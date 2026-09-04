import * as THREE from 'three';

// High, pulled-back broadcast angle framed on the middle of the pitch so both
// baselines (near court at z = -depth and far court at z = +depth) stay in view.
const BASE_POS = new THREE.Vector3(0, 11.0, -18.0);
const LOOK_BASE = new THREE.Vector3(0, 0.4, 0.5);

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
  camera.position.copy(BASE_POS);
  camera.lookAt(LOOK_BASE);
  return camera;
}

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

export function updateCamera(camera, ball, dt) {
  const ballX = THREE.MathUtils.clamp(ball.position.x, -6, 6);
  const ballZ = THREE.MathUtils.clamp(ball.position.z, -9, 9);

  // Follow only gently so the whole court stays framed and both baselines
  // remain visible rather than the camera chasing the ball.
  desiredPos.set(
    BASE_POS.x + ballX * 0.14,
    BASE_POS.y + Math.max(ball.position.y - 1, 0) * 0.08,
    BASE_POS.z + ballZ * 0.05
  );
  desiredLook.set(ballX * 0.30, 0.6 + Math.max(ball.position.y, 0) * 0.18, ballZ * 0.35 + 0.5);

  const smoothing = 1 - Math.pow(0.001, dt);
  camera.position.lerp(desiredPos, smoothing);
  const currentLook = camera.userData._look || desiredLook.clone();
  currentLook.lerp(desiredLook, smoothing);
  camera.userData._look = currentLook;
  camera.lookAt(currentLook);
}
