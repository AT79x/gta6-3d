// Solmar Bay 3D — the four screenshot scenes. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot that follows the street grid toward its target, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame. In shot mode the world then holds still for the screenshot.
import { startMission, currentTarget } from './missions.js';
import { stepWorld } from './main.js';
import { makeCar } from './vehicles.js';
import { clamp } from './random.js';

const STEP = 1 / 60;

/** Run the world forward for `seconds`, steering with `driveFn(state)`. */
function simulate(state, seconds, driveFn) {
  state.noBust = true; // staging never busts or wastes the player
  for (let t = 0; t < seconds; t += STEP) {
    const ctrl = driveFn ? driveFn(state) : {};
    ctrl.orbitDX = 0;
    stepWorld(state, ctrl, STEP);
  }
  state.noBust = false;
  state.screen = 'playing';
  state.player.health = Math.max(state.player.health, 80);
}

/**
 * Street-grid autopilot: steer the player's car toward (tx, tz), turning at
 * intersections onto the street that closes the bigger gap first. The car is
 * "on" a street when it is within 7 m of a centreline; at an intersection it
 * is on both, and the bigger gap decides the axis.
 */
function streetAutopilot(state, tx, tz) {
  const car = state.player.car;
  if (!car) return { up: false, down: false, left: false, right: false, brake: false };
  const dx = tx - car.x;
  const dz = tz - car.z;
  if (Math.hypot(dx, dz) < 6) return { up: false, down: false, left: false, right: false, brake: true };
  const onV = Math.abs(car.x - nearestV(car.x)) < 7;
  const onH = Math.abs(car.z - nearestH(car.z)) < 7;
  let desired = Math.atan2(dx, dz);
  if (onV && !onH) {
    // On a vertical street: drive along it, or turn onto a crossing street
    // when one is just ahead and the x gap still needs closing.
    if (Math.abs(dx) > 30) {
      const nextH = nextStreetH(car.z, dz > 0 ? 1 : -1);
      if (nextH !== null && Math.abs(nextH - car.z) < 18) desired = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
      else desired = dz > 0 ? 0 : Math.PI;
    } else {
      desired = dz > 0 ? 0 : Math.PI;
    }
  } else if (onH && !onV) {
    // On a horizontal street: the mirror image.
    if (Math.abs(dz) > 30) {
      const nextV = nextStreetV(car.x, dx > 0 ? 1 : -1);
      if (nextV !== null && Math.abs(nextV - car.x) < 18) desired = dz > 0 ? 0 : Math.PI;
      else desired = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      desired = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  } else if (onV && onH) {
    // At an intersection: take the axis with the bigger gap to close.
    if (Math.abs(dx) > Math.abs(dz)) desired = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    else desired = dz > 0 ? 0 : Math.PI;
  }
  // Mid-block (e.g. after a ram) keeps the direct heading to the target.
  const diff = wrap(desired - car.heading);
  // Slow into turns so the car stays on the road instead of cutting corners
  // across blocks — but never brake to a standstill mid-turn: below 6 m/s
  // the throttle stays on, because a stopped car cannot steer at all.
  const speed = Math.abs(car.speed);
  return {
    up: Math.abs(diff) < 0.9 || speed < 6,
    down: false,
    left: diff < -0.06,
    right: diff > 0.06,
    brake: Math.abs(diff) > 0.5 && speed > 12,
  };
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

const STREETS_V = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const STREETS_H = [-180, -120, -60, 0, 60, 120, 180];

function nearestV(x) {
  let best = STREETS_V[0];
  for (let i = 1; i < STREETS_V.length; i += 1) {
    if (Math.abs(STREETS_V[i] - x) < Math.abs(best - x)) best = STREETS_V[i];
  }
  return best;
}
function nearestH(z) {
  let best = STREETS_H[0];
  for (let j = 1; j < STREETS_H.length; j += 1) {
    if (Math.abs(STREETS_H[j] - z) < Math.abs(best - z)) best = STREETS_H[j];
  }
  return best;
}
function nextStreetH(z, dir) {
  let best = null;
  for (let j = 0; j < STREETS_H.length; j += 1) {
    const d = STREETS_H[j] - z;
    if (dir > 0 && d > 0 && (best === null || d < best - z)) best = STREETS_H[j];
    if (dir < 0 && d < 0 && (best === null || d > best - z)) best = STREETS_H[j];
  }
  return best;
}
function nextStreetV(x, dir) {
  let best = null;
  for (let i = 0; i < STREETS_V.length; i += 1) {
    const d = STREETS_V[i] - x;
    if (dir > 0 && d > 0 && (best === null || d < best - x)) best = STREETS_V[i];
    if (dir < 0 && d < 0 && (best === null || d > best - x)) best = STREETS_V[i];
  }
  return best;
}

/** Put the player in a fresh car of `type` at (x, z), facing `heading`. */
function putInCar(state, type, x, z, heading) {
  const car = makeCar(type, x, z, heading);
  car.driver = 'player';
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.z = z;
  p.heading = heading;
  car.speed = 0;
  return car;
}

/**
 * Stage the named scene (start, play, chase or mission; any other name is
 * start) and set the screen the HUD should draw over it.
 */
export function stageShot(name, state) {
  const p = state.player;
  if (name === 'play') {
    state.screen = 'playing';
    putInCar(state, 'sedan', 0, -180, 0);
    // A straight run north up the central avenue, 11 seconds at speed.
    simulate(state, 11, (s) => streetAutopilot(s, 0, 180));
    return { screen: 'playing' };
  }
  if (name === 'chase') {
    state.screen = 'playing';
    putInCar(state, 'sports', -60, -150, 0);
    state.wanted = 3;
    // Flee toward the far north-east corner for 8 seconds.
    simulate(state, 8, (s) => streetAutopilot(s, 240, 180));
    // Stage the chase for the camera: two police cars right behind the
    // player's car, same heading, matching speed, lights flashing.
    const car = state.player.car;
    state.wanted = 3;
    for (let i = 0; i < 2; i += 1) {
      const back = 16 + i * 12;
      const px = car.x - Math.sin(car.heading) * back;
      const pz = car.z - Math.cos(car.heading) * back;
      const cop = makeCar('police', px, pz, car.heading);
      cop.driver = 'police';
      cop.speed = Math.max(10, Math.abs(car.speed));
      state.cars.push(cop);
      state.police.push({ car: cop, bustTimer: 0, stuckTimer: 0, ramTimer: 0 });
    }
    // A side view of the chase: the player's car with both police cars
    // visible behind it, instead of the usual rear camera (which would put
    // the police behind the camera).
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const rx = -fz;
    const rz = fx;
    state.cameraFixed = {
      eye: [car.x + rx * 26 - fx * 4, 7, car.z + rz * 26 - fz * 4],
      look: [car.x + fx * 12, 1, car.z + fz * 12],
    };
    return { screen: 'playing' };
  }
  if (name === 'mission') {
    state.screen = 'playing';
    startMission(state, 0);
    // Start in Vera's taxi at the stand, then drive the first mission's
    // objective (pickup, then the bank drop-off) for 4 seconds: mid-route,
    // the bank's beacon visible ahead down the street.
    const stand = state.world.spots.taxiStand;
    putInCar(state, 'taxi', stand.x + 4, stand.z, Math.PI / 2);
    simulate(state, 4, (s) => {
      const target = currentTarget(s);
      if (!target) return { up: true, down: false, left: false, right: false, brake: false };
      return streetAutopilot(s, target.x, target.z);
    });
    return { screen: 'playing' };
  }
  // start: the title screen over a slow, fixed vantage of downtown.
  state.screen = 'title';
  p.x = 30;
  p.z = 60;
  p.heading = Math.PI * 0.75;
  state.cameraFixed = { eye: [95, 42, 145], look: [-10, 10, -10] };
  // A few cars parked in view, traffic passing on the avenue.
  const near = makeCar('sedan', 24, 66, Math.PI / 2);
  state.cars.push(near);
  const taxi = makeCar('taxi', 36, 54, -Math.PI / 2);
  taxi.driver = 'traffic';
  taxi.tx = 60;
  taxi.tz = 54;
  state.cars.push(taxi);
  state.traffic.push(taxi);
  return { screen: 'title' };
}
