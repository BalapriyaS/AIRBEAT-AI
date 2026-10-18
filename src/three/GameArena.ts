import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AttackEvent, DanceMoveId, InstrumentId, SuperAttackId } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';

/**
 * AIRBEAT AI - Professional 3D Game Arena & Cinematic Realistic Creature
 * Implements a detailed, lifelike bio-mechanical creature with procedural scale normals,
 * anatomical skull, realistic predatory eyes, articulated blinking eyelids, breathing ribcage,
 * sculpted muscular limbs, raptor talons, multi-jointed tail, and beat-synchronized dance animations.
 */
export class GameArena {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  // Arena & Lighting
  private stageGroup: THREE.Group;
  private floorGrid!: THREE.GridHelper;
  private floorPlane!: THREE.Mesh;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.HemisphereLight;
  private rimLight!: THREE.PointLight;
  private strobeLight!: THREE.PointLight;

  // Realistic Creature Hierarchy
  private monsterGroup: THREE.Group;
  private creatureRoot!: THREE.Group;
  private pelvisGroup!: THREE.Group;
  private spineGroup!: THREE.Group;
  private chestGroup!: THREE.Group;
  private neckGroup!: THREE.Group;
  private headGroup!: THREE.Group;
  private lowerJawGroup!: THREE.Group;
  private upperEyelidL!: THREE.Mesh;
  private upperEyelidR!: THREE.Mesh;
  private eyeOrbL!: THREE.Mesh;
  private eyeOrbR!: THREE.Mesh;
  private hornsGroup!: THREE.Group;
  private tongueMesh!: THREE.Mesh;
  private coreReactor!: THREE.Mesh;
  private dorsalPlates: THREE.Mesh[] = [];

  // Limbs
  private leftClavicle!: THREE.Group;
  private rightClavicle!: THREE.Group;
  private leftUpperArm!: THREE.Group;
  private rightUpperArm!: THREE.Group;
  private leftForearm!: THREE.Group;
  private rightForearm!: THREE.Group;
  private leftHandGroup!: THREE.Group;
  private rightHandGroup!: THREE.Group;

  private leftThighGroup!: THREE.Group;
  private rightThighGroup!: THREE.Group;
  private leftShinGroup!: THREE.Group;
  private rightShinGroup!: THREE.Group;
  private leftFootMesh!: THREE.Group;
  private rightFootMesh!: THREE.Group;

  // Tail segments
  private tailSegments: THREE.Group[] = [];

  // Rhythm Breaker shield & rune
  private rhythmShield: THREE.Group | null = null;
  private rhythmRuneMesh: THREE.Mesh | null = null;

  // Boss orbital rings
  private bossOrbitRings: THREE.Mesh[] = [];

  // Projectiles & Particle System
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
  private readonly MAX_PARTICLES = 150;

  // Dance & State Management
  private currentStage: string = 'stage_1_beat_eater';
  private currentDanceMove: DanceMoveId = 'idle';
  private danceTimer: number = 0;
  private monsterHealthRatio: number = 1.0;
  private screenShakeIntensity: number = 0;
  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;

  // Head and Eye Tracking
  private pointerTarget: THREE.Vector2 = new THREE.Vector2(0.5, 0.5);
  private currentHeadYaw: number = 0;
  private currentHeadPitch: number = 0;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  // Math helpers
  private readonly _v1 = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060d);
    this.scene.fog = new THREE.FogExp2(0x04060d, 0.038);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0, 1.85, 8.5);
    this.camera.lookAt(0, 1.35, 0);

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Studio Environment Reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig
    this.setupLighting();

    // 5. Stage & Arena
    this.stageGroup = new THREE.Group();
    this.scene.add(this.stageGroup);
    this.setupStage();

    // 6. Monster Group & Creature
    this.monsterGroup = new THREE.Group();
    this.monsterGroup.position.set(0, 0, 0);
    this.scene.add(this.monsterGroup);

    // 7. Particle System Setup
    this.particlePositions = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleVelocities = new Float32Array(this.MAX_PARTICLES * 3);
    this.particleLifespans = new Float32Array(this.MAX_PARTICLES);
    this.setupParticleSystem();

    // 8. Build Realistic Creature & Stage Boss Props
    this.buildRealisticCreature();
    this.buildRhythmBreakerProps();
    this.buildMusicDestroyerProps();

    this.setStage('stage_1_beat_eater');

    // 9. Resize Listener & Pre-warm
    window.addEventListener('resize', this.onResize);
    this.renderer.compile(this.scene, this.camera);

    // 10. Start Loop
    this.animate();
  }

  // ==================== PROCEDURAL TEXTURES GENERATION ====================
  /**
   * Generates realistic procedural normal & roughness map for reptilian scutes & cyber-chitin skin
   */
  private generateScaleTextures(): { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 512;
    const canvasN = document.createElement('canvas');
    canvasN.width = size;
    canvasN.height = size;
    const ctxN = canvasN.getContext('2d')!;

    const canvasR = document.createElement('canvas');
    canvasR.width = size;
    canvasR.height = size;
    const ctxR = canvasR.getContext('2d')!;

    const imgDataN = ctxN.createImageData(size, size);
    const imgDataR = ctxR.createImageData(size, size);
    const dataN = imgDataN.data;
    const dataR = imgDataR.data;

    // Height array for Sobel filter
    const height = new Float32Array(size * size);

    // Voronoi-like cellular scute height pattern
    const cells = 36;
    const points: [number, number][] = [];
    for (let i = 0; i < cells; i++) {
      points.push([Math.random() * size, Math.random() * size]);
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let d1 = 999999;
        let d2 = 999999;
        for (let i = 0; i < cells; i++) {
          const dx = x - points[i][0];
          const dy = y - points[i][1];
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) {
            d2 = d;
          }
        }
        const dist1 = Math.sqrt(d1);
        const dist2 = Math.sqrt(d2);
        const cellEdge = Math.max(0, Math.min(1, (dist2 - dist1) / 12));
        // Add subtle micro pore noise
        const micro = (Math.sin(x * 0.4) * Math.cos(y * 0.4) + 1) * 0.08;
        height[y * size + x] = cellEdge * 0.85 + micro;
      }
    }

    // Sobel normal map computation
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const left = height[y * size + ((x - 1 + size) % size)];
        const right = height[y * size + ((x + 1) % size)];
        const up = height[((y - 1 + size) % size) * size + x];
        const down = height[((y + 1) % size) * size + x];

        const dx = (right - left) * 2.5;
        const dy = (down - up) * 2.5;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        const idx = (y * size + x) * 4;
        dataN[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        dataN[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        dataN[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        dataN[idx + 3] = 255;

        // Roughness: scale center is slick (0.2), crevices are rough (0.85)
        const hVal = height[y * size + x];
        const rough = Math.round((1.0 - hVal * 0.7) * 255);
        dataR[idx] = rough;
        dataR[idx + 1] = rough;
        dataR[idx + 2] = rough;
        dataR[idx + 3] = 255;
      }
    }

    ctxN.putImageData(imgDataN, 0, 0);
    ctxR.putImageData(imgDataR, 0, 0);

    const normalMap = new THREE.CanvasTexture(canvasN);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 4);

    const roughnessMap = new THREE.CanvasTexture(canvasR);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(4, 4);

    return { normalMap, roughnessMap };
  }

  /**
   * Generates a realistic predatory eye texture with radiant iris & vertical slit pupil
   */
  private generatePredatorEyeTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    // 1. Sclera with subtle dark rim
    const gradSclera = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    gradSclera.addColorStop(0, '#1a1e29');
    gradSclera.addColorStop(1, '#05070a');
    ctx.fillStyle = gradSclera;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Limbal ring & glowing iris (Amber & Cyan bioluminescence)
    const irisR = r * 0.85;
    const gradIris = ctx.createRadialGradient(cx, cy, 10, cx, cy, irisR);
    gradIris.addColorStop(0, '#fef08a'); // inner glow
    gradIris.addColorStop(0.3, '#f59e0b'); // amber
    gradIris.addColorStop(0.7, '#06b6d4'); // electric cyan striation
    gradIris.addColorStop(0.95, '#0284c7'); // dark cerulean
    gradIris.addColorStop(1.0, '#030712'); // black limbal ring

    ctx.fillStyle = gradIris;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Radial muscle fiber rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (irisR * 0.2), cy + Math.sin(a) * (irisR * 0.2));
      ctx.lineTo(cx + Math.cos(a) * (irisR * 0.9), cy + Math.sin(a) * (irisR * 0.9));
      ctx.stroke();
    }

    // 4. Vertical slit predator pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, irisR * 0.18, irisR * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Specular gleam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.25, cy - irisR * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ==================== LIGHTING SETUP ====================
  private setupLighting() {
    this.keyLight = new THREE.DirectionalLight(0xfff5e6, 2.8);
    this.keyLight.position.set(4, 9, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x06b6d4, 0x1b1130, 1.3);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.PointLight(0xd946ef, 3.8, 16);
    this.rimLight.position.set(0, 4.5, -4.2);
    this.scene.add(this.rimLight);

    this.strobeLight = new THREE.PointLight(0x00f0ff, 0, 22);
    this.strobeLight.position.set(0, 2.2, 2.5);
    this.scene.add(this.strobeLight);
  }

  // ==================== STAGE SETUP ====================
  private setupStage() {
    // Octagonal concert stage platform with metallic brushed titanium edge
    const stageGeo = new THREE.CylinderGeometry(5.4, 5.8, 0.45, 8);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d18,
      roughness: 0.28,
      metalness: 0.9
    });
    const stageBase = new THREE.Mesh(stageGeo, stageMat);
    stageBase.position.y = -0.225;
    stageBase.receiveShadow = true;
    this.stageGroup.add(stageBase);

    // Glowing Neon Edge Ring
    const ringGeo = new THREE.TorusGeometry(5.45, 0.05, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.01;
    this.stageGroup.add(ringMesh);

    // Inner concentric amber glow ring
    const ringInnerGeo = new THREE.TorusGeometry(3.6, 0.03, 16, 48);
    const ringInnerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const ringInner = new THREE.Mesh(ringInnerGeo, ringInnerMat);
    ringInner.rotation.x = Math.PI / 2;
    ringInner.position.y = 0.012;
    this.stageGroup.add(ringInner);

    // Holographic Cyber Grid
    this.floorGrid = new THREE.GridHelper(18, 36, 0x06b6d4, 0x1e293b);
    this.floorGrid.position.y = 0.02;
    (this.floorGrid.material as THREE.Material).opacity = 0.35;
    (this.floorGrid.material as THREE.Material).transparent = true;
    this.stageGroup.add(this.floorGrid);

    // Shadow receiver plane
    const shadowGeo = new THREE.PlaneGeometry(16, 16);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.6 });
    this.floorPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.y = 0.015;
    this.floorPlane.receiveShadow = true;
    this.stageGroup.add(this.floorPlane);
  }

  // ==================== REALISTIC CINEMATIC 3D CREATURE ====================
  private buildRealisticCreature() {
    this.creatureRoot = new THREE.Group();
    this.creatureRoot.position.set(0, 0, 0);

    const { normalMap, roughnessMap } = this.generateScaleTextures();
    const eyeTex = this.generatePredatorEyeTexture();

    // Premium Dielectric Organic PBR Materials (Living Dragon / Beast)
    const scaleSkinMat = new THREE.MeshStandardMaterial({
      color: 0x1b2e24, // Deep forest/emerald-obsidian reptilian scales
      metalness: 0.02, // Pure dielectric organic keratin
      roughness: 0.54, // Tactile cellular scute roughness
      normalMap: normalMap,
      roughnessMap: roughnessMap
    });

    const darkChitinMat = new THREE.MeshStandardMaterial({
      color: 0x121e17, // Dense dorsal armor scutes, horns, and talons
      metalness: 0.03, // Organic bone/keratin
      roughness: 0.46,
      normalMap: normalMap
    });

    const ivoryFangsMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb, // Polished biological ivory enamel
      metalness: 0.0,
      roughness: 0.18
    });

    const neonCyanEmissive = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonAmberEmissive = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // 1. Pelvis & Root (Weight center)
    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.position.y = 1.15;
    this.creatureRoot.add(this.pelvisGroup);

    const pelvisMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.4, 16), darkChitinMat);
    pelvisMesh.castShadow = true;
    this.pelvisGroup.add(pelvisMesh);

    // 2. Spine & Breathing Ribcage
    this.spineGroup = new THREE.Group();
    this.spineGroup.position.y = 0.22;
    this.pelvisGroup.add(this.spineGroup);

    this.chestGroup = new THREE.Group();
    this.chestGroup.position.y = 0.55;
    this.spineGroup.add(this.chestGroup);

    // Muscular Anatomical Torso (Sculpted Pectorals & Ribs)
    const chestGeo = new THREE.SphereGeometry(0.82, 24, 18);
    chestGeo.scale(1.0, 1.15, 0.85);
    const chestMesh = new THREE.Mesh(chestGeo, scaleSkinMat);
    chestMesh.castShadow = true;
    this.chestGroup.add(chestMesh);

    // Layered abdominal armor scutes (contoured organic plates)
    for (let i = 0; i < 3; i++) {
      const scuteGeo = new THREE.CylinderGeometry(0.28 - i * 0.04, 0.32 - i * 0.04, 0.14, 12);
      scuteGeo.rotateZ(Math.PI / 2);
      scuteGeo.scale(1.0, 0.5, 0.8);
      const scute = new THREE.Mesh(scuteGeo, darkChitinMat);
      scute.position.set(0, -0.32 + i * 0.2, 0.54);
      this.chestGroup.add(scute);
    }

    // Glowing Biometric Power Reactor (Pulsing Heart)
    const reactorGeo = new THREE.IcosahedronGeometry(0.24, 2);
    this.coreReactor = new THREE.Mesh(reactorGeo, neonCyanEmissive);
    this.coreReactor.position.set(0, 0.15, 0.58);
    this.chestGroup.add(this.coreReactor);

    // 7 Articulated Dorsal Spine Plates (running down the back)
    for (let i = 0; i < 7; i++) {
      const scale = 1.0 - Math.abs(i - 3) * 0.18;
      const plate = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.42 * scale, 4), darkChitinMat);
      plate.position.set(0, 0.65 - i * 0.18, -0.65 + i * 0.05);
      plate.rotation.x = -0.55;
      this.dorsalPlates.push(plate);
      this.chestGroup.add(plate);
    }

    // 3. Neck & Anatomical Head
    this.neckGroup = new THREE.Group();
    this.neckGroup.position.set(0, 0.72, 0);
    this.chestGroup.add(this.neckGroup);

    const neckGeo = new THREE.CylinderGeometry(0.28, 0.36, 0.45, 16);
    const neckMesh = new THREE.Mesh(neckGeo, scaleSkinMat);
    this.neckGroup.add(neckMesh);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.38, 0.12);
    this.neckGroup.add(this.headGroup);

    // Sculpted Cranium / Skull (Organic brow & muzzle)
    const craniumGeo = new THREE.SphereGeometry(0.48, 20, 16);
    craniumGeo.scale(0.85, 0.75, 1.25);
    const craniumMesh = new THREE.Mesh(craniumGeo, scaleSkinMat);
    craniumMesh.position.set(0, 0.08, -0.05);
    craniumMesh.castShadow = true;
    this.headGroup.add(craniumMesh);

    // Sculpted Organic Muzzle / Maxilla
    const snoutGeo = new THREE.CylinderGeometry(0.2, 0.36, 0.68, 16);
    snoutGeo.rotateX(Math.PI / 2);
    snoutGeo.scale(0.85, 0.72, 1.0);
    const snout = new THREE.Mesh(snoutGeo, darkChitinMat);
    snout.position.set(0, -0.02, 0.52);
    snout.castShadow = true;
    this.headGroup.add(snout);

    // Anatomical nostril cavities
    [-0.08, 0.08].forEach((nx) => {
      const nostril = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x070d0a })
      );
      nostril.position.set(nx, 0.05, 0.82);
      this.headGroup.add(nostril);
    });

    // Upper Predatory Saber Fangs (Ivory Overbite)
    [-0.16, 0.16].forEach((fx) => {
      const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.28, 10), ivoryFangsMat);
      upperFang.position.set(fx, -0.15, 0.65);
      upperFang.rotation.x = 0.22;
      this.headGroup.add(upperFang);
    });

    // Dual Realistic Predatory Eyes
    const eyeMat = new THREE.MeshStandardMaterial({
      map: eyeTex,
      roughness: 0.1,
      metalness: 0.1
    });

    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.75,
      opacity: 0.9,
      roughness: 0.04,
      transparent: true,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });

    [-0.32, 0.32].forEach((xSide, idx) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(xSide, 0.14, 0.32);
      eyeSocket.rotation.y = xSide > 0 ? 0.35 : -0.35;
      this.headGroup.add(eyeSocket);

      // Eyeball
      const eyeOrb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), eyeMat);
      eyeOrb.rotation.y = Math.PI / 2;
      eyeSocket.add(eyeOrb);

      // Cornea dome
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), corneaMat);
      eyeSocket.add(cornea);

      // Upper eyelid
      const lidGeo = new THREE.SphereGeometry(0.135, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const eyelid = new THREE.Mesh(lidGeo, darkChitinMat);
      eyelid.rotation.x = -0.4;
      eyeSocket.add(eyelid);

      if (idx === 0) {
        this.eyeOrbL = eyeOrb;
        this.upperEyelidL = eyelid;
      } else {
        this.eyeOrbR = eyeOrb;
        this.upperEyelidR = eyelid;
      }
    });

    // Swept-Back Majestic Horns / Acoustic Crests
    this.hornsGroup = new THREE.Group();
    this.headGroup.add(this.hornsGroup);

    [-0.42, 0.42].forEach((hx) => {
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx, 0.22, 0.0),
        new THREE.Vector3(hx * 1.35, 0.65, -0.3),
        new THREE.Vector3(hx * 1.65, 0.95, -0.75)
      ]);
      const hornGeo = new THREE.TubeGeometry(hornCurve, 20, 0.09, 8, false);
      const hornMesh = new THREE.Mesh(hornGeo, darkChitinMat);
      this.hornsGroup.add(hornMesh);

      // Bioluminescent ring bands around horns
      for (let ring = 1; ring <= 3; ring++) {
        const pt = hornCurve.getPoint(ring * 0.25);
        const rBand = new THREE.Mesh(new THREE.TorusGeometry(0.09 - ring * 0.015, 0.018, 8, 16), neonCyanEmissive);
        rBand.position.copy(pt);
        rBand.lookAt(hornCurve.getPoint(ring * 0.25 + 0.05));
        this.hornsGroup.add(rBand);
      }
    });

    // Articulated Curved Lower Mandible & Fangs
    this.lowerJawGroup = new THREE.Group();
    this.lowerJawGroup.position.set(0, -0.16, 0.12);
    this.headGroup.add(this.lowerJawGroup);

    const jawGeo = new THREE.CylinderGeometry(0.14, 0.26, 0.64, 14);
    jawGeo.rotateX(Math.PI / 2);
    jawGeo.scale(0.82, 0.6, 1.0);
    const jawMesh = new THREE.Mesh(jawGeo, darkChitinMat);
    jawMesh.position.set(0, -0.04, 0.28);
    this.lowerJawGroup.add(jawMesh);

    // Realistic curved lower fangs
    const fangPositions = [
      [-0.14, 0.08, 0.46, 0.24],
      [0.14, 0.08, 0.46, 0.24],
      [-0.11, 0.06, 0.28, 0.16],
      [0.11, 0.06, 0.28, 0.16]
    ];
    fangPositions.forEach(([fx, fy, fz, fHeight]) => {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.04, fHeight, 8), ivoryFangsMat);
      fang.position.set(fx, fy, fz);
      fang.rotation.x = -0.22;
      this.lowerJawGroup.add(fang);
    });

    // Fleshy Tongue & Vascular Gums
    const tongueGeo = new THREE.ConeGeometry(0.09, 0.35, 8);
    tongueGeo.rotateX(Math.PI / 2);
    this.tongueMesh = new THREE.Mesh(
      tongueGeo,
      new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.35, metalness: 0.0 })
    );
    this.tongueMesh.position.set(0, 0.02, 0.24);
    this.lowerJawGroup.add(this.tongueMesh);

    // 4. Clavicles & Arms
    // Left Arm
    this.leftClavicle = new THREE.Group();
    this.leftClavicle.position.set(-0.75, 0.35, 0);
    this.chestGroup.add(this.leftClavicle);

    const shoulderPauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), darkChitinMat);
    this.leftClavicle.add(shoulderPauldronL);

    this.leftUpperArm = new THREE.Group();
    this.leftUpperArm.position.y = -0.12;
    this.leftClavicle.add(this.leftUpperArm);

    const bicepMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.58, 12), scaleSkinMat);
    bicepMeshL.position.y = -0.26;
    this.leftUpperArm.add(bicepMeshL);

    this.leftForearm = new THREE.Group();
    this.leftForearm.position.y = -0.54;
    this.leftUpperArm.add(this.leftForearm);

    const forearmMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.52, 12), darkChitinMat);
    forearmMeshL.position.y = -0.24;
    this.leftForearm.add(forearmMeshL);

    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.position.y = -0.52;
    this.leftForearm.add(this.leftHandGroup);

    const palmLGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.16, 12);
    palmLGeo.rotateZ(Math.PI / 2);
    palmLGeo.scale(1.0, 0.65, 1.0);
    const palmL = new THREE.Mesh(palmLGeo, darkChitinMat);
    this.leftHandGroup.add(palmL);

    // 3 Curved predatory talons on left hand
    [-0.06, 0, 0.06].forEach((cx, idx) => {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.18, 8), darkChitinMat);
      claw.position.set(cx, -0.14, 0.03);
      claw.rotation.x = 0.25;
      claw.rotation.z = (idx - 1) * 0.1;
      this.leftHandGroup.add(claw);
    });

    // Right Arm
    this.rightClavicle = new THREE.Group();
    this.rightClavicle.position.set(0.75, 0.35, 0);
    this.chestGroup.add(this.rightClavicle);

    const shoulderPauldronR = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), darkChitinMat);
    this.rightClavicle.add(shoulderPauldronR);

    this.rightUpperArm = new THREE.Group();
    this.rightUpperArm.position.y = -0.12;
    this.rightClavicle.add(this.rightUpperArm);

    const bicepMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.58, 12), scaleSkinMat);
    bicepMeshR.position.y = -0.26;
    this.rightUpperArm.add(bicepMeshR);

    this.rightForearm = new THREE.Group();
    this.rightForearm.position.y = -0.54;
    this.rightUpperArm.add(this.rightForearm);

    const forearmMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.52, 12), darkChitinMat);
    forearmMeshR.position.y = -0.24;
    this.rightForearm.add(forearmMeshR);

    this.rightHandGroup = new THREE.Group();
    this.rightHandGroup.position.y = -0.52;
    this.rightForearm.add(this.rightHandGroup);

    const palmRGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.16, 12);
    palmRGeo.rotateZ(Math.PI / 2);
    palmRGeo.scale(1.0, 0.65, 1.0);
    const palmR = new THREE.Mesh(palmRGeo, darkChitinMat);
    this.rightHandGroup.add(palmR);

    [-0.06, 0, 0.06].forEach((cx, idx) => {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.18, 8), darkChitinMat);
      claw.position.set(cx, -0.14, 0.03);
      claw.rotation.x = 0.25;
      claw.rotation.z = (idx - 1) * 0.1;
      this.rightHandGroup.add(claw);
    });

    // 5. Heavy Muscular Digitigrade Legs & Raptor Talons
    // Left Leg
    this.leftThighGroup = new THREE.Group();
    this.leftThighGroup.position.set(-0.48, -0.05, 0);
    this.pelvisGroup.add(this.leftThighGroup);

    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.65, 14), scaleSkinMat);
    thighL.position.y = -0.32;
    this.leftThighGroup.add(thighL);

    // Armored knee cap
    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), darkChitinMat);
    kneeL.position.set(0, -0.62, 0.12);
    this.leftThighGroup.add(kneeL);

    this.leftShinGroup = new THREE.Group();
    this.leftShinGroup.position.y = -0.65;
    this.leftThighGroup.add(this.leftShinGroup);

    const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 12), darkChitinMat);
    shinL.position.y = -0.28;
    this.leftShinGroup.add(shinL);

    this.leftFootMesh = new THREE.Group();
    this.leftFootMesh.position.set(0, -0.58, 0.12);
    this.leftShinGroup.add(this.leftFootMesh);

    const footBaseLGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.42, 12);
    footBaseLGeo.rotateX(Math.PI / 2);
    footBaseLGeo.scale(0.85, 0.55, 1.0);
    const footBaseL = new THREE.Mesh(footBaseLGeo, darkChitinMat);
    footBaseL.castShadow = true;
    this.leftFootMesh.add(footBaseL);

    // 3 grounded raptor claws
    [-0.09, 0, 0.09].forEach((tx, idx) => {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.26, 8), ivoryFangsMat);
      talon.rotation.x = Math.PI / 2 + 0.1;
      talon.rotation.z = (idx - 1) * 0.15;
      talon.position.set(tx, -0.04, 0.28);
      this.leftFootMesh.add(talon);
    });

    // Right Leg
    this.rightThighGroup = new THREE.Group();
    this.rightThighGroup.position.set(0.48, -0.05, 0);
    this.pelvisGroup.add(this.rightThighGroup);

    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.65, 14), scaleSkinMat);
    thighR.position.y = -0.32;
    this.rightThighGroup.add(thighR);

    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), darkChitinMat);
    kneeR.position.set(0, -0.62, 0.12);
    this.rightThighGroup.add(kneeR);

    this.rightShinGroup = new THREE.Group();
    this.rightShinGroup.position.y = -0.65;
    this.rightThighGroup.add(this.rightShinGroup);

    const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 12), darkChitinMat);
    shinR.position.y = -0.28;
    this.rightShinGroup.add(shinR);

    this.rightFootMesh = new THREE.Group();
    this.rightFootMesh.position.set(0, -0.58, 0.12);
    this.rightShinGroup.add(this.rightFootMesh);

    const footBaseRGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.42, 12);
    footBaseRGeo.rotateX(Math.PI / 2);
    footBaseRGeo.scale(0.85, 0.55, 1.0);
    const footBaseR = new THREE.Mesh(footBaseRGeo, darkChitinMat);
    footBaseR.castShadow = true;
    this.rightFootMesh.add(footBaseR);

    [-0.09, 0, 0.09].forEach((tx, idx) => {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.26, 8), ivoryFangsMat);
      talon.rotation.x = Math.PI / 2 + 0.1;
      talon.rotation.z = (idx - 1) * 0.15;
      talon.position.set(tx, -0.04, 0.28);
      this.rightFootMesh.add(talon);
    });

    // 6. Articulated Flexible Tail (5 linked segments with trailing physics)
    let prevTailGroup: THREE.Group = this.pelvisGroup;
    for (let seg = 0; seg < 5; seg++) {
      const segGroup = new THREE.Group();
      segGroup.position.set(0, -0.15, -0.35);
      prevTailGroup.add(segGroup);

      const radius = 0.18 - seg * 0.028;
      const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, 0.45, 10), darkChitinMat);
      segMesh.rotation.x = -Math.PI / 3;
      segMesh.position.set(0, -0.18, -0.16);
      segGroup.add(segMesh);

      this.tailSegments.push(segGroup);
      prevTailGroup = segGroup;
    }

    this.monsterGroup.add(this.creatureRoot);
  }

  // ==================== STAGE BOSS PROPS & SHIELDS ====================
  private buildRhythmBreakerProps() {
    this.rhythmShield = new THREE.Group();
    this.rhythmShield.position.set(0, 1.45, 1.3);
    this.rhythmShield.visible = false;

    const shieldDiscGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.06, 32);
    const shieldDiscMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      transmission: 0.75,
      opacity: 0.85,
      transparent: true,
      roughness: 0.08,
      clearcoat: 1.0
    });
    const shieldDisc = new THREE.Mesh(shieldDiscGeo, shieldDiscMat);
    shieldDisc.rotation.x = Math.PI / 2;
    this.rhythmShield.add(shieldDisc);

    const runeGeo = new THREE.PlaneGeometry(1.3, 1.3);
    this.rhythmRuneMesh = new THREE.Mesh(runeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }));
    this.rhythmRuneMesh.position.z = 0.05;
    this.rhythmShield.add(this.rhythmRuneMesh);

    this.creatureRoot.add(this.rhythmShield);
  }

  private buildMusicDestroyerProps() {
    // 3 Orbiting Audio Resonance Rings for Final Boss Phase
    [2.3, 2.7, 3.1].forEach((r, idx) => {
      const rGeo = new THREE.TorusGeometry(r, 0.055, 16, 64);
      const ring = new THREE.Mesh(
        rGeo,
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x06b6d4 : idx === 1 ? 0xd946ef : 0xf59e0b,
          transparent: true,
          opacity: 0.85
        })
      );
      ring.position.set(0, 1.4, 0);
      ring.visible = false;
      this.bossOrbitRings.push(ring);
      this.creatureRoot.add(ring);
    });
  }

  // ==================== PARTICLE SYSTEM ====================
  private generateGlowParticleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private setupParticleSystem() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0x00f0ff,
      map: this.generateGlowParticleTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.impactParticles = new THREE.Points(geo, mat);
    this.scene.add(this.impactParticles);
  }

  public spawnParticlesAt(pos: THREE.Vector3, colorHex: number, count: number = 14) {
    if (!this.impactParticles) return;
    (this.impactParticles.material as THREE.PointsMaterial).color.setHex(colorHex);

    const targetCount = Math.min(count, 18);
    let spawned = 0;
    for (let i = 0; i < this.MAX_PARTICLES && spawned < targetCount; i++) {
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

  // ==================== EXTERNAL POINTER / HEAD TRACKING ====================
  public setTargetPointer(x: number, y: number) {
    // Normal 0..1 coordinates
    this.pointerTarget.set(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  }

  // ==================== DANCE TRIGGER API ====================
  public setDanceMove(move: DanceMoveId, duration: number = 2.4) {
    this.currentDanceMove = move;
    this.danceTimer = duration;

    // Trigger visual particle and lighting flair on move change
    switch (move) {
      case 'drums_stomp':
        this.triggerScreenShake(0.14);
        this.triggerStrobe(0x06b6d4);
        this.spawnParticlesAt(new THREE.Vector3(0, 0.4, 0), 0x06b6d4, 18);
        break;
      case 'guitar_headbang':
        this.triggerScreenShake(0.12);
        this.triggerStrobe(0xf97316);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0xf97316, 22);
        break;
      case 'piano_sway':
        this.triggerStrobe(0x3b82f6);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.5, 0), 0x3b82f6, 16);
        break;
      case 'trumpet_march':
        this.triggerStrobe(0xeab308);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.2, 0), 0xeab308, 20);
        break;
      case 'violin_spin':
        this.triggerStrobe(0xd946ef);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.6, 0), 0xd946ef, 24);
        break;
      case 'dj_bassdrop':
        this.triggerScreenShake(0.2);
        this.triggerStrobe(0x22c55e);
        this.spawnParticlesAt(new THREE.Vector3(0, 0.2, 0), 0x22c55e, 28);
        break;
      case 'missed_stumble':
        this.triggerScreenShake(0.08);
        this.triggerStrobe(0xef4444);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.2, 0), 0x94a3b8, 12);
        break;
      case 'fever_dance':
        this.triggerScreenShake(0.24);
        this.triggerStrobe(0xfbbf24);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xfbbf24, 45);
        break;
      case 'super_thunder':
      case 'super_storm':
      case 'super_drop':
        this.triggerScreenShake(0.32);
        this.triggerStrobe(0xa855f7);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xa855f7, 50);
        break;
      default:
        break;
    }
  }

  // ==================== ATTACK VISUAL PROJECTILES ====================
  public fireAttack(event: AttackEvent) {
    const monsterPos = new THREE.Vector3(0, 1.5, 0);
    const start3D = new THREE.Vector3(
      (event.startX - 0.5) * 11,
      (0.5 - event.startY) * 7 + 1.5,
      3.0
    );

    let projMesh: THREE.Object3D;
    const colorHex = parseInt(event.color.replace('#', '0x'), 16);

    if (event.isSuperAttack) {
      const superGeo = new THREE.IcosahedronGeometry(0.85, 2);
      const superMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      projMesh = new THREE.Mesh(superGeo, superMat);
      this.triggerScreenShake(0.28);
      this.triggerStrobe(colorHex);
    } else {
      switch (event.instrumentId) {
        case 'drums': {
          const geo = new THREE.TorusGeometry(0.65, 0.14, 16, 32);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 }));
          break;
        }
        case 'guitar': {
          const geo = new THREE.ConeGeometry(0.32, 1.2, 4);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex }));
          break;
        }
        case 'piano': {
          const geo = new THREE.BoxGeometry(0.42, 0.85, 0.12);
          projMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.1 }));
          break;
        }
        case 'trumpet': {
          const geo = new THREE.RingGeometry(0.25, 0.75, 32);
          projMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide }));
          break;
        }
        case 'violin': {
          const geo = new THREE.TorusKnotGeometry(0.36, 0.09, 64, 8);
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

    if (stage === 'stage_1_beat_eater') {
      if (this.rhythmShield) this.rhythmShield.visible = false;
      this.bossOrbitRings.forEach((r) => (r.visible = false));
      if (this.coreReactor) (this.coreReactor.material as THREE.MeshBasicMaterial).color.setHex(0x06b6d4);
    } else if (stage === 'stage_2_rhythm_breaker') {
      if (this.rhythmShield) this.rhythmShield.visible = true;
      this.bossOrbitRings.forEach((r) => (r.visible = false));
      if (this.coreReactor) (this.coreReactor.material as THREE.MeshBasicMaterial).color.setHex(0xd946ef);
    } else if (stage === 'stage_3_music_destroyer') {
      if (this.rhythmShield) this.rhythmShield.visible = false;
      this.bossOrbitRings.forEach((r) => (r.visible = true));
      if (this.coreReactor) (this.coreReactor.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
    }
  }

  public setMonsterHealthRatio(ratio: number) {
    this.monsterHealthRatio = Math.max(0, Math.min(1, ratio));
  }

  public playDefeatAnimation(callback?: () => void) {
    this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xf59e0b, 150);
    this.triggerScreenShake(0.32);
    this.triggerStrobe(0xff00ff);
    if (callback) setTimeout(callback, 900);
  }

  // ==================== PROCEDURAL SKELETAL DANCE & BREATHING ====================
  private updateMonsterDance(delta: number, time: number) {
    if (!this.creatureRoot) return;

    if (this.danceTimer > 0) {
      this.danceTimer -= delta;
      if (this.danceTimer <= 0) {
        this.currentDanceMove = 'idle';
      }
    }

    const move = this.currentDanceMove;
    const bpm = 120;
    const beatTime = time * (bpm / 60) * Math.PI;

    // 1. Organic Parametric Breathing (Gentle chest & abdomen expansion)
    const breath = Math.sin(time * 2.2);
    this.chestGroup.scale.set(
      1.0 + breath * 0.035,
      1.0 + breath * 0.02,
      1.0 + breath * 0.045
    );

    // 2. Head & Eye Tracking (Subtly follows active hand / cursor)
    const targetYaw = (this.pointerTarget.x - 0.5) * 0.65;
    const targetPitch = -(this.pointerTarget.y - 0.5) * 0.45;
    this.currentHeadYaw = THREE.MathUtils.lerp(this.currentHeadYaw, targetYaw, delta * 4);
    this.currentHeadPitch = THREE.MathUtils.lerp(this.currentHeadPitch, targetPitch, delta * 4);

    // 3. Natural Eyelid Blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > 3.2) {
      this.isBlinking = true;
      if (this.blinkTimer > 3.38) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }
    const blinkAngle = this.isBlinking ? 0.35 : -0.4;
    this.upperEyelidL.rotation.x = THREE.MathUtils.lerp(this.upperEyelidL.rotation.x, blinkAngle, delta * 20);
    this.upperEyelidR.rotation.x = THREE.MathUtils.lerp(this.upperEyelidR.rotation.x, blinkAngle, delta * 20);

    // 4. Multi-Segmented Trailing Tail Physics
    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];
      const tailFreq = 2.5;
      seg.rotation.y = Math.sin(time * tailFreq - i * 0.5) * 0.16;
      seg.rotation.x = Math.cos(time * 1.8 - i * 0.4) * 0.08 - 0.1;
    }

    // 5. Choreographed Move Execution
    switch (move) {
      case 'drums_stomp': {
        // High-energy rhythmic double stomping with deep knee bend and roaring jaw
        const stompPhase = Math.sin(time * 10);
        const isLeftStomp = stompPhase > 0;

        if (isLeftStomp) {
          this.leftThighGroup.position.y = THREE.MathUtils.damp(this.leftThighGroup.position.y, Math.abs(stompPhase) * 0.45, 16, delta);
          this.leftThighGroup.rotation.x = -Math.abs(stompPhase) * 0.65;
          this.rightThighGroup.position.y = THREE.MathUtils.damp(this.rightThighGroup.position.y, 0, 16, delta);
          this.rightThighGroup.rotation.x = 0;
          this.spineGroup.rotation.z = 0.14;
        } else {
          this.rightThighGroup.position.y = THREE.MathUtils.damp(this.rightThighGroup.position.y, Math.abs(stompPhase) * 0.45, 16, delta);
          this.rightThighGroup.rotation.x = -Math.abs(stompPhase) * 0.65;
          this.leftThighGroup.position.y = THREE.MathUtils.damp(this.leftThighGroup.position.y, 0, 16, delta);
          this.leftThighGroup.rotation.x = 0;
          this.spineGroup.rotation.z = -0.14;
        }

        // Heavy chest punch & drumstick arms
        this.spineGroup.rotation.x = Math.sin(time * 10) * 0.28;
        this.leftUpperArm.rotation.x = Math.cos(time * 10) * 0.9 + 0.4;
        this.rightUpperArm.rotation.x = -Math.cos(time * 10) * 0.9 + 0.4;
        this.headGroup.rotation.x = Math.sin(time * 10) * 0.35 + this.currentHeadPitch;
        this.headGroup.rotation.y = this.currentHeadYaw;
        this.creatureRoot.position.y = Math.abs(Math.sin(time * 10)) * 0.18;

        // Wide roaring jaw
        this.lowerJawGroup.rotation.x = Math.abs(Math.sin(time * 10)) * 0.55;
        break;
      }

      case 'guitar_headbang': {
        // Wide aggressive power-stance rock headbanging
        this.leftThighGroup.position.x = -0.65;
        this.rightThighGroup.position.x = 0.65;
        this.leftThighGroup.rotation.z = -0.22;
        this.rightThighGroup.rotation.z = 0.22;

        const headbang = Math.sin(time * 14);
        this.headGroup.rotation.x = headbang * 0.75 + this.currentHeadPitch;
        this.headGroup.rotation.y = this.currentHeadYaw;
        this.spineGroup.rotation.x = headbang * 0.42 + 0.18;

        // Left hand grips neck, right arm strums aggressively
        this.leftUpperArm.rotation.set(-0.65, 0.45, -0.65);
        this.leftForearm.rotation.set(-0.85, 0, 0.5);
        this.rightUpperArm.rotation.x = Math.sin(time * 14) * 0.9;
        this.rightForearm.rotation.z = Math.cos(time * 14) * 0.6;

        this.creatureRoot.position.y = Math.abs(Math.sin(time * 7)) * 0.12;
        this.lowerJawGroup.rotation.x = Math.abs(headbang) * 0.4;
        break;
      }

      case 'piano_sway': {
        // Fluid lateral swaying & expressive sweeping arm arcs
        const sway = Math.sin(time * 3.5);
        this.creatureRoot.position.x = sway * 0.55;
        this.spineGroup.rotation.z = -sway * 0.3;
        this.headGroup.rotation.z = sway * 0.24;
        this.headGroup.rotation.y = this.currentHeadYaw;
        this.headGroup.rotation.x = this.currentHeadPitch;

        this.leftUpperArm.rotation.set(-0.95, 0.2, -0.3 + Math.sin(time * 8) * 0.25);
        this.rightUpperArm.rotation.set(-0.95, -0.2, 0.3 + Math.cos(time * 8) * 0.25);
        this.leftForearm.rotation.x = -0.45 + Math.sin(time * 12) * 0.2;
        this.rightForearm.rotation.x = -0.45 + Math.cos(time * 12) * 0.2;

        this.leftThighGroup.position.y = Math.sin(time * 3.5) * 0.12;
        this.rightThighGroup.position.y = -Math.sin(time * 3.5) * 0.12;
        this.lowerJawGroup.rotation.x = 0.08;
        break;
      }

      case 'trumpet_march': {
        // Triumphant parade march with high-knee struts and puffed chest
        const marchPhase = Math.sin(time * 6);
        const isLeftStep = marchPhase > 0;

        if (isLeftStep) {
          this.leftThighGroup.position.y = Math.abs(marchPhase) * 0.58;
          this.leftThighGroup.rotation.x = -Math.abs(marchPhase) * 0.75;
          this.rightThighGroup.position.y = 0;
          this.rightThighGroup.rotation.x = 0;
        } else {
          this.rightThighGroup.position.y = Math.abs(marchPhase) * 0.58;
          this.rightThighGroup.rotation.x = -Math.abs(marchPhase) * 0.75;
          this.leftThighGroup.position.y = 0;
          this.leftThighGroup.rotation.x = 0;
        }

        this.leftUpperArm.rotation.set(-1.45, 0.3, -0.2);
        this.rightUpperArm.rotation.set(-1.45, -0.3, 0.2);
        this.headGroup.rotation.x = -0.45 + Math.sin(time * 6) * 0.2 + this.currentHeadPitch;
        this.headGroup.rotation.y = this.currentHeadYaw;
        this.spineGroup.rotation.y = marchPhase * 0.25;
        this.spineGroup.rotation.x = -0.16 + Math.sin(time * 12) * 0.12; // chest pop

        this.creatureRoot.position.y = Math.abs(Math.sin(time * 6)) * 0.16;
        this.lowerJawGroup.rotation.x = 0.25;
        break;
      }

      case 'violin_spin': {
        // Elegant 360-degree pirouette spin on one foot with lyrical extension
        this.creatureRoot.rotation.y += delta * 7.0;

        this.leftUpperArm.rotation.set(-1.15, 0.75, -0.5);
        this.rightUpperArm.rotation.set(-0.85 + Math.sin(time * 8) * 0.45, -0.6, 0.35);
        this.spineGroup.rotation.z = Math.sin(time * 4) * 0.22;
        this.creatureRoot.position.y = 0.32 + Math.sin(time * 6) * 0.12;
        this.lowerJawGroup.rotation.x = 0.12;
        break;
      }

      case 'dj_bassdrop': {
        // Breakdance drop squat into freeze & turntable scratch
        const bounce = Math.sin(time * 8);
        const isDropping = (time % 2.0) > 1.1;

        if (isDropping) {
          this.creatureRoot.position.y = THREE.MathUtils.damp(this.creatureRoot.position.y, -0.35, 12, delta);
          this.leftThighGroup.position.x = -0.7;
          this.rightThighGroup.position.x = 0.7;
          this.spineGroup.rotation.x = 0.48;
          this.leftUpperArm.rotation.set(-1.25, 0.8, -0.6);
          this.rightUpperArm.rotation.set(-0.75, -0.5, 0.9);
        } else {
          this.creatureRoot.position.y = Math.abs(bounce) * 0.26;
          this.leftUpperArm.rotation.x = Math.sin(time * 8) * 0.78;
          this.rightUpperArm.rotation.x = -Math.sin(time * 8) * 0.78;
          this.headGroup.rotation.y = Math.sin(time * 4) * 0.35 + this.currentHeadYaw;
        }
        this.lowerJawGroup.rotation.x = Math.abs(bounce) * 0.3;
        break;
      }

      case 'missed_stumble': {
        // Stumble backwards off-balance
        const wobble = Math.sin(time * 18);
        this.spineGroup.rotation.x = -0.42 + wobble * 0.08;
        this.spineGroup.rotation.z = Math.sin(time * 12) * 0.24;
        this.headGroup.rotation.x = 0.26 + wobble * 0.12;
        this.headGroup.rotation.y = Math.sin(time * 15) * 0.32;

        this.leftUpperArm.rotation.set(-0.6, 0.5, -0.9 + wobble * 0.15);
        this.rightUpperArm.rotation.set(-0.6, -0.5, 0.9 - wobble * 0.15);
        this.creatureRoot.position.z = -0.32;
        this.creatureRoot.position.y = -0.06;
        this.lowerJawGroup.rotation.x = 0.45;
        break;
      }

      case 'fever_dance': {
        const feverBeat = Math.sin(time * 16);
        const jump = Math.abs(Math.sin(time * 8)) * 0.48;
        this.creatureRoot.position.y = jump;
        this.creatureRoot.rotation.y = Math.sin(time * 4) * 0.5;

        this.spineGroup.rotation.x = feverBeat * 0.22;
        this.spineGroup.rotation.z = Math.cos(time * 8) * 0.18;
        this.headGroup.rotation.x = -feverBeat * 0.25 + this.currentHeadPitch;
        this.headGroup.rotation.y = this.currentHeadYaw;

        this.leftUpperArm.rotation.set(-1.15 + Math.sin(time * 16) * 0.65, 0.3, -0.4);
        this.rightUpperArm.rotation.set(-1.15 - Math.sin(time * 16) * 0.65, -0.3, 0.4);
        this.lowerJawGroup.rotation.x = Math.abs(feverBeat) * 0.4;
        break;
      }

      case 'super_thunder':
      case 'super_storm':
      case 'super_drop': {
        this.creatureRoot.position.y = 0.5 + Math.sin(time * 8) * 0.32;
        this.creatureRoot.rotation.y += delta * 5.0;
        this.leftUpperArm.rotation.set(-1.6, 0.5, -0.5);
        this.rightUpperArm.rotation.set(-1.6, -0.5, 0.5);
        this.spineGroup.rotation.x = Math.sin(time * 8) * 0.28;
        this.lowerJawGroup.rotation.x = 0.6;
        break;
      }

      case 'idle':
      default: {
        // Groovy idle bobbing to 120 BPM tempo
        const idleBeat = Math.sin(beatTime);
        this.creatureRoot.position.y = THREE.MathUtils.damp(this.creatureRoot.position.y, Math.abs(idleBeat) * 0.08, 10, delta);
        this.creatureRoot.position.x = THREE.MathUtils.damp(this.creatureRoot.position.x, 0, 8, delta);
        this.creatureRoot.position.z = THREE.MathUtils.damp(this.creatureRoot.position.z, 0, 8, delta);
        this.creatureRoot.rotation.y = THREE.MathUtils.damp(this.creatureRoot.rotation.y, 0, 8, delta);

        this.spineGroup.rotation.x = THREE.MathUtils.damp(this.spineGroup.rotation.x, idleBeat * 0.08, 10, delta);
        this.spineGroup.rotation.z = THREE.MathUtils.damp(this.spineGroup.rotation.z, Math.sin(time * 2) * 0.04, 10, delta);
        this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, -idleBeat * 0.06 + this.currentHeadPitch, 10, delta);
        this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, this.currentHeadYaw, 10, delta);

        this.leftUpperArm.rotation.x = THREE.MathUtils.damp(this.leftUpperArm.rotation.x, Math.sin(time * 2.5) * 0.12, 10, delta);
        this.rightUpperArm.rotation.x = THREE.MathUtils.damp(this.rightUpperArm.rotation.x, -Math.sin(time * 2.5) * 0.12, 10, delta);
        this.leftUpperArm.rotation.z = THREE.MathUtils.damp(this.leftUpperArm.rotation.z, -0.22, 10, delta);
        this.rightUpperArm.rotation.z = THREE.MathUtils.damp(this.rightUpperArm.rotation.z, 0.22, 10, delta);

        this.leftThighGroup.position.set(-0.48, -0.05, 0);
        this.rightThighGroup.position.set(0.48, -0.05, 0);
        this.leftThighGroup.rotation.set(0, 0, 0);
        this.rightThighGroup.rotation.set(0, 0, 0);

        this.lowerJawGroup.rotation.x = THREE.MathUtils.damp(this.lowerJawGroup.rotation.x, 0.05, 8, delta);
        break;
      }
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

    // 2. Boss & Stage ambient props
    if (this.currentStage === 'stage_2_rhythm_breaker' && this.rhythmShield?.visible) {
      this.rhythmShield.rotation.z = Math.sin(elapsedTime * 1.5) * 0.15;
      this.rhythmShield.scale.lerp(this._v1.set(1, 1, 1), delta * 8);
    } else if (this.currentStage === 'stage_3_music_destroyer') {
      this.bossOrbitRings.forEach((ring, idx) => {
        const speed = (idx + 1) * 0.7 * (idx % 2 === 0 ? 1 : -1);
        ring.rotation.x += delta * speed;
        ring.rotation.y += delta * (speed * 0.8);
      });
    }

    // 3. Strobe decay
    if (this.strobeLight.intensity > 0) {
      this.strobeLight.intensity = THREE.MathUtils.damp(this.strobeLight.intensity, 0, 8, delta);
    }

    // 4. Projectiles update
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

    // 5. Particles update
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

    // 6. Camera Screen Shake
    let camOffsetX = 0;
    let camOffsetY = 0;
    if (this.screenShakeIntensity > 0.005) {
      camOffsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
      camOffsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
      this.screenShakeIntensity = THREE.MathUtils.damp(this.screenShakeIntensity, 0, 6, delta);
    }
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camOffsetX, 10, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.85 + camOffsetY, 10, delta);

    // 7. Render
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
