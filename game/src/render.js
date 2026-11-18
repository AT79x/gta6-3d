// Solmar Bay 3D — drawing: the WebGL scene (city, cars, people, effects) and
// the 2D HUD overlay (cash, health, wanted stars, objective, clock, minimap,
// banners and the title / pause / busted / wasted screens).
import { CAR_TYPES, PALETTE, STREETS_H, STREETS_V, WORLD } from './config.js';
import { clamp } from './random.js';
import { currentTarget, trialGate } from './missions.js';

const MINIMAP_W = 208;
const MINIMAP_H = 156;

function css(rgb) {
  return 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ')';
}

/** Where the camera sits and looks, from the player and the camera state. */
export function computeCamera(state) {
  if (state.cameraFixed) return state.cameraFixed;
  const p = state.player;
  const cam = state.camera;
  let eye;
  let look;
  let heading = p.heading;
  if (p.car) {
    heading = p.car.heading;
    const back = 13;
    const up = 6.8;
    eye = [p.car.x - Math.sin(heading) * back, up, p.car.z - Math.cos(heading) * back];
    look = [p.car.x + Math.sin(heading) * 9, 0.8, p.car.z + Math.cos(heading) * 9];
  } else {
    const yaw = heading + cam.orbit;
    const back = 8.5;
    const up = 4.6;
    eye = [p.x - Math.sin(yaw) * back, up, p.z - Math.cos(yaw) * back];
    look = [p.x + Math.sin(yaw) * 3, 1.4, p.z + Math.cos(yaw) * 3];
  }
  // Smooth the camera so it trails instead of snapping.
  const k = 1 - Math.exp(-6 * cam.dt);
  cam.eye[0] += (eye[0] - cam.eye[0]) * k;
  cam.eye[1] += (eye[1] - cam.eye[1]) * k;
  cam.eye[2] += (eye[2] - cam.eye[2]) * k;
  cam.look[0] += (look[0] - cam.look[0]) * k;
  cam.look[1] += (look[1] - cam.look[1]) * k;
  cam.look[2] += (look[2] - cam.look[2]) * k;
  return { eye: cam.eye, look: cam.look };
}

export function renderScene(gl, state) {
  const world = state.world;
  const cam = computeCamera(state);
  gl.begin(cam.eye, cam.look);
  const t = state.time;

  // Ground, sea and beach. Each layer's top sits at a different height so
  // overlapping boxes never z-fight: ground -0.1, sand -0.05, sea 0.0.
  gl.box(0, -0.6, 0, WORLD.halfX * 2 + 60, 1, WORLD.halfZ * 2 + 60, PALETTE.ground, 0);
  gl.box(403, -0.25, 0, 314, 0.5, WORLD.halfZ * 2 + 60, PALETTE.sea, 0);
  gl.box((WORLD.sandX + WORLD.seaX) / 2, -0.35, 0, WORLD.seaX - WORLD.sandX, 0.6, WORLD.halfZ * 2, PALETTE.sand, 0);

  // Roads and sidewalks.
  for (let i = 0; i < STREETS_V.length; i += 1) {
    const x = STREETS_V[i];
    gl.box(x, -0.25, 0, WORLD.roadHalf * 2, 0.5, WORLD.halfZ * 2, PALETTE.road, 0);
    gl.box(x - WORLD.roadHalf - 1.5, -0.3, 0, 3, 0.4, WORLD.halfZ * 2, PALETTE.sidewalk, 0);
    gl.box(x + WORLD.roadHalf + 1.5, -0.3, 0, 3, 0.4, WORLD.halfZ * 2, PALETTE.sidewalk, 0);
  }
  for (let j = 0; j < STREETS_H.length; j += 1) {
    const z = STREETS_H[j];
    gl.box(0, -0.25, z, WORLD.halfX * 2, 0.5, WORLD.roadHalf * 2, PALETTE.road, 0);
    gl.box(0, -0.3, z - WORLD.roadHalf - 1.5, WORLD.halfX * 2, 0.4, 3, PALETTE.sidewalk, 0);
    gl.box(0, -0.3, z + WORLD.roadHalf + 1.5, WORLD.halfX * 2, 0.4, 3, PALETTE.sidewalk, 0);
  }
  // Centre dashes on the main avenues.
  for (let i = 0; i < STREETS_V.length; i += 1) {
    const x = STREETS_V[i];
    for (let z = -180; z < 180; z += 16) {
      gl.box(x, -0.15, z, 0.5, 0.2, 6, [0.85, 0.8, 0.4], 0);
    }
  }

  // Parks.
  for (let i = 0; i < world.parks.length; i += 1) {
    const pk = world.parks[i];
    gl.box((pk.x0 + pk.x1) / 2, -0.2, (pk.z0 + pk.z1) / 2, pk.x1 - pk.x0, 0.4, pk.z1 - pk.z0, PALETTE.park, 0);
  }

  // Buildings.
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    gl.box(b.x, b.h / 2, b.z, b.w, b.h, b.d, b.color, 0);
    // A roof cap in the building's own colour, darkened, so towers read
    // from above without turning the skyline black.
    gl.box(b.x, b.h + 0.25, b.z, b.w * 0.92, 0.5, b.d * 0.92, [b.color[0] * 0.68, b.color[1] * 0.68, b.color[2] * 0.68], 0);
  }

  // Trees: trunk plus a foliage block (palms get a taller trunk).
  for (let i = 0; i < world.trees.length; i += 1) {
    const tr = world.trees[i];
    const trunkH = tr.palm ? 4 : 2.2;
    gl.box(tr.x, trunkH / 2, tr.z, 0.5, trunkH, 0.5, PALETTE.trunk, 0);
    gl.box(tr.x, trunkH + 1, tr.z, 2.6, 2, 2.6, tr.palm ? PALETTE.palmLeaves : PALETTE.leaves, 0);
  }

  // Lamp posts.
  for (let i = 0; i < world.lamps.length; i += 1) {
    const l = world.lamps[i];
    gl.box(l.x, 2.5, l.z, 0.3, 5, 0.3, [0.15, 0.15, 0.18], 0);
    gl.box(l.x, 5.1, l.z, 0.9, 0.4, 0.9, [1, 0.95, 0.7], 0);
  }

  // Mission beacon: a gold column with a floating diamond on top.
  const target = currentTarget(state);
  if (target) drawBeacon(gl, target.x, target.z, t);
  if (state.fare) drawBeacon(gl, state.fare.x, state.fare.z, t);
  if (state.trial.active) {
    const g = trialGate(state);
    drawBeacon(gl, g.x, g.z, t);
  }

  // Pickups.
  for (let i = 0; i < state.packages.length; i += 1) {
    const pk = state.packages[i];
    if (pk.taken > 0) continue;
    const bob = Math.sin(t * 3 + i) * 0.3;
    gl.box(pk.x, 0.8 + bob, pk.z, 0.9, 0.9, 0.9, PALETTE.packageBox, t * 0.5);
  }
  for (let i = 0; i < state.pickups.length; i += 1) {
    const pk = state.pickups[i];
    if (pk.taken > 0) continue;
    const bob = Math.sin(t * 3 + i * 2) * 0.3;
    gl.box(pk.x, 0.8 + bob, pk.z, 0.9, 0.9, 0.9, pk.kind === 'health' ? PALETTE.healthBox : PALETTE.armourBox, 0);
  }

  // Cars.
  for (let i = 0; i < state.cars.length; i += 1) drawCar(gl, state.cars[i], t);

  // Pedestrians.
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.fall > 0) {
      gl.box(ped.x, 0.3, ped.z, 1.6, 0.6, 0.7, ped.color, ped.heading);
    } else {
      gl.box(ped.x, 0.85, ped.z, 0.7, 1.7, 0.5, ped.color, ped.heading);
      gl.box(ped.x, 1.95, ped.z, 0.45, 0.45, 0.45, [0.9, 0.75, 0.6], ped.heading);
    }
  }

  // Foot police: dark uniforms with a cap.
  for (let i = 0; i < state.footPolice.length; i += 1) {
    const cop = state.footPolice[i];
    gl.box(cop.x, 0.9, cop.z, 0.75, 1.8, 0.5, [0.08, 0.1, 0.2], cop.heading);
    gl.box(cop.x, 2.0, cop.z, 0.5, 0.4, 0.5, [0.05, 0.05, 0.1], cop.heading);
  }

  // Gang members: red shirts, and a gun box when they are fighting.
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (e.fall > 0) {
      gl.box(e.x, 0.3, e.z, 1.6, 0.6, 0.7, [0.7, 0.15, 0.15], e.heading);
    } else {
      gl.box(e.x, 0.85, e.z, 0.75, 1.7, 0.5, [0.75, 0.15, 0.15], e.heading);
      gl.box(e.x, 1.95, e.z, 0.45, 0.45, 0.45, [0.85, 0.7, 0.55], e.heading);
      gl.box(e.x + Math.sin(e.heading) * 0.5, 1.1, e.z + Math.cos(e.heading) * 0.5, 0.15, 0.15, 0.7, [0.1, 0.1, 0.1], e.heading);
    }
  }

  // The player on foot: a teal jacket and a cap, or nothing when driving.
  const p = state.player;
  if (p.onFoot) {
    gl.box(p.x, 0.9, p.z, 0.8, 1.8, 0.55, [0.1, 0.65, 0.6], p.heading);
    gl.box(p.x, 2.05, p.z, 0.5, 0.45, 0.5, [0.9, 0.75, 0.6], p.heading);
    gl.box(p.x, 2.32, p.z, 0.55, 0.18, 0.55, [0.1, 0.65, 0.6], p.heading);
  }

  // Particles.
  for (let i = 0; i < state.particles.length; i += 1) {
    const pt = state.particles[i];
    gl.box(pt.x, pt.y, pt.z, pt.size, pt.size, pt.size, pt.color, 0);
  }
}

function drawBeacon(gl, x, z, t) {
  const pulse = 0.75 + Math.sin(t * 4) * 0.25;
  gl.box(x, 12, z, 1.6, 24, 1.6, [PALETTE.beacon[0] * pulse, PALETTE.beacon[1] * pulse, PALETTE.beacon[2] * pulse], 0);
  gl.box(x, 25 + Math.sin(t * 2) * 0.8, z, 2.2, 2.2, 2.2, PALETTE.beacon, t);
}

function drawCar(gl, car, t) {
  const def = CAR_TYPES[car.type];
  // Blob shadow under the car.
  gl.box(car.x, 0.06, car.z, car.length + 0.3, 0.1, car.width + 0.3, [0.05, 0.05, 0.06], car.heading);
  // Body and cabin.
  gl.box(car.x, 0.75, car.z, car.length, 0.9, car.width, car.color, car.heading);
  const cabLen = car.length * 0.5;
  const cabX = car.x - Math.sin(car.heading) * car.length * 0.08;
  const cabZ = car.z - Math.cos(car.heading) * car.length * 0.08;
  gl.box(cabX, 1.45, cabZ, cabLen, 0.75, car.width * 0.86, [0.28, 0.38, 0.48], car.heading);
  // Wheels: one long dark box each side reads as wheels from any angle.
  const rx = Math.cos(car.heading);
  const rz = -Math.sin(car.heading);
  gl.box(car.x + rx * (car.width / 2), 0.4, car.z + rz * (car.width / 2), car.length * 0.8, 0.7, 0.3, [0.08, 0.08, 0.09], car.heading);
  gl.box(car.x - rx * (car.width / 2), 0.4, car.z - rz * (car.width / 2), car.length * 0.8, 0.7, 0.3, [0.08, 0.08, 0.09], car.heading);
  if (car.type === 'taxi') {
    gl.box(car.x, 2.0, car.z, 1.0, 0.35, 0.6, [1, 0.9, 0.2], car.heading);
  }
  if (car.type === 'police') {
    const flash = Math.sin(t * 10) > 0;
    const lx = car.x - Math.sin(car.heading) * 0.3;
    const lz = car.z - Math.cos(car.heading) * 0.3;
    gl.box(lx - rx * 0.4, 1.95, lz - rz * 0.4, 0.5, 0.3, 0.4, flash ? [1, 0.1, 0.1] : [0.3, 0.05, 0.05], car.heading);
    gl.box(lx + rx * 0.4, 1.95, lz + rz * 0.4, 0.5, 0.3, 0.4, flash ? [0.1, 0.1, 0.5] : [0.1, 0.3, 1], car.heading);
  }
}

// ---- 2D HUD overlay ----
export function renderHUD(ctx, gl, state, w, h) {
  ctx.clearRect(0, 0, w, h);
  const p = state.player;
  const screen = state.screen;

  if (screen === 'title') {
    drawTitle(ctx, state, w, h);
    return;
  }
  if (screen === 'paused') {
    drawPanel(ctx, w, h, 'PAUSED', ['ESC — resume', 'R — restart from the start screen', 'M — mute music']);
    return;
  }
  if (screen === 'busted') {
    drawPanel(ctx, w, h, 'BUSTED', ['The Solmar Bay PD caught you.', 'Fine: $' + state.lastFine, 'ENTER — back on the street']);
    return;
  }
  if (screen === 'wasted') {
    drawPanel(ctx, w, h, 'WASTED', ['Rex is down. The hospital patches him up.', 'Bill: $' + state.lastFine, 'ENTER — back on the street']);
    return;
  }

  // Crosshair (always on while playing: the pistol is always to hand).
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  const cx = w / 2;
  const cy = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
  ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
  ctx.stroke();

  // Top-left: cash, debt, health, armour. Bars and their labels never share
  // a row: cash 42, debt 64, health bar 74, HP text 100, armour bar 106,
  // armour/ammo text 124.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, 12, 250, 126);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), 26, 42);
  ctx.fillStyle = p.debt > 0 ? '#ff9a8a' : '#8aff9a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(p.debt > 0 ? 'Debt to Vera: $' + p.debt.toLocaleString('en-US') : 'DEBT CLEARED', 26, 64);
  bar(ctx, 26, 74, 200, 12, p.health / 100, '#e33', '#333');
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP ' + Math.round(p.health), 26, 100);
  bar(ctx, 26, 106, 200, 10, p.armour / 100, '#48c', '#333');
  ctx.fillText('Armour ' + Math.round(p.armour) + '   Ammo ' + p.ammo + '/' + 12, 26, 130);

  // Top-right: wanted stars, clock, minimap.
  drawStars(ctx, state.wanted, w - 26, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(state.clockText, w - 26, 62);
  drawMinimap(ctx, state, w - MINIMAP_W - 14, 72);

  // Bottom-centre: objective.
  const target = currentTarget(state);
  const m = state.mission;
  ctx.textAlign = 'center';
  if (m.active) {
    const step = m.def.steps[m.step];
    let line = m.def.name + ': ' + step.label;
    if (step.type === 'survive') line += ' — ' + Math.max(0, Math.ceil(step.seconds - m.timer)) + 's';
    if (step.type === 'wait') line += ' — ' + Math.max(0, Math.ceil(m.timer)) + 's';
    if (target) {
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      line += '  (' + Math.round(d) + 'm)';
    }
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const tw = ctx.measureText(line).width;
    ctx.fillRect(w / 2 - tw / 2 - 10, h - 64, tw + 20, 28);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(line, w / 2, h - 44);
  }
  if (m.hint) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffb0a0';
    ctx.fillText(m.hint, w / 2, h - 84);
  }

  // Trial timer.
  if (state.trial.active) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffb14d';
    ctx.fillText('TIME TRIAL  ' + state.trial.timer.toFixed(1) + 's   Gate ' + (state.trial.gate + 1) + '/6', w / 2, h - 92);
  }

  // Speed when driving.
  if (p.car) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 3.6) + ' km/h', w - 26, h - 24);
    ctx.font = '13px sans-serif';
    ctx.fillText(p.car.name + '  —  E to exit', w - 26, h - 44);
  } else {
    ctx.textAlign = 'right';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#fff';
    const near = state.nearestCarLabel;
    ctx.fillText(near ? near + '  —  E to enter' : 'E near a car to enter it', w - 26, h - 24);
  }

  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD drive / walk   E car   Click shoot   F punch   R reload   Space handbrake   Esc pause', 16, h - 16);

  // Banner.
  if (m.bannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bw = ctx.measureText(m.banner).width;
    ctx.fillRect(w / 2 - bw / 2 - 14, 84, bw + 28, 36);
    ctx.fillStyle = '#ffe27a';
    ctx.fillText(m.banner, w / 2, 110);
  }

  // Brief text for the first seconds of a mission.
  if (m.active && m.bannerTimer > 2.5) {
    ctx.textAlign = 'center';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(m.def.brief, w / 2, 140);
  }

  // Enemy health bars, projected from the 3D scene.
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (e.fall > 0) continue;
    const s = gl.project(e.x, 2.6, e.z);
    if (!s.visible) continue;
    bar(ctx, s.x - 18, s.y, 36, 5, clamp(e.health / 100, 0, 1), '#e33', '#222');
  }

  // Hurt flash.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(220,30,30,' + (p.hurtTimer * 0.8).toFixed(2) + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawStars(ctx, wanted, x, y) {
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  let s = '';
  for (let i = 0; i < 5; i += 1) s += i < wanted ? '★' : '☆';
  ctx.fillStyle = wanted > 0 ? '#ffd94d' : 'rgba(255,255,255,0.55)';
  ctx.fillText(s, x, y);
}

function drawMinimap(ctx, state, ox, oy) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(ox - 4, oy - 4, MINIMAP_W + 8, MINIMAP_H + 8);
  const sx = MINIMAP_W / (WORLD.halfX * 2);
  const sz = MINIMAP_H / (WORLD.halfZ * 2);
  const X = (x) => ox + (x + WORLD.halfX) * sx;
  const Z = (z) => oy + (z + WORLD.halfZ) * sz;
  // Sea and sand.
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(X(WORLD.seaX), oy, MINIMAP_W - (WORLD.seaX + WORLD.halfX) * sx, MINIMAP_H);
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(X(WORLD.sandX), oy, (WORLD.seaX - WORLD.sandX) * sx, MINIMAP_H);
  // Parks.
  ctx.fillStyle = '#2d6b2d';
  for (let i = 0; i < state.world.parks.length; i += 1) {
    const pk = state.world.parks[i];
    ctx.fillRect(X(pk.x0), Z(pk.z0), (pk.x1 - pk.x0) * sx, (pk.z1 - pk.z0) * sz);
  }
  // Roads.
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  for (let i = 0; i < STREETS_V.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(X(STREETS_V[i]), oy);
    ctx.lineTo(X(STREETS_V[i]), oy + MINIMAP_H);
    ctx.stroke();
  }
  for (let j = 0; j < STREETS_H.length; j += 1) {
    ctx.beginPath();
    ctx.moveTo(ox, Z(STREETS_H[j]));
    ctx.lineTo(ox + MINIMAP_W, Z(STREETS_H[j]));
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#888';
  for (let i = 0; i < state.world.buildings.length; i += 1) {
    const b = state.world.buildings[i];
    ctx.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), Math.max(1, b.w * sx), Math.max(1, b.d * sz));
  }
  // Mission / fare / trial markers.
  const target = currentTarget(state);
  if (target) drawMapMarker(ctx, X(target.x), Z(target.z), '#ffd94d');
  if (state.fare) drawMapMarker(ctx, X(state.fare.x), Z(state.fare.z), '#7ae0ff');
  // Enemies, police, traffic.
  ctx.fillStyle = '#ff4444';
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (e.fall > 0) continue;
    ctx.fillRect(X(e.x) - 2, Z(e.z) - 2, 4, 4);
  }
  const flash = Math.sin(state.time * 10) > 0;
  ctx.fillStyle = flash ? '#ff2222' : '#2266ff';
  for (let i = 0; i < state.police.length; i += 1) {
    const car = state.police[i].car;
    ctx.beginPath();
    ctx.arc(X(car.x), Z(car.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffcc33';
  for (let i = 0; i < state.traffic.length; i += 1) {
    const car = state.traffic[i];
    ctx.fillRect(X(car.x) - 1.5, Z(car.z) - 1.5, 3, 3);
  }
  // The player: a white triangle pointing along the heading. On the map,
  // x is world x and y is world z, so the triangle (drawn pointing up) needs
  // a rotation of PI - heading to point along (sin h, cos h).
  const p = state.player;
  const heading = p.car ? p.car.heading : p.heading;
  ctx.save();
  ctx.translate(X(p.x), Z(p.z));
  ctx.rotate(Math.PI - heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.5, 5);
  ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North arrow.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', ox + 2, oy + 12);
}

function drawMapMarker(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPanel(ctx, w, h, title, lines) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], w / 2, h / 2 + 10 + i * 28);
  }
}

function drawTitle(ctx, state, w, h) {
  ctx.fillStyle = 'rgba(10,14,24,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('An open-world crime story in 3D', w / 2, h * 0.3 + 44);
  ctx.font = '17px sans-serif';
  ctx.fillText('Rex Marlowe owes fixer Vera Kessler $20,000. Drive, steal, fight — and pay it back.', w / 2, h * 0.3 + 78);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = state.saveExists ? '#8aff9a' : '#fff';
  ctx.fillText(state.saveExists ? 'ENTER — New Game      C — Continue' : 'ENTER — New Game', w / 2, h * 0.58);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px sans-serif';
  const controls = [
    'WASD / Arrows — walk and drive      E — enter / exit car',
    'Mouse — aim      Click — shoot      F — punch      R — reload',
    'Shift — sprint      Space — handbrake      Esc — pause      M — mute',
  ];
  for (let i = 0; i < controls.length; i += 1) {
    ctx.fillText(controls[i], w / 2, h * 0.68 + i * 24);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px sans-serif';
  ctx.fillText('A fully original game: its city, names, story, art and music are its own. WebGL, no libraries.', w / 2, h - 24);
}
