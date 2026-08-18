import { COURT } from './court.js';

const other = (team) => (team === 'A' ? 'B' : 'A');

const WIN_SCORE = 5;

export class HegbalMatch {
  constructor(hooks) {
    this.hooks = hooks; // { onBanner, onScore, onServe, onMatchOver, onHedgeRest }
    this.setsA = 0;
    this.setsB = 0;
    this.serverRotation = { A: 0, B: 0 };
    this.lastServer = Math.random() < 0.5 ? 'A' : 'B';
    this.newGame(this.lastServer);
  }

  newGame(firstServer) {
    this.score = { A: 0, B: 0 };
    this.phase = 'idle'; // 'serve' | 'rally' | 'over'
    this.lastServer = firstServer;
    this.hooks.onScore(this.score, this.setsA, this.setsB);
    this.beginServeSequence(firstServer);
  }

  rematch() {
    this.newGame(this.loser);
  }

  beginServeSequence(team) {
    this.serverTeam = team;
    this.serveAttempt = 1;
    this.serveGrazed = false;
    this.serveStruck = false;
    this.phase = 'serve';
    this.trackedSide = team;
    const rotationIndex = this.serverRotation[team] % 3;
    this.serverRotation[team]++;
    this.hooks.onServe(team, rotationIndex, this.serveAttempt, this);
  }

  letServe() {
    this.serveAttempt = 2;
    this.serveGrazed = false;
    this.serveStruck = false;
    this.hooks.onBanner('LET! NOG EEN KANS', 1400);
    this.hooks.onServeRetake(this.serverTeam);
  }

  isInBounds(x, z) {
    const withinWidth = Math.abs(x) <= COURT.halfWidth + 0.05;
    const edge = COURT.hedge.halfThickness + 0.1;
    const withinDepth = Math.abs(z) >= edge && Math.abs(z) <= COURT.depth + 0.4;
    return withinWidth && withinDepth;
  }

  awardPoint(scoringTeam, reason) {
    this.score[scoringTeam]++;
    this.hooks.onScore(this.score, this.setsA, this.setsB);
    if (reason) this.hooks.onBanner(reason, 1300);

    const leader = this.score[scoringTeam];
    const trailer = this.score[other(scoringTeam)];
    if (leader >= WIN_SCORE && leader - trailer >= 2) {
      this.winner = scoringTeam;
      this.loser = other(scoringTeam);
      if (scoringTeam === 'A') this.setsA++; else this.setsB++;
      this.phase = 'over';
      this.hooks.onMatchOver(scoringTeam);
      return;
    }

    const nextServer = other(this.lastServer);
    this.lastServer = nextServer;
    setTimeout(() => {
      if (this.phase !== 'over') this.beginServeSequence(nextServer);
    }, 900);
    this.phase = 'idle';
  }

  faultServe(reason) {
    this.awardPoint(other(this.serverTeam), reason);
  }

  faultRally(winningTeam, reason) {
    this.awardPoint(winningTeam, reason);
  }

  startRally(receiverSide) {
    this.phase = 'rally';
    this.turnTeam = receiverSide;
    this.trackedSide = receiverSide;
    this.bounceCount = 1;
    this.touchCount = 0;
    this.rallyTimer = 0;
    this.hooks.onBanner('', 0);
  }

  // "Je moet minstens één keer overspelen": a team must pass the ball to a
  // teammate at least once before sending it back over the hedge — you
  // can't just return it on your very first touch.
  recordTouch(team) {
    if (this.phase === 'rally' && team === this.turnTeam) {
      this.touchCount = (this.touchCount || 0) + 1;
    }
  }

  update(ball, dt) {
    if (this.phase === 'rally') {
      this.rallyTimer = (this.rallyTimer || 0) + dt;
      if (this.rallyTimer > 14) {
        this.faultRally(other(this.turnTeam), 'TE LANG DEZELFDE KANT');
        return;
      }
    }

    const events = ball.drainEvents();
    const currentSide = ball.position.z < 0 ? 'A' : 'B';

    if (this.phase === 'serve') {
      for (const ev of events) {
        if (ev.type === 'hedge_blocked' || ev.type === 'rest_on_hedge') {
          this.faultServe('OPSLAG IN DE HEG');
          return;
        }
        if (ev.type === 'hedge_graze') {
          this.serveGrazed = true;
        }
        if (ev.type === 'bounce') {
          if (ev.side === this.serverTeam) {
            this.faultServe('OPSLAG NIET OVER');
            return;
          }
          const inBounds = this.isInBounds(ev.x, ev.z);
          if (this.serveGrazed) {
            if (!inBounds) { this.faultServe('OPSLAG VIA DE HEG EN UIT'); return; }
            if (this.serveAttempt === 1) { this.letServe(); return; }
            this.faultServe('TWEEDE OPSLAG VIA DE HEG'); return;
          } else {
            if (!inBounds) { this.faultServe('OPSLAG UIT'); return; }
            this.startRally(ev.side);
            return;
          }
        }
      }
      return;
    }

    if (this.phase === 'rally') {
      if (currentSide !== this.trackedSide) {
        const blockedThisFrame = events.some((e) => e.type === 'hedge_blocked');
        if (!blockedThisFrame) {
          if ((this.touchCount || 0) < 2) {
            this.faultRally(other(this.turnTeam), 'NIET OVERGESPEELD');
            return;
          }
          this.turnTeam = currentSide;
          this.trackedSide = currentSide;
          this.bounceCount = 0;
          this.touchCount = 0;
          this.rallyTimer = 0;
        }
      }
      for (const ev of events) {
        if (ev.type === 'hedge_blocked') {
          this.faultRally(other(this.turnTeam), 'NIET OVER DE HEG');
          return;
        }
        if (ev.type === 'bounce') {
          if (ev.side === this.turnTeam) {
            this.bounceCount = (this.bounceCount || 0) + 1;
            if (this.bounceCount >= 2) {
              this.faultRally(other(this.turnTeam), 'TWEE KEER GESTUITERD');
              return;
            }
          } else {
            if ((this.touchCount || 0) < 2) {
              this.faultRally(other(this.turnTeam), 'NIET OVERGESPEELD');
              return;
            }
            this.turnTeam = ev.side;
            this.trackedSide = ev.side;
            this.bounceCount = 1;
            this.touchCount = 0;
            this.rallyTimer = 0;
          }
        }
        if (ev.type === 'rest_on_hedge' && this.hooks.onHedgeRest) {
          this.hooks.onHedgeRest(this.turnTeam);
        }
      }
    }
  }
}
