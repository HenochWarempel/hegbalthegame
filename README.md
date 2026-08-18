# Hegbal

A browser game in the style of *Virtua Tennis 2*: low-poly arcade graphics,
an over-the-shoulder dynamic camera, and simple pick-up-and-play controls.
Hegbal itself is a Dutch backyard sport — 3-vs-3 footvolley played over a
trimmed hedge (1.30 m tall) instead of a net, on a parking lot.

The scene (herringbone pavers, hedge, streetlight, roadside bushes and
houses) is modeled after a real photo of a Hegbal game.

## Running it

No build step — it's plain ES modules with a vendored copy of three.js.
Serve the folder over HTTP (loading `index.html` directly via `file://`
won't work because of module imports):

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Controls

- **Arrow keys** — move your player
- **Space** — hit the ball / serve
- **Shift + Space** — serve from the hand instead of the ground
- **Q** — switch which of your 3 players you control
- Hold left/right while hitting to aim; up/down picks a deep or short shot

## Rules implemented

- **Serve**: taken from on/behind the serve line, from the ground or the
  hand, and must go directly to the other side. A serve that clips the
  hedge but still lands in gets replayed once; a second clip, a clip that
  then goes out, or a serve that never clears the hedge is a fault —
  point and serve go to the other team.
- **Rally**: each team may let the ball bounce once per turn (anywhere,
  even off the pavement) before it must go back over the hedge; a second
  bounce on the same side, or a shot that fails to clear the hedge, ends
  the point.
- **Match**: first to 5 points, win by 2. In a rematch, the team that
  lost serves first.

## Project layout

- `index.html` — page shell, HUD markup, import map for three.js
- `src/main.js` — app entry point: rendering loop, input, hooks everything up
- `src/court.js` — the parking-lot/hedge/houses scene
- `src/players.js` — low-poly player rig and team setup
- `src/ball.js` — ball physics, ground/hedge collision
- `src/ai.js` — AI teammates and opponents
- `src/rules.js` — the Hegbal rules/scoring state machine
- `src/camera.js`, `src/hud.js`, `src/audio.js`, `src/input.js`, `src/textures.js`
- `vendor/` — vendored three.js build (no CDN dependency)
