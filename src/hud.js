const el = (id) => document.getElementById(id);

let bannerTimeout = null;

export function setScore(score, setsA, setsB) {
  el('teamAScore').textContent = score.A;
  el('teamBScore').textContent = score.B;
  el('setsA').textContent = setsA;
  el('setsB').textContent = setsB;
}

export function setServeIndicator(team) {
  el('serveDotA').classList.toggle('show', team === 'A');
  el('serveDotB').classList.toggle('show', team === 'B');
}

export function showBanner(text, durationMs = 1200) {
  const banner = el('banner');
  clearTimeout(bannerTimeout);
  if (!text) {
    banner.classList.remove('show');
    return;
  }
  banner.textContent = text;
  banner.classList.add('show');
  if (durationMs > 0) {
    bannerTimeout = setTimeout(() => banner.classList.remove('show'), durationMs);
  }
}

export function setActiveHint(text) {
  el('activeHint').textContent = text;
}

export function showPointBanner(main, sub) {
  const box = el('pointBanner');
  if (!box) return;
  el('pointMain').textContent = main || '';
  el('pointSub').textContent = sub || '';
  box.classList.add('show');
}

export function hidePointBanner() {
  const box = el('pointBanner');
  if (box) box.classList.remove('show');
}

export function showGameOver(title, scoreText, opts = {}) {
  el('gameoverTitle').textContent = title || '';
  el('finalScoreLabel').textContent = opts.label || 'Eindstand';
  el('finalScore').textContent = scoreText || '';
  const verdict = el('gameoverVerdict');
  if (opts.verdict) {
    verdict.textContent = opts.verdict;
    verdict.classList.remove('hidden');
  } else {
    verdict.textContent = '';
    verdict.classList.add('hidden');
  }
  el('gameover').classList.remove('hidden');
}

export function hideGameOver() {
  el('gameover').classList.add('hidden');
}

export function setPower(frac, visible) {
  const bar = el('powerbar');
  if (!bar) return;
  bar.classList.toggle('show', !!visible);
  const w = Math.max(0, Math.min(1, frac || 0)) * 100;
  el('powerfill').style.width = w + '%';
}

export function showOverlay() { el('overlay').classList.remove('hidden'); }
export function hideOverlay() { el('overlay').classList.add('hidden'); }
export function showTeamSelect() { el('teamSelect').classList.remove('hidden'); }
export function hideTeamSelect() { el('teamSelect').classList.add('hidden'); }
export function hideLoading() { el('loading').style.display = 'none'; }

export function setTeamLabels(nameA, nameB) {
  if (nameA) el('teamAName').textContent = nameA;
  if (nameB) el('teamBName').textContent = nameB;
}

export function setMatchOverText(text) {
  el('matchOver').textContent = text;
}

export function setStartButtonLabel(text) {
  el('startBtn').textContent = text;
}
