//////////////////////////////////////////////////////////////////////////////
// # UBC CPSC 314, September 2022, Assignment 1
//
// ## Authors
//
// - UBC CPSC 314 course staff (starter code)
// - Peyton Seigo
//
// ## Controls
//
// W to look up, S to look down. Hold Shift to pan slowly.
//
//////////////////////////////////////////////////////////////////////////////

//// Settings ////////////////////////////////////////////////////////////////

// Makes the stars look better!
const k_antialias = true;
const k_upsample_ratio = 1.5;

const k_star_count = 5000;

const k_move_swing = true;
const k_swing_period_seconds = 4;

const k_player_height = 1.5;

const k_camera_mode_swing = 0;
const k_camera_mode_orbit = 1;
const k_camera_mode = k_camera_mode_swing;
//const k_camera_mode = k_camera_mode_orbit;

const k_movable_star_light = false;
const k_movable_star_light_speed = 0.1;
// Controls:
//    (-z) (+y) (+z)
//      u    k    o
//   (-x) h     l (+x)
//           j
//         (-y)
const k_light_key_sub_x = "H";
const k_light_key_add_x = "L";
const k_light_key_sub_y = "J";
const k_light_key_add_y = "K";
const k_light_key_sub_z = "U";
const k_light_key_add_z = "O";

const k_draw_grid = false;
const k_grid = {x_min: -0, x_max: 20, z_min: -40, z_max: 5, label_spacing: 2};
const k_draw_grid_position_labels = true; // warning: slow

const k_draw_world_coordinate_frame = false;
//////////////////////////////////////////////////////////////////////////////


const colours = {
    red: 0xff0000,
    orange: 0xff8c00,
    yellow: 0xffff00,
    green: 0x5bef00,
    blue: 0x366cff,
    purple: 0x5d2cff,
    pink: 0xff80fd,
    laser_red: 0xec0047,
    laser_red_dark: 0xC70039,
    black: 0x000000,
    white: 0xffffff,
    tree_bark_brown: 0x6a5140,
    pine_needle_green: 0x495740,
    steel_grey: 0xb6b6b6,
    //// for overhead light ////
    yellow_shine: 0xffff8f,
    moonlight: 0xa3a3e7,
    ////////////////////////////
    default_ambience: 0x606060, // given in assignment 1 <3
    moonlight_ambience: 0x2a2a46, // 0x140e0e,//0x2a2a46, // 0x06060a,// 0x56566b,
    // moonlight_ambience: 0,
    night_sky: 0x000715,
    night_chilly_fog: 0x000b23,
};
const colour_palettes = {
    rainbow: [colours.red, colours.orange, colours.yellow, colours.green, colours.blue, colours.purple, colours.pink],
};

function random(lower, upper) {
    if (lower === upper) {
        return lower;
    }
    if (lower > upper) {
        throw new Error("random/2: `lower` must be less than or equal to `upper`");
    }
    const width = Math.abs(upper - lower);
    return Math.random() * width + lower;
}

function THREE_Vector3_to_string(v) {
    return `#< <${v.x}, ${v.y}, ${v.z}> >`;
}

function main() {
    const clock = new THREE.Clock();

// SETUP RENDERER & SCENE
    const assets_path = "./assets/";
    const canvas = document.getElementById("canvas");
    const scene = new THREE.Scene();

    // antialiasing: https://stackoverflow.com/a/4404530
    const renderer = new THREE.WebGLRenderer({antialias: k_antialias});
    renderer.setPixelRatio(window.devicePixelRatio * k_upsample_ratio);

    // scene.fog = new THREE.Fog(0x000000, 250, 1400);
    // scene.fog = new THREE.Fog(colours.night_chilly_fog, 1, 500);
    // scene.fog = new THREE.Fog(colours.night_chilly_fog, 1, 1200);
    renderer.setClearColor(colours.night_sky); // Background colour
    canvas.appendChild(renderer.domElement);

// SETUP CAMERA
    {
        // const view_angle = 30;
        const view_angle = 60;
        const aspect_ratio = 1;
        const near = 0.1;
        const far = 2000;
        var camera = new THREE.PerspectiveCamera(view_angle, aspect_ratio, near, far);

        switch (k_camera_mode) {
            case k_camera_mode_swing: {
                camera.position.set(0, 1 + k_player_height, 0);
                camera.lookAt(0, 8, -5);
                break;
            }
            case k_camera_mode_orbit: {
                // camera.position.set(0, 12, 20); // default
                camera.position.set(0, 5, 15);
                // camera.lookAt(0, 10, 0); // doesn't seem to do anything with orbit controls on

                const controls = new THREE.OrbitControls(camera);
                controls.damping = 0.2;
                controls.autoRotate = false;
                controls.target = new THREE.Vector3(0, 2, 0);
                controls.update();
                break;
            }
            default:
                throw new Error(`(camera setup): invalid camera mode '${k_camera_mode}'`);
        }

        scene.add(camera);
    }

// ADAPT TO WINDOW RESIZE
    function resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }

// EVENT LISTENER RESIZE
    window.addEventListener("resize", resize);
    resize();

//SCROLLBAR FUNCTION DISABLE
    window.onscroll = function () {
        window.scrollTo(0, 0);
    }

//KEYBOARD
    const keyboard = new THREEx.KeyboardState();

    const max_camera_speed = 0.073;
    const camera_acceleration = max_camera_speed * 1.9;
    const camera_acceleration_timeout_ms = 0.2;

    let is_camera_rotating = false;
    let camera_speed = 0;
    let time_ms_camera_last_moved_at = 0;

    function process_input(delta) {
        // camera controls
        {
            // INVARIANT: min <= camera.rotation.x <= max
            const dx = 0.02, max = 1.22, min = -0.75;

            const now = clock.getElapsedTime();
            if (is_camera_rotating && (now - time_ms_camera_last_moved_at) >= camera_acceleration_timeout_ms) {
                is_camera_rotating = false;
            }

            const look_up = keyboard.pressed("W") && camera.rotation.x <= max;
            const look_down = keyboard.pressed("S") && camera.rotation.x >= min;

            if (look_up || look_down) {
                // Start accelerating
                if (!is_camera_rotating) {
                    is_camera_rotating = true;
                    camera_speed = dx;
                }

                // Enforce speed limit
                if (camera_speed < max_camera_speed) {
                    camera_speed = Math.min(max_camera_speed, camera_speed + camera_acceleration * delta);
                }
                time_ms_camera_last_moved_at = now;

                // Slow mode
                let speed = camera_speed;
                if (keyboard.pressed("shift")) {
                    // camera_speed *= 0.25;
                    speed *= 0.04;
                }

                // console.log(" ");
                // console.log(`rotating at ${camera_speed} rad/s`);

                // Rotate
                if (look_up) {
                    const gap = max - camera.rotation.x;
                    const dr = Math.min(gap, speed);
                    camera.rotateX(dr);
                } else { // if (look_down)
                    const gap = camera.rotation.x - min;
                    const dr = Math.min(gap, speed);
                    camera.rotateX(-dr);
                }

                // console.log(`new camera rotation: ${camera.rotation.x}`);
                // console.log(" ");
            }
        }

        if (k_movable_star_light) {
            const speed = k_movable_star_light_speed;
            const x = {min: -100, max: 100};
            const y = {min: -100, max: 100};

            // x-axis
            if (keyboard.pressed(k_light_key_add_x) && star_light.position.x < x.max) {
                star_light.position.x = Math.min(x.max, star_light.position.x + speed);
            } else if (keyboard.pressed(k_light_key_sub_x) && star_light.position.x > x.min) {
                star_light.position.x = Math.max(x.min, star_light.position.x - speed);
            }

            // y-axis
            if (keyboard.pressed(k_light_key_add_y) && star_light.position.y < y.max) {
                star_light.position.y = Math.min(y.max, star_light.position.y + speed);
            } else if (keyboard.pressed(k_light_key_sub_y) && star_light.position.y > y.min) {
                star_light.position.y = Math.max(y.min, star_light.position.y - speed);
            }

            // z-axis
            if (keyboard.pressed(k_light_key_add_z)) {
                star_light.position.z += speed;
            } else if (keyboard.pressed(k_light_key_sub_z)) {
                star_light.position.z -= speed;
            }

            // log position
            if (keyboard.pressed("P")) {
                console.log(`camera position: (${star_light.position.x}, ${star_light.position.y}, ${star_light.position.z})`);
            }

            light_sphere.position.set(star_light.position.x, star_light.position.y, star_light.position.z);
        }
    }

//LOOP
    /**
     * @type {{context: any, tick: function(delta_time: float, context: any)}[]}
     */
    const updatables = [];

    function tick(delta) {
        for (let updatable of updatables) {
            updatable.tick(delta, updatable.context);
        }
    }

    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta();
        process_input(delta);
        tick(delta);
        renderer.render(scene, camera);
    });

//HELPERS (the ones that need setup to be done)
    function create_pillar_with_colour(thickness, height, colour) {
        const width = thickness;
        const depth = thickness;
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshLambertMaterial({color: colour});
        return new THREE.Mesh(geometry, material);
    }

    /**
     * @param heights{number[]}
     * @param position{THREE.Vector3}
     * @param pillar_thickness{number}
     * @param colour_palette{number[]}
     */
    function place_debug_pillars(heights, position, pillar_thickness = 0.25, colour_palette = colour_palettes.rainbow) {
        const num_colours = colour_palette.length;

        let colour_index = 0;
        const pillar_pairs = [];

        for (let height of heights) {
            pillar_pairs.push({
                pillar: create_pillar_with_colour(pillar_thickness, height, colour_palette[colour_index]),
                height: height
            });

            colour_index++;
            colour_index %= num_colours;
        }

        do_place_debug_pillars(pillar_pairs, position);
    }

    /**
     *
     * @param pillars{[{height: number, pillar: THREE.Object3}]}
     * @param position{THREE.Vector3}
     */
    function do_place_debug_pillars(pillars, position) {
        let y = position.y;
        for (let {height, pillar} of pillars) {
            pillar.position.x = position.x;
            pillar.position.z = position.z;
            pillar.position.y = height / 2 + y;
            scene.add(pillar);
            y += height;
        }
    }

//SHADER SETUP
    // TODO what is this ?
    {
        const ctx = renderer.context;
        ctx.getShaderInfoLog = function () {
            return "";
        };   // stops shader warnings, seen in some browsers
    }


//// LIGHTING  ///////////////////////////////////////////////////////////////

    const star_light = new THREE.PointLight(colours.moonlight);
    // light.position.set(0, 8, -9); // nice n close
    star_light.position.set(0, 44, -35); // high in the sky!
    star_light.intensity = 0.42;
    scene.add(star_light);

    {
        // const ambientLight = new THREE.AmbientLight(colours.moonlight_ambience);
        // scene.add(ambientLight);

        const hemisphere_light = new THREE.HemisphereLight(colours.moonlight, colours.moonlight_ambience, 0.12);
        scene.add(hemisphere_light);
    }


//// WORLD COORDINATE FRAME //////////////////////////////////////////////////

    if (k_draw_world_coordinate_frame) {
        const world_frame = new THREE.AxesHelper(5);
        scene.add(world_frame);
    }


//// FLOOR ///////////////////////////////////////////////////////////////////

    {
        const material = new THREE.MeshBasicMaterial({color: 0x060504});
        const geometry = new THREE.PlaneBufferGeometry(100, 100);
        const floor = new THREE.Mesh(geometry, material);
        floor.position.y = 0;
        floor.rotation.x = (-1) * Math.PI / 2;
        scene.add(floor);
    }


//// SPHERE, REPRESENTING THE LIGHT //////////////////////////////////////////

    if (k_movable_star_light) {
        const radius = 0.3;
        const segments = 32;
        const geometry = new THREE.SphereGeometry(radius, segments);    // radius, segments, segments
        const material = new THREE.MeshBasicMaterial({color: 0xffff00});
        var light_sphere = new THREE.Mesh(geometry, material);
        light_sphere.position.set(0, 4, 2);
        light_sphere.position.set(star_light.position.x, star_light.position.y, star_light.position.z);
        scene.add(light_sphere);
    }

    {
        /**
         * @returns {THREE.Mesh}
         */
        function create_sphere() {
            const radius = 0.07;
            const segments = 2;
            const geometry = new THREE.SphereGeometry(radius, segments, segments);
            const material = new THREE.MeshBasicMaterial({color: colours.laser_red});
            return new THREE.Mesh(geometry, material);
        }

        /**
         * @returns {THREE.Mesh}
         */
        function create_label(text, font) {
            const geometry = new THREE.TextGeometry(text, {
                font: font,
                size: 0.1,
                height: 0.005,
                curveSegments: 1,
                // bevelThickness: bevelThickness,
                // bevelSize: bevelSize,
                // bevelEnabled: bevelEnabled,
            });
            const material = new THREE.MeshBasicMaterial({color: colours.white});
            return new THREE.Mesh(geometry, material);
        }

        function load_font(name, weight, onLoad) {
            return new THREE.FontLoader().load(
                assets_path + "fonts/" + name + "_" + weight + ".typeface.json",
                onLoad);
        }

        if (k_draw_grid) {
            load_font("helvetiker", "regular", (font) => {
                for (let j = k_grid.z_min; j <= k_grid.z_max; j++) {
                    for (let i = k_grid.x_min; i <= k_grid.x_max; i++) {
                        const sphere = create_sphere();
                        sphere.position.set(i, 0, j);
                        scene.add(sphere);

                        if (k_draw_grid_position_labels
                            && i % k_grid.label_spacing === 0
                            && j % k_grid.label_spacing === 0) {
                            const label = create_label(`P(${i}, 0, ${j})`, font);
                            label.position.set(i, 0, j);
                            label.rotation.x = (-1) * Math.PI / 2;
                            scene.add(label);
                        }
                    }
                }
            });
        }
    }


//// STARS ///////////////////////////////////////////////////////////////////

    /**
     * @type {THREE.Object3D[]}
     */
    const stars = [];
    {
        /**
         * @returns {THREE.Mesh}
         */
        function create_star() {
            // const radius = random(0.2, 0.5);
            const radius = Math.pow(random(1.45, 1.87), 3) / 6;
            const segments = 1;
            const geometry = new THREE.SphereGeometry(radius, segments, segments);
            const material = new THREE.MeshBasicMaterial({color: 0xe0e6e7});
            const mesh = new THREE.Mesh(geometry, material);

            // Random starting rotation
            mesh.rotation.x = random(0, Math.PI / 2);
            mesh.rotation.y = random(0, Math.PI / 2);
            mesh.rotation.z = random(0, Math.PI / 2);

            // const rotation_per_second = random(0.3, 1)/10;
            // updatables.push({
            //     context: mesh, tick: (delta, star) => {
            //         star.rotation.x += rotation_per_second * delta;
            //         star.rotation.y += rotation_per_second * delta;
            //         star.rotation.z += rotation_per_second * delta;
            //     }
            // });

            return mesh;
        }

        let stars_created = 0;
        let stars_discarded = 0;
        while (stars_created < k_star_count) {
            // Linear
            // const y_intersect = 200;
            // const slope = 1.3;
            // const y_variance = random(60, 70);
            // const y = (slope * z) + y_intersect + y_variance;
            // const x = random(-y_intersect * 1.7, y_intersect * 1.7);
            // const z = random(-y_intersect, 50);

            // Quadratic
            const min = -800;
            const max = 300;
            const buffer = 400;
            const width = max - min;
            const buffered_width = width + buffer;

            const generate = () =>
                random(0, 1) * buffered_width;

            const map_value = (old_value, old_min, old_max, new_min, new_max) =>
                (old_value - old_min) / (old_max - old_min) * new_max + new_min;

            const balance = (z, fun) =>
                z * fun(z) + min;

            const z = balance(generate(), (z) => {
                const log_value = map_value(z, min, max, 2, 24);
                return Math.pow(random(0.8, 1), Math.log2(log_value));
            });

            if (z > max || z < min) {
                stars_discarded++;
                continue;
            }

            // console.log(`mapped ${z_vanilla} to ${z}`);

            const b = 980;
            const y_variance = random(0, 2);
            const y = -0.9 * Math.pow(1 / 50 * z - 15, 2) + b + y_variance;

            const x_radius = 620 * 1.7;
            const x = random(-x_radius, x_radius);
            // const x = (stars_created % x_radius * 2) - x_radius;

            const star = create_star();
            star.position.set(x, y, z);
            stars.push(star);
            stars_created++;
        }

        console.log(`Finished creating ${k_star_count} stars (${stars_discarded} were discarded during generation because they were out of bounds; ${(((k_star_count + stars_discarded) / k_star_count - 1) * 100).toPrecision(2)}% waste).`);

        function draw_stars() {
            for (let star of stars) {
                scene.add(star);
                // console.log(`A star appeared at (${star.position.x}, ${star.position.y}, ${star.position.z})!`);
            }
        }

        draw_stars();
    }


//// SWING ///////////////////////////////////////////////////////////////////

    // TODO Refactor swing; so much hard-coding and global meddling
    {
        function create_pillar(thickness, height) {
            const width = thickness;
            const depth = thickness;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({color: colours.tree_bark_brown});
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }

        function create_crossbar(thickness, length) {
            const width = length;
            const height = thickness;
            const depth = thickness;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({color: colours.tree_bark_brown});
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }

        function create_seat_chain(thickness, length) {
            const width = thickness;
            const height = length;
            const depth = thickness;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({color: colours.steel_grey});
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }

        const log_thickness = 0.25;
        const crossbar_length = 5;
        const pillar_height = 5;
        let swing_position = new THREE.Vector3(0, 0, 0); // TODO use this

        const pillar_1 = create_pillar(log_thickness, pillar_height);
        pillar_1.position.set(-(crossbar_length / 2), pillar_height / 2, 0);

        const pillar_2 = create_pillar(log_thickness, pillar_height);
        pillar_2.position.set(crossbar_length / 2, pillar_height / 2, 0);

        const crossbar = create_crossbar(log_thickness, crossbar_length + log_thickness);
        crossbar.position.set(0, pillar_height + log_thickness / 2, 0);

        var swing_pivot_midpoint = new THREE.Vector3(swing_position.x, swing_position.y + pillar_height, swing_position.z);
        var seat_starting_position = new THREE.Vector3(0, 1, 0);
        var seat_height = 0.02;
        var seat_depth = 0.5;
        var seat_width = 0.865;
        var dist_crossbar_bottom_to_seat_top = pillar_height - seat_starting_position.y - seat_height / 2;

        // debugging
        {
            // const debug_pillars = [];
            // {
            //     const heights = [
            //         seat_starting_position.y,
            //         seat_height / 2,
            //         seat_height / 2,
            //         dist_crossbar_bottom_to_seat_top
            //     ];
            //
            //     let colour = 0;
            //     const num_colours = colour_palettes.rainbow.length;
            //     for (let height of heights) {
            //         debug_pillars.push({
            //             pillar: create_pillar_with_colour(log_thickness, height, colour_palettes.rainbow[colour]),
            //             height: height
            //         });
            //
            //         colour++;
            //         colour %= num_colours;
            //     }
            // }

            // place_debug_pillars([
            //         seat_starting_position.y,
            //         seat_height / 2,
            //         seat_height / 2,
            //         dist_crossbar_bottom_to_seat_top
            //     ], new THREE.Vector3(-1.4, 0, 0));
            //
            // place_debug_pillars(
            //     [dist_crossbar_bottom_to_seat_top],
            //     new THREE.Vector3(-1, seat_starting_position.y + seat_height / 2, 0));

            /*
            place_debug_pillars(debug_pillars, new THREE.Vector3(-1.4, 0, 0));
            place_debug_pillars([{
                    height: dist_crossbar_bottom_to_seat_top,
                    pillar: create_pillar_with_colour(log_thickness, dist_crossbar_bottom_to_seat_top, colours.pink)
                }],
                new THREE.Vector3(-1, seat_starting_position.y + seat_height / 2, 0));
             */
        }

        const seat_chain_thickness = 0.02;
        const chain_length = dist_crossbar_bottom_to_seat_top;
        const chain_position_y = dist_crossbar_bottom_to_seat_top / 2 + seat_starting_position.y + seat_height / 2;

        var seat_chain_1 = create_seat_chain(seat_chain_thickness, chain_length)
        seat_chain_1.position.set(-(seat_width / 2 - seat_chain_thickness / 2), chain_position_y, 0);

        var seat_chain_2 = create_seat_chain(seat_chain_thickness, chain_length)
        seat_chain_2.position.set(-seat_chain_1.position.x, chain_position_y, 0);

        scene.add(pillar_1);
        scene.add(pillar_2);
        scene.add(crossbar);
        scene.add(seat_chain_1);
        scene.add(seat_chain_2);
    }


//// PENDULUM ////////////////////////////////////////////////////////////////

    {
        /**
         * @returns {THREE.Mesh}
         */
        function create_pivot_marker() {
            const radius = 0.07;
            const segments = 2;
            const geometry = new THREE.SphereGeometry(radius, segments, segments);
            const material = new THREE.MeshLambertMaterial({color: colours.laser_red});
            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
        }

        // Rotate pendulum about pivot point
        const pivot = swing_pivot_midpoint;

        // const pivot_marker = create_pivot_marker();
        // pivot_marker.position.set(pivot.x, pivot.y, pivot.z);
        // scene.add(pivot_marker);

        const swing_mid_dist_from_ground = 1;
        // const pendulum_dist = swing_position.distanceTo(swing_pivot_midpoint) - swing_mid_dist_from_ground;
        const pendulum_dist = dist_crossbar_bottom_to_seat_top + seat_height / 2;

        // const pendulum_start = new THREE.Vector3(pivot.x, pivot.y - pendulum_dist, pivot.z);
        const pendulum_start = seat_starting_position; // temp, to make sure things are consistent while i'm debugging

        /**
         * @param pendulum{THREE.Object3D}
         * @param radians{number}
         */
        function set_pendulum_rotation(pendulum, radians) {
            pendulum.position.set(pivot.x, pivot.y, pivot.z);
            pendulum.rotation.x = 0;
            pendulum.rotateX((-1) * radians);
            pendulum.translateOnAxis(new THREE.Vector3(0, -1, 0), pendulum_dist);
        }

        /**
         * @param chain{THREE.Object3D}
         * @param radians{number}
         */
        function set_chain_rotation(chain, radians) {
            chain.position.set(chain.position.x, pivot.y, pivot.z);
            chain.rotation.x = 0;
            chain.rotateX((-1) * radians);
            chain.translateOnAxis(new THREE.Vector3(0, -1, 0), dist_crossbar_bottom_to_seat_top / 2);
        }

        /**
         * @returns {THREE.Mesh}
         */
        function create_pendulum({width, height, depth, colour}) {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({color: colour});
            const mesh = new THREE.Mesh(geometry, material);

            let t = 0;
            if (k_move_swing) {
                updatables.push({
                    context: mesh, tick: (delta, pendulum) => {
                        t += delta;

                        // https://en.wikipedia.org/wiki/Pendulum
                        const angle = Math.cos(2 * Math.PI / k_swing_period_seconds * t);
                        // console.log(`time t = ${t.toFixed(3)}; angle Θ = ${angle.toFixed(3)}`);

                        // Move seat
                        set_pendulum_rotation(pendulum, angle);

                        // Move chains
                        set_chain_rotation(seat_chain_1, angle);
                        set_chain_rotation(seat_chain_2, angle);

                        // Move camera
                        if (k_camera_mode === k_camera_mode_swing) {
                            const pendulum_pos_world = new THREE.Vector3(0, 0, 0);
                            pendulum.getWorldPosition(pendulum_pos_world);
                            camera.position.set(pendulum_pos_world.x, pendulum_pos_world.y + k_player_height, pendulum_pos_world.z + 0.28);
                            // camera.lookAt(0, 1.3, 0);
                        }
                    }
                });
            }

            return mesh;
        }

        const pendulum = create_pendulum({
            width: seat_width,
            height: seat_height,
            depth: seat_depth,
            colour: colours.tree_bark_brown
        });
        pendulum.position.set(0, swing_mid_dist_from_ground, 0);
        scene.add(pendulum);

        // debugging
        // setTimeout(() => set_rotation(pendulum, Math.PI/6), 2000);
        // setTimeout(() => set_rotation(pendulum, Math.PI/3), 20000);
        // setTimeout(() => set_rotation(pendulum, Math.PI/3), 30000);
        // setTimeout(() => set_rotation(pendulum, (-1) * Math.PI/3), 10000);
        // set_rotation(pendulum, 1);
    }


//// TREES ///////////////////////////////////////////////////////////////////

    {
        function place_tree(tree, y_displacement, options) {
            if (options.scale) {
                const scale = options.scale;
                const scale_vector = new THREE.Vector3(scale, scale, scale);
                const scale_matrix = new THREE.Matrix4();
                scale_matrix.scale(scale_vector);
                tree.applyMatrix(scale_matrix);
                tree.updateMatrix();
                y_displacement *= scale;
            }
            if (options.position) {
                const position = options.position;
                tree.position.set(position.x, position.y + y_displacement, position.z);
            }

            // place_debug_pillars([tree_height/2, tree_height/2], new THREE.Vector3(tree.position.x + 1, position.y - tree_height/2, tree.position.z));
            // const bounding_box = new THREE.Box3Helper(bounding_box_math);
            // bounding_box.position.set(position.x, position.y + y_displacement, position.z);
            // console.log(`bounding_box.position.y: ${bounding_box.position.y}`);
            // scene.add(bounding_box);

            scene.add(tree);
        }

        function place_trees(tree_prototype) {
            // Get y displacement (madness) because the tree's position is not
            // actually in the center but like the center of mass or something
            // (I could fix this in Blender if that's the case?)
            const bounding_box_math = new THREE.Box3().setFromObject(tree_prototype, true);

            const bounding_box_center = new THREE.Vector3(0, 0, 0);
            bounding_box_math.getCenter(bounding_box_center);

            const bounding_box_size = new THREE.Vector3(0, 0, 0);
            bounding_box_math.getSize(bounding_box_size);
            const height = bounding_box_size.y;

            const y_displacement = height / 2 - bounding_box_center.y;

            const metadata = [
                // in front
                {position: new THREE.Vector3(-4, 0, -9), scale: 2.5}, // big friend
                {position: new THREE.Vector3(3.62, 0, -8), scale: 1.6},
                {position: new THREE.Vector3(1, 0, -6), scale: 1},
                {position: new THREE.Vector3(-2, 0, -5), scale: 0.9},
                {position: new THREE.Vector3(-0.7, 0, -8), scale: 1.2},
                {position: new THREE.Vector3(-4, 0, -4), scale: 1.18},
                {position: new THREE.Vector3(-6.5, 0, -6), scale: 1.3},
                {position: new THREE.Vector3(5, 0, -4.5), scale: 1.3},
                {position: new THREE.Vector3(2.8, 0, -5), scale: 0.8},

                // party in back
                {position: new THREE.Vector3(3, 0, -10), scale: 1.4},
                {position: new THREE.Vector3(0.7, 0, -12), scale: 1.3},
                {position: new THREE.Vector3(-1.8, 0, -12.5), scale: 1},
                {position: new THREE.Vector3(3, 0, -15), scale: 2.7},
                {position: new THREE.Vector3(-3.4, 0, -16), scale: 2.1},
                {position: new THREE.Vector3(-6.5, 0, -17.5), scale: 0.7},
                // {position: new THREE.Vector3(-7, 0, -19), scale: 0.9},
                {position: new THREE.Vector3(-10, 0, -20), scale: 1.3},
                {position: new THREE.Vector3(0, 0, -21.5), scale: 3},
                // {position: new THREE.Vector3(-7, 0, -21), scale: 0.9},
                {position: new THREE.Vector3(-2.1, 0, -27), scale: 3.1},
                {position: new THREE.Vector3(4.3, 0, -32), scale: 3.6},
                {position: new THREE.Vector3(-10, 0, -30), scale: 3.91},
                {position: new THREE.Vector3(-9.1, 0, -41), scale: 4.2},
                {position: new THREE.Vector3(4.2, 0, -39), scale: 3.8},
                {position: new THREE.Vector3(-4.3, 0, -42), scale: 4.3},

                // left side
                {position: new THREE.Vector3(-9, 0, -14), scale: 2.9},
                {position: new THREE.Vector3(-9, 0, -9), scale: 1.6},
                {position: new THREE.Vector3(-9, 0, -5.4), scale: 1.7},
                {position: new THREE.Vector3(-12, 0, -10), scale: 1.3},
                {position: new THREE.Vector3(-13, 0, -7), scale: 1.7},
                {position: new THREE.Vector3(-14, 0, -11), scale: 1.3},
                {position: new THREE.Vector3(-14, 0, -14), scale: 1.4},
                {position: new THREE.Vector3(-18, 0, -18), scale: 2.8},
                {position: new THREE.Vector3(-21, 0, -13), scale: 2.5},
                {position: new THREE.Vector3(-19, 0, -13), scale: 3.2},
                {position: new THREE.Vector3(-14, 0, -20), scale: 3.6},
                {position: new THREE.Vector3(-18, 0, -30), scale: 4.5},
                {position: new THREE.Vector3(-28, 0, -35), scale: 4.5},

                // right side
                {position: new THREE.Vector3(6, 0, -2), scale: 0.6},
                {position: new THREE.Vector3(4.5, 0, -2.5), scale: 0.4},
                {position: new THREE.Vector3(8, 0, -10), scale: 2.9},
                {position: new THREE.Vector3(8.5, 0, -5), scale: 1.7},
                {position: new THREE.Vector3(9, 0, -2), scale: 2.4},
                {position: new THREE.Vector3(15, 0, -6), scale: 2.8},
                {position: new THREE.Vector3(16, 0, -14), scale: 3.4},
                {position: new THREE.Vector3(12, 0, -18), scale: 3.1},
                {position: new THREE.Vector3(10, 0, -18), scale: 4.4},
                {position: new THREE.Vector3(16, 0, -22), scale: 4.2},
                {position: new THREE.Vector3(10, 0, -25), scale: 4.2},
            ];

            for (let options of metadata) {
                place_tree(tree_prototype.clone(), y_displacement, options);
            }
        }

        const manager = new THREE.LoadingManager();
        manager.onProgress = function (item, loaded, total) {
            console.log(item, loaded, total);
        };

        const on_progress = function (xhr) {
            if (xhr.lengthComputable) {
                const percent_complete = xhr.loaded / xhr.total * 100;
                console.log(Math.round(percent_complete, 2) + "% downloaded");
            }
        };

        const on_error = function (asset_type, xhr) {
            console.error(`Failed to load ${asset_type}.`);
            console.error(xhr);
        };

        const mtl_loader = new THREE.MTLLoader();
        mtl_loader.setPath(assets_path + "objects/");
        mtl_loader.setResourcePath(assets_path + "objects/");
        mtl_loader.setMaterialOptions({});

        // (1) Load material(s)
        mtl_loader.load("lowpolytree.mtl", (material_creator) => {
            const obj_loader = new THREE.OBJLoader(manager);
            obj_loader.setPath(assets_path + "objects/");

            // (2) Load object
            obj_loader.setMaterials(material_creator);
            obj_loader.load("lowpolytree.obj", (tree) => {
                // idk how to make the trees not shiny :(
                // TODO preserve colours from lowpolytree.mtl but use Lambertian light scattering

                const lambert = new THREE.MeshLambertMaterial({color: colours.pine_needle_green});

                tree.traverse(function (child) {
                    // console.log("found child!");
                    if (child instanceof THREE.Mesh) {
                        // console.log("child is a mesh!");
                        child.material = lambert;
                    }
                });

                // (3) Place object(s)
                place_trees(tree);

            }, on_progress, (xhr) => on_error("object", xhr));
        }, on_progress, (xhr) => on_error("material", xhr));
    }
}

export default main;
