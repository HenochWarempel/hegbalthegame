import * as THREE from 'three';
import { makePaverTexture, makeGrassTexture, makeHedgeTexture, makeSkyTexture, makeBrickWallTexture } from './textures.js';

// World layout (meters). Hedge sits on the z=0 plane, Team A plays on -z (paved
// side, matches camera / reference photo), Team B plays on +z (grass side).
export const COURT = {
  width: 12,          // playable width, x in [-6, 6]
  halfWidth: 6,
  depth: 9,           // each team's playable depth, z in [0.35, 9] / [-9, -0.35]
  serveLineZ: 6.2,    // server must stand at |z| >= this
  hedge: {
    height: 1.3,
    halfThickness: 0.32,
    halfLength: 6.6,
  },
};

function roofGeometry(width, depth, height) {
  // Simple gabled ("tent") roof: a triangular-cross-section prism.
  const w = width / 2, d = depth / 2;
  const positions = new Float32Array([
    // ridge line along z at x=0, y=height; eaves at y=0, x=+-w
    -w, 0, -d,   w, 0, -d,   0, height, -d,
    -w, 0,  d,   w, 0,  d,   0, height,  d,
    // front triangle
    -w, 0, -d,  0, height, -d,  -w, 0, d,
    0, height, -d, 0, height, d, -w, 0, d,
    // back triangle
    w, 0, -d, w, 0, d, 0, height, -d,
    w, 0, d, 0, height, d, 0, height, -d,
    // end caps
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, 0, height, d, w, 0, d,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeHouse(x, z, hue) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: hue });
  const w = 3.6 + Math.random() * 1.4, h = 3 + Math.random() * 1.2, d = 3.2 + Math.random() * 1.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  group.add(body);

  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2b2b30 });
  const roof = new THREE.Mesh(roofGeometry(w + 0.3, d + 0.3, 1.4 + Math.random() * 0.5), roofMat);
  roof.position.y = h;
  group.add(roof);

  // A couple of window accents.
  const winMat = new THREE.MeshBasicMaterial({ color: 0x1c2430 });
  for (let i = -1; i <= 1; i += 2) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat);
    win.position.set(i * w * 0.22, h * 0.5, d / 2 + 0.01);
    group.add(win);
  }

  group.position.set(x, 0, z);
  group.rotation.y = (Math.random() - 0.5) * 0.3;
  return group;
}

function makeTree(scale = 1) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 1.6 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3826 })
  );
  trunk.position.y = 0.8 * scale;
  group.add(trunk);
  const foliageMat = new THREE.MeshLambertMaterial({ color: 0x3f7a35 });
  for (let i = 0; i < 3; i++) {
    const s = (1.1 - i * 0.22) * scale;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), foliageMat);
    blob.position.set((Math.random() - 0.5) * 0.4 * scale, (1.7 + i * 0.65) * scale, (Math.random() - 0.5) * 0.4 * scale);
    blob.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(blob);
  }
  return group;
}

function makeBushCluster(count = 5, spread = 1.6, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a6b30 });
  for (let i = 0; i < count; i++) {
    const s = (0.35 + Math.random() * 0.35) * scale;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    b.position.set((Math.random() - 0.5) * spread, s * 0.7, (Math.random() - 0.5) * spread * 0.6);
    b.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(b);
  }
  return group;
}

function makeStreetlight() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x555a5c });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8), poleMat);
  pole.position.y = 2.6;
  group.add(pole);

  const armCurveGroup = new THREE.Group();
  armCurveGroup.position.y = 5.1;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 6), poleMat);
  arm.rotation.z = Math.PI / 2.3;
  arm.position.set(0.55, 0.25, 0);
  armCurveGroup.add(arm);
  group.add(armCurveGroup);

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f31 });
  const lamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.35, 4, 8), lampMat);
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(1.05, 5.5, 0);
  group.add(lamp);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 })
  );
  glow.position.set(1.05, 5.38, 0);
  group.add(glow);

  return group;
}

function makeCar() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4b4f54 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), bodyMat);
  cabin.position.set(0, 1.05, -0.2);
  group.add(cabin);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2530 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.4, 2.0), glassMat);
  glass.position.set(0, 1.05, -0.2);
  group.add(glass);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 10);
  const positions = [[-0.95, 0.32, 1.35], [0.95, 0.32, 1.35], [-0.95, 0.32, -1.35], [0.95, 0.32, -1.35]];
  for (const [x, y, z] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: 0xaa1111 }));
  tailLight.position.set(0.7, 0.6, 2.1);
  group.add(tailLight);
  const tailLight2 = tailLight.clone();
  tailLight2.position.x = -0.7;
  group.add(tailLight2);
  return group;
}

export function buildCourt(scene) {
  const paverTex = makePaverTexture();
  paverTex.repeat.set(6, 5);
  const grassTex = makeGrassTexture();
  grassTex.repeat.set(40, 40);
  const hedgeTex = makeHedgeTexture();
  hedgeTex.repeat.set(4, 1);

  scene.fog = new THREE.Fog(0xdfe6df, 30, 95);
  scene.background = new THREE.Color(0xdde5e0);

  // Sky dome for a soft overcast gradient like the reference photo.
  const skyTex = makeSkyTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // Base grass field (far/grass side + surrounding wasteland).
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.01;
  scene.add(grass);

  // Paved parking lot area on Team A's (near) side.
  const paverW = 16, paverD = COURT.depth + 3;
  const pavers = new THREE.Mesh(
    new THREE.PlaneGeometry(paverW, paverD),
    new THREE.MeshLambertMaterial({ map: paverTex })
  );
  pavers.rotation.x = -Math.PI / 2;
  pavers.position.set(0, 0.005, -(paverD / 2 - 0.4));
  scene.add(pavers);

  // Painted court lines (baseline + serve line) on the pavement.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2ea });
  function makeLine(len, x, z, rotY = 0) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.08), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = rotY;
    line.position.set(x, 0.012, z);
    scene.add(line);
  }
  makeLine(COURT.width, 0, -COURT.serveLineZ);
  makeLine(COURT.width, 0, -0.36);
  makeLine(COURT.depth - 0.36, -COURT.halfWidth, -(COURT.depth + 0.36) / 2, Math.PI / 2);
  makeLine(COURT.depth - 0.36, COURT.halfWidth, -(COURT.depth + 0.36) / 2, Math.PI / 2);

  // Mirror the same markings onto Team B's grass side beyond the hedge.
  makeLine(COURT.width, 0, COURT.serveLineZ);
  makeLine(COURT.width, 0, 0.36);
  makeLine(COURT.depth - 0.36, -COURT.halfWidth, (COURT.depth + 0.36) / 2, Math.PI / 2);
  makeLine(COURT.depth - 0.36, COURT.halfWidth, (COURT.depth + 0.36) / 2, Math.PI / 2);

  // Hedge "net" across the middle.
  const hedgeGroup = new THREE.Group();
  const hedgeMat = new THREE.MeshLambertMaterial({ map: hedgeTex });
  const hedgeMain = new THREE.Mesh(
    new THREE.BoxGeometry(COURT.hedge.halfLength * 2, COURT.hedge.height, COURT.hedge.halfThickness * 2),
    hedgeMat
  );
  hedgeMain.position.y = COURT.hedge.height / 2;
  hedgeGroup.add(hedgeMain);
  // Bumpy top using small foliage blobs so it reads as a trimmed hedge, not a box.
  for (let i = 0; i < 46; i++) {
    const s = 0.22 + Math.random() * 0.16;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), hedgeMat);
    blob.position.set(
      -COURT.hedge.halfLength + Math.random() * COURT.hedge.halfLength * 2,
      COURT.hedge.height - 0.05 + Math.random() * 0.16,
      (Math.random() - 0.5) * COURT.hedge.halfThickness * 1.6
    );
    hedgeGroup.add(blob);
  }
  scene.add(hedgeGroup);

  // Wooden fence posts + wire along the far left boundary, like the photo.
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b5a3f });
  for (let i = 0; i < 10; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), postMat);
    post.position.set(-11 - Math.random() * 2, 0.45, -8 + i * 3.2);
    scene.add(post);
  }

  // Roadside bushes/hedgerow on the left, matching the photo's tree line.
  for (let i = 0; i < 8; i++) {
    const bush = makeBushCluster(6, 1.8, 1.4 + Math.random());
    bush.position.set(-9 - Math.random() * 3, 0, -10 + i * 3.4 + Math.random());
    scene.add(bush);
  }
  for (let i = 0; i < 6; i++) {
    const tree = makeTree(1.2 + Math.random() * 0.8);
    tree.position.set(-8 - Math.random() * 6, 0, 4 + i * 3 + Math.random() * 2);
    scene.add(tree);
  }
  // Tree/bush line behind the hedge (background greenery from the photo).
  for (let i = 0; i < 10; i++) {
    const tree = makeTree(1.4 + Math.random());
    tree.position.set(-9 + i * 2.2 + (Math.random() - 0.5), 0, 11 + Math.random() * 3);
    scene.add(tree);
  }
  for (let i = 0; i < 6; i++) {
    const tree = makeTree(1.1 + Math.random() * 0.6);
    tree.position.set(6 + i * 2.4, 0, 12 + Math.random() * 4);
    scene.add(tree);
  }

  // Background houses beyond the far grass field.
  const houseHues = [0xb8b0a0, 0xa5462f, 0x8f8878, 0xc7bca6];
  const housePositions = [[-13, 20], [-6, 22], [3, 21], [11, 23], [18, 20.5]];
  for (const [x, z] of housePositions) {
    const h = makeHouse(x, z, houseHues[Math.floor(Math.random() * houseHues.length)]);
    scene.add(h);
  }

  // Streetlight beside the court, echoing the photo composition.
  const light = makeStreetlight();
  light.position.set(-6.4, 0, -3.2);
  scene.add(light);

  // Parked car at the pavement's edge.
  const car = makeCar();
  car.position.set(9.4, 0, -3.4);
  car.rotation.y = Math.PI / 2 + 0.06;
  scene.add(car);

  // Small stray ball on the grass, an easter-egg nod to the reference photo.
  const strayBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a6f6b })
  );
  strayBall.position.set(9.6, 0.18, 2.6);
  scene.add(strayBall);

  // Onlookers: a few simple low-poly bystanders near the gravel path.
  const spectatorColors = [0x33445a, 0x555555, 0x6a2e2e, 0x3d3d3d];
  for (let i = 0; i < 4; i++) {
    const s = makeSpectator(spectatorColors[i % spectatorColors.length]);
    s.position.set(4 + i * 1.1, 0, 13 + (i % 2) * 0.6);
    s.rotation.y = Math.PI + (Math.random() - 0.5) * 0.6;
    scene.add(s);
  }

  return { hedgeGroup };
}

function makeSpectator(shirtColor) {
  const group = new THREE.Group();
  const skin = 0xe0b394;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.55, 4, 8), new THREE.MeshLambertMaterial({ color: shirtColor }));
  body.position.y = 0.9;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.35;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x2c2f38 }));
  legs.position.y = 0.35;
  group.add(legs);
  return group;
}
