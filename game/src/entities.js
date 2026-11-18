// Solmar Bay 3D — the living city: pedestrians on the sidewalks, traffic cars
// following the street grid, and the police who chase the player when the
// wanted level rises. All of it runs on the same ground plane as the player.
import { CAR_TYPES, PED_COLORS, STREETS_H, STREETS_V } from './config.js';
import { clamp, int, pick, range, wrapAngle } from './random.js';
import { makeCar, stepCar } from './vehicles.js';
import { hitsBuilding, nearestStreetH, nearestStreetV, randomIntersection, randomStreetPoint } from './world.js';

/** Spawn the opening population: peds, parked cars and traffic. */
export function spawnPopulation(state) {
  const rng = state.rng;
  for (let i = 0; i < 26; i += 1) {
    const p = randomStreetPoint(rng);
    state.peds.push(makePed(state, p.x, p.z));
  }
  const parkedTypes = ['sedan', 'sedan', 'taxi', 'van', 'sports', 'sedan'];
  for (let i = 0; i < 10; i += 1) {
    const p = randomStreetPoint(rng);
    const type = pick(rng, parkedTypes);
    const heading = rng() < 0.5 ? 0 : Math.PI / 2;
    const car = makeCar(type, p.x, p.z, heading);
    car.driver = null;
    state.cars.push(car);
  }
  for (let i = 0; i < 12; i += 1) {
    spawnTrafficCar(state);
  }
}

export function makePed(state, x, z) {
  const rng = state.rng;
  const target = randomIntersection(rng);
  return {
    x,
    z,
    heading: rng() * Math.PI * 2,
    speed: range(rng, 1.1, 2.0),
    color: pick(rng, PED_COLORS),
    fall: 0, // seconds left lying on the ground after being hit
    flee: false,
    fleeTimer: 0,
    tx: target.x,
    tz: target.z,
  };
}

/** A traffic car that drives from intersection to intersection. */
export function spawnTrafficCar(state) {
  const rng = state.rng;
  const from = randomIntersection(rng);
  const to = randomIntersection(rng);
  const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports']);
  const car = makeCar(type, from.x + range(rng, -2, 2), from.z + range(rng, -2, 2), 0);
  car.driver = 'traffic';
  car.speed = range(rng, 9, 14);
  car.tx = to.x;
  car.tz = to.z;
  car.heading = Math.atan2(to.x - car.x, to.z - car.z);
  state.cars.push(car);
  state.traffic.push(car);
}

/** Steer a car toward (tx, tz) along the streets; returns a control object. */
export function driveToward(car, tx, tz) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 4) return { up: false, down: false, left: false, right: false, brake: true };
  const desired = Math.atan2(dx, dz);
  const diff = wrapAngle(desired - car.heading);
  return {
    up: true,
    down: false,
    left: diff < -0.06,
    right: diff > 0.06,
    brake: Math.abs(diff) > 1.1,
  };
}

export function updatePeds(state, dt) {
  const peds = state.peds;
  for (let i = peds.length - 1; i >= 0; i -= 1) {
    const ped = peds[i];
    if (ped.fall > 0) {
      ped.fall -= dt;
      if (ped.fall <= 0 && ped.flee) peds.splice(i, 1);
      continue;
    }
    if (ped.flee) {
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        peds.splice(i, 1);
        continue;
      }
    }
    const dx = ped.tx - ped.x;
    const dz = ped.tz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      const next = randomIntersection(state.rng);
      ped.tx = next.x;
      ped.tz = next.z;
      continue;
    }
    const desired = Math.atan2(dx, dz);
    ped.heading += wrapAngle(desired - ped.heading) * Math.min(1, 6 * dt);
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
  }
}

export function updateTraffic(state, dt) {
  for (let i = 0; i < state.traffic.length; i += 1) {
    const car = state.traffic[i];
    const dx = car.tx - car.x;
    const dz = car.tz - car.z;
    if (Math.hypot(dx, dz) < 5) {
      const next = randomIntersection(state.rng);
      car.tx = next.x;
      car.tz = next.z;
    }
    stepCar(state.world, car, driveToward(car, car.tx, car.tz), dt);
    // Keep traffic moving: a car stuck against a building picks a new route.
    if (Math.abs(car.speed) < 0.5) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 3) {
        const next = randomIntersection(state.rng);
        car.tx = next.x;
        car.tz = next.z;
        car.stuckTimer = 0;
      }
    } else {
      car.stuckTimer = 0;
    }
  }
}

/** How many police cars the wanted level calls for. */
export function policeWanted(state) {
  return state.wanted;
}

/** Spawn police cars until the count matches the wanted level. */
export function maintainPolice(state) {
  const want = policeWanted(state);
  while (state.police.length < want) {
    const p = state.player;
    const angle = state.rng() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 70, -240, 240);
    const z = clamp(p.z + Math.sin(angle) * 70, -180, 180);
    const sx = nearestStreetV(x);
    const sz = nearestStreetH(z);
    const car = makeCar('police', Math.abs(x - sx) < Math.abs(z - sz) ? sx : x, Math.abs(x - sx) < Math.abs(z - sz) ? z : sz, 0);
    car.driver = 'police';
    car.speed = 20;
    state.cars.push(car);
    state.police.push({ car, bustTimer: 0, stuckTimer: 0, ramTimer: 0 });
  }
  while (state.police.length > want) {
    const gone = state.police.pop();
    const idx = state.cars.indexOf(gone.car);
    if (idx >= 0) state.cars.splice(idx, 1);
  }
  // Foot police join the chase when the player is on foot and wanted.
  if (state.wanted >= 2 && !state.player.car && state.footPolice.length < 2) {
    const p = state.player;
    const angle = state.rng() * Math.PI * 2;
    state.footPolice.push({
      x: p.x + Math.cos(angle) * 30,
      z: p.z + Math.sin(angle) * 30,
      heading: 0,
      speed: 5.2,
      catchTimer: 0,
    });
  }
  if (state.wanted === 0) state.footPolice.length = 0;
}

export function updatePolice(state, dt) {
  const p = state.player;
  for (let i = 0; i < state.police.length; i += 1) {
    const unit = state.police[i];
    const car = unit.car;
    const ctrl = driveToward(car, p.x, p.z);
    // Police drive a little faster than the traffic they chase.
    const boosted = { ...ctrl };
    stepCar(state.world, car, boosted, dt);
    if (Math.abs(car.speed) < 0.5) {
      unit.stuckTimer += dt;
      if (unit.stuckTimer > 4) {
        // Teleport back onto a road near the player instead of staying stuck.
        const angle = state.rng() * Math.PI * 2;
        car.x = clamp(p.x + Math.cos(angle) * 55, -240, 240);
        car.z = clamp(p.z + Math.sin(angle) * 55, -180, 180);
        car.speed = 18;
        unit.stuckTimer = 0;
      }
    } else {
      unit.stuckTimer = 0;
    }
    // Ram the player: a slow player with a police car on the bumper gets busted.
    const dist = Math.hypot(car.x - p.x, car.z - p.z);
    const playerSpeed = p.car ? Math.abs(p.car.speed) : 3;
    if (dist < 5.5 && playerSpeed < 2) {
      unit.bustTimer += dt;
      if (unit.bustTimer > 3) state.events.push({ type: 'busted' });
    } else {
      unit.bustTimer = 0;
    }
    if (dist < 3.2 && p.car) {
      // A ram shoves the player's car and hurts — but only once per 1.5 s,
      // and the police car bounces back, so it must chase again instead of
      // pinning the player to a standstill forever.
      if (unit.ramTimer <= 0) {
        p.car.speed *= 0.6;
        car.speed *= 0.4;
        car.x -= Math.sin(car.heading) * 3;
        car.z -= Math.cos(car.heading) * 3;
        unit.ramTimer = 1.5;
        state.events.push({ type: 'rammed' });
      }
    }
    unit.ramTimer -= dt;
  }
  for (let i = state.footPolice.length - 1; i >= 0; i -= 1) {
    const cop = state.footPolice[i];
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.5) {
      cop.heading = Math.atan2(dx, dz);
      const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!hitsBuilding(state.world, nx, nz, 0.6)) {
        cop.x = nx;
        cop.z = nz;
      }
    }
    if (dist < 1.7) {
      cop.catchTimer += dt;
      if (cop.catchTimer > 2) state.events.push({ type: 'busted' });
    } else {
      cop.catchTimer = 0;
    }
  }
}

/** A player car running a pedestrian over: the ped falls, wanted rises. */
export function checkPedHits(state) {
  const p = state.player;
  if (!p.car || Math.abs(p.car.speed) < 5) return;
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.fall > 0) continue;
    const d = Math.hypot(ped.x - p.car.x, ped.z - p.car.z);
    if (d < 2.1) {
      ped.fall = 4;
      state.events.push({ type: 'pedHit' });
    }
  }
}

/** Keep the traffic population topped up as cars are stolen or wrecked. */
export function topUpTraffic(state) {
  if (state.traffic.length < 10) spawnTrafficCar(state);
  if (state.peds.length < 18) {
    const p = randomStreetPoint(state.rng);
    state.peds.push(makePed(state, p.x, p.z));
  }
}
