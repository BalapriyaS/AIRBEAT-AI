import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AttackEvent, DanceMoveId, InstrumentId, SuperAttackId } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';

/**
 * AIRBEAT AI - Professional 3D Game Arena & High-Poly Realistic Sci-Fi Creature
 * Implements a true 3D rigged sci-fi behemoth with realistic PBR materials,
 * 27 real-time skeletal animation clips, dynamic combat reactions, and beat synchronization.
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

  // Biometric Chest Core Light & Reactor
  private coreLight!: THREE.PointLight;
  private coreReactor!: THREE.Mesh;

  // High-Poly Realistic 3D Sci-Fi Creature Model & Skeletal Rig
  private monsterGroup: THREE.Group;
  private creatureRoot!: THREE.Group;
  private gltfLoader: GLTFLoader = new GLTFLoader();
  private animationMixer: THREE.AnimationMixer | null = null;
  private animationActions: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private creatureModel: THREE.Group | null = null;
  private creatureMeshes: THREE.Mesh[] = [];
  private isCreatureLoaded: boolean = false;

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
    colorHex: number;
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
  private monsterHitTimer: number = 0;
  private monsterDeflectTimer: number = 0;
  private monsterSkinMat: THREE.MeshStandardMaterial | null = null;
  private coreReactorMat: THREE.MeshBasicMaterial | null = null;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

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

    // 1. Sclera: Deep midnight obsidian cavity
    const gradSclera = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    gradSclera.addColorStop(0, '#130d24');
    gradSclera.addColorStop(1, '#05030a');
    ctx.fillStyle = gradSclera;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Limbal ring & Glowing Violet / Purple Demonic Iris (Matching reference image)
    const irisR = r * 0.86;
    const gradIris = ctx.createRadialGradient(cx, cy, 6, cx, cy, irisR);
    gradIris.addColorStop(0, '#ffffff'); // pure white-hot center
    gradIris.addColorStop(0.25, '#f3e8ff'); // luminous lavender
    gradIris.addColorStop(0.55, '#c084fc'); // intense violet glow
    gradIris.addColorStop(0.85, '#8b5cf6'); // electric purple
    gradIris.addColorStop(0.98, '#4c1d95'); // dark purple rim
    gradIris.addColorStop(1.0, '#000000'); // black limbal ring

    ctx.fillStyle = gradIris;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // 3. Radial iris muscle fiber rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (irisR * 0.22), cy + Math.sin(a) * (irisR * 0.22));
      ctx.lineTo(cx + Math.cos(a) * (irisR * 0.9), cy + Math.sin(a) * (irisR * 0.9));
      ctx.stroke();
    }

    // 4. Vertical slit predator pupil
    ctx.fillStyle = '#060010';
    ctx.beginPath();
    ctx.ellipse(cx, cy, irisR * 0.15, irisR * 0.74, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Specular gleam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.24, cy - irisR * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates curved stadium jumbotron display textures matching the reference arena
   */
  private createStadiumScreenTexture(
    headerText: string,
    subText: string,
    waveColor: string = '#00d9ff'
  ): THREE.CanvasTexture {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Background gradient - dark cyber stadium panel
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#060a14');
    bgGrad.addColorStop(1, '#0c1527');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // High-tech telemetry grid
    ctx.strokeStyle = 'rgba(22, 135, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Outer cyber screen border with corner notches
    ctx.strokeStyle = '#1687ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Cyan glowing inner border
    ctx.strokeStyle = '#00d9ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Corner brackets
    ctx.fillStyle = '#00d9ff';
    const bLen = 18;
    ctx.fillRect(10, 10, bLen, 5);
    ctx.fillRect(10, 10, 5, bLen);
    ctx.fillRect(w - 10 - bLen, 10, bLen, 5);
    ctx.fillRect(w - 15, 10, 5, bLen);
    ctx.fillRect(10, h - 15, bLen, 5);
    ctx.fillRect(10, h - 10 - bLen, 5, bLen);
    ctx.fillRect(w - 10 - bLen, h - 15, bLen, 5);
    ctx.fillRect(w - 15, h - 10 - bLen, 5, bLen);

    // Header Text
    ctx.font = '900 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1f5f9';
    ctx.shadowColor = waveColor;
    ctx.shadowBlur = 18;
    ctx.fillText(headerText, w / 2, 85);
    ctx.shadowBlur = 0;

    // Subtitle text
    if (subText) {
      ctx.font = '800 22px monospace';
      ctx.fillStyle = '#00d9ff';
      ctx.fillText(subText, w / 2, 130);
    }

    // Audio Waveform Visualizer
    ctx.beginPath();
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 3.5;
    const waveY = 180;
    for (let x = 40; x <= w - 40; x += 4) {
      const norm = (x - 40) / (w - 80);
      const envelope = Math.sin(norm * Math.PI);
      const y = waveY + Math.sin(x * 0.14) * Math.cos(x * 0.06) * 26 * envelope;
      if (x === 40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.shadowColor = waveColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
    return tex;
  }

  // ==================== LIGHTING SETUP ====================
  private setupLighting() {
    this.keyLight = new THREE.DirectionalLight(0xf1f5f9, 2.8);
    this.keyLight.position.set(4, 9, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.0003;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x00d9ff, 0x080d18, 1.3);
    this.scene.add(this.fillLight);

    // Cinematic Blue & Violet Rim Lighting matching reference arena
    this.rimLight = new THREE.PointLight(0x1687ff, 5.2, 20);
    this.rimLight.position.set(0, 4.5, -4.5);
    this.scene.add(this.rimLight);

    const purpleBacklight = new THREE.PointLight(0x8b5cf6, 3.5, 16);
    purpleBacklight.position.set(0, 3.0, -3.0);
    this.scene.add(purpleBacklight);

    this.strobeLight = new THREE.PointLight(0x00d9ff, 0, 22);
    this.strobeLight.position.set(0, 2.2, 2.5);
    this.scene.add(this.strobeLight);
  }

  // ==================== PROCEDURAL SCULPTING ENGINE ====================
  /**
   * Applies multi-octave 3D fractal noise displacement to vertices of any BufferGeometry,
   * converting basic primitives into organic, striated, craggy biological surfaces.
   */
  private sculptGeometry(
    geo: THREE.BufferGeometry,
    frequency: number = 2.4,
    amplitude: number = 0.075,
    weightVector: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
  ): THREE.BufferGeometry {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Multi-frequency 3D fractal noise
      const n1 = Math.sin(x * frequency * 1.8 + 0.3) * Math.cos(y * frequency * 1.8 + 0.7) * Math.sin(z * frequency * 1.8);
      const n2 = Math.cos(x * frequency * 3.6 + y * frequency * 2.8) * Math.sin(z * frequency * 3.6 + 1.1);
      const n3 = Math.sin(x * frequency * 7.2 + z * frequency * 5.4) * 0.5;
      const displacement = (n1 * 0.55 + n2 * 0.3 + n3 * 0.15) * amplitude;

      const len = Math.sqrt(x * x + y * y + z * z) || 1.0;
      pos.setXYZ(
        i,
        x + (x / len) * displacement * weightVector.x,
        y + (y / len) * displacement * weightVector.y,
        z + (z / len) * displacement * weightVector.z
      );
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  // ==================== STAGE SETUP ====================
  private setupStage() {
    // 1. Octagonal Brushed Obsidian Stage Platform
    const stageGeo = new THREE.CylinderGeometry(5.6, 6.0, 0.45, 8);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.28,
      metalness: 0.85
    });
    const stageBase = new THREE.Mesh(stageGeo, stageMat);
    stageBase.position.y = -0.225;
    stageBase.receiveShadow = true;
    this.stageGroup.add(stageBase);

    // 2. Glowing Neon Stage Edge Ring (Electric Cyan)
    const ringGeo = new THREE.TorusGeometry(5.65, 0.05, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.01;
    this.stageGroup.add(ringMesh);

    // 3. Inner Concentric Purple Glow Ring
    const ringInnerGeo = new THREE.TorusGeometry(3.8, 0.035, 16, 48);
    const ringInnerMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const ringInner = new THREE.Mesh(ringInnerGeo, ringInnerMat);
    ringInner.rotation.x = Math.PI / 2;
    ringInner.position.y = 0.012;
    this.stageGroup.add(ringInner);

    // 4. Holographic Cyber Grid
    this.floorGrid = new THREE.GridHelper(18, 36, 0x00d9ff, 0x111c2d);
    this.floorGrid.position.y = 0.02;
    (this.floorGrid.material as THREE.Material).opacity = 0.35;
    (this.floorGrid.material as THREE.Material).transparent = true;
    this.stageGroup.add(this.floorGrid);

    // 5. Shadow Receiver Plane for Realistic Creature Contact Shadows
    const shadowGeo = new THREE.PlaneGeometry(16, 16);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.65 });
    this.floorPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.y = 0.015;
    this.floorPlane.receiveShadow = true;
    this.stageGroup.add(this.floorPlane);

    // 6. Curved Stadium Background LED Screens
    const leftScreenGeo = new THREE.CylinderGeometry(14, 14, 4.4, 32, 1, true, -Math.PI * 0.78, Math.PI * 0.44);
    const leftScreenTex = this.createStadiumScreenTexture('AIRBEAT AI', 'HAND GESTURE BATTLE', '#00d9ff');
    const leftScreenMat = new THREE.MeshBasicMaterial({ map: leftScreenTex, side: THREE.BackSide });
    const leftScreen = new THREE.Mesh(leftScreenGeo, leftScreenMat);
    leftScreen.position.set(0, 3.2, 0);
    this.stageGroup.add(leftScreen);

    const rightScreenGeo = new THREE.CylinderGeometry(14, 14, 4.4, 32, 1, true, -Math.PI * 0.22, Math.PI * 0.44);
    const rightScreenTex = this.createStadiumScreenTexture('MOVE CREATE EXPLORE', 'NEON STADIUM ARENA', '#a78bfa');
    const rightScreenMat = new THREE.MeshBasicMaterial({ map: rightScreenTex, side: THREE.BackSide });
    const rightScreen = new THREE.Mesh(rightScreenGeo, rightScreenMat);
    rightScreen.position.set(0, 3.2, 0);
    this.stageGroup.add(rightScreen);

    // 7. Arena Floodlight Rig
    const leftSpot = new THREE.SpotLight(0x00d9ff, 4.5, 20, Math.PI / 5, 0.4);
    leftSpot.position.set(-6, 7, 2);
    leftSpot.target = stageBase;
    this.stageGroup.add(leftSpot);

    const rightSpot = new THREE.SpotLight(0xa855f7, 4.5, 20, Math.PI / 5, 0.4);
    rightSpot.position.set(6, 7, 2);
    rightSpot.target = stageBase;
    this.stageGroup.add(rightSpot);
  }

  // ==================== REALISTIC 3D SCI-FI CREATURE (GLTF/GLB) ====================
  private buildRealisticCreature() {
    this.creatureRoot = new THREE.Group();
    this.creatureRoot.position.set(0, 0, 0);
    this.monsterGroup.add(this.creatureRoot);

    // Biometric Chest Core Light that illuminates the arena & beast
    this.coreLight = new THREE.PointLight(0x00d9ff, 4.0, 7.0);
    this.coreLight.position.set(0, 1.4, 0.6);
    this.creatureRoot.add(this.coreLight);

    // Glowing Chest Core Reactor Disc
    const reactorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 32);
    reactorGeo.rotateX(Math.PI / 2);
    this.coreReactorMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    this.coreReactor = new THREE.Mesh(reactorGeo, this.coreReactorMat);
    this.coreReactor.position.set(0, 1.4, 0.45);
    this.creatureRoot.add(this.coreReactor);

    // Load High-Poly Realistic Sci-Fi Creature GLB (Tarisland High-Poly Dragon Behemoth)
    this.gltfLoader.load(
      '/models/creature.glb',
      (gltf) => {
        const model = gltf.scene;
        this.creatureModel = model;

        // 1. Process materials & shadows on high-poly meshes
        const meshes: THREE.Mesh[] = [];
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            meshes.push(mesh);
            if (mesh.material) {
              const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
              mat.roughness = 0.35;
              mat.metalness = 0.8;
              mat.envMapIntensity = 2.0;
              mat.emissive = new THREE.Color(0x000000);
              mat.emissiveIntensity = 0;
              mesh.material = mat;
            }
          }
        });
        this.creatureMeshes = meshes;

        // 2. Compute exact bounding box and scale to ~2.5 arena height
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const targetHeight = 2.5;
        const scaleFactor = targetHeight / (size.y || 1);
        model.scale.setScalar(scaleFactor);

        // Center on X and Z, place feet squarely on stage ground (y = 0.02)
        box.setFromObject(model);
        box.getSize(size);
        box.getCenter(center);
        model.position.x = -center.x;
        model.position.y = -box.min.y + 0.02;
        model.position.z = -center.z;
        model.rotation.y = Math.PI; // Face the player / camera

        this.creatureRoot.add(model);

        // 3. Setup AnimationMixer and 27 Skeletal Animation Clips
        if (gltf.animations && gltf.animations.length > 0) {
          this.animationMixer = new THREE.AnimationMixer(model);
          for (const clip of gltf.animations) {
            const action = this.animationMixer.clipAction(clip);
            this.animationActions.set(clip.name, action);
          }

          // Start with idle standing breathing animation
          this.playAction('Qishilong_stand', 0.5);
        }

        this.isCreatureLoaded = true;
      },
      undefined,
      (err) => {
        console.error('[AIRBEAT AI] Error loading creature.glb:', err);
      }
    );
  }

  private playAction(name: string, duration: number = 0.35, loop: boolean = true) {
    if (!this.animationMixer) return;
    const action = this.animationActions.get(name);
    if (!action) return;

    if (this.currentAction === action) return;

    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    if (!loop) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (this.currentAction) {
      this.currentAction.crossFadeTo(action, duration, true);
    } else {
      action.play();
    }
    this.currentAction = action;
  }

  private updateBackdropSize() {
    // Dynamic 3D arena handles viewports via projection matrix
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

    const targetCount = Math.min(count, 55);
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

    // Trigger visual particle, lighting flair, and real skeletal animation clips
    switch (move) {
      case 'drums_stomp':
        this.playAction('Qishilong_attack01', 0.25, true);
        this.triggerScreenShake(0.14);
        this.triggerStrobe(0x06b6d4);
        this.spawnParticlesAt(new THREE.Vector3(0, 0.4, 0), 0x06b6d4, 18);
        break;
      case 'guitar_headbang':
        this.playAction('Qishilong_skill06', 0.25, true);
        this.triggerScreenShake(0.12);
        this.triggerStrobe(0xf97316);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0xf97316, 22);
        break;
      case 'piano_sway':
        this.playAction('Qishilong_skill02', 0.35, true);
        this.triggerStrobe(0x3b82f6);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.5, 0), 0x3b82f6, 16);
        break;
      case 'trumpet_march':
        this.playAction('Qishilong_walk', 0.25, true);
        this.triggerStrobe(0xeab308);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.2, 0), 0xeab308, 20);
        break;
      case 'violin_spin':
        this.playAction('Qishilong_turnleft', 0.3, true);
        this.triggerStrobe(0xd946ef);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.6, 0), 0xd946ef, 24);
        break;
      case 'dj_bassdrop':
        this.playAction('Qishilong_skill08', 0.2, true);
        this.triggerScreenShake(0.2);
        this.triggerStrobe(0x22c55e);
        this.spawnParticlesAt(new THREE.Vector3(0, 0.2, 0), 0x22c55e, 28);
        break;
      case 'missed_stumble':
        this.playAction('Qishilong_down', 0.15, true);
        this.triggerScreenShake(0.08);
        this.triggerStrobe(0xef4444);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.2, 0), 0x94a3b8, 12);
        break;
      case 'fever_dance':
        this.playAction('Qishilong_skill10', 0.2, true);
        this.triggerScreenShake(0.24);
        this.triggerStrobe(0xfbbf24);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xfbbf24, 45);
        break;
      case 'super_thunder':
      case 'super_storm':
      case 'super_drop':
        this.playAction('Qishilong_skill05', 0.2, true);
        this.triggerScreenShake(0.32);
        this.triggerStrobe(0xa855f7);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xa855f7, 50);
        break;
      default:
        this.playAction('Qishilong_stand', 0.4, true);
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
      speed: 16.0,
      colorHex: colorHex
    });
  }

  public triggerScreenShake(intensity: number = 0.15) {
    this.screenShakeIntensity = intensity;
  }

  public triggerStrobe(colorHex: number) {
    this.strobeLight.color.setHex(colorHex);
    this.strobeLight.intensity = 5.5;
  }

  public triggerMonsterHitReaction(colorHex: number = 0x00f0ff, damage: number = 50) {
    this.monsterHitTimer = 0.42;
    this.monsterDeflectTimer = 0;

    // Recoil animation clip
    this.playAction('Qishilong_down01', 0.15, false);

    // High-voltage hit flash on creature skin and core
    this.creatureMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(colorHex);
        mat.emissiveIntensity = 2.5;
      }
    });

    if (this.coreLight) {
      this.coreLight.intensity = 8.5;
      this.coreLight.color.setHex(colorHex);
    }
    if (this.coreReactorMat) {
      this.coreReactorMat.color.setHex(colorHex);
    }

    // Dense 3D particle shower explosion at chest
    this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0.2), colorHex, damage > 40 ? 55 : 35);

    // Strobe lighting flash & camera screen shake
    this.triggerStrobe(colorHex);
    this.triggerScreenShake(damage > 40 ? 0.24 : 0.16);
  }

  public triggerMonsterDeflect() {
    this.monsterDeflectTimer = 0.42;
    this.monsterHitTimer = 0;

    // Deflect / block animation clip
    this.playAction('Qishilong_up', 0.15, false);

    this.creatureMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 1.8;
      }
    });

    if (this.coreLight) {
      this.coreLight.intensity = 7.0;
      this.coreLight.color.setHex(0xef4444);
    }
    if (this.coreReactorMat) {
      this.coreReactorMat.color.setHex(0xef4444);
    }

    // Red deflection spark burst
    this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0.6), 0xef4444, 35);

    // Red strobe flash & screen buzz
    this.strobeLight.color.setHex(0xff2222);
    this.strobeLight.intensity = 4.5;
    this.triggerScreenShake(0.09);
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
    this.playAction('Qishilong_die', 0.2, false);
    this.spawnParticlesAt(new THREE.Vector3(0, 2.0, 0), 0xf59e0b, 150);
    this.triggerScreenShake(0.32);
    this.triggerStrobe(0xff00ff);
    if (callback) setTimeout(callback, 1800);
  }

  // ==================== CREATURE ANIMATION & LIGHTING UPDATE ====================
  private updateMonsterDance(delta: number, time: number) {
    if (!this.creatureRoot) return;

    if (this.danceTimer > 0) {
      this.danceTimer -= delta;
      if (this.danceTimer <= 0) {
        this.currentDanceMove = 'idle';
        this.playAction('Qishilong_stand', 0.45, true);
      }
    }

    // Parallax tracking: tilt creature slightly toward hand pointer
    const targetTiltX = -(this.pointerTarget.y - 0.5) * 0.08;
    const targetTiltY = (this.pointerTarget.x - 0.5) * 0.18;
    this.creatureRoot.rotation.x = THREE.MathUtils.damp(this.creatureRoot.rotation.x, targetTiltX, 5, delta);
    this.creatureRoot.rotation.y = THREE.MathUtils.damp(this.creatureRoot.rotation.y, Math.PI + targetTiltY, 5, delta);

    // Smooth emissive flash decay on hit
    if (this.monsterHitTimer > 0) {
      this.monsterHitTimer -= delta;
      this.creatureMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.lerp(new THREE.Color(0x000000), delta * 7);
          mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, delta * 7);
        }
      });
    }

    if (this.monsterDeflectTimer > 0) {
      this.monsterDeflectTimer -= delta;
      this.creatureMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.lerp(new THREE.Color(0x000000), delta * 7);
          mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, delta * 7);
        }
      });
    }

    // Pulse biometric core light in sync with music beat
    const bpm = 132;
    const beatTime = time * (bpm / 60) * Math.PI;
    const breath = Math.sin(beatTime);
    if (this.coreLight) {
      this.coreLight.intensity = THREE.MathUtils.damp(
        this.coreLight.intensity,
        2.8 + Math.abs(breath) * 1.6,
        6,
        delta
      );
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
    if (this.animationMixer) {
      this.animationMixer.update(delta);
    }

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
        this.triggerMonsterHitReaction(p.colorHex || 0x00f0ff, 50);
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
    this.updateBackdropSize();
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
