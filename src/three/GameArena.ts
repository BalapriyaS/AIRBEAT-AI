import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AttackEvent, DanceMoveId, InstrumentId, SuperAttackId } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';

export class GameArena {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  // Arena elements
  private floorGrid!: THREE.GridHelper;
  private floorPlane!: THREE.Mesh;
  private stageGroup: THREE.Group;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.HemisphereLight;
  private rimLight!: THREE.PointLight;
  private strobeLight!: THREE.PointLight;

  // Monster Group & Articulated Skeletal Hierarchy
  private monsterGroup: THREE.Group;
  private beatEaterGroup: THREE.Group | null = null;
  private rhythmBreakerGroup: THREE.Group | null = null;
  private bossGroup: THREE.Group | null = null;

  // Articulated Dancer Limbs (for Beat Eater & Groove Monsters)
  private dancerSpine!: THREE.Group;
  private dancerHead!: THREE.Group;
  private dancerVisor!: THREE.Mesh;
  private dancerJaw!: THREE.Mesh;
  private dancerCore!: THREE.Mesh;
  private dancerLeftArm!: THREE.Group;
  private dancerRightArm!: THREE.Group;
  private dancerLeftForearm!: THREE.Group;
  private dancerRightForearm!: THREE.Group;
  private dancerLeftHand!: THREE.Group;
  private dancerRightHand!: THREE.Group;
  private dancerLeftLeg!: THREE.Group;
  private dancerRightLeg!: THREE.Group;
  private dancerLeftFoot!: THREE.Mesh;
  private dancerRightFoot!: THREE.Mesh;

  // Rhythm Breaker shield & rune
  private rhythmShield: THREE.Group | null = null;
  private rhythmRuneMesh: THREE.Mesh | null = null;

  // Boss armor & orbital rings
  private bossArmorParts: THREE.Object3D[] = [];
  private bossOrbitRings: THREE.Mesh[] = [];

  // Projectiles & Particles
  private activeProjectiles: {
    mesh: THREE.Object3D;
    type: InstrumentId | SuperAttackId;
    start: THREE.Vector3;
    target: THREE.Vector3;
    progress: number;
    speed: number;
  }[] = [];

  private impactParticles: THREE.Points | null = null;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleLifespans: Float32Array;
  private readonly MAX_PARTICLES = 600;

  // Dance & State Management
  private currentStage: string = 'stage_1_beat_eater';
  private currentDanceMove: DanceMoveId = 'idle';
  private danceTimer: number = 0;
  private monsterHealthRatio: number = 1.0;
  private screenShakeIntensity: number = 0;
  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;

  // Math helpers (Zero GC)
  private readonly _v1 = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Scene & Camera Setup (Framed to show entire monster head to toe)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060d);
    this.scene.fog = new THREE.FogExp2(0x05060d, 0.035);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 1.8, 8.8);
    this.camera.lookAt(0, 1.35, 0);

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Mandatory Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig
    this.setupLighting();

    // 5. Stage & Arena
    this.stageGroup = new THREE.Group();
    this.scene.add(this.stageGroup);
    this.setupStage();

    // 6. Monster Container
    this.monsterGroup = new THREE.Group();
    this.monsterGroup.position.set(0, 0, 0);
    this.scene.add(this.monsterGroup);

    // 7. Particle System Setup
    this.particlePositions = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleVelocities = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleLifespans = new Float32Array(this.MAX_PARTICLES);
    this.setupParticleSystem();

    // 8. Build Full-Body Articulated Dancing Monster Models
    this.buildDancingBeatEater();
    this.buildRhythmBreaker();
    this.buildMusicDestroyer();

    // Show initial monster
    this.setStage('stage_1_beat_eater');

    // 9. Resize Listener & Pre-warm
    window.addEventListener('resize', this.onResize);
    this.renderer.compile(this.scene, this.camera);

    // 10. Start Loop
    this.animate();
  }

  private setupLighting() {
    this.keyLight = new THREE.DirectionalLight(0xfff5e6, 2.6);
    this.keyLight.position.set(4, 8, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 25;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x06b6d4, 0x1e1035, 1.2);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.PointLight(0xa855f7, 3.5, 15);
    this.rimLight.position.set(0, 4, -4);
    this.scene.add(this.rimLight);

    this.strobeLight = new THREE.PointLight(0x00f0ff, 0, 20);
    this.strobeLight.position.set(0, 2, 2);
    this.scene.add(this.strobeLight);
  }

  private setupStage() {
    // Floor platform with neon edge
    const stageGeo = new THREE.CylinderGeometry(5.2, 5.5, 0.4, 48);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f1d,
      roughness: 0.35,
      metalness: 0.85
    });
    const stageBase = new THREE.Mesh(stageGeo, stageMat);
    stageBase.position.y = -0.2;
    stageBase.receiveShadow = true;
    this.stageGroup.add(stageBase);

    // Neon edge ring
    const ringGeo = new THREE.TorusGeometry(5.3, 0.06, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.01;
    this.stageGroup.add(ringMesh);

    // Holographic cyber grid
    this.floorGrid = new THREE.GridHelper(18, 36, 0x06b6d4, 0x1e293b);
    this.floorGrid.position.y = 0.02;
    (this.floorGrid.material as THREE.Material).opacity = 0.35;
    (this.floorGrid.material as THREE.Material).transparent = true;
    this.stageGroup.add(this.floorGrid);

    // Shadow receiver plane
    const shadowGeo = new THREE.PlaneGeometry(16, 16);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.55 });
    this.floorPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.y = 0.015;
    this.floorPlane.receiveShadow = true;
    this.stageGroup.add(this.floorPlane);
  }

  // ==================== FULL-BODY ARTICULATED DANCING MONSTER ====================
  private buildDancingBeatEater() {
    this.beatEaterGroup = new THREE.Group();
    this.beatEaterGroup.position.set(0, 0, 0);

    // Materials
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e2438,
      metalness: 0.88,
      roughness: 0.22
    });
    const darkPlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.15
    });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });

    // 1. Pelvis & Root
    const pelvisGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.35, 12);
    const pelvis = new THREE.Mesh(pelvisGeo, darkPlateMat);
    pelvis.position.y = 1.1;
    this.beatEaterGroup.add(pelvis);

    // 2. Spine & Chest (Dancer Torso)
    this.dancerSpine = new THREE.Group();
    this.dancerSpine.position.y = 0.2;
    pelvis.add(this.dancerSpine);

    const chestGeo = new THREE.DodecahedronGeometry(0.85, 1);
    const chest = new THREE.Mesh(chestGeo, metalMat);
    chest.position.y = 0.55;
    chest.castShadow = true;
    this.dancerSpine.add(chest);

    // Glowing core reactor in center of chest
    const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
    this.dancerCore = new THREE.Mesh(coreGeo, neonPinkMat);
    this.dancerCore.position.set(0, 0.55, 0.5);
    this.dancerSpine.add(this.dancerCore);

    // 3. Head & Neck
    this.dancerHead = new THREE.Group();
    this.dancerHead.position.set(0, 1.25, 0);
    this.dancerSpine.add(this.dancerHead);

    const headGeo = new THREE.BoxGeometry(0.8, 0.65, 0.75);
    const headMesh = new THREE.Mesh(headGeo, metalMat);
    this.dancerHead.add(headMesh);

    // Angular laser visor optics
    const visorGeo = new THREE.PlaneGeometry(0.65, 0.16);
    const visor = new THREE.Mesh(visorGeo, neonCyanMat);
    visor.position.set(0, 0.08, 0.39);
    this.dancerVisor = visor;
    this.dancerHead.add(visor);

    // Acoustic resonator horns
    [-0.55, 0.55].forEach((xPos) => {
      const hornGeo = new THREE.ConeGeometry(0.12, 0.7, 8);
      const horn = new THREE.Mesh(hornGeo, darkPlateMat);
      horn.position.set(xPos, 0.45, -0.1);
      horn.rotation.z = xPos > 0 ? -0.45 : 0.45;
      this.dancerHead.add(horn);
    });

    // Hydraulic predator jaw
    const jawGeo = new THREE.BoxGeometry(0.75, 0.22, 0.65);
    this.dancerJaw = new THREE.Mesh(jawGeo, darkPlateMat);
    this.dancerJaw.position.set(0, -0.32, 0.18);
    this.dancerHead.add(this.dancerJaw);

    // Chrome razor teeth
    for (let i = 0; i < 4; i++) {
      const toothGeo = new THREE.ConeGeometry(0.06, 0.18, 6);
      const tooth = new THREE.Mesh(toothGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 }));
      tooth.position.set((i - 1.5) * 0.16, 0.12, 0.2);
      this.dancerJaw.add(tooth);
    }

    // 4. Arms & Hands (Left & Right)
    // Left Arm
    this.dancerLeftArm = new THREE.Group();
    this.dancerLeftArm.position.set(-0.95, 0.75, 0);
    this.dancerSpine.add(this.dancerLeftArm);

    const upperArmGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.55, 8);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, metalMat);
    leftUpperArm.position.y = -0.25;
    this.dancerLeftArm.add(leftUpperArm);

    this.dancerLeftForearm = new THREE.Group();
    this.dancerLeftForearm.position.y = -0.5;
    this.dancerLeftArm.add(this.dancerLeftForearm);

    const foreArmGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8);
    const leftForearmMesh = new THREE.Mesh(foreArmGeo, darkPlateMat);
    leftForearmMesh.position.y = -0.25;
    this.dancerLeftForearm.add(leftForearmMesh);

    // Left Cyber Hand & Articulated Fingers
    this.dancerLeftHand = new THREE.Group();
    this.dancerLeftHand.position.y = -0.52;
    this.dancerLeftForearm.add(this.dancerLeftHand);

    const handPalmGeo = new THREE.BoxGeometry(0.16, 0.12, 0.1);
    const leftPalm = new THREE.Mesh(handPalmGeo, metalMat);
    this.dancerLeftHand.add(leftPalm);

    // 3 cyber fingers on left hand
    [-0.05, 0, 0.05].forEach((fX) => {
      const fingerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6);
      const finger = new THREE.Mesh(fingerGeo, neonCyanMat);
      finger.position.set(fX, -0.1, 0);
      this.dancerLeftHand.add(finger);
    });

    // Right Arm
    this.dancerRightArm = new THREE.Group();
    this.dancerRightArm.position.set(0.95, 0.75, 0);
    this.dancerSpine.add(this.dancerRightArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeo, metalMat);
    rightUpperArm.position.y = -0.25;
    this.dancerRightArm.add(rightUpperArm);

    this.dancerRightForearm = new THREE.Group();
    this.dancerRightForearm.position.y = -0.5;
    this.dancerRightArm.add(this.dancerRightForearm);

    const rightForearmMesh = new THREE.Mesh(foreArmGeo, darkPlateMat);
    rightForearmMesh.position.y = -0.25;
    this.dancerRightForearm.add(rightForearmMesh);

    // Right Cyber Hand & Articulated Fingers
    this.dancerRightHand = new THREE.Group();
    this.dancerRightHand.position.y = -0.52;
    this.dancerRightForearm.add(this.dancerRightHand);

    const rightPalm = new THREE.Mesh(handPalmGeo, metalMat);
    this.dancerRightHand.add(rightPalm);

    [-0.05, 0, 0.05].forEach((fX) => {
      const fingerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6);
      const finger = new THREE.Mesh(fingerGeo, neonCyanMat);
      finger.position.set(fX, -0.1, 0);
      this.dancerRightHand.add(finger);
    });

    // 5. Legs & Feet (Left & Right)
    const thighGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.6, 8);
    const shinGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.55, 8);
    const footGeo = new THREE.BoxGeometry(0.3, 0.15, 0.45);

    // Left Leg
    this.dancerLeftLeg = new THREE.Group();
    this.dancerLeftLeg.position.set(-0.45, 0, 0);
    pelvis.add(this.dancerLeftLeg);

    const leftThigh = new THREE.Mesh(thighGeo, metalMat);
    leftThigh.position.y = -0.3;
    this.dancerLeftLeg.add(leftThigh);

    const leftShin = new THREE.Mesh(shinGeo, darkPlateMat);
    leftShin.position.y = -0.75;
    this.dancerLeftLeg.add(leftShin);

    this.dancerLeftFoot = new THREE.Mesh(footGeo, darkPlateMat);
    this.dancerLeftFoot.position.set(0, -1.05, 0.1);
    this.dancerLeftFoot.castShadow = true;
    this.dancerLeftLeg.add(this.dancerLeftFoot);

    // Right Leg
    this.dancerRightLeg = new THREE.Group();
    this.dancerRightLeg.position.set(0.45, 0, 0);
    pelvis.add(this.dancerRightLeg);

    const rightThigh = new THREE.Mesh(thighGeo, metalMat);
    rightThigh.position.y = -0.3;
    this.dancerRightLeg.add(rightThigh);

    const rightShin = new THREE.Mesh(shinGeo, darkPlateMat);
    rightShin.position.y = -0.75;
    this.dancerRightLeg.add(rightShin);

    this.dancerRightFoot = new THREE.Mesh(footGeo, darkPlateMat);
    this.dancerRightFoot.position.set(0, -1.05, 0.1);
    this.dancerRightFoot.castShadow = true;
    this.dancerRightLeg.add(this.dancerRightFoot);

    this.monsterGroup.add(this.beatEaterGroup);
  }

  // ==================== MONSTER 2: THE RHYTHM BREAKER ====================
  private buildRhythmBreaker() {
    this.rhythmBreakerGroup = new THREE.Group();
    this.rhythmBreakerGroup.position.set(0, 0, 0);
    this.rhythmBreakerGroup.visible = false;

    const torsoGeo = new THREE.BoxGeometry(1.6, 1.8, 1.2);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.25 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.8;
    torso.castShadow = true;
    this.rhythmBreakerGroup.add(torso);

    const coreGeo = new THREE.SphereGeometry(0.35, 24, 24);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
    core.position.set(0, 1.8, 0.65);
    this.rhythmBreakerGroup.add(core);

    const headGeo = new THREE.BoxGeometry(0.9, 0.8, 0.9);
    const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 }));
    head.position.set(0, 3.0, 0);
    this.rhythmBreakerGroup.add(head);

    // Holographic Shield Disc
    this.rhythmShield = new THREE.Group();
    this.rhythmShield.position.set(0, 1.8, 1.5);
    const shieldDiscGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.06, 32);
    const shieldDiscMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      transmission: 0.7,
      opacity: 0.85,
      transparent: true,
      roughness: 0.1
    });
    const shieldDisc = new THREE.Mesh(shieldDiscGeo, shieldDiscMat);
    shieldDisc.rotation.x = Math.PI / 2;
    this.rhythmShield.add(shieldDisc);

    const runeGeo = new THREE.PlaneGeometry(1.2, 1.2);
    this.rhythmRuneMesh = new THREE.Mesh(runeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }));
    this.rhythmRuneMesh.position.z = 0.05;
    this.rhythmShield.add(this.rhythmRuneMesh);
    this.rhythmBreakerGroup.add(this.rhythmShield);

    this.monsterGroup.add(this.rhythmBreakerGroup);
  }

  // ==================== MONSTER 3: THE MUSIC DESTROYER ====================
  private buildMusicDestroyer() {
    this.bossGroup = new THREE.Group();
    this.bossGroup.position.set(0, 0, 0);
    this.bossGroup.visible = false;

    const coreGeo = new THREE.OctahedronGeometry(1.6, 2);
    const bodyCore = new THREE.Mesh(
      coreGeo,
      new THREE.MeshStandardMaterial({ color: 0x4c1d95, metalness: 0.85, roughness: 0.15 })
    );
    bodyCore.position.y = 2.4;
    bodyCore.castShadow = true;
    this.bossArmorParts.push(bodyCore);
    this.bossGroup.add(bodyCore);

    // Orbiting Audio Rings
    [2.2, 2.6, 3.0].forEach((r, idx) => {
      const rGeo = new THREE.TorusGeometry(r, 0.05, 16, 64);
      const ring = new THREE.Mesh(
        rGeo,
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x06b6d4 : idx === 1 ? 0xd946ef : 0xf59e0b,
          transparent: true,
          opacity: 0.8
        })
      );
      ring.position.y = 2.4;
      this.bossOrbitRings.push(ring);
      this.bossGroup!.add(ring);
    });

    this.monsterGroup.add(this.bossGroup);
  }

  // ==================== PARTICLE SYSTEM ====================
  private setupParticleSystem() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: false,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    this.impactParticles = new THREE.Points(geo, mat);
    this.scene.add(this.impactParticles);
  }

  public spawnParticlesAt(pos: THREE.Vector3, colorHex: number, count: number = 30) {
    if (!this.impactParticles) return;
    (this.impactParticles.material as THREE.PointsMaterial).color.setHex(colorHex);

    let spawned = 0;
    for (let i = 0; i < this.MAX_PARTICLES && spawned < count; i++) {
      if (this.particleLifespans[i] <= 0) {
        const idx = i * 3;
        this.particlePositions[idx] = pos.x + (Math.random() - 0.5) * 0.4;
        this.particlePositions[idx + 1] = pos.y + (Math.random() - 0.5) * 0.4;
        this.particlePositions[idx + 2] = pos.z + (Math.random() - 0.5) * 0.4;

        this.particleVelocities[idx] = (Math.random() - 0.5) * 6;
        this.particleVelocities[idx + 1] = Math.random() * 5 + 1;
        this.particleVelocities[idx + 2] = (Math.random() - 0.5) * 6;

        this.particleLifespans[i] = 1.0;
        spawned++;
      }
    }
    this.impactParticles.geometry.attributes.position.needsUpdate = true;
  }

  // ==================== DANCE TRIGGER API ====================
  public setDanceMove(move: DanceMoveId, duration: number = 2.4) {
    this.currentDanceMove = move;
    this.danceTimer = duration;

    // Dynamically update cyber visor color and trigger strobe/shake
    if (this.dancerVisor) {
      const visorMat = this.dancerVisor.material as THREE.MeshBasicMaterial;
      switch (move) {
        case 'drums_stomp':
          visorMat.color.setHex(0x06b6d4); // Cyan
          this.triggerScreenShake(0.12);
          this.triggerStrobe(0x06b6d4);
          this.spawnParticlesAt(new THREE.Vector3(0, 0.4, 0), 0x06b6d4, 15);
          break;
        case 'guitar_headbang':
          visorMat.color.setHex(0xf97316); // Orange
          this.triggerScreenShake(0.1);
          this.triggerStrobe(0xf97316);
          this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0xf97316, 20);
          break;
        case 'piano_sway':
          visorMat.color.setHex(0x3b82f6); // Blue
          this.triggerStrobe(0x3b82f6);
          this.spawnParticlesAt(new THREE.Vector3(0, 1.5, 0), 0x3b82f6, 15);
          break;
        case 'trumpet_march':
          visorMat.color.setHex(0xeab308); // Yellow
          this.triggerStrobe(0xeab308);
          this.spawnParticlesAt(new THREE.Vector3(0, 2.2, 0), 0xeab308, 18);
          break;
        case 'violin_spin':
          visorMat.color.setHex(0xd946ef); // Magenta
          this.triggerStrobe(0xd946ef);
          this.spawnParticlesAt(new THREE.Vector3(0, 1.6, 0), 0xd946ef, 22);
          break;
        case 'dj_bassdrop':
          visorMat.color.setHex(0x22c55e); // Neon Green
          this.triggerScreenShake(0.18);
          this.triggerStrobe(0x22c55e);
          this.spawnParticlesAt(new THREE.Vector3(0, 0.2, 0), 0x22c55e, 25);
          break;
        case 'missed_stumble':
          visorMat.color.setHex(0xef4444); // Red glitch
          this.triggerScreenShake(0.08);
          this.triggerStrobe(0xef4444);
          this.spawnParticlesAt(new THREE.Vector3(0, 1.2, 0), 0x94a3b8, 12);
          break;
        case 'fever_dance':
          visorMat.color.setHex(0xfbbf24); // Gold
          this.triggerScreenShake(0.22);
          this.triggerStrobe(0xfbbf24);
          this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xfbbf24, 45);
          break;
        case 'super_thunder':
        case 'super_storm':
        case 'super_drop':
          visorMat.color.setHex(0xa855f7); // Cosmic Purple
          this.triggerScreenShake(0.3);
          this.triggerStrobe(0xa855f7);
          this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xa855f7, 50);
          break;
        default:
          visorMat.color.setHex(0x00f0ff);
          break;
      }
    }
  }

  // ==================== ATTACK VISUAL PROJECTILES ====================
  public fireAttack(event: AttackEvent) {
    const monsterPos = new THREE.Vector3(0, 1.6, 0);
    const start3D = new THREE.Vector3(
      (event.startX - 0.5) * 11,
      (0.5 - event.startY) * 7 + 1.6,
      3.0
    );

    let projMesh: THREE.Object3D;
    const colorHex = parseInt(event.color.replace('#', '0x'), 16);

    if (event.isSuperAttack) {
      const superGeo = new THREE.IcosahedronGeometry(0.8, 2);
      const superMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      projMesh = new THREE.Mesh(superGeo, superMat);
      this.triggerScreenShake(0.3);
      this.triggerStrobe(colorHex);
    } else {
      switch (event.instrumentId) {
        case 'drums': {
          const geo = new THREE.TorusGeometry(0.6, 0.12, 16, 32);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 }));
          break;
        }
        case 'guitar': {
          const geo = new THREE.ConeGeometry(0.3, 1.2, 4);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex }));
          break;
        }
        case 'piano': {
          const geo = new THREE.BoxGeometry(0.4, 0.8, 0.1);
          projMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.1 }));
          break;
        }
        case 'trumpet': {
          const geo = new THREE.RingGeometry(0.2, 0.7, 32);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide }));
          break;
        }
        case 'violin': {
          const geo = new THREE.TorusKnotGeometry(0.35, 0.08, 64, 8);
          projMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.2 }));
          break;
        }
        case 'dj': {
          const djGroup = new THREE.Group();
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true }));
          djGroup.add(sphere);
          projMesh = djGroup;
          break;
        }
        default: {
          projMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: colorHex }));
        }
      }
    }

    projMesh.position.copy(start3D);
    this.scene.add(projMesh);

    this.activeProjectiles.push({
      mesh: projMesh,
      type: event.isSuperAttack && event.superAttackId ? event.superAttackId : event.instrumentId,
      start: start3D,
      target: monsterPos,
      progress: 0,
      speed: 4.2
    });
  }

  public triggerScreenShake(intensity: number = 0.15) {
    this.screenShakeIntensity = intensity;
  }

  public triggerStrobe(colorHex: number) {
    this.strobeLight.color.setHex(colorHex);
    this.strobeLight.intensity = 5.5;
  }

  public onMonsterHit(isDeflected: boolean, damage: number) {
    if (isDeflected) {
      if (this.rhythmShield) this.rhythmShield.scale.set(1.25, 1.25, 1.25);
      this.triggerScreenShake(0.06);
      this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 1.5), 0x94a3b8, 15);
    } else {
      this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0xffffff, damage > 40 ? 45 : 20);
    }
  }

  public setShieldRequirement(instrumentId: InstrumentId | null) {
    if (!this.rhythmRuneMesh) return;
    if (!instrumentId) {
      this.rhythmRuneMesh.visible = false;
      return;
    }

    this.rhythmRuneMesh.visible = true;
    const inst = INSTRUMENTS[instrumentId];
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = inst.color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(inst.name, 128, 110);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = inst.color;
    ctx.fillText('PLAY NOW', 128, 155);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    (this.rhythmRuneMesh.material as THREE.MeshBasicMaterial).map = texture;
    (this.rhythmRuneMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }

  public setStage(stage: string) {
    this.currentStage = stage;
    // The dancing articulated creature is ALWAYS the star in all stages!
    if (this.beatEaterGroup) this.beatEaterGroup.visible = true;

    if (stage === 'stage_1_beat_eater') {
      if (this.rhythmShield) this.rhythmShield.visible = false;
      this.bossOrbitRings.forEach((r) => (r.visible = false));
      if (this.dancerCore) (this.dancerCore.material as THREE.MeshBasicMaterial).color.setHex(0xec4899);
    } else if (stage === 'stage_2_rhythm_breaker') {
      if (this.rhythmShield) {
        this.rhythmShield.visible = true;
        if (this.beatEaterGroup && this.rhythmShield.parent !== this.beatEaterGroup) {
          this.beatEaterGroup.add(this.rhythmShield);
          this.rhythmShield.position.set(0, 1.3, 1.2);
        }
      }
      this.bossOrbitRings.forEach((r) => (r.visible = false));
      if (this.dancerCore) (this.dancerCore.material as THREE.MeshBasicMaterial).color.setHex(0x06b6d4);
    } else if (stage === 'stage_3_music_destroyer') {
      if (this.rhythmShield) this.rhythmShield.visible = false;
      this.bossOrbitRings.forEach((r) => {
        r.visible = true;
        if (this.beatEaterGroup && r.parent !== this.beatEaterGroup) {
          this.beatEaterGroup.add(r);
          r.position.set(0, 1.4, 0);
        }
      });
      if (this.dancerCore) (this.dancerCore.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
    }
  }

  public setMonsterHealthRatio(ratio: number) {
    this.monsterHealthRatio = Math.max(0, Math.min(1, ratio));
  }

  public playDefeatAnimation(callback?: () => void) {
    this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xf59e0b, 150);
    this.triggerScreenShake(0.3);
    this.triggerStrobe(0xff00ff);
    if (callback) setTimeout(callback, 900);
  }

  // ==================== PROCEDURAL SKELETAL DANCE ANIMATOR ====================
  private updateMonsterDance(delta: number, time: number) {
    if (!this.beatEaterGroup || !this.beatEaterGroup.visible) return;

    if (this.danceTimer > 0) {
      this.danceTimer -= delta;
      if (this.danceTimer <= 0) {
        this.currentDanceMove = 'idle';
      }
    }

    const move = this.currentDanceMove;
    const bpm = 124;
    const beatTime = (time * (bpm / 60)) * Math.PI;

    switch (move) {
      case 'drums_stomp': {
        // High-energy rhythmic double stomping, alternating shoulder hits & chest punch
        const stompPhase = Math.sin(time * 10);
        const isLeftStomp = stompPhase > 0;

        // Lift leg high then slam down with impact
        if (isLeftStomp) {
          this.dancerLeftLeg.position.y = THREE.MathUtils.damp(this.dancerLeftLeg.position.y, Math.abs(stompPhase) * 0.45, 15, delta);
          this.dancerLeftLeg.rotation.x = -Math.abs(stompPhase) * 0.6;
          this.dancerRightLeg.position.y = THREE.MathUtils.damp(this.dancerRightLeg.position.y, 0, 15, delta);
          this.dancerRightLeg.rotation.x = 0;
          this.dancerSpine.rotation.z = 0.12; // shoulder hit right
        } else {
          this.dancerRightLeg.position.y = THREE.MathUtils.damp(this.dancerRightLeg.position.y, Math.abs(stompPhase) * 0.45, 15, delta);
          this.dancerRightLeg.rotation.x = -Math.abs(stompPhase) * 0.6;
          this.dancerLeftLeg.position.y = THREE.MathUtils.damp(this.dancerLeftLeg.position.y, 0, 15, delta);
          this.dancerLeftLeg.rotation.x = 0;
          this.dancerSpine.rotation.z = -0.12; // shoulder hit left
        }

        // Powerful chest punch & drumstick arms
        this.dancerSpine.rotation.x = Math.sin(time * 10) * 0.25;
        this.dancerLeftArm.rotation.x = Math.cos(time * 10) * 0.85 + 0.4;
        this.dancerRightArm.rotation.x = -Math.cos(time * 10) * 0.85 + 0.4;
        this.dancerHead.rotation.x = Math.sin(time * 10) * 0.25;
        this.beatEaterGroup.position.y = Math.abs(Math.sin(time * 10)) * 0.16;
        break;
      }

      case 'guitar_headbang': {
        // Wide power-stance rock headbanging & air-guitar strumming
        this.dancerLeftLeg.position.x = -0.65;
        this.dancerRightLeg.position.x = 0.65;
        this.dancerLeftLeg.rotation.z = -0.25;
        this.dancerRightLeg.rotation.z = 0.25;

        // Deep aggressive headbang
        const headbang = Math.sin(time * 14);
        this.dancerHead.rotation.x = headbang * 0.65;
        this.dancerSpine.rotation.x = headbang * 0.38 + 0.18;

        // Left arm grips guitar neck, right arm circles / strums with gusto
        this.dancerLeftArm.rotation.set(-0.6, 0.45, -0.65);
        this.dancerLeftForearm.rotation.set(-0.8, 0, 0.5);
        this.dancerRightArm.rotation.x = Math.sin(time * 14) * 0.85;
        this.dancerRightForearm.rotation.z = Math.cos(time * 14) * 0.55;

        this.beatEaterGroup.position.y = Math.abs(Math.sin(time * 7)) * 0.12;
        break;
      }

      case 'piano_sway': {
        // Elegant fluid lateral swaying & finger key ripples across dance floor
        const sway = Math.sin(time * 3.5);
        this.beatEaterGroup.position.x = sway * 0.55;
        this.dancerSpine.rotation.z = -sway * 0.28;
        this.dancerHead.rotation.z = sway * 0.22;

        // Both arms extended in front rippling across piano keys
        this.dancerLeftArm.rotation.set(-0.9, 0.2, -0.3 + Math.sin(time * 8) * 0.25);
        this.dancerRightArm.rotation.set(-0.9, -0.2, 0.3 + Math.cos(time * 8) * 0.25);
        this.dancerLeftForearm.rotation.x = -0.4 + Math.sin(time * 12) * 0.18;
        this.dancerRightForearm.rotation.x = -0.4 + Math.cos(time * 12) * 0.18;

        // Smooth gliding footwork
        this.dancerLeftLeg.position.y = Math.sin(time * 3.5) * 0.1;
        this.dancerRightLeg.position.y = -Math.sin(time * 3.5) * 0.1;
        break;
      }

      case 'trumpet_march': {
        // High-stepping brass band parade march with fanfare strut and chest pop
        const marchPhase = Math.sin(time * 6);
        const isLeftStep = marchPhase > 0;

        if (isLeftStep) {
          this.dancerLeftLeg.position.y = Math.abs(marchPhase) * 0.55;
          this.dancerLeftLeg.rotation.x = -Math.abs(marchPhase) * 0.7;
          this.dancerRightLeg.position.y = 0;
          this.dancerRightLeg.rotation.x = 0;
        } else {
          this.dancerRightLeg.position.y = Math.abs(marchPhase) * 0.55;
          this.dancerRightLeg.rotation.x = -Math.abs(marchPhase) * 0.7;
          this.dancerLeftLeg.position.y = 0;
          this.dancerLeftLeg.rotation.x = 0;
        }

        // Both arms raised high holding brass trumpet to sky, chest popping
        this.dancerLeftArm.rotation.set(-1.4, 0.3, -0.2);
        this.dancerRightArm.rotation.set(-1.4, -0.3, 0.2);
        this.dancerHead.rotation.x = -0.4 + Math.sin(time * 6) * 0.18;
        this.dancerSpine.rotation.y = marchPhase * 0.25;
        this.dancerSpine.rotation.x = -0.15 + Math.sin(time * 12) * 0.1; // chest pop

        this.beatEaterGroup.position.y = Math.abs(Math.sin(time * 6)) * 0.15;
        break;
      }

      case 'violin_spin': {
        // Graceful 360-degree pirouette spin with lyrical extension
        this.beatEaterGroup.rotation.y += delta * 6.8;

        // Left arm tucked like violin chin-rest, right arm drawing bow
        this.dancerLeftArm.rotation.set(-1.1, 0.7, -0.5);
        this.dancerRightArm.rotation.set(-0.8 + Math.sin(time * 8) * 0.45, -0.6, 0.35);
        this.dancerSpine.rotation.z = Math.sin(time * 4) * 0.22;
        this.beatEaterGroup.position.y = 0.28 + Math.sin(time * 6) * 0.12;
        break;
      }

      case 'dj_bassdrop': {
        // Breakdance / hip-hop drop into freeze, turntable scratch shuffle & robot pop
        const bounce = Math.sin(time * 8);
        const isDropping = (time % 2.0) > 1.1;

        if (isDropping) {
          // Deep breakdance drop squat freeze
          this.beatEaterGroup.position.y = THREE.MathUtils.damp(this.beatEaterGroup.position.y, -0.35, 12, delta);
          this.dancerLeftLeg.position.x = -0.7;
          this.dancerRightLeg.position.x = 0.7;
          this.dancerSpine.rotation.x = 0.45;
          this.dancerLeftArm.rotation.set(-1.25, 0.8, -0.6); // Hand on headphone
          this.dancerRightArm.rotation.set(-0.7, -0.5, 0.85); // Scratch turntable
        } else {
          // Upright electro bounce and robot pop
          this.beatEaterGroup.position.y = Math.abs(bounce) * 0.24;
          this.dancerLeftArm.rotation.x = Math.sin(time * 8) * 0.75;
          this.dancerRightArm.rotation.x = -Math.sin(time * 8) * 0.75;
          this.dancerHead.rotation.y = Math.sin(time * 4) * 0.35;
        }
        break;
      }

      case 'missed_stumble': {
        // Stumble backwards, flail arms, tilt head and shake
        const wobble = Math.sin(time * 18);
        
        // Torso tilts backward and wavers off-balance
        this.dancerSpine.rotation.x = -0.4 + wobble * 0.08;
        this.dancerSpine.rotation.z = Math.sin(time * 12) * 0.22;
        this.dancerHead.rotation.x = 0.25 + wobble * 0.12;
        this.dancerHead.rotation.y = Math.sin(time * 15) * 0.3; // head shake

        // Arms flail outward to regain balance
        this.dancerLeftArm.rotation.set(-0.6, 0.5, -0.9 + wobble * 0.15);
        this.dancerRightArm.rotation.set(-0.6, -0.5, 0.9 - wobble * 0.15);
        this.dancerLeftForearm.rotation.x = -0.6;
        this.dancerRightForearm.rotation.x = -0.6;

        // One leg slips forward
        this.dancerLeftLeg.position.z = 0.35;
        this.dancerLeftLeg.rotation.x = -0.35;
        this.dancerRightLeg.position.z = -0.2;
        this.dancerRightLeg.rotation.x = 0.2;

        this.beatEaterGroup.position.z = -0.3;
        this.beatEaterGroup.position.y = -0.06;
        break;
      }

      case 'fever_dance': {
        // High-energy fast electro dance: rapid steps, double-time bob, arm waves & jumps
        const feverBeat = Math.sin(time * 16);
        const jump = Math.abs(Math.sin(time * 8)) * 0.45;
        this.beatEaterGroup.position.y = jump;
        this.beatEaterGroup.rotation.y = Math.sin(time * 4) * 0.5;

        // Torso dynamic pulse
        this.dancerSpine.rotation.x = feverBeat * 0.2;
        this.dancerSpine.rotation.z = Math.cos(time * 8) * 0.18;
        this.dancerHead.rotation.x = -feverBeat * 0.25;

        // Rapid techno waves with arms
        this.dancerLeftArm.rotation.set(-1.1 + Math.sin(time * 16) * 0.6, 0.3, -0.4);
        this.dancerRightArm.rotation.set(-1.1 - Math.sin(time * 16) * 0.6, -0.3, 0.4);
        this.dancerLeftForearm.rotation.x = -0.5 + Math.cos(time * 16) * 0.4;
        this.dancerRightForearm.rotation.x = -0.5 - Math.cos(time * 16) * 0.4;

        // Alternating rapid shuffle kicks
        if (feverBeat > 0) {
          this.dancerLeftLeg.position.y = feverBeat * 0.35;
          this.dancerLeftLeg.rotation.x = -feverBeat * 0.5;
          this.dancerRightLeg.position.y = 0;
          this.dancerRightLeg.rotation.x = 0.1;
        } else {
          this.dancerRightLeg.position.y = -feverBeat * 0.35;
          this.dancerRightLeg.rotation.x = feverBeat * 0.5;
          this.dancerLeftLeg.position.y = 0;
          this.dancerLeftLeg.rotation.x = 0.1;
        }
        break;
      }

      case 'super_thunder':
      case 'super_storm':
      case 'super_drop': {
        // Signature super acrobatics: Leaping levitation & cosmic spin
        this.beatEaterGroup.position.y = 0.45 + Math.sin(time * 8) * 0.28;
        this.beatEaterGroup.rotation.y += delta * 4.5;
        this.dancerLeftArm.rotation.set(-1.6, 0.5, -0.5);
        this.dancerRightArm.rotation.set(-1.6, -0.5, 0.5);
        this.dancerSpine.rotation.x = Math.sin(time * 8) * 0.25;
        break;
      }

      case 'idle':
      default: {
        // Smooth groovy idle: rhythmic bobbing to 124 BPM beat
        const idleBeat = Math.sin(beatTime);
        this.beatEaterGroup.position.y = THREE.MathUtils.damp(this.beatEaterGroup.position.y, Math.abs(idleBeat) * 0.08, 10, delta);
        this.beatEaterGroup.position.x = THREE.MathUtils.damp(this.beatEaterGroup.position.x, 0, 8, delta);
        this.beatEaterGroup.position.z = THREE.MathUtils.damp(this.beatEaterGroup.position.z, 0, 8, delta);
        this.beatEaterGroup.rotation.y = THREE.MathUtils.damp(this.beatEaterGroup.rotation.y, 0, 8, delta);

        this.dancerSpine.rotation.x = THREE.MathUtils.damp(this.dancerSpine.rotation.x, idleBeat * 0.08, 10, delta);
        this.dancerSpine.rotation.z = THREE.MathUtils.damp(this.dancerSpine.rotation.z, Math.sin(time * 2) * 0.04, 10, delta);
        this.dancerHead.rotation.x = THREE.MathUtils.damp(this.dancerHead.rotation.x, -idleBeat * 0.06, 10, delta);
        this.dancerHead.rotation.y = THREE.MathUtils.damp(this.dancerHead.rotation.y, 0, 10, delta);

        // Arms resting naturally with subtle sway
        this.dancerLeftArm.rotation.x = THREE.MathUtils.damp(this.dancerLeftArm.rotation.x, Math.sin(time * 2.5) * 0.12, 10, delta);
        this.dancerRightArm.rotation.x = THREE.MathUtils.damp(this.dancerRightArm.rotation.x, -Math.sin(time * 2.5) * 0.12, 10, delta);
        this.dancerLeftArm.rotation.z = THREE.MathUtils.damp(this.dancerLeftArm.rotation.z, -0.2, 10, delta);
        this.dancerRightArm.rotation.z = THREE.MathUtils.damp(this.dancerRightArm.rotation.z, 0.2, 10, delta);

        this.dancerLeftLeg.position.set(-0.45, 0, 0);
        this.dancerRightLeg.position.set(0.45, 0, 0);
        this.dancerLeftLeg.rotation.set(0, 0, 0);
        this.dancerRightLeg.rotation.set(0, 0, 0);
        break;
      }
    }

    // Biomechanical jaw rhythmic chomp
    if (this.dancerJaw) {
      this.dancerJaw.position.y = -0.32 - Math.abs(Math.sin(time * 5)) * 0.1;
    }
  }

  // ==================== MAIN RENDER LOOP ====================
  private animate = () => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Dance & Animation Update
    this.updateMonsterDance(delta, elapsedTime);

    // Boss & Rhythm Breaker secondary ambient animations
    if (this.currentStage === 'stage_2_rhythm_breaker' && this.rhythmBreakerGroup?.visible) {
      this.rhythmBreakerGroup.position.y = Math.sin(elapsedTime * 2.5) * 0.08;
      if (this.rhythmShield) {
        this.rhythmShield.rotation.z = Math.sin(elapsedTime * 1.5) * 0.15;
        this.rhythmShield.scale.lerp(this._v1.set(1, 1, 1), delta * 8);
      }
    } else if (this.currentStage === 'stage_3_music_destroyer' && this.bossGroup?.visible) {
      this.bossGroup.position.y = Math.sin(elapsedTime * 2.0) * 0.2;
      this.bossOrbitRings.forEach((ring, idx) => {
        const speed = (idx + 1) * 0.7 * (idx % 2 === 0 ? 1 : -1);
        ring.rotation.x += delta * speed;
        ring.rotation.y += delta * (speed * 0.8);
      });
    }

    // Strobe decay
    if (this.strobeLight.intensity > 0) {
      this.strobeLight.intensity = THREE.MathUtils.damp(this.strobeLight.intensity, 0, 8, delta);
    }

    // 2. Projectiles update
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.progress += delta * p.speed;
      p.mesh.position.lerpVectors(p.start, p.target, Math.min(1.0, p.progress));
      p.mesh.rotation.x += delta * 4;
      p.mesh.rotation.y += delta * 6;

      if (p.progress >= 1.0) {
        this.scene.remove(p.mesh);
        this.activeProjectiles.splice(i, 1);
      }
    }

    // 3. Particles update
    if (this.impactParticles) {
      let activeCount = 0;
      for (let i = 0; i < this.MAX_PARTICLES; i++) {
        if (this.particleLifespans[i] > 0) {
          this.particleLifespans[i] -= delta * 1.4;
          const idx = i * 3;
          this.particlePositions[idx] += this.particleVelocities[idx] * delta;
          this.particlePositions[idx + 1] += this.particleVelocities[idx + 1] * delta;
          this.particlePositions[idx + 2] += this.particleVelocities[idx + 2] * delta;
          this.particleVelocities[idx + 1] -= 9.8 * delta;
          activeCount++;
        }
      }
      if (activeCount > 0) {
        this.impactParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 4. Camera Screen Shake
    let camOffsetX = 0;
    let camOffsetY = 0;
    if (this.screenShakeIntensity > 0.005) {
      camOffsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
      camOffsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
      this.screenShakeIntensity = THREE.MathUtils.damp(this.screenShakeIntensity, 0, 6, delta);
    }
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camOffsetX, 10, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.8 + camOffsetY, 10, delta);

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public dispose() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onResize);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
