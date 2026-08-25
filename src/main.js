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

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
buildCourt(scene);

const hemi = new THREE.HemisphereLight(0xf4f6f2, 0x6b7a52, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.55);
sun.position.set(6, 12, -6);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe0ff, 0.25);
fill.position.set(-8, 6, 8);
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

const REACH = 0.75;
const MAX_HIT_HEIGHT = 2.35;
let gameStarted = false;
let hedgeRestTimer = 0;
let prevTotalScore = 0;
let serveCountdown = 0;

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
  onServe(team, rotationIndex, serveAttempt, matchRef) {
    const idx = team === 'A' ? humanIndex : rotationIndex;
    matchRef.currentServerIndex = idx;
    matchRef.serveReady = false;
    serveCountdown = 0.7;
    HUD.setServeIndicator(team);
    positionForNewPoint(team, idx);
    HUD.showBanner(team === 'A' ? 'JOUW OPSLAG' : 'OPSLAG TEGENSTANDER', 1000);
  },
  onServeRetake(team) {
    match.serveReady = false;
    serveCountdown = 0.7;
    positionForNewPoint(team, match.currentServerIndex, true);
  },
  onHedgeRest(team) {
    hedgeRestTimer = 0;
  },
  onMatchOver(winner) {
    gameStarted = false;
    const label = winner === 'A' ? 'Jouw team wint!' : 'De tegenstander wint!';
    HUD.setMatchOverText(`${label}  (${match.score.A} - ${match.score.B})`);
    HUD.setStartButtonLabel('Rematch');
    HUD.showOverlay();
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
  server.group.position.set(0, 0, sign * (COURT.serveLineZ + 0.4));
  server.group.rotation.y = serverTeam === 'A' ? Math.PI : 0;

  const ballZ = sign * (COURT.serveLineZ + 0.05);
  ball.place(0, ball.radius, ballZ);
}

function canPlayerTouch(team) {
  if (match.phase !== 'rally') return false;
  if (ball.restingOnHedge) return match.turnTeam === team;
  const ballSide = ball.position.z <= 0 ? 'A' : 'B';
  return ballSide === team && match.turnTeam === team;
}

function pickHumanTarget(player) {
  const move = Input.moveVector();
  const targetSideSign = player.team === 'A' ? 1 : -1;
  const spread = 4.2;
  const x = THREE.MathUtils.clamp(player.group.position.x + move.x * spread, -COURT.halfWidth + 0.4, COURT.halfWidth - 0.4);
  let depth;
  if (move.z > 0) depth = COURT.depth - 1.2; // Up: deep shot
  else if (move.z < 0) depth = 1.3; // Down: short dink
  else depth = 4.4;
  const z = targetSideSign * depth;
  return new THREE.Vector3(x, 0, z);
}

function pickPassTarget(player) {
  // A soft set to a teammate, entirely on our own side — no hedge to clear.
  const teammates = teamA.filter((p) => p !== player);
  const mate = teammates[Math.floor(Math.random() * teammates.length)] || player;
  const x = THREE.MathUtils.clamp(mate.homeSlot.x + (Math.random() - 0.5) * 1.5, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
  const z = -(1.8 + Math.random() * 3.2);
  return new THREE.Vector3(x, 0, z);
}

function humanHit(player, isServe) {
  const start = new THREE.Vector3(player.group.position.x, Math.max(ball.position.y, 0.2), player.group.position.z);
  // The rules require passing to a teammate at least once before sending the
  // ball back over the hedge, so the first touch of a possession is a set.
  const mustPassFirst = !isServe && (match.touchCount || 0) === 0;
  const target = mustPassFirst ? pickPassTarget(player) : pickHumanTarget(player);
  const apex = mustPassFirst ? 1.3 + Math.random() * 0.8
    : COURT.hedge.height + (isServe ? 1.1 : 0.6 + Math.random() * 0.9);
  const v = computeLaunchVelocity(start, target, apex);
  ball.velocity.copy(v);
  ball.position.y = Math.max(ball.position.y, 0.25);
  player.triggerKick();
  ball.lastTouchTeam = 'A';
  Audio.playKick();
}

function handleHumanInput(dt) {
  const player = teamA[humanIndex];
  if (Input.wasPressed('KeyQ')) {
    switchHuman((humanIndex + 1) % teamA.length);
    return;
  }

  const move = Input.moveVector();
  const dir = new THREE.Vector3(move.x, 0, move.z);
  if (dir.lengthSq() > 0) dir.normalize();
  player.velocity.set(dir.x * player.speed, 0, dir.z * player.speed);

  const nextX = THREE.MathUtils.clamp(player.group.position.x + player.velocity.x * dt, -(COURT.halfWidth + 3), COURT.halfWidth + 3);
  const nextZ = THREE.MathUtils.clamp(player.group.position.z + player.velocity.z * dt, -(COURT.depth + 3), -0.36);
  player.group.position.x = nextX;
  player.group.position.z = nextZ;
  if (dir.lengthSq() > 0) {
    const angle = Math.atan2(dir.x, dir.z) + Math.PI;
    player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, angle, 0.3);
  }

  const isServing = match.phase === 'serve' && match.serverTeam === 'A' && match.currentServerIndex === humanIndex;
  const spacePressed = Input.wasPressed('Space');

  if (isServing) {
    const alreadyStruck = match.serveStruck;
    HUD.setActiveHint(alreadyStruck ? '' : Math.abs(player.group.position.z) >= COURT.serveLineZ
      ? 'Spatie: opslag vanaf de grond | Shift+Spatie: vanuit de hand'
      : 'Ga achter de opslaglijn staan!');
    if (spacePressed && !alreadyStruck) {
      if (Math.abs(player.group.position.z) < COURT.serveLineZ) {
        HUD.showBanner('GA ACHTER DE LIJN STAAN', 700);
      } else {
        if (Input.isDown('ShiftLeft') || Input.isDown('ShiftRight')) {
          ball.position.y = 1.1; // struck straight from the hand
        }
        match.serveStruck = true;
        humanHit(player, true);
      }
    }
    return;
  }

  if (match.phase === 'rally') {
    const dx = ball.position.x - player.group.position.x;
    const dz = ball.position.z - player.group.position.z;
    const dist = Math.hypot(dx, dz);
    const canTouch = canPlayerTouch('A');
    const willPass = (match.touchCount || 0) === 0;
    HUD.setActiveHint(canTouch && dist < REACH + 0.5
      ? (willPass ? 'Spatie: overspelen naar teamgenoot' : 'Spatie: speel de bal over de heg')
      : '');
    if (spacePressed && canTouch && dist < REACH && ball.position.y < MAX_HIT_HEIGHT) {
      humanHit(player, false);
      match.recordTouch('A', player);
    }
  } else {
    HUD.setActiveHint('');
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
      teamA, teamB, ball, match,
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

let matchesPlayed = 0;
document.getElementById('startBtn').addEventListener('click', () => {
  HUD.hideOverlay();
  Audio.playKick();
  if (matchesPlayed > 0) match.rematch();
  matchesPlayed++;
  gameStarted = true;
});

HUD.hideLoading();
HUD.showOverlay();

if (window.__HEGBAL_DEBUG__) {
  window.__debug = { ball, match, teamA, teamB, get humanIndex() { return humanIndex; } };
}

animate();
