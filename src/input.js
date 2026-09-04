const keys = new Set();
const justPressed = new Set();
const justReleased = new Set();

const mouse = { x: 0, y: 0 };
const mouseButtons = new Set();
const mousePressed = new Set();
const mouseReleased = new Set();
const downOnTarget = new Set(); // buttons whose press began on the game canvas
let usingMouse = false;
let target = null;

window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) justPressed.add(e.code);
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); justReleased.add(e.code); });
window.addEventListener('blur', () => { keys.clear(); mouseButtons.clear(); downOnTarget.clear(); });

function onMove(e) {
  const el = target;
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  usingMouse = true;
}
function onDown(e) {
  // Only clicks that start on the game canvas count as game input, so clicking
  // a menu button (Speel, difficulty) never registers as a shot/serve.
  if (!mouseButtons.has(e.button)) mousePressed.add(e.button);
  mouseButtons.add(e.button);
  downOnTarget.add(e.button);
  usingMouse = true;
  e.preventDefault();
}
function onUp(e) {
  mouseButtons.delete(e.button);
  if (downOnTarget.has(e.button)) {
    mouseReleased.add(e.button);
    downOnTarget.delete(e.button);
  }
}

export const Input = {
  // Attach mouse handling to a specific element (the WebGL canvas). Release is
  // tracked on window so letting go off-canvas still ends a charge.
  bindMouse(el) {
    target = el;
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mousedown', onDown);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    window.addEventListener('mouseup', onUp);
  },
  isDown(code) { return keys.has(code); },
  wasPressed(code) {
    if (justPressed.has(code)) { justPressed.delete(code); return true; }
    return false;
  },
  wasReleased(code) {
    if (justReleased.has(code)) { justReleased.delete(code); return true; }
    return false;
  },
  mouseNDC() { return { x: mouse.x, y: mouse.y }; },
  usingMouse() { return usingMouse; },
  isMouseDown(b) { return mouseButtons.has(b); },
  mouseWasPressed(b) {
    if (mousePressed.has(b)) { mousePressed.delete(b); return true; }
    return false;
  },
  mouseWasReleased(b) {
    if (mouseReleased.has(b)) { mouseReleased.delete(b); return true; }
    return false;
  },
  clearFrame() { justPressed.clear(); justReleased.clear(); mousePressed.clear(); mouseReleased.clear(); },
  moveVector() {
    let x = 0, z = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x += 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x -= 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) z += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) z -= 1;
    return { x, z };
  },
};
