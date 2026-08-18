import * as THREE from 'three';

const SKIN_TONES = [0xe0b394, 0xc68a5f, 0x8d5a3c, 0xf0c9a0];

function limb(radiusTop, radiusBottom, length, color) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radiusTop, length, 3, 6),
    new THREE.MeshLambertMaterial({ color })
  );
  return mesh;
}

export class Player {
  constructor({ team, index, jersey, isHuman, name }) {
    this.team = team; // 'A' or 'B'
    this.index = index;
    this.isHuman = isHuman;
    this.name = name;
    this.radius = 0.42; // reach radius for hitting the ball
    this.height = 1.75;
    this.velocity = new THREE.Vector3();
    this.speed = 4.6;
    this.animPhase = Math.random() * Math.PI * 2;
    this.animSpeed = 0;
    this.kickTimer = 0;
    this.kickDuration = 0.34;
    this.diveTimer = 0;
    this.facing = team === 'A' ? 1 : -1; // which way is "forward" (toward hedge)

    this.group = new THREE.Group();
    this.buildMesh(jersey);
  }

  buildMesh(jerseyColor) {
    const skin = SKIN_TONES[this.index % SKIN_TONES.length];
    const shortsColor = 0x22262e;
    const shoeColor = 0xf5f5f2;

    const rig = new THREE.Group();
    this.rig = rig;
    this.group.add(rig);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.42, 4, 8),
      new THREE.MeshLambertMaterial({ color: jerseyColor })
    );
    torso.position.y = 1.05;
    rig.add(torso);
    this.torso = torso;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.52;
    rig.add(head);
    this.head = head;

    // Hair blob
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshLambertMaterial({ color: [0x2b1c14, 0x1a1a1a, 0x5c3a22, 0x0d0d0d][this.index % 4] }));
    hair.position.y = 1.56;
    rig.add(hair);

    // Arms (pivoted at shoulder)
    this.armL = new THREE.Group();
    this.armL.position.set(0.26, 1.28, 0);
    const armLMesh = limb(0.06, 0.045, 0.38, jerseyColor);
    armLMesh.position.y = -0.22;
    this.armL.add(armLMesh);
    rig.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(-0.26, 1.28, 0);
    const armRMesh = limb(0.06, 0.045, 0.38, jerseyColor);
    armRMesh.position.y = -0.22;
    this.armR.add(armRMesh);
    rig.add(this.armR);

    // Legs (pivoted at hip)
    this.legL = new THREE.Group();
    this.legL.position.set(0.11, 0.82, 0);
    const legLMesh = limb(0.09, 0.07, 0.42, shortsColor);
    legLMesh.position.y = -0.24;
    this.legL.add(legLMesh);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), new THREE.MeshLambertMaterial({ color: shoeColor }));
    shoeL.position.set(0, -0.48, 0.05);
    this.legL.add(shoeL);
    rig.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(-0.11, 0.82, 0);
    const legRMesh = limb(0.09, 0.07, 0.42, shortsColor);
    legRMesh.position.y = -0.24;
    this.legR.add(legRMesh);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.24), new THREE.MeshLambertMaterial({ color: shoeColor }));
    shoeR.position.set(0, -0.48, 0.05);
    this.legR.add(shoeR);
    rig.add(this.legR);

    // Ring beneath feet to help the player read as "grounded" and show whose turn it is.
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    this.group.add(marker);
    this.marker = marker;

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.group.add(shadow);
  }

  setMarkerVisible(visible, color = 0xffe37a) {
    this.marker.material.opacity = visible ? 0.85 : 0;
    this.marker.material.color.set(color);
  }

  triggerKick(power = 1) {
    this.kickTimer = this.kickDuration;
    this.kickPower = power;
  }

  update(dt) {
    const speedFrac = THREE.MathUtils.clamp(this.velocity.length() / this.speed, 0, 1);
    this.animSpeed = speedFrac;

    if (this.kickTimer > 0) {
      this.kickTimer -= dt;
      const t = 1 - Math.max(this.kickTimer, 0) / this.kickDuration;
      const swing = Math.sin(Math.min(t, 1) * Math.PI);
      this.legR.rotation.x = -swing * 1.4;
      this.legL.rotation.x = swing * 0.35;
      this.torso.rotation.x = -swing * 0.25;
      this.armL.rotation.x = swing * 0.9;
      this.armR.rotation.x = -swing * 0.5;
    } else if (speedFrac > 0.05) {
      this.animPhase += dt * (8 + speedFrac * 6);
      const s = Math.sin(this.animPhase);
      this.legL.rotation.x = s * 0.6 * speedFrac;
      this.legR.rotation.x = -s * 0.6 * speedFrac;
      this.armL.rotation.x = -s * 0.5 * speedFrac;
      this.armR.rotation.x = s * 0.5 * speedFrac;
      this.torso.rotation.x = Math.abs(s) * 0.05;
    } else {
      this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, dt * 6);
      this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, dt * 6);
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, dt * 6);
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, 0, dt * 6);
      this.torso.rotation.x = THREE.MathUtils.lerp(this.torso.rotation.x, 0, dt * 6);
      this.idleT = (this.idleT || 0) + dt;
      this.rig.position.y = Math.sin(this.idleT * 2) * 0.01;
    }
  }

  get position() { return this.group.position; }
}

const TEAM_A_JERSEY = 0x2255cc;
const TEAM_B_JERSEY = 0xcc3322;

export function createTeams(scene) {
  const layout = [
    { role: 'left', x: -3.2, z: 5.6 },
    { role: 'mid', x: 0, z: 4.6 },
    { role: 'right', x: 3.2, z: 5.6 },
  ];

  const teamA = layout.map((slot, i) => {
    const p = new Player({ team: 'A', index: i, jersey: TEAM_A_JERSEY, isHuman: i === 1, name: `Blauw ${i + 1}` });
    p.homeSlot = { x: slot.x, z: -slot.z };
    p.group.position.set(slot.x, 0, -slot.z);
    p.group.rotation.y = Math.PI; // facing +z (toward hedge)
    scene.add(p.group);
    return p;
  });

  const teamB = layout.map((slot, i) => {
    const p = new Player({ team: 'B', index: i, jersey: TEAM_B_JERSEY, isHuman: false, name: `Rood ${i + 1}` });
    p.homeSlot = { x: -slot.x, z: slot.z };
    p.group.position.set(-slot.x, 0, slot.z);
    p.group.rotation.y = 0; // facing -z (toward hedge)
    scene.add(p.group);
    return p;
  });

  return { teamA, teamB };
}
