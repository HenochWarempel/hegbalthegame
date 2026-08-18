import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Herringbone brick paver pattern, like the parking lot in the reference photo.
export function makePaverTexture() {
  const size = 256;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8f8a82';
  ctx.fillRect(0, 0, size, size);

  const brickW = 34, brickH = 14, gap = 2;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-size, -size);
  for (let y = -brickH; y < size * 2; y += brickH + gap) {
    let offset = (Math.floor(y / (brickH + gap)) % 2 === 0) ? 0 : (brickW + gap) / 2;
    for (let x = -brickW + offset; x < size * 2; x += brickW + gap) {
      const shade = 0.82 + Math.random() * 0.22;
      const grey = Math.random() > 0.5;
      const base = grey ? [128, 124, 116] : [150, 108, 88];
      ctx.fillStyle = `rgb(${base[0] * shade | 0},${base[1] * shade | 0},${base[2] * shade | 0})`;
      ctx.fillRect(x, y, brickW, brickH);
    }
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGrassTexture() {
  const size = 128;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c7a3f';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const l = 2 + Math.random() * 4;
    const shade = 0.7 + Math.random() * 0.5;
    ctx.strokeStyle = `rgba(${60 * shade | 0},${110 * shade | 0},${40 * shade | 0},0.8)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - l);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeHedgeTexture() {
  const size = 128;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f5d2a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 1 + Math.random() * 2.4;
    const shade = 0.6 + Math.random() * 0.7;
    ctx.fillStyle = `rgba(${40 * shade | 0},${95 * shade | 0},${35 * shade | 0},0.9)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSkyTexture() {
  const w = 4, h = 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#c9d3d6');
  grad.addColorStop(0.45, '#dfe6e4');
  grad.addColorStop(1, '#eef0e8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBrickWallTexture(colorA = '#a6482f', colorB = '#8f3c26') {
  const size = 64;
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = colorB;
  const bw = 16, bh = 8;
  for (let y = 0; y < size; y += bh) {
    const offset = (y / bh) % 2 === 0 ? 0 : bw / 2;
    for (let x = -bw; x < size; x += bw) {
      ctx.fillRect(x + offset + 1, y + 1, bw - 2, bh - 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
