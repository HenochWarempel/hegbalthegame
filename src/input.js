const keys = new Set();
const justPressed = new Set();

window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) justPressed.add(e.code);
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});
window.addEventListener('blur', () => { keys.clear(); });

export const Input = {
  isDown(code) { return keys.has(code); },
  wasPressed(code) {
    if (justPressed.has(code)) { justPressed.delete(code); return true; }
    return false;
  },
  clearFrame() { justPressed.clear(); },
  moveVector() {
    // The camera sits behind team A looking toward +z, which (given the
    // right-handed lookAt) puts screen-right at world -x. These signs are
    // chosen so the on-screen movement actually matches the arrow pressed.
    let x = 0, z = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x += 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x -= 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) z += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) z -= 1;
    return { x, z };
  },
};
