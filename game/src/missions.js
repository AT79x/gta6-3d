// Solmar Bay 3D — the story and the side work. Rex Marlowe, a courier and
// driver, owes fixer Vera Kessler $20,000. Six story missions pay it down;
// taxi fares, package pickups and a beach time trial pay a little extra.
// A mission is a list of steps; the step the player is on decides the marker.
import { MISSION_NAMES, MISSION_REWARDS } from './config.js';
import { clamp, int, range } from './random.js';
import { spawnEnemies } from './combat.js';
import { randomStreetPoint } from './world.js';

function spot(state, key) {
  return state.world.spots[key];
}

// Each step: goto (reach a place), defeat (down every enemy), survive (stay
// alive with a wanted level for a timer), wait (stand in a marker).
// `car` means the step only counts while the player is driving.
const MISSION_DEFS = [
  {
    name: 'First Fare',
    brief: 'Vera: "Pick up my taxi at the stand, then take the client downtown. No scratches."',
    steps: [
      { type: 'goto', key: 'taxiStand', r: 7, label: 'Pick up Vera\'s taxi', car: false },
      { type: 'goto', key: 'bank', r: 9, label: 'Drop the client at the bank', car: true },
    ],
  },
  {
    name: 'The Package',
    brief: 'Vera: "A package waits at the warehouse. Deliver it to the harbour. Don\'t open it."',
    steps: [
      { type: 'goto', key: 'warehouse', r: 8, label: 'Collect the package', car: false },
      { type: 'goto', key: 'harbour', r: 9, label: 'Deliver the package', car: false },
    ],
  },
  {
    name: 'Collect the Debt',
    brief: 'Vera: "A debtor hides near the north flats. Make him pay — his friends will object."',
    steps: [
      { type: 'goto', key: 'debtor', r: 10, label: 'Find the debtor', car: false, spawn: 2 },
      { type: 'defeat', label: 'Deal with his crew', count: 2 },
      { type: 'goto', key: 'veraOffice', r: 8, label: 'Bring the money to Vera', car: false },
    ],
  },
  {
    name: 'Heat Wave',
    brief: 'Vera: "The police are onto you. Lose them — stay out of sight for 45 seconds."',
    steps: [
      { type: 'survive', seconds: 45, wanted: 3, label: 'Lose the police (45s)' },
    ],
  },
  {
    name: 'Warehouse War',
    brief: 'Vera: "A rival crew took my warehouse. Take it back. All five of them."',
    steps: [
      { type: 'goto', key: 'warehouse', r: 12, label: 'Reach the warehouse', car: false, spawn: 5 },
      { type: 'defeat', label: 'Clear the warehouse', count: 5 },
    ],
  },
  {
    name: 'The Big Score',
    brief: 'Vera: "One last job: the bank. Grab the crew, take the cash, and run. This clears your debt."',
    steps: [
      { type: 'goto', key: 'park', r: 8, label: 'Pick up the crew at the park', car: true },
      { type: 'goto', key: 'bank', r: 9, label: 'Reach the bank', car: true },
      { type: 'wait', key: 'bank', r: 7, seconds: 4, label: 'Grab the cash (stay in the vault)' },
      { type: 'survive', seconds: 30, wanted: 4, label: 'Escape the police (30s)' },
    ],
  },
];

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  state.mission = {
    index,
    step: 0,
    timer: 0,
    active: true,
    def,
    banner: 'Mission: ' + def.name,
    bannerTimer: 4,
  };
  state.events.push({ type: 'missionStart', name: def.name, brief: def.brief });
  enterStep(state);
}

function enterStep(state) {
  const m = state.mission;
  const step = m.def.steps[m.step];
  m.timer = 0;
  if (!step) return;
  if (step.spawn) {
    const at = spot(state, step.key);
    spawnEnemies(state, at.x, at.z, step.spawn);
  }
  if (step.type === 'survive') {
    state.wanted = Math.max(state.wanted, step.wanted);
    state.hiddenTimer = 0;
  }
  if (step.type === 'wait') m.timer = step.seconds;
}

/** The current objective marker: {x, z, label} or null. */
export function currentTarget(state) {
  const m = state.mission;
  if (!m.active) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.type === 'defeat') {
    const alive = state.enemies.filter((e) => e.fall <= 0);
    if (alive.length > 0) return { x: alive[0].x, z: alive[0].z, label: step.label };
    return null;
  }
  if (step.key) {
    const at = spot(state, step.key);
    return { x: at.x, z: at.z, label: step.label };
  }
  // Survive steps point at the player: no marker, just the timer.
  return null;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m.active) {
    // Chain the next mission a few seconds after the last one ended.
    if (m.nextTimer !== undefined && m.nextTimer > 0) {
      m.nextTimer -= dt;
      if (m.nextTimer <= 0) {
        const next = m.index + 1;
        if (next < MISSION_DEFS.length) startMission(state, next);
        else m.nextTimer = undefined;
      }
    }
    return;
  }
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = state.player;
  if (step.type === 'goto') {
    const at = spot(state, step.key);
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (step.car && p.onFoot) {
      m.hint = 'You need a car for this';
    } else {
      m.hint = '';
      if (d < step.r) advanceStep(state);
    }
  } else if (step.type === 'defeat') {
    const alive = state.enemies.filter((e) => e.fall <= 0).length;
    if (alive === 0) advanceStep(state);
  } else if (step.type === 'survive') {
    m.timer += dt;
    if (m.timer >= step.seconds) advanceStep(state);
  } else if (step.type === 'wait') {
    const at = spot(state, step.key);
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d < step.r) {
      m.timer -= dt;
      if (m.timer <= 0) advanceStep(state);
    }
  }
}

function advanceStep(state) {
  const m = state.mission;
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    completeMission(state);
  } else {
    enterStep(state);
  }
}

function completeMission(state) {
  const m = state.mission;
  const reward = MISSION_REWARDS[m.index];
  state.player.cash += reward;
  state.player.debt = Math.max(0, state.player.debt - reward);
  state.missionsDone += 1;
  state.events.push({ type: 'missionDone', name: m.def.name, reward });
  m.active = false;
  m.banner = 'Mission complete: ' + m.def.name + '  +$' + reward;
  m.bannerTimer = 4;
  if (m.index === MISSION_DEFS.length - 1) {
    m.banner = 'THE BIG SCORE — debt cleared! Solmar Bay is yours, Rex.';
    m.bannerTimer = 6;
    state.events.push({ type: 'storyDone' });
  }
  m.nextTimer = 4;
}

// ---- Side activities: taxi fares, package pickups, beach time trial. ----
export function updateSide(state, dt) {
  const p = state.player;
  // Taxi fares appear while the player drives.
  state.fareTimer -= dt;
  if (!p.onFoot && !state.fare && state.fareTimer <= 0) {
    const at = randomStreetPoint(state.rng);
    state.fare = {
      stage: 'pickup',
      x: at.x,
      z: at.z,
      reward: int(state.rng, 60, 120),
      ped: true,
    };
    state.events.push({ type: 'fareOffer' });
  }
  if (state.fare) {
    const f = state.fare;
    const d = Math.hypot(p.x - f.x, p.z - f.z);
    if (f.stage === 'pickup' && d < 7) {
      const drop = randomStreetPoint(state.rng);
      f.stage = 'dropoff';
      f.x = drop.x;
      f.z = drop.z;
      f.ped = false;
    } else if (f.stage === 'dropoff' && d < 9) {
      p.cash += f.reward;
      state.events.push({ type: 'fareDone', reward: f.reward });
      state.fare = null;
      state.fareTimer = 18;
    }
  }
  // Package pickups: glowing boxes scattered around the city.
  for (let i = 0; i < state.packages.length; i += 1) {
    const pk = state.packages[i];
    if (pk.taken > 0) {
      pk.taken -= dt;
      continue;
    }
    const d = Math.hypot(p.x - pk.x, p.z - pk.z);
    if (d < 2.5) {
      pk.taken = 45;
      p.cash += 80;
      state.events.push({ type: 'packageDone', reward: 80 });
    }
  }
  // Health and armour pickups.
  for (let i = 0; i < state.pickups.length; i += 1) {
    const pk = state.pickups[i];
    if (pk.taken > 0) {
      pk.taken -= dt;
      continue;
    }
    const d = Math.hypot(p.x - pk.x, p.z - pk.z);
    if (d < 2.5) {
      pk.taken = 60;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 30);
      else p.armour = Math.min(100, p.armour + 30);
      state.events.push({ type: 'pickupDone', kind: pk.kind });
    }
  }
  // Beach time trial: drive through the start gate on the beach road.
  updateTrial(state, dt);
}

const TRIAL_GATES = [
  { x: 240, z: -120 },
  { x: 240, z: -60 },
  { x: 240, z: 0 },
  { x: 240, z: 60 },
  { x: 240, z: 120 },
  { x: 240, z: 180 },
];

export function updateTrial(state, dt) {
  const p = state.player;
  const t = state.trial;
  if (!t.active) {
    const g = TRIAL_GATES[0];
    if (!p.onFoot && Math.hypot(p.x - g.x, p.z - g.z) < 6) {
      t.active = true;
      t.gate = 1;
      t.timer = 0;
      state.events.push({ type: 'trialStart' });
    }
    return;
  }
  t.timer += dt;
  if (t.timer > 75) {
    t.active = false;
    state.events.push({ type: 'trialFail' });
    return;
  }
  const g = TRIAL_GATES[t.gate];
  if (g && Math.hypot(p.x - g.x, p.z - g.z) < 7) {
    t.gate += 1;
    if (t.gate >= TRIAL_GATES.length) {
      t.active = false;
      p.cash += 250;
      state.events.push({ type: 'trialDone', reward: 250, time: t.timer });
    }
  }
}

export function trialGate(state) {
  const t = state.trial;
  if (!t.active) return { x: TRIAL_GATES[0].x, z: TRIAL_GATES[0].z, label: 'Time trial start' };
  return { x: TRIAL_GATES[t.gate].x, z: TRIAL_GATES[t.gate].z, label: 'Gate ' + (t.gate + 1) + ' of ' + TRIAL_GATES.length };
}
