// Solmar Bay 3D — shared constants: world layout, palette, vehicles, story.
// Every number the game systems agree on lives here so the files stay in sync.
export const WORLD = {
  halfX: 260, // city spans x in [-260, 260]
  halfZ: 200, // city spans z in [-200, 200]
  roadHalf: 6, // half the width of a road
  block: 60, // distance between neighbouring street centrelines
  seaX: 246, // the sea starts east of this x
  sandX: 196, // the beach strip starts east of this x
};

// Street centrelines: vertical streets run along z, horizontal along x.
export const STREETS_V = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const STREETS_H = [-180, -120, -60, 0, 60, 120, 180];

export const SEED_DEFAULT = 1;
export const DEBT_START = 20000; // Rex owes Vera Kessler this much
export const BUST_FINE = 300;
export const WASTED_FINE = 300;

// Warm sun-soaked palette: each entry is [r, g, b] in 0..1.
export const PALETTE = {
  sky: [0.55, 0.8, 0.96],
  fog: [0.78, 0.87, 0.94],
  sunDir: [0.45, 0.75, 0.35], // direction TOWARD the sun
  ground: [0.42, 0.55, 0.38], // grassy base under the city
  road: [0.25, 0.26, 0.29],
  sidewalk: [0.62, 0.62, 0.6],
  sand: [0.88, 0.8, 0.58],
  sea: [0.12, 0.45, 0.68],
  park: [0.3, 0.55, 0.3],
  building: [
    [0.92, 0.85, 0.72], [0.85, 0.72, 0.58], [0.78, 0.68, 0.6],
    [0.72, 0.78, 0.82], [0.88, 0.78, 0.66], [0.66, 0.66, 0.68],
    [0.9, 0.82, 0.7], [0.82, 0.66, 0.55], [0.7, 0.74, 0.78],
  ],
  warehouse: [0.62, 0.58, 0.52],
  trunk: [0.35, 0.25, 0.15],
  leaves: [0.22, 0.5, 0.25],
  palmLeaves: [0.25, 0.6, 0.3],
  beacon: [1.0, 0.8, 0.15], // mission marker gold
  packageBox: [1.0, 0.75, 0.1],
  healthBox: [0.2, 0.9, 0.3],
  armourBox: [0.25, 0.55, 1.0],
  gate: [1.0, 0.55, 0.1],
};

// Arcade car types: top speed, acceleration, turn rate, body size and colour.
export const CAR_TYPES = {
  sedan: { name: 'Sedan', maxSpeed: 28, accel: 13, turn: 2.1, length: 4.4, width: 2.0, height: 1.1, color: [0.75, 0.25, 0.25] },
  taxi: { name: 'Taxi', maxSpeed: 26, accel: 12, turn: 2.2, length: 4.4, width: 2.0, height: 1.1, color: [0.95, 0.8, 0.15] },
  van: { name: 'Van', maxSpeed: 22, accel: 9, turn: 1.7, length: 5.2, width: 2.2, height: 1.9, color: [0.85, 0.85, 0.85] },
  sports: { name: 'Sports', maxSpeed: 38, accel: 18, turn: 2.5, length: 4.2, width: 2.0, height: 0.95, color: [0.15, 0.35, 0.85] },
  police: { name: 'Police', maxSpeed: 34, accel: 16, turn: 2.4, length: 4.4, width: 2.0, height: 1.1, color: [0.1, 0.12, 0.18] },
};

export const PED_COLORS = [
  [0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.9, 0.7, 0.3], [0.4, 0.8, 0.4],
  [0.8, 0.4, 0.8], [0.95, 0.95, 0.95], [0.3, 0.3, 0.35], [0.95, 0.55, 0.25],
];

export const MISSION_REWARDS = [300, 400, 500, 600, 800, 1500];
export const MISSION_NAMES = [
  'First Fare',
  'The Package',
  'Collect the Debt',
  'Heat Wave',
  'Warehouse War',
  'The Big Score',
];

// Named spots in the city, picked from street intersections by world.js.
export const SPOT_KEYS = [
  'taxiStand', 'veraOffice', 'warehouse', 'bank', 'debtor',
  'harbour', 'beach', 'hospital', 'policeStation', 'park',
];
