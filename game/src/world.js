// Solmar Bay 3D — the city itself: a seeded grid of streets and blocks with
// districts (downtown towers, suburbs, harbour warehouses, a park, a beach and
// the sea), plus named spots the missions use and collision helpers.
import { PALETTE, STREETS_H, STREETS_V, WORLD } from './config.js';
import { int, mulberry32, pick, range } from './random.js';

// Two blocks are parks instead of buildings.
const PARK_BLOCKS = [{ i: 2, j: 2 }, { i: 5, j: 4 }];

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const lamps = [];

  for (let i = 0; i < STREETS_V.length - 1; i += 1) {
    for (let j = 0; j < STREETS_H.length - 1; j += 1) {
      const x0 = STREETS_V[i] + WORLD.roadHalf + 2;
      const x1 = STREETS_V[i + 1] - WORLD.roadHalf - 2;
      const z0 = STREETS_H[j] + WORLD.roadHalf + 2;
      const z1 = STREETS_H[j + 1] - WORLD.roadHalf - 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cx > WORLD.sandX - 10) continue; // beach: sand and palms, no buildings
      const isPark = PARK_BLOCKS.some((p) => p.i === i && p.j === j);
      if (isPark) {
        parks.push({ x0, z0, x1, z1 });
        for (let t = 0; t < 8; t += 1) {
          trees.push({ x: range(rng, x0 + 4, x1 - 4), z: range(rng, z0 + 4, z1 - 4), palm: false });
        }
        continue;
      }
      const downtown = Math.abs(cx) < 110 && Math.abs(cz) < 70;
      const harbour = cx < -120 && cz > 120;
      const cols = int(rng, 1, 2);
      const rows = int(rng, 1, 2);
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (rng() < 0.18) continue; // some plots stay empty (plazas, parking)
          const w = range(rng, 12, (x1 - x0) / cols - 6);
          const d = range(rng, 12, (z1 - z0) / rows - 6);
          const bx = x0 + ((c + 0.5) * (x1 - x0)) / cols + range(rng, -2, 2);
          const bz = z0 + ((r + 0.5) * (z1 - z0)) / rows + range(rng, -2, 2);
          let h;
          let color;
          if (harbour) {
            h = range(rng, 9, 14);
            color = PALETTE.warehouse;
          } else if (downtown) {
            h = range(rng, 22, 58);
            color = pick(rng, PALETTE.building);
          } else {
            h = range(rng, 8, 18);
            color = pick(rng, PALETTE.building);
          }
          buildings.push({ x: bx, z: bz, w, d, h, color });
        }
      }
    }
  }

  // Palm trees along the beach and a few street trees in the suburbs.
  for (let z = -180; z <= 180; z += 24) {
    trees.push({ x: range(rng, 205, 232), z: z + range(rng, -6, 6), palm: true });
  }
  for (let t = 0; t < 24; t += 1) {
    trees.push({
      x: range(rng, -240, 180),
      z: range(rng, -180, 180),
      palm: false,
    });
  }

  // Lamp posts at every other intersection, for a lit-street look at dusk.
  for (let i = 0; i < STREETS_V.length; i += 2) {
    for (let j = 0; j < STREETS_H.length; j += 2) {
      lamps.push({ x: STREETS_V[i] + 8, z: STREETS_H[j] + 8 });
    }
  }

  // Named spots the missions and respawns use: street intersections.
  const spots = {
    taxiStand: { x: 6, z: -60 },
    veraOffice: { x: -6, z: 6 },
    warehouse: { x: -180, z: 120 },
    bank: { x: 60, z: -6 },
    debtor: { x: -120, z: -120 },
    harbour: { x: -180, z: 180 },
    beach: { x: 210, z: -60 },
    hospital: { x: 120, z: 120 },
    policeStation: { x: -60, z: -120 },
    park: { x: -120, z: -60 },
  };

  return { seed, buildings, trees, parks, lamps, spots };
}

/** True when the circle (x, z, radius r) touches any building. */
export function hitsBuilding(world, x, z, r) {
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0);
    const dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0);
    if (dx * dx + dz * dz < r * r) return b;
  }
  return null;
}

/** Nearest street centreline coordinate on the given axis to (x, z). */
export function nearestStreetV(x) {
  let best = STREETS_V[0];
  for (let i = 1; i < STREETS_V.length; i += 1) {
    if (Math.abs(STREETS_V[i] - x) < Math.abs(best - x)) best = STREETS_V[i];
  }
  return best;
}

export function nearestStreetH(z) {
  let best = STREETS_H[0];
  for (let j = 1; j < STREETS_H.length; j += 1) {
    if (Math.abs(STREETS_H[j] - z) < Math.abs(best - z)) best = STREETS_H[j];
  }
  return best;
}

/** A random point on a random street (used to spawn traffic, peds, fares). */
export function randomStreetPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, STREETS_V), z: range(rng, -180, 180) };
  }
  return { x: range(rng, -240, 240), z: pick(rng, STREETS_H) };
}

/** A random intersection (used for traffic waypoints). */
export function randomIntersection(rng) {
  return { x: pick(rng, STREETS_V), z: pick(rng, STREETS_H) };
}
