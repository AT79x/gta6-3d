# Solmar Bay 3D

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/AT79x/gta6-3d/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/AT79x/gta6-3d/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D open-world crime game for make.fun's **Make GTA 6** bounty
(`gta6-01`), built by an AI agent. It is the 3D sibling of the 2D entry
[Solmar Bay](https://github.com/AT79x/gta6-01): same city, same story, a
different engine — raw WebGL written from scratch, no libraries, no network.

## The game

**Solmar Bay** is a sun-soaked coastal city. Rex Marlowe, a courier and
driver, owes fixer Vera Kessler **$20,000** — drive, steal, fight, and pay
it back.

- **A 3D city** on a grid of streets: downtown towers, suburbs, harbour
  warehouses, a park, a beach and the sea, all low-poly boxes with warm
  directional sunlight and distance fog.
- **On foot and by car**: walk the sidewalks, steal any parked or driven
  car (E to enter/exit) — sedan, taxi, van, sports car — each with its own
  speed and handling.
- **Traffic and pedestrians**: cars follow the street grid, pedestrians
  walk the pavements; run one over and the police notice.
- **Wanted level 1–5**: police cars chase and ram, foot police pursue on
  foot. Lose them by staying out of sight and the heat cools down. Get
  caught while slow and you're busted; lose all your health and you're
  wasted.
- **Six story missions**: First Fare, The Package, Collect the Debt, Heat
  Wave, Warehouse War, and The Big Score — plus taxi fares, package
  pickups and a beach time trial for extra cash.
- **Combat**: pistol (mouse aim, click to shoot), punch (F), rival gang
  members who shoot back, health and armour pickups.
- **HUD with minimap**: cash, debt, health, armour, wanted stars, mission
  objective with distance, clock, speed, and a live top-down map.
- **Menus and saves**: title screen, pause, busted/wasted screens, and
  progress saved to localStorage.
- **Sound**: fully procedural WebAudio — engine hum, police sirens,
  gunshots, and a quiet bassline. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk / drive |
| E | Enter / exit car |
| Mouse + Click | Aim / shoot |
| F | Punch |
| R | Reload |
| Shift | Sprint |
| Space | Handbrake |
| H | Horn |
| Esc / P | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `game/index.html` and its ES modules, no build step,
no network requests.

## How it is built

| File | Job |
| --- | --- |
| `game/src/gl.js` | The WebGL engine from scratch: shaders, matrices, cube mesh |
| `game/src/world.js` | Seeded city generation, districts, collision |
| `game/src/vehicles.js` | Arcade car physics, entering/exiting, stealing |
| `game/src/entities.js` | Pedestrians, traffic, police AI |
| `game/src/missions.js` | Story missions and side activities |
| `game/src/combat.js` | Shooting, punching, enemies, wanted level |
| `game/src/render.js` | 3D scene, HUD overlay, minimap |
| `game/src/audio.js` | Procedural WebAudio SFX and music |
| `game/src/main.js` | Game loop, screens, save/load |
| `game/src/shots.js` | Deterministic screenshot scenes |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/config.js` | Constants, palette, car types |
| `game/src/random.js` | Seeded RNG |

## Screenshots

`?shot=start|play|chase|mission&seed=1` stages each scene deterministically:
title over downtown, driving in traffic, a 3-star police chase, and the
first mission in progress.

## License

MIT. Everything in this game — city, names, story, art, sounds — is
original. Nothing is taken from Rockstar Games' Grand Theft Auto series or
any other commercial game.
