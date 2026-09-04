import * as THREE from 'three';

const SKIN_TONES = [0xf0c9a0, 0xe0b394, 0xc68a5f, 0x8d5a3c];
const HAIR_TONES = [0x2b1c14, 0x1a1a1a, 0x5c3a22, 0x0d0d0d, 0x6b4a2a];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function mat(color, rough = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 });
}

// A limb segment whose group pivot sits at the top joint, capsule hanging down.
function segment(len, rad, material) {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 6, 14), material);
  mesh.position.y = -(len / 2 + rad);
  mesh.castShadow = true;
  g.add(mesh);
  g.userData.tipY = -(len + 2 * rad); // where the next joint attaches
  return g;
}

export class Player {
  constructor({ team, index, jersey, isHuman, name }) {
    this.team = team;
    this.index = index;
    this.isHuman = isHuman;
    this.name = name;
    this.radius = 0.42;   // reach radius for hitting the ball (unchanged gameplay)
    this.height = 1.78;
    this.velocity = new THREE.Vector3();
    this.speed = 6.3;
    this.animPhase = Math.random() * Math.PI * 2;
    this.animSpeed = 0;
    this.kickTimer = 0;
    this.kickDuration = 0.34;
    this.idleT = Math.random() * 10;
    this.hitCooldown = 0; // brief lockout after touching the ball (used by main/ai)
    this.facing = team === 'A' ? 1 : -1;

    this.group = new THREE.Group();
    this.buildMesh(jersey);
  }

  buildMesh(jerseyColor) {
    const skin = SKIN_TONES[this.index % SKIN_TONES.length];
    const skinMat = mat(skin, 0.85);
    const jerseyMat = mat(jerseyColor, 0.7);
    const jerseyDark = mat(new THREE.Color(jerseyColor).multiplyScalar(0.8).getHex(), 0.7);
    const shortsMat = mat(0x2a2f3a, 0.75);
    const shoeMat = mat(0xf4f4ef, 0.55);
    const soleMat = mat(0x20242b, 0.6);
    const hairMat = mat(HAIR_TONES[this.index % HAIR_TONES.length], 0.9);

    const rig = new THREE.Group();
    this.rig = rig;
    this.group.add(rig);

    // ---- Torso: rounded, slightly flattened front-to-back so it isn't tubular ----
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 8, 20), jerseyMat);
    torso.position.y = 1.16;
    torso.scale.set(1.0, 1.0, 0.72);
    torso.castShadow = true;
    rig.add(torso);
    this.torso = torso;

    // Shoulder yoke for a bit of width
    const yoke = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 6, 14), jerseyMat);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.y = 1.42;
    yoke.scale.set(1, 1, 0.8);
    yoke.castShadow = true;
    rig.add(yoke);

    // Hips
    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.12, 6, 14), shortsMat);
    pelvis.position.y = 0.94;
    pelvis.scale.set(1.05, 1, 0.78);
    pelvis.castShadow = true;
    rig.add(pelvis);

    // ---- Neck + head ----
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 10), skinMat);
    neck.position.y = 1.5;
    rig.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18), skinMat);
    head.position.y = 1.66;
    head.scale.set(0.95, 1.05, 0.98);
    head.castShadow = true;
    rig.add(head);
    this.head = head;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hair.position.y = 1.68;
    rig.add(hair);
    // nose hint so the facing reads
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), skinMat);
    nose.position.set(0, 1.65, 0.13);
    rig.add(nose);

    // ---- Arms: shoulder -> upper -> elbow -> forearm -> hand ----
    const makeArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.235, 1.44, 0);
      shoulder.rotation.z = side * 0.12;         // slight splay so arms clear the torso
      const upper = segment(0.26, 0.052, jerseyMat);
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = upper.userData.tipY;
      elbow.rotation.x = -0.25;
      const fore = segment(0.24, 0.045, skinMat);
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skinMat);
      hand.position.y = fore.userData.tipY;
      hand.castShadow = true;
      elbow.add(hand);
      shoulder.add(elbow);
      rig.add(shoulder);
      return { shoulder, elbow };
    };
    const aL = makeArm(1), aR = makeArm(-1);
    this.shoulderL = aL.shoulder; this.elbowL = aL.elbow;
    this.shoulderR = aR.shoulder; this.elbowR = aR.elbow;

    // ---- Legs: hip -> thigh -> knee -> shin -> foot ----
    const makeLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0.9, 0);
      const thigh = segment(0.4, 0.075, shortsMat);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = thigh.userData.tipY;
      knee.rotation.x = -0.08;
      const shin = segment(0.4, 0.06, skinMat);
      knee.add(shin);
      // rounded shoe (no more box): capsule sole + toe cap
      const shoe = new THREE.Group();
      shoe.position.y = shin.userData.tipY - 0.02;
      const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 4, 10), shoeMat);
      sole.rotation.x = Math.PI / 2;
      sole.position.set(0, 0, 0.06);
      sole.scale.set(1, 1, 1.15);
      sole.castShadow = true;
      shoe.add(sole);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), shoeMat);
      toe.position.set(0, 0, 0.15);
      shoe.add(toe);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 6, 12), soleMat);
      band.rotation.y = Math.PI / 2;
      band.position.set(0, 0.01, 0.02);
      shoe.add(band);
      knee.add(shoe);
      hip.add(knee);
      rig.add(hip);
      return { hip, knee };
    };
    const lL = makeLeg(1), lR = makeLeg(-1);
    this.hipL = lL.hip; this.kneeL = lL.knee;
    this.hipR = lR.hip; this.kneeR = lR.knee;

    // number on the back
    const numMat = mat(0xffffff, 0.6);
    const num = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), numMat);
    num.position.set(0, 1.2, -0.16);
    num.rotation.y = Math.PI;
    rig.add(num);

    // turn-indicator ring + soft contact AO (kept subtle now that we have real shadows)
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe37a, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    this.group.add(marker);
    this.marker = marker;

    const ao = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 })
    );
    ao.rotation.x = -Math.PI / 2;
    ao.position.y = 0.014;
    this.group.add(ao);
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
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    const speedFrac = clamp(this.velocity.length() / this.speed, 0, 1);
    this.animSpeed = speedFrac;
    const K = (o, to, r) => { o.rotation.x = lerp(o.rotation.x, to, r); };

    if (this.kickTimer > 0) {
      this.kickTimer -= dt;
      const t = 1 - Math.max(this.kickTimer, 0) / this.kickDuration; // 0..1
      const swing = Math.sin(Math.min(t, 1) * Math.PI);              // windup -> contact -> recover
      const ext = Math.min(t, 1);
      this.hipR.rotation.x = -swing * 1.5;               // kicking leg drives forward
      this.kneeR.rotation.x = -(1 - ext) * 1.0;          // bent on windup, snaps straight at contact
      this.hipL.rotation.x = swing * 0.35;               // plant leg
      this.kneeL.rotation.x = -0.2 - swing * 0.2;
      this.torso.rotation.x = -swing * 0.22;
      this.shoulderL.rotation.x = swing * 1.0;
      this.shoulderR.rotation.x = -swing * 0.6;
      this.elbowL.rotation.x = -0.5;
      this.elbowR.rotation.x = -0.8;
      this.rig.position.y = swing * 0.02;
    } else if (speedFrac > 0.05) {
      this.animPhase += dt * (7 + speedFrac * 7);
      const s = Math.sin(this.animPhase);
      const amp = 0.72 * speedFrac;
      this.hipL.rotation.x = s * amp;
      this.hipR.rotation.x = -s * amp;
      // knee bends on the leg that is swinging forward (recovery)
      this.kneeL.rotation.x = -Math.max(0, s) * 0.95 * speedFrac - 0.1;
      this.kneeR.rotation.x = -Math.max(0, -s) * 0.95 * speedFrac - 0.1;
      this.shoulderL.rotation.x = -s * 0.55 * speedFrac;
      this.shoulderR.rotation.x = s * 0.55 * speedFrac;
      this.elbowL.rotation.x = -0.5 - Math.max(0, -s) * 0.4;
      this.elbowR.rotation.x = -0.5 - Math.max(0, s) * 0.4;
      this.torso.rotation.x = 0.13 * speedFrac + Math.abs(s) * 0.04; // forward lean + counter-bob
      this.torso.scale.y = 1;
      this.rig.position.y = Math.abs(s) * 0.03 * speedFrac;           // vertical bob
    } else {
      const r = dt * 8;
      K(this.hipL, 0, r); K(this.hipR, 0, r);
      K(this.kneeL, -0.08, r); K(this.kneeR, -0.08, r);
      K(this.shoulderL, 0.04, r); K(this.shoulderR, 0.04, r);
      K(this.elbowL, -0.28, r); K(this.elbowR, -0.28, r);
      K(this.torso, 0, r);
      this.idleT += dt;
      this.rig.position.y = Math.sin(this.idleT * 1.8) * 0.012;
      this.torso.scale.y = 1 + Math.sin(this.idleT * 1.8) * 0.02; // breathing
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
    p.group.rotation.y = Math.PI;
    scene.add(p.group);
    return p;
  });

  const teamB = layout.map((slot, i) => {
    const p = new Player({ team: 'B', index: i, jersey: TEAM_B_JERSEY, isHuman: false, name: `Rood ${i + 1}` });
    p.homeSlot = { x: -slot.x, z: slot.z };
    p.group.position.set(-slot.x, 0, slot.z);
    p.group.rotation.y = 0;
    scene.add(p.group);
    return p;
  });

  return { teamA, teamB };
}
