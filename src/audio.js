let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function envGain(ac, start, attack, decay, peak = 0.35) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.001, start + attack + decay);
  return g;
}

export function playKick() {
  const ac = getCtx();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const g = envGain(ac, t, 0.005, 0.15, 0.5);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

export function playBounce(strength = 1) {
  const ac = getCtx();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220 * strength, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
  const g = envGain(ac, t, 0.002, 0.09, 0.18 * strength);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

export function playHedgeRustle() {
  const ac = getCtx();
  const t = ac.currentTime;
  const bufferSize = ac.sampleRate * 0.18;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  noise.connect(filter).connect(g).connect(ac.destination);
  noise.start(t);
}

export function playWhistle() {
  const ac = getCtx();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, t);
  const g = envGain(ac, t, 0.01, 0.35, 0.12);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.4);
}

export function playPoint() {
  const ac = getCtx();
  const t = ac.currentTime;
  [660, 880, 1100].forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const start = t + i * 0.09;
    const g = envGain(ac, start, 0.005, 0.18, 0.22);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  });
}
