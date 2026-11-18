// Solmar Bay 3D — combat and the wanted level: the pistol (raycast from the
// camera through the crosshair), the punch, rival gang members who shoot back,
// health and armour, and what raises or lowers the wanted level.
import { clamp, range, wrapAngle } from './random.js';

export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 70;
export const PISTOL_MAG = 12;
export const PUNCH_DAMAGE = 25;
export const PUNCH_RANGE = 2.4;

export function spawnEnemies(state, x, z, count) {
  const rng = state.rng;
  for (let i = 0; i < count; i += 1) {
    state.enemies.push({
      x: x + range(rng, -8, 8),
      z: z + range(rng, -8, 8),
      heading: rng() * Math.PI * 2,
      health: 100,
      speed: 3.4,
      shootTimer: range(rng, 0.5, 1.5),
      fall: 0,
    });
  }
}

/**
 * Fire the pistol along `dir` from `origin`. The nearest enemy or pedestrian
 * close to the ray and in front of the shooter takes the hit; a wall stops
 * nothing here because the shot is short-range street combat, but the ray
 * only reaches PISTOL_RANGE.
 */
export function shoot(state, origin, dir) {
  const p = state.player;
  if (p.ammo <= 0) {
    state.events.push({ type: 'dryFire' });
    return;
  }
  p.ammo -= 1;
  p.muzzleTimer = 0.09;
  addTracer(state, origin, dir);
  addWanted(state, 1);
  state.audio.shoot();

  const targets = [];
  for (let i = 0; i < state.enemies.length; i += 1) {
    targets.push({ kind: 'enemy', ref: state.enemies[i] });
  }
  for (let i = 0; i < state.peds.length; i += 1) {
    if (state.peds[i].fall <= 0) targets.push({ kind: 'ped', ref: state.peds[i] });
  }
  let best = null;
  let bestDist = PISTOL_RANGE;
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    const dx = t.ref.x - origin[0];
    const dz = t.ref.z - origin[2];
    const along = dx * dir[0] + dz * dir[2];
    if (along < 1 || along > bestDist) continue;
    const perp = Math.abs(dx * dir[2] - dz * dir[0]);
    if (perp < 1.4) {
      best = t;
      bestDist = along;
    }
  }
  if (!best) return;
  if (best.kind === 'enemy') {
    best.ref.health -= PISTOL_DAMAGE;
    burst(state, best.ref.x, 1.2, best.ref.z, [0.9, 0.2, 0.2], 6);
    if (best.ref.health <= 0) {
      best.ref.fall = 999; // lies on the ground, out of the fight
      state.events.push({ type: 'enemyDown' });
    }
  } else {
    best.ref.fall = 4;
    state.events.push({ type: 'pedHit' });
  }
}

/** A punch hits the nearest enemy or pedestrian in front of the player. */
export function punch(state) {
  const p = state.player;
  p.punchTimer = 0.25;
  state.audio.punch();
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const targets = [...state.enemies, ...state.peds];
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    if (t.fall > 0) continue;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > PUNCH_RANGE) continue;
    const facing = (dx * fx + dz * fz) / (dist || 1);
    if (facing < 0.3) continue;
    if (t.health !== undefined) {
      t.health -= PUNCH_DAMAGE;
      if (t.health <= 0) {
        t.fall = 999;
        state.events.push({ type: 'enemyDown' });
      }
    } else {
      t.fall = 4;
      state.events.push({ type: 'pedHit' });
    }
    burst(state, t.x, 1.2, t.z, [1, 0.9, 0.4], 4);
    addWanted(state, 1);
    return;
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    if (e.fall > 0) {
      e.fall -= dt;
      if (e.fall <= 0) state.enemies.splice(i, 1);
      continue;
    }
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 14) {
      // Close the distance.
      e.heading = Math.atan2(dx, dz);
      e.x += Math.sin(e.heading) * e.speed * dt;
      e.z += Math.cos(e.heading) * e.speed * dt;
    } else {
      // Hold ground and shoot.
      e.heading = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = range(state.rng, 0.9, 1.6);
        if (dist < 38 && state.rng() < 0.55) {
          damagePlayer(state, 5 + Math.floor(state.rng() * 5));
          addTracer(state, [e.x, 1.4, e.z], [dx / dist, 0, dz / dist]);
          state.audio.enemyShot();
        }
      }
    }
  }
}

/** Damage the player, armour absorbing first. */
export function damagePlayer(state, amount) {
  const p = state.player;
  let left = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, left);
    p.armour -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.hurtTimer = 0.3;
  if (p.health <= 0) {
    p.health = 0;
    state.events.push({ type: 'wasted' });
  }
}

/** Raise the wanted level, never above 5. */
export function addWanted(state, n) {
  if (state.wanted < 5) {
    state.wanted = Math.min(5, state.wanted + n);
    state.hiddenTimer = 0;
  }
}

/** Wanted decays when no police can see the player for a while. */
export function updateWanted(state, dt) {
  if (state.wanted === 0) return;
  const p = state.player;
  let seen = false;
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i].car;
    if (Math.hypot(car.x - p.x, car.z - p.z) < 45) seen = true;
  }
  for (let i = 0; i < state.footPolice.length; i += 1) {
    const cop = state.footPolice[i];
    if (Math.hypot(cop.x - p.x, cop.z - p.z) < 30) seen = true;
  }
  if (!seen) {
    state.hiddenTimer += dt;
    if (state.hiddenTimer > 12) {
      state.wanted -= 1;
      state.hiddenTimer = 0;
      state.events.push({ type: 'wantedDown' });
    }
  } else {
    state.hiddenTimer = 0;
  }
}

// ---- particles: small coloured boxes that fly out and fade. ----
export function burst(state, x, y, z, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const sp = range(state.rng, 2, 7);
    state.particles.push({
      x,
      y,
      z,
      vx: Math.cos(a) * sp,
      vy: range(state.rng, 1, 5),
      vz: Math.sin(a) * sp,
      life: range(state.rng, 0.3, 0.7),
      maxLife: 0.7,
      color,
      size: range(state.rng, 0.15, 0.35),
    });
  }
}

export function addTracer(state, origin, dir) {
  for (let i = 1; i <= 8; i += 1) {
    state.particles.push({
      x: origin[0] + dir[0] * i * 2.2,
      y: (origin[1] || 1.4) + dir[1] * i * 2.2,
      z: origin[2] + dir[2] * i * 2.2,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0.12,
      maxLife: 0.12,
      color: [1, 0.9, 0.4],
      size: 0.12,
    });
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vy -= 9 * dt;
    if (pt.y < 0.1) {
      pt.y = 0.1;
      pt.vy = 0;
    }
  }
}
