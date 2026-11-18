// Solmar Bay 3D — boot and the one loop: read input every frame, advance the
// world in fixed 1/60 s steps, and paint the scene plus the HUD. The game
// moves between five screens: title, playing, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene deterministically and holds it for a screenshot.
import { DEBT_START, SEED_DEFAULT } from './config.js';
import { AudioSys } from './audio.js';
import { damagePlayer, punch, shoot, updateEnemies, updateParticles, updateWanted } from './combat.js';
import { driveToward, maintainPolice, spawnPopulation, topUpTraffic, updatePeds, updatePolice, updateTraffic, checkPedHits } from './entities.js';
import { createInput, driveInput, endFrame, takeClick, takePressed } from './input.js';
import { startMission, updateMissions, updateSide } from './missions.js';
import { clamp, mulberry32, wrapAngle } from './random.js';
import { renderHUD, renderScene } from './render.js';
import { GLEngine } from './gl.js';
import { stageShot } from './shots.js';
import { enterCar, exitCar, makeCar, nearestCar, stepCar } from './vehicles.js';
import { buildWorld, hitsBuilding } from './world.js';

const SAVE_KEY = 'solmarbay3d-save-v1';
const STEP = 1 / 60;

export function createState(seed) {
  const rng = mulberry32(seed);
  const world = buildWorld(seed);
  const state = {
    seed,
    rng,
    world,
    player: {
      x: 6, z: -44, heading: 0, speed: 0,
      health: 100, armour: 0, ammo: 12,
      cash: 150, debt: DEBT_START,
      onFoot: true, car: null,
      punchTimer: 0, muzzleTimer: 0, hurtTimer: 0, reloadTimer: 0,
    },
    cars: [], traffic: [], police: [], footPolice: [],
    peds: [], enemies: [], particles: [],
    packages: [], pickups: [],
    wanted: 0, hiddenTimer: 0,
    mission: { index: -1, step: 0, timer: 0, active: false, def: null, banner: '', bannerTimer: 0, hint: '', nextTimer: undefined },
    fare: null, fareTimer: 20,
    trial: { active: false, gate: 0, timer: 0 },
    time: 0, clockMinutes: 9 * 60, clockText: '09:00',
    screen: 'title',
    camera: { eye: [40, 30, 90], look: [0, 8, 0], orbit: 0, dt: 0.016 },
    cameraFixed: null,
    events: [],
    audio: new AudioSys(),
    missionsDone: 0,
    lastFine: 0,
    saveExists: false,
    muted: false,
    shot: null,
    nearestCarLabel: '',
  };
  spawnPopulation(state);
  // A taxi waits at the stand for the first mission.
  const taxi = makeCar('taxi', world.spots.taxiStand.x + 4, world.spots.taxiStand.z, Math.PI / 2);
  state.cars.push(taxi);
  // Package and health/armour pickups at fixed spots.
  const pkgSpots = [world.spots.park, world.spots.harbour, world.spots.beach, world.spots.hospital, world.spots.debtor];
  for (let i = 0; i < pkgSpots.length; i += 1) {
    state.packages.push({ x: pkgSpots[i].x + 6, z: pkgSpots[i].z + 6, taken: 0 });
  }
  state.pickups.push({ x: world.spots.hospital.x - 6, z: world.spots.hospital.z, kind: 'health', taken: 0 });
  state.pickups.push({ x: world.spots.policeStation.x + 6, z: world.spots.policeStation.z, kind: 'armour', taken: 0 });
  state.pickups.push({ x: world.spots.park.x - 6, z: world.spots.park.z, kind: 'health', taken: 0 });
  try {
    state.saveExists = !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) { /* private mode: no save */ }
  return state;
}

/** One fixed step of the living world. `ctrl` is a plain control object. */
export function stepWorld(state, ctrl, dt) {
  const p = state.player;
  state.time += dt;
  state.clockMinutes += dt * 0.5; // one game minute every two real seconds
  const hh = Math.floor(state.clockMinutes / 60) % 24;
  const mm = Math.floor(state.clockMinutes % 60);
  state.clockText = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (state.mission.bannerTimer > 0) state.mission.bannerTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  if (p.muzzleTimer > 0) p.muzzleTimer -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) p.ammo = 12;
  }
  state.camera.orbit += (ctrl.orbitDX || 0) * 0.005;

  if (p.onFoot) {
    stepOnFoot(state, ctrl, dt);
  } else if (p.car) {
    stepCar(state.world, p.car, ctrl, dt);
    // The player's position IS the car's while driving: missions, police,
    // the minimap and the HUD all read p.x / p.z.
    p.x = p.car.x;
    p.z = p.car.z;
    p.heading = p.car.heading;
    if (ctrl.enter) exitCar(state);
  }

  updatePeds(state, dt);
  updateTraffic(state, dt);
  maintainPolice(state);
  updatePolice(state, dt);
  updateEnemies(state, dt);
  updateMissions(state, dt);
  updateSide(state, dt);
  updateWanted(state, dt);
  updateParticles(state, dt);
  checkPedHits(state);
  topUpTraffic(state);

  // The nearest car, for the "E to enter" hint.
  if (p.onFoot) {
    const near = nearestCar(state.cars, p.x, p.z, 4.5);
    state.nearestCarLabel = near ? near.name : '';
  } else {
    state.nearestCarLabel = '';
  }

  handleEvents(state);
  state.audio.update(state, dt);
}

function stepOnFoot(state, ctrl, dt) {
  const p = state.player;
  const yaw = p.heading + state.camera.orbit;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const lx = -fz;
  const lz = fx;
  let mx = 0;
  let mz = 0;
  if (ctrl.up) { mx += fx; mz += fz; }
  if (ctrl.down) { mx -= fx; mz -= fz; }
  if (ctrl.left) { mx += lx; mz += lz; }
  if (ctrl.right) { mx -= lx; mz -= lz; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const speed = ctrl.sprint ? 9.5 : 6;
    const desired = Math.atan2(mx, mz);
    p.heading += wrapAngle(desired - p.heading) * Math.min(1, 12 * dt);
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (!hitsBuilding(state.world, nx, p.z, 0.6)) p.x = nx;
    if (!hitsBuilding(state.world, p.x, nz, 0.6)) p.z = nz;
    p.x = clamp(p.x, -252, 252);
    p.z = clamp(p.z, -192, 192);
  }
  if (ctrl.enter) {
    const near = nearestCar(state.cars, p.x, p.z, 4.5);
    if (near) enterCar(state, near);
  }
  if (ctrl.shoot && p.reloadTimer <= 0) {
    const eye = state.camera.eye;
    const look = state.camera.look;
    let dx = look[0] - eye[0];
    let dz = look[2] - eye[2];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // Face where the camera looks while firing.
    p.heading = Math.atan2(dx, dz);
    shoot(state, [p.x, 1.5, p.z], [dx, 0, dz]);
  }
  if (ctrl.punch && p.punchTimer <= 0) punch(state);
  if (ctrl.reload && p.ammo < 12 && p.reloadTimer <= 0) p.reloadTimer = 0.8;
  if (ctrl.horn) state.audio.horn();
}

function handleEvents(state) {
  const p = state.player;
  for (let i = 0; i < state.events.length; i += 1) {
    const ev = state.events[i];
    switch (ev.type) {
      case 'steal':
        state.mission.banner = 'Car stolen! The police are on their way.';
        state.mission.bannerTimer = 3;
        break;
      case 'pedHit':
        state.mission.banner = 'You hit a pedestrian! Wanted level up.';
        state.mission.bannerTimer = 3;
        break;
      case 'busted':
        if (!state.noBust) bustPlayer(state);
        break;
      case 'wasted':
        if (!state.noBust) wastePlayer(state);
        break;
      case 'rammed':
        damagePlayer(state, 3);
        break;
      case 'missionDone':
        state.audio.missionDone();
        saveGame(state);
        break;
      case 'missionStart':
        state.mission.banner = 'Mission: ' + ev.name;
        state.mission.bannerTimer = 4;
        break;
      case 'fareOffer':
        state.mission.banner = 'Taxi fare waiting nearby — pick them up!';
        state.mission.bannerTimer = 3;
        break;
      case 'fareDone':
        state.audio.pickup();
        state.mission.banner = 'Fare complete  +$' + ev.reward;
        state.mission.bannerTimer = 3;
        break;
      case 'packageDone':
        state.audio.pickup();
        state.mission.banner = 'Package found  +$' + ev.reward;
        state.mission.bannerTimer = 2.5;
        break;
      case 'pickupDone':
        state.audio.pickup();
        break;
      case 'trialStart':
        state.mission.banner = 'Time trial! Hit all 6 gates in 75s.';
        state.mission.bannerTimer = 3;
        break;
      case 'trialDone':
        state.audio.missionDone();
        state.mission.banner = 'Time trial done in ' + ev.time.toFixed(1) + 's  +$' + ev.reward;
        state.mission.bannerTimer = 4;
        break;
      case 'trialFail':
        state.mission.banner = 'Time trial failed — too slow.';
        state.mission.bannerTimer = 3;
        break;
      case 'storyDone':
        state.audio.missionDone();
        saveGame(state);
        break;
      case 'dryFire':
        state.mission.banner = 'Out of ammo — press R to reload.';
        state.mission.bannerTimer = 2;
        break;
      default:
        break;
    }
  }
  state.events.length = 0;
}

function bustPlayer(state) {
  const p = state.player;
  const fine = Math.min(p.cash, 300);
  p.cash -= fine;
  state.lastFine = fine;
  state.wanted = 0;
  state.police.length = 0;
  state.footPolice.length = 0;
  if (p.car) {
    p.car.driver = null;
    p.car.speed = 0;
    p.car = null;
    p.onFoot = true;
  }
  p.health = Math.max(p.health, 60);
  p.x = state.world.spots.policeStation.x;
  p.z = state.world.spots.policeStation.z;
  state.screen = 'busted';
  saveGame(state);
}

function wastePlayer(state) {
  const p = state.player;
  const fine = Math.min(p.cash, 300);
  p.cash -= fine;
  state.lastFine = fine;
  state.wanted = 0;
  state.police.length = 0;
  state.footPolice.length = 0;
  state.enemies.length = 0;
  if (p.car) {
    p.car.driver = null;
    p.car.speed = 0;
    p.car = null;
    p.onFoot = true;
  }
  p.health = 100;
  p.armour = 0;
  p.x = state.world.spots.hospital.x;
  p.z = state.world.spots.hospital.z;
  state.screen = 'wasted';
  saveGame(state);
}

function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.player.cash,
      debt: state.player.debt,
      missionsDone: state.missionsDone,
    }));
    state.saveExists = true;
  } catch (e) { /* private mode */ }
}

function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.player.cash = data.cash;
    state.player.debt = data.debt;
    state.missionsDone = data.missionsDone;
    return true;
  } catch (e) {
    return false;
  }
}

// ---- boot ----
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || SEED_DEFAULT) || SEED_DEFAULT;
const shotName = params.get('shot');
let state = createState(seed);

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const gl = new GLEngine(glCanvas);
const hud = hudCanvas.getContext('2d');
const input = createInput(glCanvas);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  gl.resize(w, h);
  hudCanvas.width = w;
  hudCanvas.height = h;
}
window.addEventListener('resize', resize);
resize();

if (shotName) {
  state.shot = shotName;
  stageShot(shotName, state);
} else {
  // The title screen shows the city behind it from a fixed vantage.
  state.cameraFixed = { eye: [95, 42, 145], look: [-10, 10, -10] };
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  state.camera.dt = dt;

  if (!state.shot) {
    state.audio.unlock();
    const ctrl = driveInput(input);
    ctrl.orbitDX = input.orbitDX;
    ctrl.enter = takePressed(input, 'KeyE');
    ctrl.punch = takePressed(input, 'KeyF');
    ctrl.reload = takePressed(input, 'KeyR');
    ctrl.horn = takePressed(input, 'KeyH');
    ctrl.shoot = takeClick(input);
    if (takePressed(input, 'KeyM')) state.muted = !state.muted;

    if (state.screen === 'title') {
      if (takePressed(input, 'Enter')) {
        state.cameraFixed = null;
        state.screen = 'playing';
        startMission(state, 0);
      } else if (takePressed(input, 'KeyC') && state.saveExists) {
        if (loadGame(state)) {
          state.cameraFixed = null;
          state.screen = 'playing';
          startMission(state, Math.min(state.missionsDone, 5));
        }
      }
    } else if (state.screen === 'playing') {
      if (takePressed(input, 'Escape') || takePressed(input, 'KeyP')) {
        state.screen = 'paused';
      } else {
        let acc = dt;
        while (acc > 0) {
          const step = Math.min(acc, STEP);
          stepWorld(state, ctrl, step);
          acc -= step;
        }
      }
    } else if (state.screen === 'paused') {
      if (takePressed(input, 'Escape') || takePressed(input, 'KeyP')) {
        state.screen = 'playing';
      } else if (takePressed(input, 'KeyR')) {
        const audio = state.audio;
        state = createState(seed);
        state.audio = audio;
        state.cameraFixed = { eye: [95, 42, 145], look: [-10, 10, -10] };
      }
    } else if (state.screen === 'busted' || state.screen === 'wasted') {
      if (takePressed(input, 'Enter')) state.screen = 'playing';
    }
    endFrame(input);
  }

  renderScene(gl, state);
  renderHUD(hud, gl, state, hudCanvas.width, hudCanvas.height);
}
requestAnimationFrame(frame);
