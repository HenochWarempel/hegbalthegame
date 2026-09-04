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

## Kies je team

After picking a difficulty, "Kies je team" opens a roster of 13 named
characters (each with a distinct hairstyle and outfit color). Pick who you
play as — either by selecting a character or typing your own name — your 2
teammates, and either 3 opponents or leave "Kies zelf mijn tegenstanders"
checked to let the game pick them. Anything left unpicked is filled in
automatically when the match starts.

## Controls

- **WASD** (or arrow keys) — move your player
- **Mouse** — aim; the ring on the ground shows where your shot will land
- **Left mouse button** (or Space) — hold to charge power, release to hit/serve
- **Shift** — serve from the hand instead of the ground
- **Right-click** (or Q) — switch which of your 3 players you control
- Keyboard-only fallback: left/right picks a corner, up/down + charge picks depth

## Rules implemented

- **Serve**: taken from on/behind the serve line, from the ground or the
  hand, and must go directly to the other side. A serve that clips the
  hedge but still lands in gets replayed once; a second clip, a clip that
  then goes out, or a serve that never clears the hedge is a fault —
  point and serve go to the other team.
- **Rally**: a team must pass to a teammate at least once before sending
  the ball back over the hedge — the first touch of a possession is always
  a set, never a direct return. Once received, the ball may bounce once
  per turn anywhere (even off the pavement); a second bounce, or a shot
  that fails to clear the hedge, ends the point. The very first bounce of
  a crossing shot (before the receiving team touches it) must land inside
  the field, though — if it lands out, the sender is at fault.
- **Match**: first to 5 points, win by 2. In a rematch, the team that
  lost serves first. After a match, you can also play a best-of-3 decider.
- **Difficulty**: Makkelijk/Gemiddeld/Moeilijk tunes how often the AI
  opponent botches the pass-first rule — your own teammates never do.

## Project layout

- `index.html` — page shell, HUD markup, import map for three.js
- `src/main.js` — app entry point: rendering loop, input, hooks everything up
- `src/court.js` — the parking-lot/hedge/houses scene
- `src/players.js` — low-poly player rig, team setup and appearance re-skinning
- `src/roster.js` — the 13 selectable characters (name/hair/outfit)
- `src/portraits.js` — 2D canvas portrait generator for the team-select screen
- `src/ball.js` — ball physics, ground/hedge collision
- `src/ai.js` — AI teammates and opponents
- `src/rules.js` — the Hegbal rules/scoring state machine
- `src/camera.js`, `src/hud.js`, `src/audio.js`, `src/input.js`, `src/textures.js`
- `vendor/` — vendored three.js build (no CDN dependency)
