import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AttackEvent, DanceMoveId, InstrumentId, SuperAttackId } from '../types/game';
import { INSTRUMENTS } from '../game/instrumentsConfig';
import { GAME_CONFIG } from '../game/gameConfig';

export type GraphicsQuality = 'AUTO' | 'HIGH' | 'MEDIUM' | 'LOW';

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
  private fallbackCreature: THREE.Group | null = null;
  private summonBeacon: THREE.Group | null = null;
  private summonRingMesh: THREE.Mesh | null = null;

  // Rhythm Breaker shield & rune
  private rhythmShield: THREE.Group | null = null;
  private rhythmRuneMesh: THREE.Mesh | null = null;

  // Boss orbital rings
  private bossOrbitRings: THREE.Mesh[] = [];

  // Projectiles & Particle System
  private activeProjectiles: {
    mesh: THREE.Object3D;
    type: InstrumentId | SuperAttackId;
    instrumentId: InstrumentId;
    start: THREE.Vector3;
    target: THREE.Vector3;
    progress: number;
    speed: number;
    colorHex: number;
    damage: number;
    comboCount: number;
    judgment?: 'perfect' | 'great';
    isSuperAttack: boolean;
    materials: { material: THREE.Material; opacity: number }[];
  }[] = [];
  private activeDamageNumbers: {
    sprite: THREE.Sprite;
    age: number;
    lifetime: number;
  }[] = [];
  private activeImpactRings: {
    mesh: THREE.Mesh;
    age: number;
    lifetime: number;
    maxScale: number;
  }[] = [];
  private impactCallback:
    | ((
        isSuperAttack: boolean,
        instrumentId: InstrumentId,
        comboCount: number,
        judgment?: 'perfect' | 'great'
      ) => void)
    | null = null;

  private impactParticles: THREE.Points | null = null;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particleLifespans: Float32Array;
  private readonly MAX_PARTICLES = 150;
  private readonly HIDDEN_PARTICLE_POSITION = 10000;

  // Dance & State Management
  private currentStage: string = 'stage_1_beat_eater';
  private currentDanceMove: DanceMoveId = 'idle';
  private danceTimer: number = 0;
  private monsterHealthRatio: number = 1.0;
  private screenShakeIntensity: number = 0;
  private reducedEffects: boolean = false;
  private graphicsQuality: GraphicsQuality = 'AUTO';
  private effectiveQuality: Exclude<GraphicsQuality, 'AUTO'> = 'HIGH';
  private currentFps: number = 0;
  private currentFrameTimeMs: number = 0;
  private previousFrameStartMs: number = 0;
  private activeParticleCount: number = 0;
  private fpsFrameCount: number = 0;
  private fpsWindowStartMs: number = 0;
  private lastQualityChangeMs: number = 0;
  private highFpsSinceMs: number | null = null;
  private lowFpsSinceMs: number | null = null;
  private monsterDefeated: boolean = false;
  private defeatElapsed: number = 0;
  private defeatCallback: (() => void) | null = null;
  private defeatCallbackFired: boolean = false;
  private destructionMaterials: {
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    animated: THREE.Material[];
  }[] = [];
  private monsterHitTimer: number = 0;
  private monsterDeflectTimer: number = 0;
  private hitReactionElapsed: number = 0;
  private hitReactionDuration: number = 0.5;
  private hitReactionPosition = new THREE.Vector3();
  private hitReactionRotation = new THREE.Vector3();
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
  private readonly _blackColor = new THREE.Color(0x000000);
  private readonly creatureHomePosition = new THREE.Vector3(0, 0, 0);
  private readonly creatureHomeRotation = new THREE.Euler(0, Math.PI, 0);
  private readonly impactPosition = new THREE.Vector3(0, 1.8, 0.25);

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
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.compile(this.scene, this.camera);

    // 10. Start Loop
    this.animate();
  }

  public getPerformanceInfo() {
    return {
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      activeParticles: this.activeParticleCount,
      quality: this.effectiveQuality,
      qualityMode: this.graphicsQuality
    };
  }

  public setGraphicsQuality(quality: GraphicsQuality) {
    this.graphicsQuality = quality;
    this.highFpsSinceMs = null;
    this.lowFpsSinceMs = null;
    this.applyGraphicsQuality(quality === 'AUTO' ? this.effectiveQuality : quality);
  }

  private applyGraphicsQuality(quality: Exclude<GraphicsQuality, 'AUTO'>) {
    this.effectiveQuality = quality;
    const ratioLimit = quality === 'HIGH' ? 1.25 : quality === 'MEDIUM' ? 1 : 0.75;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioLimit));
    this.renderer.shadowMap.enabled = quality === 'HIGH';
    this.renderer.shadowMap.needsUpdate = true;
  }

  private getParticleLimit() {
    return this.effectiveQuality === 'HIGH' ? this.MAX_PARTICLES :
      this.effectiveQuality === 'MEDIUM' ? 90 : 48;
  }

  private updatePerformance(now: number) {
    this.fpsFrameCount++;
    if (this.fpsWindowStartMs === 0) {
      this.fpsWindowStartMs = now;
      return;
    }
    const elapsed = now - this.fpsWindowStartMs;
    if (elapsed < 1000) return;
    this.currentFps = Math.round((this.fpsFrameCount * 1000) / elapsed);
    this.fpsFrameCount = 0;
    this.fpsWindowStartMs = now;

    if (this.graphicsQuality !== 'AUTO' || now - this.lastQualityChangeMs < 5000) return;
    if (this.currentFps < 43) {
      if (this.lowFpsSinceMs === null) this.lowFpsSinceMs = now;
      if (now - this.lowFpsSinceMs < 2500) return;
      const targetQuality = this.currentFps < 34 ? 'LOW' : 'MEDIUM';
      const shouldLowerQuality =
        targetQuality === 'LOW'
          ? this.effectiveQuality !== 'LOW'
          : this.effectiveQuality === 'HIGH';
      if (shouldLowerQuality) {
        this.applyGraphicsQuality(targetQuality);
        this.lastQualityChangeMs = now;
      }
      this.highFpsSinceMs = null;
      this.lowFpsSinceMs = null;
    } else if (this.currentFps >= 56) {
      this.lowFpsSinceMs = null;
      if (this.highFpsSinceMs === null) this.highFpsSinceMs = now;
      if (now - this.highFpsSinceMs >= 12000 && this.effectiveQuality !== 'HIGH') {
        this.applyGraphicsQuality(this.effectiveQuality === 'LOW' ? 'MEDIUM' : 'HIGH');
        this.lastQualityChangeMs = now;
        this.highFpsSinceMs = now;
      }
    } else {
      this.highFpsSinceMs = null;
      this.lowFpsSinceMs = null;
    }
  }

  private onVisibilityChange = () => {
    if (document.hidden) {
      if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.clock.stop();
      return;
    }
    this.fpsFrameCount = 0;
    this.fpsWindowStartMs = performance.now();
    this.previousFrameStartMs = 0;
    this.currentFrameTimeMs = 0;
    this.lowFpsSinceMs = null;
    this.highFpsSinceMs = null;
    this.clock.start();
    if (this.animationFrameId === null && !this.isDestroyed) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  };

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
  private buildSummonBeacon() {
    this.summonBeacon = new THREE.Group();
    this.summonBeacon.position.set(0, 0, 0);

    // 1. Outer cyber summoning ring on stage ground
    const ringGeo = new THREE.RingGeometry(1.6, 1.85, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.summonRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.summonRingMesh.position.y = 0.03;
    this.summonBeacon.add(this.summonRingMesh);

    // 2. Inner counter-rotating neon ring
    const innerRingGeo = new THREE.RingGeometry(1.05, 1.25, 32);
    innerRingGeo.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.y = 0.035;
    this.summonBeacon.add(innerRing);

    // 3. Vertical holographic energy beam cylinder
    const beamGeo = new THREE.CylinderGeometry(1.1, 1.5, 2.8, 32, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22,
      wireframe: true
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 1.4;
    this.summonBeacon.add(beam);

    this.monsterGroup.add(this.summonBeacon);
  }

  private buildFallbackCreature() {
    if (this.fallbackCreature) return;

    console.info('[AIRBEAT AI] Showing procedural dragon while the detailed model loads...');
    const fallbackGroup = new THREE.Group();
    fallbackGroup.rotation.y = Math.PI;

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x087f8c,
      roughness: 0.32,
      metalness: 0.62
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0x55b8a8,
      roughness: 0.48,
      metalness: 0.3
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x123b58,
      roughness: 0.4,
      metalness: 0.48,
      side: THREE.DoubleSide
    });
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x9be7dc,
      roughness: 0.28,
      metalness: 0.5
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00eaff });
    const meshes: THREE.Mesh[] = [];
    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      fallbackGroup.add(mesh);
      meshes.push(mesh);
      return mesh;
    };

    const torso = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skinMat));
    torso.position.set(0, 1.28, 0);
    torso.scale.set(0.58, 0.7, 0.43);

    const belly = addMesh(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bellyMat));
    belly.position.set(0, 1.22, 0.27);
    belly.scale.set(0.37, 0.51, 0.23);

    const neck = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 0.75, 16), skinMat));
    neck.position.set(0, 1.92, 0.12);
    neck.rotation.x = -0.2;

    const head = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), skinMat));
    head.position.set(0, 2.42, 0.24);
    head.scale.set(1.05, 0.78, 1.08);

    const snout = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), bellyMat));
    snout.position.set(0, 2.3, 0.53);
    snout.scale.set(0.78, 0.52, 1.2);

    for (const side of [-1, 1]) {
      const eye = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), eyeMat));
      eye.position.set(side * 0.2, 2.49, 0.51);

      const horn = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.43, 8), hornMat));
      horn.position.set(side * 0.22, 2.78, 0.1);
      horn.rotation.z = -side * 0.38;
      horn.rotation.x = -0.2;

      for (const z of [-0.25, 0.08, 0.38]) {
        const leg = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.48, 10), skinMat));
        leg.position.set(side * 0.36, 0.55, z);
        leg.rotation.z = side * -0.12;
        const foot = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), bellyMat));
        foot.position.set(side * 0.37, 0.31, z + 0.06);
        foot.scale.set(1, 0.55, 1.25);
      }

      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.27, 0.39);
      wingShape.lineTo(1.08, 0.75);
      wingShape.lineTo(0.91, 0.24);
      wingShape.quadraticCurveTo(0.83, 0.05, 0.69, -0.07);
      wingShape.quadraticCurveTo(0.55, 0.16, 0.43, -0.14);
      wingShape.quadraticCurveTo(0.28, 0.07, 0.16, -0.22);
      wingShape.lineTo(0, 0);
      const wing = addMesh(new THREE.Mesh(
        new THREE.ExtrudeGeometry(wingShape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 }),
        wingMat
      ));
      wing.position.set(side * 0.24, 1.75, -0.19);
      wing.scale.x = side;
      wing.rotation.z = side * 0.08;
    }

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.0, -0.3),
      new THREE.Vector3(0.04, 0.88, -0.68),
      new THREE.Vector3(0.12, 0.92, -1.03),
      new THREE.Vector3(0.2, 1.08, -1.33)
    ]);
    addMesh(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 20, 0.13, 10, false), skinMat));
    const tailTip = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.38, 5), hornMat));
    tailTip.position.set(0.2, 1.22, -1.42);
    tailTip.rotation.x = -0.5;

    for (let i = 0; i < 5; i++) {
      const spike = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), hornMat));
      spike.position.set(0, 1.82 - i * 0.15, -0.3 + i * 0.15);
      spike.rotation.x = -0.25;
    }

    this.creatureMeshes = meshes;
    this.creatureRoot.add(fallbackGroup);
    this.fallbackCreature = fallbackGroup;

    if (this.coreReactor) this.coreReactor.visible = true;
    if (this.summonBeacon) {
      this.monsterGroup.remove(this.summonBeacon);
      this.summonBeacon = null;
      this.summonRingMesh = null;
    }
    this.isCreatureLoaded = true;
  }

  private buildRealisticCreature() {
    this.creatureRoot = new THREE.Group();
    this.creatureRoot.position.copy(this.creatureHomePosition);
    this.creatureRoot.rotation.copy(this.creatureHomeRotation);
    this.monsterGroup.add(this.creatureRoot);

    // Biometric Chest Core Light that illuminates the arena & beast
    this.coreLight = new THREE.PointLight(0x00d9ff, 4.0, 7.0);
    this.coreLight.position.set(0, 1.35, 0.55);
    this.creatureRoot.add(this.coreLight);

    // Glowing Chest Core Reactor Disc (kept hidden until model arrives)
    const reactorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 32);
    reactorGeo.rotateX(Math.PI / 2);
    this.coreReactorMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    this.coreReactor = new THREE.Mesh(reactorGeo, this.coreReactorMat);
    this.coreReactor.position.set(0, 1.35, 0.45);
    this.coreReactor.visible = false; // Hidden until monster is ready
    this.creatureRoot.add(this.coreReactor);

    // Build Cyber Summoning Beacon on arena floor
    this.buildSummonBeacon();
    this.buildFallbackCreature();

    // Load High-Poly Realistic Sci-Fi Creature GLB (Tarisland High-Poly Dragon Behemoth)
    console.log('[AIRBEAT AI] Requesting /models/creature.glb...');
    (window as any).__arena = this;
    this.gltfLoader.load(
      '/models/creature.glb',
      (gltf) => {
        if (this.isDestroyed) {
          this.disposeObjectResources(gltf.scene);
          return;
        }
        try {
          console.log('[AIRBEAT AI] creature.glb downloaded and parsed! Scene children:', gltf.scene?.children?.length, 'Animations:', gltf.animations?.length);
          const model = gltf.scene;
          this.creatureModel = model;

          // 1. Process materials & shadows on high-poly meshes
          const meshes: THREE.Mesh[] = [];
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = false;
              mesh.frustumCulled = true;
              meshes.push(mesh);
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material = mesh.material.map((m) => {
                    const mat = (m as THREE.MeshStandardMaterial).clone();
                    mat.roughness = 0.35;
                    mat.metalness = 0.8;
                    mat.envMapIntensity = 2.0;
                    mat.emissive = new THREE.Color(0x000000);
                    mat.emissiveIntensity = 0;
                    return mat;
                  });
                } else {
                  const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
                  mat.roughness = 0.35;
                  mat.metalness = 0.8;
                  mat.envMapIntensity = 2.0;
                  mat.emissive = new THREE.Color(0x000000);
                  mat.emissiveIntensity = 0;
                  mesh.material = mat;
                }
              }
            }
          });
          this.creatureMeshes = meshes;
          console.log('[AIRBEAT AI] Traversed meshes count:', meshes.length);

          // 2. Compute exact bounding box and scale to ~2.5 arena height
          let box = new THREE.Box3().setFromObject(model);
          let size = box.getSize(new THREE.Vector3());

          const targetHeight = 2.5;
          const scaleFactor = targetHeight / (size.y || 1);
          model.scale.setScalar(scaleFactor);

          // Rotate to face camera FIRST so center accounts for orientation
          model.rotation.y = Math.PI;
          model.updateMatrixWorld(true);

          // Compute box AFTER scale and rotation
          box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());

          // Center on X and Z, place feet squarely on stage ground (y = 0.02)
          model.position.x = -center.x;
          model.position.y = -box.min.y + 0.02;
          model.position.z = -center.z;
          model.updateMatrixWorld(true);

          console.log('[AIRBEAT AI] Centered Model Position:', JSON.stringify(model.position), 'ScaleFactor:', scaleFactor);

          this.creatureRoot.add(model);
          console.log('[AIRBEAT AI] Added creature model to creatureRoot. creatureRoot children:', this.creatureRoot.children.length);

          // 3. Setup AnimationMixer and 27 Skeletal Animation Clips
          if (gltf.animations && gltf.animations.length > 0) {
            this.animationMixer = new THREE.AnimationMixer(model);
            this.animationMixer.addEventListener('finished', (event) => {
              if (
                event.action === this.currentAction &&
                !this.monsterDefeated &&
                event.action !== this.animationActions.get('Qishilong_die') &&
                this.danceTimer <= 0
              ) {
                this.playAction('Qishilong_stand', 0.2, true);
              }
            });
            for (const clip of gltf.animations) {
              const action = this.animationMixer.clipAction(clip);
              this.animationActions.set(clip.name, action);
            }

            // Start with idle standing breathing animation
            this.playAction('Qishilong_stand', 0.5);
            console.log('[AIRBEAT AI] Started initial animation: Qishilong_stand');
          }

          if (this.fallbackCreature) {
            this.creatureRoot.remove(this.fallbackCreature);
            this.fallbackCreature = null;
          }

          // Remove summoning beacon & reveal creature
          if (this.summonBeacon) {
            this.monsterGroup.remove(this.summonBeacon);
            this.summonBeacon = null;
            this.summonRingMesh = null;
          }
          if (this.coreReactor) this.coreReactor.visible = true;
          this.spawnParticlesAt(new THREE.Vector3(0, 1.4, 0), 0x00d9ff, 50);

          this.isCreatureLoaded = true;
          console.log('[AIRBEAT AI] creature isCreatureLoaded = true!');
        } catch (e) {
          console.error('[AIRBEAT AI] Exception in creature GLTF setup:', e);
          if (this.summonBeacon) {
            this.monsterGroup.remove(this.summonBeacon);
            this.summonBeacon = null;
            this.summonRingMesh = null;
          }
          this.buildFallbackCreature();
        }
      },
      (xhr) => {
        if (xhr.total) {
          console.log(`[AIRBEAT AI] creature.glb progress: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
        }
      },
      (err) => {
        if (this.isDestroyed) return;
        console.error('[AIRBEAT AI] Error loading creature.glb:', err);
        if (this.summonBeacon) {
          this.monsterGroup.remove(this.summonBeacon);
          this.summonBeacon = null;
          this.summonRingMesh = null;
        }
        this.buildFallbackCreature();
      }
    );
  }

  private playAction(name: string, duration: number = 0.35, loop: boolean = true) {
    if (!this.animationMixer) return;
    const action = this.animationActions.get(name);
    if (!action) return;

    const previousAction = this.currentAction;
    const isCurrentAction = previousAction === action;
    action.reset();
    action.setEffectiveWeight(1);
    if (!loop) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
    const targetDuration = loop
      ? name === 'Qishilong_stand'
        ? 4
        : 1.6
      : 0.75 / GAME_CONFIG.attackSpeedMultiplier;
    action.setEffectiveTimeScale(action.getClip().duration / targetDuration);

    action.play();
    if (previousAction && !isCurrentAction) {
      previousAction.crossFadeTo(
        action,
        duration / GAME_CONFIG.attackSpeedMultiplier,
        true
      );
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
    this.particlePositions.fill(this.HIDDEN_PARTICLE_POSITION);
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
    this.impactParticles.frustumCulled = false;
    this.scene.add(this.impactParticles);
  }

  public spawnParticlesAt(pos: THREE.Vector3, colorHex: number, count: number = 14) {
    if (!this.impactParticles) return;
    (this.impactParticles.material as THREE.PointsMaterial).color.setHex(colorHex);

    const particleLimit = this.getParticleLimit();
    const targetCount = Math.min(count, 55, particleLimit);
    let spawned = 0;
    for (let i = 0; i < particleLimit && spawned < targetCount; i++) {
      if (this.particleLifespans[i] <= 0) {
        const idx = i * 3;
        this.particlePositions[idx] = pos.x + (Math.random() - 0.5) * 0.4;
        this.particlePositions[idx + 1] = pos.y + (Math.random() - 0.5) * 0.4;
        this.particlePositions[idx + 2] = pos.z + (Math.random() - 0.5) * 0.4;

        this.particleVelocities[idx] = (Math.random() - 0.5) * 6;
        this.particleVelocities[idx + 1] = Math.random() * 5 + 1;
        this.particleVelocities[idx + 2] = (Math.random() - 0.5) * 6;

        this.particleLifespans[i] = GAME_CONFIG.visualEffectLifetimeMultiplier;
        spawned++;
      }
    }
    this.impactParticles.geometry.attributes.position.needsUpdate = true;
  }

  private clearParticles() {
    this.particleLifespans.fill(0);
    this.particlePositions.fill(this.HIDDEN_PARTICLE_POSITION);
    this.activeParticleCount = 0;
    if (this.impactParticles) {
      this.impactParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  public setReducedEffects(enabled: boolean) {
    this.reducedEffects = enabled;
  }

  public setImpactCallback(
    callback: (
      isSuperAttack: boolean,
      instrumentId: InstrumentId,
      comboCount: number,
      judgment?: 'perfect' | 'great'
    ) => void
  ) {
    this.impactCallback = callback;
  }

  private spawnImpactRings(
    position: THREE.Vector3,
    colorHex: number,
    comboCount: number,
    isSuperAttack = false
  ) {
    const colors = isSuperAttack ? [0x00d9ff, 0xa855f7, 0xec4899, colorHex] : [colorHex];
    const ringCount = isSuperAttack ? 4 : comboCount >= 8 ? 3 : 2;
    for (let i = 0; i < ringCount; i++) {
      const color = colors[i % colors.length];
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, isSuperAttack ? 0.045 : 0.035, 8, 48),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      mesh.position.copy(position);
      mesh.rotation.x = i === 0 && !isSuperAttack ? Math.PI / 2 : Math.PI * (0.12 + i * 0.19);
      mesh.rotation.y = Math.PI * (i * 0.23);
      mesh.scale.setScalar(0.15 + i * 0.08);
      this.scene.add(mesh);
      this.activeImpactRings.push({
        mesh,
        age: -i * 0.055,
        lifetime:
          (isSuperAttack ? 1.05 : 0.72) *
          GAME_CONFIG.visualEffectLifetimeMultiplier,
        maxScale: (isSuperAttack ? 4.8 : 2.8) * (1 + Math.min(comboCount, 10) * 0.035)
      });
    }

    while (this.activeImpactRings.length > 28) {
      const oldest = this.activeImpactRings.shift();
      if (oldest) {
        this.scene.remove(oldest.mesh);
        this.disposeObjectResources(oldest.mesh);
      }
    }
  }

  private showDamageNumber(damage: number, comboCount: number, colorHex: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    context.font = '900 34px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    const text = `+${Math.round(damage)}${comboCount >= 5 ? `  x${comboCount}` : ''}`;
    context.lineWidth = 8;
    context.strokeStyle = '#07111f';
    context.strokeText(text, 128, 48);
    context.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    context.shadowColor = `#${colorHex.toString(16).padStart(6, '0')}`;
    context.shadowBlur = 16;
    context.fillText(text, 128, 48);
    texture.needsUpdate = true;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.position.set(0, 2.65, 0.45);
    sprite.scale.set(1.6, 0.6, 1);
    this.scene.add(sprite);
    this.activeDamageNumbers.push({
      sprite,
      age: 0,
      lifetime: 0.9 * GAME_CONFIG.visualEffectLifetimeMultiplier
    });
  }

  private disposeObjectResources(object: THREE.Object3D) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();

      if (!mesh.material) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
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
        this.triggerStrobe(0x38bdf8);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0x38bdf8, 22);
        break;
      case 'piano_sway':
        this.playAction('Qishilong_skill02', 0.35, true);
        this.triggerStrobe(0x3b82f6);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.5, 0), 0x3b82f6, 16);
        break;
      case 'trumpet_march':
        this.playAction('Qishilong_walk', 0.25, true);
        this.triggerStrobe(0xfbbf24);
        this.spawnParticlesAt(new THREE.Vector3(0, 2.2, 0), 0xfbbf24, 20);
        break;
      case 'violin_spin':
        this.playAction('Qishilong_turnleft', 0.3, true);
        this.triggerStrobe(0xa78bfa);
        this.spawnParticlesAt(new THREE.Vector3(0, 1.6, 0), 0xa78bfa, 24);
        break;
      case 'dj_bassdrop':
        this.playAction('Qishilong_skill08', 0.2, true);
        this.triggerScreenShake(0.2);
        this.triggerStrobe(0xc084fc);
        this.spawnParticlesAt(new THREE.Vector3(0, 0.2, 0), 0xc084fc, 28);
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
    if (this.monsterDefeated) return;
    const monsterPos = new THREE.Vector3(0, 1.5, 0);
    const start3D = new THREE.Vector3(
      (event.startX - 0.5) * 11,
      (0.5 - event.startY) * 7 + 1.5,
      3.0
    );

    let projMesh: THREE.Object3D;
    const colorHex = parseInt(event.color.replace('#', '0x'), 16);

    if (event.isSuperAttack) {
      const superGroup = new THREE.Group();
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.45, 1),
        new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.95 })
      );
      superGroup.add(orb);
      [0x00d9ff, 0xa855f7, 0xec4899].forEach((color, index) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.7 + index * 0.16, 0.035, 8, 36),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );
        ring.rotation.set(index * 0.7, index * 0.4, index * 0.55);
        superGroup.add(ring);
      });
      projMesh = superGroup;
      this.triggerScreenShake(0.28);
      this.triggerStrobe(colorHex);
    } else {
      switch (event.instrumentId) {
        case 'drums': {
          const shockwave = new THREE.Group();
          for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(0.48 + i * 0.22, 0.055, 8, 36),
              new THREE.MeshBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 0.88 - i * 0.14,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              })
            );
            ring.rotation.x = Math.PI / 2;
            shockwave.add(ring);
          }
          projMesh = shockwave;
          break;
        }
        case 'guitar': {
          const bolt = new THREE.Group();
          const points: number[] = [];
          let previous = new THREE.Vector3(-0.42, -0.62, 0);
          for (let i = 1; i <= 8; i++) {
            const next = new THREE.Vector3(
              (Math.random() - 0.5) * 0.9,
              -0.62 + i * 0.16,
              (Math.random() - 0.5) * 0.24
            );
            points.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
            previous = next;
          }
          const boltGeometry = new THREE.BufferGeometry();
          boltGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
          bolt.add(new THREE.LineSegments(
            boltGeometry,
            new THREE.LineBasicMaterial({ color: 0x8be9ff, transparent: true, opacity: 1 })
          ));
          const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true })
          );
          bolt.add(core);
          projMesh = bolt;
          break;
        }
        case 'piano': {
          const notes = new THREE.Group();
          for (let i = 0; i < 5; i++) {
            const note = new THREE.Mesh(
              new THREE.OctahedronGeometry(i === 2 ? 0.2 : 0.14, 0),
              new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0xffffff : colorHex,
                wireframe: i % 2 === 1
              })
            );
            note.position.set((i - 2) * 0.24, Math.sin(i * 1.8) * 0.2, 0);
            notes.add(note);
          }
          const trailCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.65, -0.18, 0),
            new THREE.Vector3(-0.25, 0.2, 0.04),
            new THREE.Vector3(0.15, -0.12, 0),
            new THREE.Vector3(0.58, 0.22, -0.04)
          ]);
          notes.add(new THREE.Mesh(
            new THREE.TubeGeometry(trailCurve, 20, 0.025, 5, false),
            new THREE.MeshBasicMaterial({ color: colorHex })
          ));
          projMesh = notes;
          break;
        }
        case 'trumpet': {
          const blast = new THREE.Group();
          for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(0.36 + i * 0.24, 0.035, 8, 36),
              new THREE.MeshBasicMaterial({
                color: i === 1 ? 0xffed9c : colorHex,
                transparent: true,
                opacity: 0.9 - i * 0.15,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              })
            );
            blast.add(ring);
          }
          projMesh = blast;
          break;
        }
        case 'violin': {
          const slash = new THREE.Group();
          for (let i = 0; i < 2; i++) {
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(-0.72, -0.42 + i * 0.25, 0),
              new THREE.Vector3(-0.28, 0.02, 0.12),
              new THREE.Vector3(0.22, 0.4 - i * 0.18, 0),
              new THREE.Vector3(0.72, 0.25 + i * 0.12, -0.08)
            ]);
            slash.add(new THREE.Mesh(
              new THREE.TubeGeometry(curve, 24, i === 0 ? 0.045 : 0.02, 6, false),
              new THREE.MeshBasicMaterial({
                color: i === 0 ? 0xec4899 : colorHex,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending
              })
            ));
          }
          projMesh = slash;
          break;
        }
        case 'dj': {
          const djGroup = new THREE.Group();
          for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
              new THREE.TorusGeometry(0.42 + i * 0.25, 0.04, 8, 36),
              new THREE.MeshBasicMaterial({
                color: i === 1 ? 0xf0abfc : colorHex,
                transparent: true,
                opacity: 0.88 - i * 0.14,
                depthWrite: false,
                blending: THREE.AdditiveBlending
              })
            );
            if (i === 0) ring.rotation.x = Math.PI / 2;
            djGroup.add(ring);
          }
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
      instrumentId: event.instrumentId,
      start: start3D,
      target: monsterPos,
      progress: 0,
      speed: 16.0 * GAME_CONFIG.projectileSpeedMultiplier,
      colorHex,
      damage: event.damage,
      comboCount: event.comboCount,
      judgment: event.judgment,
      isSuperAttack: event.isSuperAttack === true,
      materials: this.getProjectileMaterials(projMesh)
    });
    if (event.isSuperAttack) {
      this.spawnImpactRings(monsterPos, colorHex, event.comboCount, true);
      this.spawnParticlesAt(monsterPos, colorHex, 55);
    }
  }

  private getProjectileMaterials(mesh: THREE.Object3D) {
    const materials: { material: THREE.Material; opacity: number }[] = [];
    mesh.traverse((child) => {
      const meshChild = child as THREE.Mesh;
      if (!meshChild.material) return;
      const list = Array.isArray(meshChild.material) ? meshChild.material : [meshChild.material];
      for (const material of list) {
        materials.push({ material, opacity: material.opacity });
        material.transparent = true;
        material.depthWrite = false;
      }
    });
    return materials;
  }

  public triggerScreenShake(intensity: number = 0.15) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity * (this.reducedEffects ? 0.25 : 1));
  }

  public triggerStrobe(colorHex: number) {
    this.strobeLight.color.setHex(colorHex);
    this.strobeLight.intensity = this.reducedEffects ? 2 : 5.5;
  }

  public triggerMonsterHitReaction(
    colorHex: number = 0x00f0ff,
    damage: number = 50,
    instrumentId?: InstrumentId
  ) {
    if (this.monsterDefeated) return;
    this.danceTimer = 0;
    this.currentDanceMove = 'idle';
    this.monsterHitTimer = 0.42;
    this.monsterDeflectTimer = 0;
    this.hitReactionElapsed = 0;
    this.hitReactionDuration =
      (damage >= 1000 ? 0.72 : 0.5) / GAME_CONFIG.attackSpeedMultiplier;
    const intensity = Math.min(
      2.2,
      (0.9 + Math.min(damage, 1500) / 1500) * (1 + (1 - this.monsterHealthRatio) * 0.45)
    );
    const side = Math.random() < 0.5 ? -1 : 1;
    this.hitReactionPosition.set(0, 0, 0);
    this.hitReactionRotation.set(0, 0, 0);

    switch (instrumentId) {
      case 'drums':
      case 'guitar':
        this.hitReactionPosition.z = -0.28 * intensity;
        this.hitReactionRotation.x = -0.12 * intensity;
        break;
      case 'piano':
        this.hitReactionRotation.y = side * 0.2 * intensity;
        this.hitReactionRotation.x = -0.08 * intensity;
        break;
      case 'violin':
        this.hitReactionPosition.x = side * 0.2 * intensity;
        this.hitReactionRotation.z = -side * 0.1 * intensity;
        break;
      case 'trumpet':
        this.hitReactionRotation.y = side * 0.14 * intensity;
        this.hitReactionRotation.x = -0.14 * intensity;
        break;
      case 'dj':
        this.hitReactionPosition.y = -0.12 * intensity;
        this.hitReactionPosition.z = -0.24 * intensity;
        this.hitReactionRotation.x = -0.08 * intensity;
        break;
      default:
        this.hitReactionPosition.z = -0.2 * intensity;
        this.hitReactionRotation.x = -0.1 * intensity;
        break;
    }

    const attackAnimation: Partial<Record<InstrumentId, string>> = {
      drums: 'Qishilong_attack01',
      guitar: 'Qishilong_skill06',
      piano: 'Qishilong_skill02',
      trumpet: 'Qishilong_walk',
      violin: 'Qishilong_turnleft',
      dj: 'Qishilong_skill08'
    };
    this.playAction(
      instrumentId ? attackAnimation[instrumentId] || 'Qishilong_down01' : 'Qishilong_down01',
      0.12,
      false
    );

    // High-voltage hit flash on creature skin and core
    this.creatureMeshes.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = this.reducedEffects ? 1.2 : 2.5;
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
    this.danceTimer = 0;
    this.currentDanceMove = 'idle';
    this.monsterDeflectTimer = 0.42;
    this.monsterHitTimer = 0;
    this.hitReactionElapsed = 0;
    this.hitReactionDuration = 0.5;
    this.hitReactionPosition.set(0, 0.14, 0);
    this.hitReactionRotation.set(-0.16, 0, 0);

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
    const material = this.rhythmRuneMesh.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.map = texture;
    material.needsUpdate = true;
  }

  public setStage(stage: string) {
    if (this.monsterDefeated) {
      this.restoreDefeatedCreature();
    }
    this.activeProjectiles.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      this.disposeObjectResources(mesh);
    });
    this.activeProjectiles = [];
    this.activeDamageNumbers.forEach(({ sprite }) => {
      this.scene.remove(sprite);
      this.disposeObjectResources(sprite);
    });
    this.activeDamageNumbers = [];
    this.activeImpactRings.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      this.disposeObjectResources(mesh);
    });
    this.activeImpactRings = [];
    this.clearParticles();
    this.monsterHitTimer = 0;
    this.monsterDeflectTimer = 0;
    this.screenShakeIntensity = 0;
    this.currentStage = stage;
    this.danceTimer = 0;
    this.currentDanceMove = 'idle';
    this.creatureRoot.position.copy(this.creatureHomePosition);
    this.creatureRoot.rotation.copy(this.creatureHomeRotation);
    this.playAction('Qishilong_stand', 0.25, true);

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

  public playFinalDefeatAnimation(callback?: () => void) {
    if (this.monsterDefeated) return;
    this.monsterDefeated = true;
    this.defeatElapsed = 0;
    this.defeatCallback = callback || null;
    this.defeatCallbackFired = false;
    this.danceTimer = 0;
    this.currentDanceMove = 'idle';
    this.playAction('Qishilong_die', 0.12, false);
    this.sampleCreatureForDisintegration();
    this.spawnImpactRings(new THREE.Vector3(0, 1.65, 0.2), 0xff3158, 10, true);
    this.triggerScreenShake(0.34);
    this.triggerStrobe(0xffffff);
    if (this.coreLight) {
      this.coreLight.color.setHex(0xff3158);
      this.coreLight.intensity = 12;
    }
  }

  private sampleCreatureForDisintegration() {
    if (!this.creatureModel) {
      this.spawnParticlesAt(new THREE.Vector3(0, 1.8, 0), 0xff3158, this.MAX_PARTICLES);
      return;
    }

    this.creatureModel.updateMatrixWorld(true);
    const sourceMeshes = this.creatureMeshes.filter((mesh) => {
      const positions = mesh.geometry.getAttribute('position');
      return positions && positions.count > 0;
    });
    if (sourceMeshes.length === 0) return;

    const particleMaterial = this.impactParticles?.material as THREE.PointsMaterial | undefined;
    if (particleMaterial) particleMaterial.color.setHex(0xff537a);
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const mesh = sourceMeshes[Math.floor(Math.random() * sourceMeshes.length)];
      const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const vertexIndex = Math.floor(Math.random() * positions.count);
      const worldPosition = new THREE.Vector3().fromBufferAttribute(positions, vertexIndex);
      mesh.localToWorld(worldPosition);
      const index = i * 3;
      this.particlePositions[index] = worldPosition.x;
      this.particlePositions[index + 1] = worldPosition.y;
      this.particlePositions[index + 2] = worldPosition.z;
      const outward = worldPosition.clone().sub(new THREE.Vector3(0, 1.5, 0)).normalize();
      this.particleVelocities[index] = outward.x * (1.2 + Math.random() * 3);
      this.particleVelocities[index + 1] = 1.5 + Math.random() * 4.5;
      this.particleVelocities[index + 2] = outward.z * (1.2 + Math.random() * 3);
      this.particleLifespans[i] = 2.1 + Math.random() * 0.45;
    }
    if (this.impactParticles) {
      this.impactParticles.geometry.attributes.position.needsUpdate = true;
    }

    for (const mesh of this.creatureMeshes) {
      const original = mesh.material;
      const animated = (Array.isArray(original) ? original : [original]).map((material) => {
        const copy = material.clone();
        if ('transparent' in copy) copy.transparent = true;
        if ('opacity' in copy) copy.opacity = 1;
        if ('depthWrite' in copy) copy.depthWrite = false;
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.emissive.setHex(0xff3158);
          copy.emissiveIntensity = 3.5;
        }
        return copy;
      });
      mesh.material = Array.isArray(original) ? animated : animated[0];
      this.destructionMaterials.push({ mesh, original, animated });
    }
  }

  private restoreDefeatedCreature() {
    this.monsterDefeated = false;
    this.defeatElapsed = 0;
    this.defeatCallback = null;
    this.defeatCallbackFired = false;
    if (this.creatureModel) {
      this.creatureModel.visible = true;
      this.creatureModel.scale.setScalar(1);
    }
    if (this.fallbackCreature) this.fallbackCreature.visible = true;
    this.creatureRoot.position.copy(this.creatureHomePosition);
    this.creatureRoot.rotation.copy(this.creatureHomeRotation);
    for (const entry of this.destructionMaterials) {
      entry.mesh.material = entry.original;
      entry.animated.forEach((material) => material.dispose());
    }
    this.destructionMaterials = [];
    this.animationMixer?.stopAllAction();
    this.currentAction = null;
    this.playAction('Qishilong_stand', 0.2, true);
    this.clearParticles();
    this.activeImpactRings.forEach(({ mesh }) => {
      this.scene.remove(mesh);
      this.disposeObjectResources(mesh);
    });
    this.activeImpactRings = [];
  }

  // ==================== CREATURE ANIMATION & LIGHTING UPDATE ====================
  private updateMonsterDance(delta: number, time: number) {
    if (!this.creatureRoot) return;

    if (this.monsterDefeated) {
      this.defeatElapsed += delta;
      const stagger = Math.min(1, this.defeatElapsed / 0.65);
      this.creatureRoot.position.set(
        this.creatureHomePosition.x,
        this.creatureHomePosition.y - stagger * 0.24,
        this.creatureHomePosition.z - Math.sin(stagger * Math.PI) * 0.16
      );
      this.creatureRoot.rotation.set(
        this.creatureHomeRotation.x - stagger * 0.2,
        this.creatureHomeRotation.y,
        this.creatureHomeRotation.z + stagger * 0.14
      );
      const dissolve = THREE.MathUtils.clamp((this.defeatElapsed - 0.55) / 1.8, 0, 1);
      this.creatureModel?.scale.setScalar(1 - dissolve * 0.88);
      for (const entry of this.destructionMaterials) {
        entry.animated.forEach((material) => {
          if ('opacity' in material) material.opacity = 1 - dissolve;
          if ('emissiveIntensity' in material) {
            material.emissiveIntensity = 1.5 + dissolve * 5;
          }
        });
      }
      if (this.defeatElapsed >= 2.45 && this.creatureModel) {
        this.creatureModel.visible = false;
      }
      if (this.defeatElapsed >= 2.45 && this.fallbackCreature) {
        this.fallbackCreature.visible = false;
      }
      if (this.defeatElapsed >= 2.8 && !this.defeatCallbackFired) {
        this.defeatCallbackFired = true;
        this.defeatCallback?.();
      }
      return;
    }

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
    this.hitReactionElapsed = Math.min(
      this.hitReactionDuration,
      this.hitReactionElapsed + delta
    );
    const reactionProgress = this.hitReactionDuration > 0
      ? this.hitReactionElapsed / this.hitReactionDuration
      : 1;
    const reactionEnvelope = Math.sin(Math.PI * reactionProgress);
    this.creatureRoot.position.set(
      this.creatureHomePosition.x + this.hitReactionPosition.x * reactionEnvelope,
      this.creatureHomePosition.y + this.hitReactionPosition.y * reactionEnvelope,
      this.creatureHomePosition.z + this.hitReactionPosition.z * reactionEnvelope
    );
    this.creatureRoot.rotation.set(
      this.creatureHomeRotation.x + targetTiltX + this.hitReactionRotation.x * reactionEnvelope,
      this.creatureHomeRotation.y + targetTiltY + this.hitReactionRotation.y * reactionEnvelope,
      this.creatureHomeRotation.z + this.hitReactionRotation.z * reactionEnvelope
    );

    // Smooth emissive flash decay on hit
    if (this.monsterHitTimer > 0) {
      this.monsterHitTimer -= delta;
      this.creatureMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.lerp(this._blackColor, delta * 7);
          mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, delta * 7);
        }
      });
    }

    if (this.monsterDeflectTimer > 0) {
      this.monsterDeflectTimer -= delta;
      this.creatureMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissive.lerp(this._blackColor, delta * 7);
          mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0, delta * 7);
        }
      });
    }

    // Pulse biometric core light in sync with music beat
    const bpm = 160;
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
    const frameStart = performance.now();
    if (this.previousFrameStartMs > 0) {
      this.currentFrameTimeMs = frameStart - this.previousFrameStartMs;
    }
    this.previousFrameStartMs = frameStart;
    this.updatePerformance(frameStart);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.elapsedTime;

    // 1. Dance & Animation Update
    this.updateMonsterDance(delta, elapsedTime);
    if (this.animationMixer) {
      this.animationMixer.update(delta);
    }

    // Summoning Beacon Animation (while model is streaming)
    if (this.summonBeacon) {
      this.summonBeacon.rotation.y += delta * 1.5;
      if (this.summonRingMesh) {
        const pulse = 0.65 + Math.sin(elapsedTime * 6) * 0.3;
        (this.summonRingMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
      }
    }

    // 2. Boss & Stage ambient props
    if (this.currentStage === 'stage_2_rhythm_breaker' && this.rhythmShield?.visible) {
      this.rhythmShield.rotation.z = Math.sin(elapsedTime * 1.5) * 0.15;
      this.rhythmShield.scale.lerp(this._v1.set(1, 1, 1), delta * 8);
    } else if (this.currentStage === 'stage_3_music_destroyer') {
      for (let idx = 0; idx < this.bossOrbitRings.length; idx++) {
        const ring = this.bossOrbitRings[idx];
        const speed = (idx + 1) * 0.7 * (idx % 2 === 0 ? 1 : -1);
        ring.rotation.x += delta * speed;
        ring.rotation.y += delta * (speed * 0.8);
      }
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
        this.impactCallback?.(
          p.isSuperAttack,
          p.instrumentId,
          p.comboCount,
          p.judgment
        );
        const impactPosition = this.impactPosition;
        const particleCount = Math.min(55, 28 + Math.max(0, p.comboCount - 1) * 3);
        this.spawnParticlesAt(impactPosition, p.colorHex || 0x00f0ff, particleCount);
        this.spawnImpactRings(impactPosition, p.colorHex || 0x00f0ff, p.comboCount, p.isSuperAttack);
        this.showDamageNumber(p.damage, p.comboCount, p.colorHex);
        if (p.comboCount >= 10) {
          this.triggerScreenShake(0.16);
          this.triggerStrobe(p.colorHex);
        }
        this.scene.remove(p.mesh);
        this.disposeObjectResources(p.mesh);
        this.activeProjectiles.splice(i, 1);
      } else {
        const fade = Math.max(0.2, 1 - p.progress * 0.55);
        for (const { material, opacity } of p.materials) {
          material.opacity = opacity * fade;
        }
      }
    }

    for (let i = this.activeImpactRings.length - 1; i >= 0; i--) {
      const ring = this.activeImpactRings[i];
      ring.age += delta;
      if (ring.age < 0) continue;
      const progress = Math.min(1, ring.age / ring.lifetime);
      const scale = THREE.MathUtils.lerp(0.2, ring.maxScale, progress);
      ring.mesh.scale.setScalar(scale);
      const material = ring.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = (1 - progress) * 0.92;
      if (ring.age >= ring.lifetime) {
        this.scene.remove(ring.mesh);
        this.disposeObjectResources(ring.mesh);
        this.activeImpactRings.splice(i, 1);
      }
    }

    for (let i = this.activeDamageNumbers.length - 1; i >= 0; i--) {
      const label = this.activeDamageNumbers[i];
      label.age += delta;
      label.sprite.position.y += delta * 0.55;
      (label.sprite.material as THREE.SpriteMaterial).opacity = Math.max(
        0,
        1 - label.age / label.lifetime
      );
      if (label.age >= label.lifetime) {
        this.scene.remove(label.sprite);
        this.disposeObjectResources(label.sprite);
        this.activeDamageNumbers.splice(i, 1);
      }
    }

    // 5. Particles update
    if (this.impactParticles) {
      let activeCount = 0;
      let particlesChanged = false;
      for (let i = 0; i < this.MAX_PARTICLES; i++) {
        if (this.particleLifespans[i] > 0) {
          this.particleLifespans[i] -= delta * 1.4;
          const idx = i * 3;
          if (this.particleLifespans[i] <= 0) {
            this.particlePositions[idx] = this.HIDDEN_PARTICLE_POSITION;
            this.particlePositions[idx + 1] = this.HIDDEN_PARTICLE_POSITION;
            this.particlePositions[idx + 2] = this.HIDDEN_PARTICLE_POSITION;
            particlesChanged = true;
          } else {
            this.particlePositions[idx] += this.particleVelocities[idx] * delta;
            this.particlePositions[idx + 1] += this.particleVelocities[idx + 1] * delta;
            this.particlePositions[idx + 2] += this.particleVelocities[idx + 2] * delta;
            this.particleVelocities[idx + 1] -= 9.8 * delta;
            activeCount++;
            particlesChanged = true;
          }
        }
      }
      this.activeParticleCount = activeCount;
      if (particlesChanged) {
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
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.animationMixer?.stopAllAction();
    this.animationMixer = null;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (!mesh.material) return;
      const objectMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of objectMaterials) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    this.scene.environment?.dispose();
    this.scene.clear();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
  }
}
