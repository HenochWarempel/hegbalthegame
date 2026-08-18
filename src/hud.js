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

export function showOverlay() { el('overlay').classList.remove('hidden'); }
export function hideOverlay() { el('overlay').classList.add('hidden'); }
export function hideLoading() { el('loading').style.display = 'none'; }

export function setMatchOverText(text) {
  el('matchOver').textContent = text;
}

export function setStartButtonLabel(text) {
  el('startBtn').textContent = text;
}
