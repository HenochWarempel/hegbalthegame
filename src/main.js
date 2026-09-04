import * as THREE from 'three';
import { COURT, buildCourt } from './court.js';
import { createTeams } from './players.js';
import { Ball, computeLaunchVelocity } from './ball.js';
import { updateAI } from './ai.js';
import { HegbalMatch } from './rules.js';
import { createCamera, updateCamera } from './camera.js';
import { Input } from './input.js';
import * as HUD from './hud.js';
import * as Audio from './audio.js';
import { ROSTER, DEFAULT_APPEARANCE, rosterById } from './roster.js';
import { portraitDataURL } from './portraits.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
app.prepend(renderer.domElement);

// A click during play is a shot, not a page interaction. Mouse input is bound
// to the canvas (see Input.bindMouse below) so menu clicks never count; here we
// just suppress selection/context-menu and give an aiming cursor.
renderer.domElement.style.touchAction = 'none';
renderer.domElement.style.cursor = 'crosshair';
document.body.style.userSelect = 'none';
Input.bindMouse(renderer.domElement);

const scene = new THREE.Scene();
buildCourt(scene);

const hemi = new THREE.HemisphereLight(0xeaf1ff, 0x5f6b4a, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
sun.position.set(9, 14, -7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
const sc = sun.shadow.camera;
sc.near = 1; sc.far = 48;
sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18;
sc.updateProjectionMatrix();
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
fill.position.set(-9, 7, 9);
scene.add(fill);

const camera = createCamera(window.innerWidth / window.innerHeight);
const { teamA, teamB } = createTeams(scene);
const ball = new Ball(scene);

let humanIndex = teamA.findIndex((p) => p.isHuman);

function switchHuman(newIndex) {
  if (newIndex === humanIndex) return;
  teamA[humanIndex].isHuman = false;
  teamA[newIndex].isHuman = true;
  humanIndex = newIndex;
}

// ---- Mouse aiming: project the cursor onto the ground and preview the shot ----
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _aimHit = new THREE.Vector3();

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.5, 28),
  new THREE.MeshBasicMaterial({ color: 0xffe37a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
reticle.rotation.x = -Math.PI / 2;
reticle.position.y = 0.03;
reticle.visible = false;
scene.add(reticle);

const landMark = new THREE.Mesh(
  new THREE.RingGeometry(0.26, 0.4, 24),
  new THREE.MeshBasicMaterial({ color: 0x8fd6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
);
landMark.rotation.x = -Math.PI / 2;
landMark.position.y = 0.028;
landMark.visible = false;
scene.add(landMark);

function mouseAimPoint() {
  raycaster.setFromCamera(Input.mouseNDC(), camera);
  return raycaster.ray.intersectPlane(groundPlane, _aimHit) ? _aimHit : null;
}
function clampToOpponent(pt, isServe) {
  const halfW = COURT.halfWidth;
  const x = THREE.MathUtils.clamp(pt.x, -(halfW - 0.4), halfW - 0.4);
  const zMin = isServe ? 0.9 : 0.6;
  const zMax = COURT.depth - (isServe ? 0.9 : 0.35);
  const z = THREE.MathUtils.clamp(Math.abs(pt.z), zMin, zMax); // opponent side is +z for team A
  return new THREE.Vector3(x, 0, z);
}
function predictLanding() {
  let x = ball.position.x, y = ball.position.y, z = ball.position.z;
  let vx = ball.velocity.x, vy = ball.velocity.y, vz = ball.velocity.z;
  const g = -13.5, h = 1 / 60;
  for (let i = 0; i < 240; i++) {
    vy += g * h; x += vx * h; y += vy * h; z += vz * h;
    if (y <= 0.12 && vy < 0) return { x, z };
  }
  return { x, z };
}
function nearestIndexToX(x) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < teamA.length; i++) {
    const d = Math.abs(teamA[i].group.position.x - x);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}
function nearestIndexToBall() {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < teamA.length; i++) {
    const d = Math.hypot(teamA[i].group.position.x - ball.position.x, teamA[i].group.position.z - ball.position.z);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

const REACH = 0.75;
const HIT_RANGE = 1.35;   // generous contact range (ball magnet reaches this far)
const MAX_HIT_HEIGHT = 2.6;
const MAX_CHARGE = 0.7; // seconds to reach full power
let spaceCharge = 0;
let gameStarted = false;
let decidingMatch = false;
let hedgeRestTimer = 0;
let prevTotalScore = 0;
let serveCountdown = 0;
let difficulty = 'medium';

const match = new HegbalMatch({
  onScore(score, setsA, setsB) {
    HUD.setScore(score, setsA, setsB);
    const total = score.A + score.B;
    if (total > prevTotalScore) Audio.playPoint();
    prevTotalScore = total;
  },
  onBanner(text, duration) {
    HUD.showBanner(text, duration);
    if (text) Audio.playWhistle();
  },
  onPoint(team, reason) {
    HUD.showPointBanner(reason, team === 'A' ? 'Punt voor jullie' : 'Punt voor de tegenstander');
    Audio.playWhistle();
  },
  onServe(team, rotationIndex, serveAttempt, matchRef) {
    HUD.hidePointBanner();
    const idx = team === 'A' ? humanIndex : rotationIndex;
    matchRef.currentServerIndex = idx;
    matchRef.serveReady = false;
    serveCountdown = 0.7;
    HUD.setServeIndicator(team);
    positionForNewPoint(team, idx);
    HUD.showBanner(team === 'A' ? 'JULLIE OPSLAG' : 'OPSLAG TEGENSTANDER', 1000);
  },
  onServeRetake(team) {
    HUD.hidePointBanner();
    match.serveReady = false;
    serveCountdown = 0.7;
    positionForNewPoint(team, match.currentServerIndex, true);
  },
  onHedgeRest(team) {
    hedgeRestTimer = 0;
  },
  onMatchOver(winner) {
    HUD.hidePointBanner();
    gameStarted = false;
    if (decidingMatch) {
      decidingMatch = false;
      const A = match.setsA;
      const B = match.setsB;
      // Tally before this deciding pot, to judge whether the decider overturned
      // the expected winner.
      const beforeA = winner === 'A' ? A - 1 : A;
      const beforeB = winner === 'B' ? B - 1 : B;
      // Only an upset (the decider's winner was trailing beforehand) is a
      // contradiction worth flagging with "maar ...".
      const upset = winner === 'A' ? beforeB > beforeA : beforeA > beforeB;
      const wonBy = winner === 'A' ? 'jullie hebben' : 'de computer heeft';
      const verdict = upset
        ? `${A}-${B} in potjes, maar ${wonBy} de winnende pot gewonnen.`
        : `${A}-${B} in potjes.`;
      const title = winner === 'A' ? 'Jullie winnen!' : 'De computer wint';
      HUD.showGameOver(title, `${A} - ${B}`, { label: 'Potjes deze pauze', verdict });
    } else {
      const label = winner === 'A' ? 'Jullie winnen!' : 'De tegenstander wint';
      HUD.showGameOver(label, `${match.score.A} - ${match.score.B}`);
    }
  },
});

function positionForNewPoint(serverTeam, serverIdx, retakeOnly = false) {
  if (!retakeOnly) {
    for (const p of teamA) p.group.position.set(p.homeSlot.x, 0, p.homeSlot.z);
    for (const p of teamB) p.group.position.set(p.homeSlot.x, 0, p.homeSlot.z);
  }
  const servingTeam = serverTeam === 'A' ? teamA : teamB;
  const server = servingTeam[serverIdx];
  const sign = serverTeam === 'A' ? -1 : 1;
  const serveZ = COURT.depth + 0.5; // on/behind the baseline, per the rules
  server.group.position.set(0, 0, sign * serveZ);
  server.group.rotation.y = serverTeam === 'A' ? Math.PI : 0;

  const ballZ = sign * (serveZ - 0.15);
  ball.place(0, ball.radius, ballZ);
}

function canPlayerTouch(team) {
  if (match.phase !== 'rally') return false;
  if (ball.restingOnHedge) return match.turnTeam === team;
  const ballSide = ball.position.z <= 0 ? 'A' : 'B';
  return ballSide === team && match.turnTeam === team;
}

function pickPassTarget(player, aimTarget) {
  // A soft set to a teammate on our own side. With the mouse, set toward the
  // teammate nearest the reticle; on keyboard, left/right chooses; otherwise
  // set to whoever is nearest the ball.
  const teammates = teamA.filter((p) => p !== player);
  let mate;
  if (aimTarget) {
    mate = teammates.reduce((a, b) =>
      Math.abs(b.group.position.x - aimTarget.x) < Math.abs(a.group.position.x - aimTarget.x) ? b : a);
  } else {
    const move = Input.moveVector();
    if (move.x > 0) mate = teammates.reduce((a, b) => (b.homeSlot.x > a.homeSlot.x ? b : a));
    else if (move.x < 0) mate = teammates.reduce((a, b) => (b.homeSlot.x < a.homeSlot.x ? b : a));
    else mate = teammates.reduce((a, b) =>
      Math.abs(b.group.position.x - ball.position.x) < Math.abs(a.group.position.x - ball.position.x) ? b : a);
  }
  const x = THREE.MathUtils.clamp(mate.group.position.x + (Math.random() - 0.5) * 0.6, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
  const z = -(1.6 + Math.random() * 2.4);
  return new THREE.Vector3(x, 0, z);
}

function humanHit(player, isServe, power = 0.6, aimTarget = null) {
  const start = new THREE.Vector3(player.group.position.x, Math.max(ball.position.y, 0.2), player.group.position.z);
  const mustPassFirst = !isServe && (match.touchCount || 0) === 0;
  const p = THREE.MathUtils.clamp(power, 0, 1);

  let target, apex;
  if (mustPassFirst) {
    target = pickPassTarget(player, aimTarget);
    apex = 1.25 + Math.random() * 0.5;
  } else if (aimTarget) {
    // Mouse: aim the exact spot; power controls loft/pace, not where it lands.
    target = clampToOpponent(aimTarget, isServe);
    apex = COURT.hedge.height + 0.4 + p * 1.3;
  } else {
    // Keyboard fallback: left/right = corner, up/down + power = depth & height.
    const move = Input.moveVector();
    const side = player.team === 'A' ? 1 : -1;
    const halfW = COURT.halfWidth;
    const up = move.z > 0 ? 1 : 0, down = move.z < 0 ? 1 : 0;
    const dMin = isServe ? 1.8 : 1.4, dMax = COURT.depth - (isServe ? 1.0 : 0.5);
    const depthFrac = THREE.MathUtils.clamp(p + 0.15 * up - 0.4 * down, 0, 1);
    const depth = THREE.MathUtils.lerp(dMin, dMax, depthFrac);
    const cornerX = halfW - (isServe ? 0.9 : 0.6);
    const tx = THREE.MathUtils.clamp(move.x !== 0 ? Math.sign(move.x) * cornerX : 0, -(halfW - 0.4), halfW - 0.4);
    target = new THREE.Vector3(tx, 0, side * depth);
    apex = COURT.hedge.height + 0.45 + p * 1.5 + 0.4 * up - 0.25 * down;
  }
  apex = Math.max(apex, COURT.hedge.height + 0.4);

  const v = computeLaunchVelocity(start, target, apex);
  if (!mustPassFirst) v.multiplyScalar(0.92 + p * 0.16); // fuller charge = more pace/carry
  ball.velocity.copy(v);
  ball.position.y = Math.max(ball.position.y, 0.25);
  player.triggerKick();
  ball.lastTouchTeam = 'A';
  Audio.playKick();
}

function handleHumanInput(dt) {
  // Switching players is manual only: right-click picks the player nearest the
  // ball, Q cycles through the three. No automatic switching.
  if (Input.mouseWasPressed(2)) switchHuman(nearestIndexToBall());
  if (Input.wasPressed('KeyQ')) switchHuman((humanIndex + 1) % teamA.length);

  const usingMouse = Input.usingMouse();
  const aimPt = usingMouse ? mouseAimPoint() : null;
  const actionDown = Input.isDown('Space') || Input.isMouseDown(0);
  const actionUp = Input.wasReleased('Space') || Input.mouseWasReleased(0);
  if (actionDown) spaceCharge = Math.min(MAX_CHARGE, spaceCharge + dt);
  const chargeFrac = spaceCharge / MAX_CHARGE;

  const isServing = match.phase === 'serve' && match.serverTeam === 'A' && match.currentServerIndex === humanIndex;

  const player = teamA[humanIndex];

  // ---- Movement (WASD or arrows), independent of aiming ----
  const move = Input.moveVector();
  const dir = new THREE.Vector3(move.x, 0, move.z);
  if (dir.lengthSq() > 0) dir.normalize();
  player.velocity.set(dir.x * player.speed, 0, dir.z * player.speed);
  player.group.position.x = THREE.MathUtils.clamp(player.group.position.x + player.velocity.x * dt, -(COURT.halfWidth + 3), COURT.halfWidth + 3);
  player.group.position.z = THREE.MathUtils.clamp(player.group.position.z + player.velocity.z * dt, -(COURT.depth + 3), -0.36);
  if (dir.lengthSq() > 0) {
    const angle = Math.atan2(dir.x, dir.z) + Math.PI;
    player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, angle, 0.3);
  }

  // ---- Reticle + incoming-landing marker ----
  const aimActive = usingMouse && aimPt && (isServing || (match.phase === 'rally' && canPlayerTouch('A')));
  if (aimActive) {
    const prev = clampToOpponent(aimPt, isServing);
    reticle.position.set(prev.x, 0.03, prev.z);
    reticle.visible = true;
  } else {
    reticle.visible = false;
  }
  if (match.phase === 'rally' && ball.velocity.z < -0.1) {
    const pr = predictLanding();
    if (pr.z < 0.2) { landMark.position.set(pr.x, 0.028, pr.z); landMark.visible = true; }
    else landMark.visible = false;
  } else {
    landMark.visible = false;
  }

  // ---- Serve ----
  if (isServing) {
    const behindLine = Math.abs(player.group.position.z) >= COURT.depth - 0.1;
    HUD.setActiveHint(match.serveStruck ? '' : behindLine
      ? 'Muis richt | linkermuis of Spatie: vasthouden voor kracht, loslaten om te slaan'
      : 'Ga achter de achterlijn staan!');
    HUD.setPower(chargeFrac, !match.serveStruck && behindLine && actionDown);
    if (actionUp && !match.serveStruck) {
      if (!behindLine) {
        HUD.showBanner('GA ACHTER DE LIJN STAAN', 700);
      } else {
        match.serveStruck = true;
        humanHit(player, true, chargeFrac, aimPt ? aimPt.clone() : null);
      }
      spaceCharge = 0;
      HUD.setPower(0, false);
    }
    return;
  }

  // ---- Rally ----
  if (match.phase === 'rally') {
    const dx = ball.position.x - player.group.position.x;
    const dz = ball.position.z - player.group.position.z;
    const dist = Math.hypot(dx, dz);
    const canTouch = canPlayerTouch('A');
    const willPass = (match.touchCount || 0) === 0;
    const inReach = canTouch && dist < HIT_RANGE && ball.position.y < MAX_HIT_HEIGHT && (player.hitCooldown || 0) <= 0;
    HUD.setActiveHint(canTouch && dist < HIT_RANGE + 0.6
      ? (willPass ? 'Set naar teamgenoot (muis of links/rechts kiest wie)' : 'Muis richt | linkermuis/Spatie vasthouden voor kracht, loslaten om te slaan')
      : '');
    HUD.setPower(chargeFrac, actionDown && inReach && !willPass);
    if (actionUp) {
      if (inReach) {
        // Ball magnet: lunge onto the ball so contact feels reliable.
        if (dist > 0.4) {
          const step = Math.min(0.75, dist - 0.3);
          player.group.position.x += (dx / dist) * step;
          player.group.position.z = THREE.MathUtils.clamp(player.group.position.z + (dz / dist) * step, -(COURT.depth + 3), -0.36);
        }
        humanHit(player, false, chargeFrac, aimPt ? aimPt.clone() : null);
        match.recordTouch('A', player);
        player.hitCooldown = 0.5;
      }
      spaceCharge = 0;
      HUD.setPower(0, false);
    }
  } else {
    HUD.setActiveHint('');
    if (actionUp) { spaceCharge = 0; HUD.setPower(0, false); }
  }
}

// "Ligt de bal stil op de heg? Dan mag de tegenpartij niet ingrijpen. Het team
// dat de bal over de heg probeerde te schieten, mag de bal alsnog een trap
// geven, zodat die in het veld van de tegenstander belandt." Normal AI/human
// play should reach and dislodge it; this is only a last-resort backstop in
// case nobody manages to in time, so the point still resolves like a real kick
// (through the same recordTouch accounting) instead of a random shove.
function forceDislodgeHedgeBall() {
  const team = match.turnTeam === 'A' ? teamA : teamB;
  let kicker = team[0];
  let bestDist = Infinity;
  for (const p of team) {
    const d = Math.hypot(ball.position.x - p.group.position.x, ball.position.z - p.group.position.z);
    if (d < bestDist) { bestDist = d; kicker = p; }
  }
  const start = new THREE.Vector3(kicker.group.position.x, Math.max(ball.position.y, 0.2), kicker.group.position.z);
  const sideSign = match.turnTeam === 'A' ? 1 : -1;
  const target = new THREE.Vector3(
    THREE.MathUtils.clamp((Math.random() - 0.5) * 8, -COURT.halfWidth + 0.6, COURT.halfWidth - 0.6),
    0,
    sideSign * (2.5 + Math.random() * 3)
  );
  const apex = COURT.hedge.height + 0.6 + Math.random() * 0.6;
  const v = computeLaunchVelocity(start, target, apex);
  ball.velocity.copy(v);
  ball.position.y = Math.max(ball.position.y, 0.3);
  kicker.triggerKick();
  ball.lastTouchTeam = match.turnTeam;
  match.recordTouch(match.turnTeam, kicker);
  Audio.playKick();
}

function updateHedgeRestSafety(dt) {
  if (ball.restingOnHedge && match.phase === 'rally') {
    hedgeRestTimer += dt;
    if (hedgeRestTimer > 4.5) {
      forceDislodgeHedgeBall();
      hedgeRestTimer = 0;
    }
  } else {
    hedgeRestTimer = 0;
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (gameStarted) {
    if (match.serveReady === false) {
      serveCountdown -= dt;
      if (serveCountdown <= 0) match.serveReady = true;
    }
    handleHumanInput(dt);
    updateAI(dt, {
      teamA, teamB, ball, match, difficulty,
      onHit(team) { Audio.playKick(); },
    });
    ball.update(dt);
    match.update(ball, dt);
    updateHedgeRestSafety(dt);

    for (const p of teamA) if (p !== teamA[humanIndex]) p.update(dt);
    teamA[humanIndex].update(dt);
    for (const p of teamB) p.update(dt);

    for (const p of [...teamA, ...teamB]) {
      p.setMarkerVisible(p.isHuman === true, 0xffe37a);
    }
  } else {
    for (const p of [...teamA, ...teamB]) p.update(dt);
    reticle.visible = false;
    landMark.visible = false;
  }

  updateCamera(camera, ball, dt);
  renderer.render(scene, camera);
  Input.clearFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.querySelectorAll('.diff-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    difficulty = btn.dataset.diff;
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

let matchesPlayed = 0;

// ---- Character select: a 3-step wizard. Step 1 picks who you play as,
// step 2 your 2 teammates, step 3 the 3 opponents. On every step, each slot
// is filled either by clicking a roster portrait or by typing a name. ----
const STEP_META = [
  { title: 'WIE BEN JIJ?', sub: 'Klik je poppetje aan, of typ je naam.', placeholders: ['Jouw naam'] },
  { title: 'KIES JE TWEE TEAMGENOTEN', sub: 'Klik twee poppetjes aan, of typ twee namen.', placeholders: ['Teamgenoot 1', 'Teamgenoot 2'] },
  { title: 'KIES JE DRIE TEGENSTANDERS', sub: 'Klik drie poppetjes aan, of typ drie namen.', placeholders: ['Tegenstander 1', 'Tegenstander 2', 'Tegenstander 3'] },
];
let tsStep = 1; // 1, 2, or 3
// Each step holds an array of slots; a slot is { rosterId, name }.
let tsSlots = [
  [{ rosterId: null, name: '' }],
  [{ rosterId: null, name: '' }, { rosterId: null, name: '' }],
  [{ rosterId: null, name: '' }, { rosterId: null, name: '' }, { rosterId: null, name: '' }],
];
let tsSlotInputEls = [];

const portraitCache = new Map();
function portraitFor(entry) {
  if (!portraitCache.has(entry.id)) portraitCache.set(entry.id, portraitDataURL(entry, 128));
  return portraitCache.get(entry.id);
}

function currentSlots() { return tsSlots[tsStep - 1]; }
function isSlotFilled(slot) { return !!slot.rosterId || slot.name.trim().length > 0; }
function stepValid() { return currentSlots().every(isSlotFilled); }
// A roster id used in a *different* step than the one being edited right now.
function usedElsewhere(id) {
  return tsSlots.some((slots, i) => i !== tsStep - 1 && slots.some((s) => s.rosterId === id));
}

function updateGridHighlight() {
  const slots = currentSlots();
  for (const card of document.getElementById('rosterGrid').children) {
    const id = card.dataset.id;
    const badge = card.querySelector('.rc-badge');
    const idx = slots.findIndex((s) => s.rosterId === id);
    card.classList.toggle('picked', idx >= 0);
    card.classList.toggle('disabled', idx < 0 && usedElsewhere(id));
    badge.textContent = idx >= 0 ? (slots.length > 1 ? String(idx + 1) : 'JIJ') : '';
  }
}

function updateSummary() {
  const label = (slots) => slots.every((s) => !isSlotFilled(s))
    ? 'nog niet gekozen'
    : slots.map((s) => (isSlotFilled(s) ? (s.name.trim() || '?') : '...')).join(', ');
  document.getElementById('tsSummary').innerHTML =
    `Jij: <b>${label(tsSlots[0])}</b> &middot; Team: <b>${label(tsSlots[1])}</b> &middot; Tegenstander: <b>${label(tsSlots[2])}</b>`;
}

function updateNextButton() {
  document.getElementById('btnTsNext').disabled = !stepValid();
}

function onRosterCardClick(id) {
  if (usedElsewhere(id)) return;
  const slots = currentSlots();
  const ownIdx = slots.findIndex((s) => s.rosterId === id);
  if (ownIdx >= 0) {
    slots[ownIdx].rosterId = null;
    slots[ownIdx].name = '';
    tsSlotInputEls[ownIdx].value = '';
  } else {
    const emptyIdx = slots.findIndex((s) => !isSlotFilled(s));
    if (emptyIdx < 0) return; // all slots already filled — deselect one first
    const entry = rosterById(id);
    slots[emptyIdx].rosterId = id;
    slots[emptyIdx].name = entry.name;
    tsSlotInputEls[emptyIdx].value = entry.name;
  }
  updateGridHighlight();
  updateSummary();
  updateNextButton();
}

function mountRosterGrid() {
  const grid = document.getElementById('rosterGrid');
  if (grid.childElementCount) return;
  for (const entry of ROSTER) {
    const card = document.createElement('div');
    card.className = 'roster-card';
    card.dataset.id = entry.id;
    card.innerHTML = `<img src="${portraitFor(entry)}" alt="" /><div class="rc-name">${entry.name}</div><div class="rc-badge"></div>`;
    card.addEventListener('click', () => onRosterCardClick(entry.id));
    grid.appendChild(card);
  }
}

function mountStep() {
  const meta = STEP_META[tsStep - 1];
  document.getElementById('tsProgress').textContent = `STAP ${tsStep} VAN 3`;
  document.getElementById('tsStepTitle').textContent = meta.title;
  document.getElementById('tsStepSub').textContent = meta.sub;

  const slotsBox = document.getElementById('tsSlots');
  slotsBox.innerHTML = '';
  tsSlotInputEls = currentSlots().map((slot, i) => {
    const input = document.createElement('input');
    input.className = 'ts-slot-input';
    input.type = 'text';
    input.maxLength = 16;
    input.autocomplete = 'off';
    input.placeholder = meta.placeholders[i];
    input.value = slot.name;
    input.addEventListener('input', (e) => {
      slot.rosterId = null;
      slot.name = e.target.value;
      input.classList.toggle('filled', slot.name.trim().length > 0);
      updateGridHighlight();
      updateSummary();
      updateNextButton();
    });
    slotsBox.appendChild(input);
    return input;
  });

  mountRosterGrid();
  updateGridHighlight();
  updateSummary();
  updateNextButton();

  document.getElementById('btnTsBack').textContent = tsStep === 1 ? 'Terug' : 'Vorige';
  document.getElementById('btnTsNext').textContent = tsStep === 3 ? 'Start wedstrijd' : 'Volgende';
}

document.getElementById('btnTsBack').addEventListener('click', () => {
  if (tsStep > 1) { tsStep--; mountStep(); return; }
  HUD.hideTeamSelect();
  HUD.showOverlay();
});
document.getElementById('btnTsNext').addEventListener('click', () => {
  if (!stepValid()) return;
  if (tsStep < 3) { tsStep++; mountStep(); return; }
  startMatchFromSelection();
});

function startMatchFromSelection() {
  const slotAppearance = (slot) => slot.rosterId
    ? { ...rosterById(slot.rosterId), name: slot.name.trim() || rosterById(slot.rosterId).name }
    : { ...DEFAULT_APPEARANCE, name: slot.name.trim() || 'Speler' };

  const you = slotAppearance(tsSlots[0][0]);
  const mates = tsSlots[1].map(slotAppearance);
  const opps = tsSlots[2].map(slotAppearance);

  teamA[0].applyAppearance(mates[0]);
  teamA[1].applyAppearance(you);
  teamA[2].applyAppearance(mates[1]);
  teamB[0].applyAppearance(opps[0]);
  teamB[1].applyAppearance(opps[1]);
  teamB[2].applyAppearance(opps[2]);

  for (const p of teamA) p.isHuman = false;
  teamA[1].isHuman = true;
  humanIndex = 1;

  HUD.setTeamLabels(`TEAM ${you.name}`.toUpperCase(), 'TEGENSTANDER');

  HUD.hideTeamSelect();
  Audio.playKick();
  if (matchesPlayed > 0) match.rematch();
  matchesPlayed++;
  decidingMatch = false;
  Input.clearFrame(); // drop the starting click so it isn't read as a serve
  gameStarted = true;
}

document.getElementById('startBtn').addEventListener('click', () => {
  HUD.hideOverlay();
  HUD.showTeamSelect();
  tsStep = 1;
  tsSlots = [
    [{ rosterId: null, name: '' }],
    [{ rosterId: null, name: '' }, { rosterId: null, name: '' }],
    [{ rosterId: null, name: '' }, { rosterId: null, name: '' }, { rosterId: null, name: '' }],
  ];
  mountStep();
});

document.getElementById('btnRematch').addEventListener('click', () => {
  HUD.hideGameOver();
  Audio.playKick();
  match.rematch();
  matchesPlayed++;
  decidingMatch = false;
  Input.clearFrame();
  gameStarted = true;
});

document.getElementById('btnDecider').addEventListener('click', () => {
  HUD.hideGameOver();
  Audio.playKick();
  match.rematch();
  matchesPlayed++;
  decidingMatch = true;
  Input.clearFrame();
  gameStarted = true;
  HUD.showBanner('WINNENDE POTJE!', 1600);
});

document.getElementById('btnToMenu').addEventListener('click', () => {
  HUD.hideGameOver();
  HUD.showOverlay();
});

HUD.hideLoading();
HUD.showOverlay();

if (window.__HEGBAL_DEBUG__) {
  window.__debug = { ball, match, teamA, teamB, get humanIndex() { return humanIndex; }, get difficulty() { return difficulty; } };
  window.__updateAITick = () => updateAI(1 / 60, { teamA, teamB, ball, match, difficulty, onHit() {} });
}

animate();
