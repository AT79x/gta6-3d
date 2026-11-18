// Solmar Bay 3D — cars: arcade physics on the ground plane, entering and
// exiting, stealing, and the player-car collision rules. A car is just a
// heading, a speed and a type; the renderer draws the body from the type.
import { CAR_TYPES } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { hitsBuilding } from './world.js';

let nextCarId = 1;

export function makeCar(type, x, z, heading) {
  const def = CAR_TYPES[type];
  return {
    id: nextCarId,
    type,
    name: def.name,
    x,
    z,
    heading,
    speed: 0,
    color: def.color,
    length: def.length,
    width: def.width,
    height: def.height,
    maxSpeed: def.maxSpeed,
    accel: def.accel,
    turn: def.turn,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    stuckTimer: 0,
  };
}

/**
 * Advance one car a step under arcade physics. `ctrl` is
 * {up, down, left, right, brake}: throttle, reverse, steering, handbrake.
 * Buildings stop the car axis by axis, so it slides along walls.
 */
export function stepCar(world, car, ctrl, dt) {
  const def = CAR_TYPES[car.type];
  if (ctrl.up) car.speed += def.accel * dt;
  if (ctrl.down) car.speed -= def.accel * 0.9 * dt;
  if (!ctrl.up && !ctrl.down) {
    // Rolling drag when neither pedal is pressed.
    car.speed -= car.speed * 0.6 * dt;
    if (Math.abs(car.speed) < 0.05) car.speed = 0;
  }
  if (ctrl.brake) car.speed -= car.speed * 3.2 * dt;
  car.speed = clamp(car.speed, -9, def.maxSpeed);

  // Heading is atan2(dx, dz): 0 is +z (north), PI/2 is +x (east). Turning
  // right (D) increases the heading, turning left (A) decreases it.
  const steer = (ctrl.right ? 1 : 0) - (ctrl.left ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / 9, 0, 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.heading += steer * def.turn * speedFactor * dir * dt;
  car.heading = wrapAngle(car.heading);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const r = Math.max(car.length, car.width) / 2 - 0.3;
  if (!hitsBuilding(world, nx, car.z, r)) {
    car.x = nx;
  } else {
    car.speed *= 0.4; // bumped a wall
  }
  if (!hitsBuilding(world, car.x, nz, r)) {
    car.z = nz;
  } else {
    car.speed *= 0.4;
  }
  car.x = clamp(car.x, -252, 252);
  car.z = clamp(car.z, -192, 192);
}

/** The nearest car to (x, z) within `maxDist`, or null. */
export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Put the player in a car (stealing a driven one raises the wanted level). */
export function enterCar(state, car) {
  const player = state.player;
  if (car.driver === 'traffic') {
    // The driver bails out and runs; stealing a driven car is a crime.
    spawnFleeingDriver(state, car);
    car.driver = null;
    state.events.push({ type: 'steal' });
  } else if (car.driver === 'police') {
    return false; // you cannot steal a police car while its officer watches
  }
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  return true;
}

/** Step out of the car beside it. */
export function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  player.car = null;
  player.onFoot = true;
  // Step out on the driver's side, clear of the body.
  player.x = car.x - Math.cos(car.heading) * 2.2;
  player.z = car.z + Math.sin(car.heading) * 2.2;
  player.heading = car.heading;
}

// A stolen car's driver runs away on foot and is gone in a few seconds.
function spawnFleeingDriver(state, car) {
  state.peds.push({
    x: car.x + 2,
    z: car.z + 2,
    heading: car.heading + Math.PI,
    speed: 4.5,
    color: [0.2, 0.3, 0.9],
    fall: 0,
    flee: true,
    fleeTimer: 5,
    tx: car.x + 40,
    tz: car.z + 40,
  });
}
