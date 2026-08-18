import * as THREE from 'three';

const BASE_POS = new THREE.Vector3(0, 5.6, -12.5);
const LOOK_BASE = new THREE.Vector3(0, 1.2, 1.5);

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 200);
  camera.position.copy(BASE_POS);
  camera.lookAt(LOOK_BASE);
  return camera;
}

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

export function updateCamera(camera, ball, dt) {
  const ballX = THREE.MathUtils.clamp(ball.position.x, -6, 6);
  const ballZ = THREE.MathUtils.clamp(ball.position.z, -9, 9);

  desiredPos.set(
    BASE_POS.x + ballX * 0.28,
    BASE_POS.y + Math.max(ball.position.y - 1, 0) * 0.15,
    BASE_POS.z + ballZ * 0.12
  );
  desiredLook.set(ballX * 0.5, 1.0 + Math.max(ball.position.y, 0) * 0.25, ballZ * 0.6 + 1.0);

  const smoothing = 1 - Math.pow(0.001, dt);
  camera.position.lerp(desiredPos, smoothing);
  const currentLook = camera.userData._look || desiredLook.clone();
  currentLook.lerp(desiredLook, smoothing);
  camera.userData._look = currentLook;
  camera.lookAt(currentLook);
}
