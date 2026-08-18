import * as THREE from 'three';
import { COURT } from './court.js';
import { computeLaunchVelocity, GRAVITY } from './ball.js';

const REACH = 0.75;
const MAX_HIT_HEIGHT = 2.35;

function clampToCourt(x, z) {
  return {
    x: THREE.MathUtils.clamp(x, -COURT.halfWidth + 0.4, COURT.halfWidth - 0.4),
    z,
  };
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

export function updateAI(dt, { teamA, teamB, ball, match, onHit }) {
  updateTeamAI(dt, teamA, teamB, ball, match, 'A', onHit);
  updateTeamAI(dt, teamB, teamA, ball, match, 'B', onHit);
}

function updateTeamAI(dt, team, opponents, ball, match, teamId, onHit) {
  const aiPlayers = team.filter((p) => !p.isHuman);
  if (aiPlayers.length === 0) return;

  const ballOnOurSide = teamId === 'A' ? ball.position.z < 0 : ball.position.z > 0;
  const ourTurn = (match.phase === 'rally' && match.turnTeam === teamId) ||
    (match.phase === 'serve' && match.serverTeam === teamId);

  const serving = match.phase === 'serve' && match.serverTeam === teamId;
  let server = null;
  if (serving) {
    const idx = match.currentServerIndex ?? 0;
    server = team[idx] && !team[idx].isHuman ? team[idx] : null;
  }

  const predictedX = predictLandingX(ball);
  let receiver = null;
  if (!serving && aiPlayers.length) {
    receiver = aiPlayers.reduce((best, p) => {
      const d = Math.abs(p.homeSlot.x - predictedX);
      const bd = Math.abs(best.homeSlot.x - predictedX);
      return d < bd ? p : best;
    }, aiPlayers[0]);
  }

  for (const player of aiPlayers) {
    let desired = new THREE.Vector3(player.homeSlot.x, 0, player.homeSlot.z);

    if (serving && player === server) {
      const serveZ = teamId === 'A' ? -(COURT.serveLineZ + 0.3) : (COURT.serveLineZ + 0.3);
      desired.set(0, 0, serveZ);
    } else if (!serving && player === receiver && (ballOnOurSide || Math.abs(ball.velocity.y) > 0.1)) {
      const targetX = THREE.MathUtils.clamp(predictedX, -COURT.halfWidth + 0.5, COURT.halfWidth - 0.5);
      const homeZ = player.homeSlot.z;
      desired.set(targetX, 0, ballOnOurSide ? THREE.MathUtils.lerp(homeZ, ball.position.z, 0.5) : homeZ);
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
    // one tasked with playing the ball.
    const isDesignatedHitter = (serving && player === server) || (!serving && player === receiver);
    const allowedToAct = !serving || (match.serveReady !== false && !match.serveStruck);
    if (isDesignatedHitter && ourTurn && allowedToAct) {
      const dx = ball.position.x - player.group.position.x;
      const dz = ball.position.z - player.group.position.z;
      const distToBall = Math.hypot(dx, dz);
      if (distToBall < REACH && ball.position.y < MAX_HIT_HEIGHT && ball.velocity.y <= 6) {
        if (serving) match.serveStruck = true;
        hit(player, ball, opponents, teamId, serving, onHit);
      }
    }

    player.update(dt);
  }
}

function hit(player, ball, opponents, teamId, serving, onHit) {
  const start = new THREE.Vector3(player.group.position.x, Math.max(ball.position.y, 0.2), player.group.position.z);
  const target = pickTarget(teamId, opponents);
  // Modest imprecision so the AI doesn't clear the hedge by an inhuman margin
  // on every touch: real footvolley shots skim close and sometimes clip it.
  target.x += (Math.random() - 0.5) * 1.0;
  target.z += (Math.random() - 0.5) * 0.8;
  const apex = serving ? 0.75 + Math.random() * 0.7 : 0.35 + Math.random() * 1.15;
  const v = computeLaunchVelocity(start, target, COURT.hedge.height + apex);
  v.x += (Math.random() - 0.5) * 0.5;
  v.z += (Math.random() - 0.5) * 0.5;
  ball.velocity.copy(v);
  ball.position.y = Math.max(ball.position.y, 0.25);
  player.triggerKick();
  ball.lastTouchTeam = teamId;
  if (onHit) onHit(teamId);
}
