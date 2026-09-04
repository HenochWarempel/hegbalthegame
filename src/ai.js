import * as THREE from 'three';
import { COURT } from './court.js';
import { computeLaunchVelocity, GRAVITY } from './ball.js';

const REACH = 0.95;
const MAX_HIT_HEIGHT = 2.6;

// How often the opponent (team B) botches the "pass to a teammate first"
// rule and just smacks it back over on their first touch — which the rules
// engine then correctly punishes as a fault. Team A's own players never do
// this on purpose; the difficulty only tunes how sharp the opponent is.
const OPPONENT_MISTAKE_RATE = { easy: 0.32, medium: 0.1, hard: 0.015 };

function clampToCourt(x, z) {
  return {
    x: THREE.MathUtils.clamp(x, -COURT.halfWidth + 0.4, COURT.halfWidth - 0.4),
    z,
  };
}

function pickPassTarget(hitterTeam, team, player) {
  // A soft set to a teammate on our own side. On the human's team, keep the
  // human involved: about three of every four sets go to them (aimed where they
  // actually are), the rest to another teammate.
  const teammates = team.filter((p) => p !== player);
  const human = teammates.find((p) => p.isHuman);
  const others = teammates.filter((p) => !p.isHuman);
  let mate;
  if (human && others.length && Math.random() < 0.75) mate = human;      // 3 of 4 to the human
  else if (human && others.length) mate = others[Math.floor(Math.random() * others.length)];
  else mate = teammates[Math.floor(Math.random() * teammates.length)] || player;

  const sideSign = hitterTeam === 'A' ? -1 : 1;
  const mx = mate.group.position.x;
  const mz = mate.group.position.z;
  const x = THREE.MathUtils.clamp(mx + (Math.random() - 0.5) * 0.8, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
  // Land it just in front of the target teammate, on our own side of the hedge.
  const zMag = THREE.MathUtils.clamp(Math.abs(mz) - 0.4 - Math.random() * 0.6, 1.2, COURT.depth - 0.8);
  return new THREE.Vector3(x, 0, sideSign * zMag);
}

function pickTarget(hitterTeam, opponents) {
  // Aim at whichever half of the opponent's court has the least defensive coverage.
  const targetSideSign = hitterTeam === 'A' ? 1 : -1;
  const leftCount = opponents.filter((p) => p.position.x < 0).length;
  const rightCount = opponents.length - leftCount;
  const wantLeft = leftCount <= rightCount;
  const xBase = wantLeft ? -2.6 - Math.random() * 2.2 : 2.6 + Math.random() * 2.2;
  const depthPick = Math.random();
  const z = targetSideSign * (depthPick < 0.4 ? 1.6 + Math.random() : 4 + Math.random() * 3.2);
  const { x } = clampToCourt(xBase, z);
  return new THREE.Vector3(x, 0, z);
}

function predictLandingX(ball) {
  if (ball.velocity.y >= -0.1) return ball.position.x;
  const dy = 0 - ball.position.y;
  const disc = ball.velocity.y * ball.velocity.y - 2 * GRAVITY * -dy;
  if (disc < 0) return ball.position.x;
  const t = (-ball.velocity.y + Math.sqrt(disc)) / GRAVITY;
  return ball.position.x + ball.velocity.x * Math.max(t, 0);
}

// Where the ball will next touch the ground (x and z), by integrating its
// current trajectory. Lets a receiver run to the actual landing spot instead
// of only shading toward its x, so fast/deep balls (and serves) get returned.
function predictLanding(ball) {
  let x = ball.position.x, y = ball.position.y, z = ball.position.z;
  let vx = ball.velocity.x, vy = ball.velocity.y, vz = ball.velocity.z;
  const h = 1 / 120;
  for (let t = 0; t < 3; t += h) {
    vy += GRAVITY * h; x += vx * h; y += vy * h; z += vz * h;
    if (y <= 0 && vy < 0) return { x, z };
  }
  return { x: ball.position.x, z: ball.position.z };
}

export function updateAI(dt, { teamA, teamB, ball, match, onHit, difficulty }) {
  updateTeamAI(dt, teamA, teamB, ball, match, 'A', onHit, difficulty);
  updateTeamAI(dt, teamB, teamA, ball, match, 'B', onHit, difficulty);
}

function updateTeamAI(dt, team, opponents, ball, match, teamId, onHit, difficulty) {
  const aiPlayers = team.filter((p) => !p.isHuman);
  if (aiPlayers.length === 0) return;

  const ballOnOurSide = teamId === 'A' ? ball.position.z < 0 : ball.position.z > 0;
  const ballResting = ball.restingOnHedge;
  const ourTurn = (match.phase === 'rally' && match.turnTeam === teamId) ||
    (match.phase === 'serve' && match.serverTeam === teamId);

  const serving = match.phase === 'serve' && match.serverTeam === teamId;
  let server = null;
  if (serving) {
    const idx = match.currentServerIndex ?? 0;
    server = team[idx] && !team[idx].isHuman ? team[idx] : null;
  }

  const predictedX = predictLandingX(ball);
  const landing = predictLanding(ball);
  const distToLanding = (p) => Math.hypot(p.group.position.x - landing.x, p.group.position.z - landing.z);
  let receiver = null;
  if (!serving && aiPlayers.length) {
    // Exclude whoever already touched the ball this possession so a
    // genuinely different teammate is the one who steps in next.
    const alreadyTouched = (match.phase === 'rally' && match.touchPlayers) || new Set();
    const untouched = aiPlayers.filter((p) => !alreadyTouched.has(p) && (p.hitCooldown || 0) <= 0);
    const pool = untouched.length ? untouched : aiPlayers.filter((p) => (p.hitCooldown || 0) <= 0);
    const finalPool = pool.length ? pool : aiPlayers;
    const bestAI = finalPool.reduce((best, p) => (distToLanding(p) < distToLanding(best) ? p : best), finalPool[0]);

    // If the ball is landing (about) closest to the human, it's theirs — the AI
    // teammates hold their positions and cover the court instead of poaching a
    // ball meant for the player. Only if the human clearly isn't going for it
    // does an AI step in to rescue.
    const human = team.find((p) => p.isHuman);
    const humanTakesIt = human && !alreadyTouched.has(human) &&
      distToLanding(human) <= distToLanding(bestAI) + 0.7;
    receiver = humanTakesIt ? null : bestAI;
  }

  for (const player of aiPlayers) {
    let desired = new THREE.Vector3(player.homeSlot.x, 0, player.homeSlot.z);

    if (serving && player === server) {
      // Serve from wherever the ball has been placed (the baseline). Walking to
      // the old fixed serve line left the server standing away from the ball,
      // so it could never make contact and the point stalled.
      if (!match.serveStruck) desired.set(ball.position.x, 0, ball.position.z);
      else desired.set(player.homeSlot.x, 0, player.homeSlot.z);
    } else if (!serving && player === receiver) {
      const land = predictLanding(ball);
      const landOurSide = teamId === 'A' ? land.z < 0.2 : land.z > -0.2;
      if (ballResting && ourTurn) {
        // Ball stuck on the hedge and ours to finish sending over: beeline for
        // the boundary right under it.
        const boundaryZ = teamId === 'A' ? -0.36 : 0.36;
        const targetX = THREE.MathUtils.clamp(ball.position.x, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
        desired.set(targetX, 0, boundaryZ);
      } else if (landOurSide || ballOnOurSide || Math.abs(ball.velocity.y) > 0.1) {
        // Run all the way to where the ball will land so it actually gets
        // returned instead of bouncing twice just out of reach.
        const tx = THREE.MathUtils.clamp(land.x, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
        const tz = teamId === 'A'
          ? THREE.MathUtils.clamp(land.z, -(COURT.depth), -0.5)
          : THREE.MathUtils.clamp(land.z, 0.5, COURT.depth);
        desired.set(tx, 0, tz);
      } else {
        // Ball still on the far side: hold a ready position shaded to where it's
        // likely to come.
        desired.set(THREE.MathUtils.clamp(land.x, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5), 0, player.homeSlot.z);
      }
    } else {
      // Shade slightly toward the ball for a more alive-looking defensive shuffle.
      const shade = THREE.MathUtils.clamp((predictedX - player.homeSlot.x) * 0.25, -1.2, 1.2);
      desired.set(player.homeSlot.x + shade, 0, player.homeSlot.z);
    }

    const toDesired = new THREE.Vector3(desired.x - player.position.x, 0, desired.z - player.position.z);
    const dist = toDesired.length();
    if (dist > 0.12) {
      toDesired.normalize();
      player.velocity.set(toDesired.x * player.speed, 0, toDesired.z * player.speed);
      player.group.position.x += player.velocity.x * dt;
      player.group.position.z += player.velocity.z * dt;
      const angle = Math.atan2(toDesired.x, toDesired.z);
      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, angle, 0.2);
    } else {
      player.velocity.set(0, 0, 0);
    }

    // Attempt a hit when in reach, it's our turn/serve, and this player is the
    // one tasked with playing the ball (and isn't still cooling down from
    // having just touched it).
    const isDesignatedHitter = (serving && player === server) || (!serving && player === receiver);
    const allowedToAct = !serving || (match.serveReady !== false && !match.serveStruck);
    if (isDesignatedHitter && ourTurn && allowedToAct && (player.hitCooldown || 0) <= 0) {
      const dx = ball.position.x - player.group.position.x;
      const dz = ball.position.z - player.group.position.z;
      const distToBall = Math.hypot(dx, dz);
      if (distToBall < REACH && ball.position.y < MAX_HIT_HEIGHT && ball.velocity.y <= 6) {
        if (serving) match.serveStruck = true;
        hit(player, ball, team, opponents, teamId, serving, match, difficulty, onHit);
        match.recordTouch(teamId, player);
        player.hitCooldown = 0.5;
      }
    }

    player.update(dt);
  }
}

function hit(player, ball, team, opponents, teamId, serving, match, difficulty, onHit) {
  const start = new THREE.Vector3(player.group.position.x, Math.max(ball.position.y, 0.2), player.group.position.z);
  // The rules require at least one pass to a teammate before sending it back
  // over the hedge, so the first touch of a possession is always a soft set —
  // except the opponent occasionally botches this (the difficulty setting
  // tunes how often), which the rules engine then correctly punishes.
  let mustPassFirst = !serving && (match.touchCount || 0) === 0 && team.length > 1;
  if (mustPassFirst && teamId === 'B') {
    const mistakeRate = OPPONENT_MISTAKE_RATE[difficulty] ?? OPPONENT_MISTAKE_RATE.medium;
    if (Math.random() < mistakeRate) mustPassFirst = false;
  }
  // The rules only require ONE pass before crossing, and the fast play is to
  // cross right after it. But you're allowed more — so very occasionally keep
  // the ball alive with a second set among teammates before sending it over.
  if (!serving && !mustPassFirst && team.length > 1 &&
      (match.touchCount || 0) >= 1 && (match.touchCount || 0) < 3 &&
      Math.random() < 0.12) {
    mustPassFirst = true;
  }

  let target, apexWorld;
  let skim = false;
  if (mustPassFirst) {
    target = pickPassTarget(teamId, team, player);
    apexWorld = 1.3 + Math.random() * 0.8;
  } else {
    target = pickTarget(teamId, opponents);
    // Sporadically play a net-skimmer: clip the top of the hedge and drop it
    // just over into the opponent's court instead of a clean high clearance.
    skim = !serving && Math.random() < 0.07;
    if (skim) {
      const sideSign = teamId === 'A' ? 1 : -1;
      const tz = 1.1 + Math.random() * 1.5;
      const clamped = clampToCourt((Math.random() - 0.5) * 6.4, tz);
      target.set(clamped.x, 0, sideSign * tz);
      apexWorld = COURT.hedge.height + 0.1 + Math.random() * 0.22; // just grazes the top
    } else {
      // Modest imprecision so the AI doesn't clear the hedge by an inhuman
      // margin on every touch, but keep shots reachable so rallies last.
      target.x += (Math.random() - 0.5) * 0.7;
      target.z += (Math.random() - 0.5) * 0.6;
      const apexAboveHedge = serving ? 0.75 + Math.random() * 0.7 : 0.8 + Math.random() * 0.9;
      apexWorld = COURT.hedge.height + apexAboveHedge;
    }
  }

  const v = computeLaunchVelocity(start, target, apexWorld);
  if (!mustPassFirst && !skim) {
    v.x += (Math.random() - 0.5) * 0.5;
    v.z += (Math.random() - 0.5) * 0.5;
  }
  ball.velocity.copy(v);
  ball.position.y = Math.max(ball.position.y, 0.25);
  player.triggerKick();
  ball.lastTouchTeam = teamId;
  if (onHit) onHit(teamId);
}
