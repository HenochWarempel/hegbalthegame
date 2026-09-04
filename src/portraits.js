// Small stylized 2D "poppetje" portraits for the character-select screen.
// Drawn on a canvas instead of rendered from the 3D rig — cheap, robust, and
// easy to keep in sync with the hairStyle/outfit vocabulary in roster.js.

const SKIN_TONES = ['#f0c9a0', '#e0b394', '#c68a5f', '#8d5a3c'];

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function hex(n) {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

function drawHair(ctx, style, color, cx, cy, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (style) {
    case 'bald':
      return; // nothing to draw
    case 'buzz':
      ctx.arc(cx, cy, r * 1.03, Math.PI, Math.PI * 2);
      ctx.fill();
      return;
    case 'quiff':
      ctx.arc(cx, cy, r * 1.05, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.15, cy - r * 0.95, r * 0.32, r * 0.4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'mid':
      ctx.arc(cx, cy, r * 1.12, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.95, cy + r * 0.15, r * 0.28, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.95, cy + r * 0.15, r * 0.28, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'long':
      ctx.arc(cx, cy, r * 1.12, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - r * 1.05, cy + r * 0.75, r * 0.34, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 1.05, cy + r * 0.75, r * 0.34, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'short':
    default:
      ctx.arc(cx, cy, r * 1.08, Math.PI * 0.98, Math.PI * 2.02);
      ctx.fill();
      return;
  }
}

// appearance: { hairStyle, hairColor (number), outfit (number), glasses?, beard?, skinSeed? }
export function drawPortrait(ctx, size, appearance) {
  const cx = size / 2;
  const skinTone = SKIN_TONES[hashId(appearance.skinSeed || 'x') % SKIN_TONES.length];
  const outfit = hex(appearance.outfit);

  ctx.clearRect(0, 0, size, size);

  // background disc
  ctx.fillStyle = '#20301f';
  ctx.beginPath();
  ctx.arc(cx, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // shoulders / jersey
  ctx.fillStyle = outfit;
  ctx.beginPath();
  ctx.ellipse(cx, size * 1.02, size * 0.46, size * 0.34, 0, Math.PI, 0, true);
  ctx.fill();

  const headR = size * 0.27;
  const headCy = size * 0.46;

  // neck
  ctx.fillStyle = skinTone;
  ctx.fillRect(cx - size * 0.06, headCy + headR * 0.55, size * 0.12, size * 0.14);

  // head
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.beginPath();
  ctx.arc(cx - headR * 0.98, headCy + headR * 0.1, headR * 0.16, 0, Math.PI * 2);
  ctx.arc(cx + headR * 0.98, headCy + headR * 0.1, headR * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#22201c';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.36, headCy + headR * 0.05, headR * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + headR * 0.36, headCy + headR * 0.05, headR * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // beard
  if (appearance.beard) {
    ctx.fillStyle = hex(appearance.hairColor);
    ctx.beginPath();
    ctx.ellipse(cx, headCy + headR * 0.55, headR * 0.68, headR * 0.5, 0, 0, Math.PI, false);
    ctx.fill();
  }

  // hair (drawn last so a low fringe overlaps the forehead correctly)
  drawHair(ctx, appearance.hairStyle, hex(appearance.hairColor), cx, headCy - headR * 0.15, headR);

  // glasses
  if (appearance.glasses) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = Math.max(1.5, size * 0.018);
    ctx.beginPath();
    ctx.arc(cx - headR * 0.36, headCy + headR * 0.05, headR * 0.22, 0, Math.PI * 2);
    ctx.arc(cx + headR * 0.36, headCy + headR * 0.05, headR * 0.22, 0, Math.PI * 2);
    ctx.moveTo(cx - headR * 0.14, headCy + headR * 0.05);
    ctx.lineTo(cx + headR * 0.14, headCy + headR * 0.05);
    ctx.stroke();
  }
}

export function portraitDataURL(appearance, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawPortrait(ctx, size, appearance);
  return canvas.toDataURL('image/png');
}
