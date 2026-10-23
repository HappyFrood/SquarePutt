'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { PuttingShotData, SlopeDifficulty } from '@/lib/types';
import { GreenTerrain } from '@/lib/physicsEngine';
import { audioEngine } from '@/components/ui/AudioEngine';
import { Settings } from 'lucide-react';

interface PuttingGreenCanvasProps {
  currentShot: PuttingShotData | null;
  targetDistanceFt: number;
  stimp: number;
  slopeDifficulty: SlopeDifficulty;
  terrainSeed?: number;
  cameraMode: 'behind' | 'overhead' | 'follow' | 'orbit';
  showGrid: boolean;
  showHeatmap: boolean;
  showBreakBeads?: boolean;
  showAimLine?: boolean;
  showStripes?: boolean;
  holeRadiusMultiplier?: number;
  isRolling?: boolean;
  onBallRollComplete?: () => void;
  onOpenSettings?: () => void;
}

/**
 * Generates a procedural PGA Tour mowed turf texture with mower striping and grass stippling.
 */
function createMowedTurfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base emerald turf green
  ctx.fillStyle = '#115e3b';
  ctx.fillRect(0, 0, 512, 512);

  // Mower stripes (alternating light and dark green cut bands)
  const stripeWidth = 64;
  for (let z = 0; z < 512; z += stripeWidth * 2) {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.12)'; // lighter cut direction
    ctx.fillRect(0, z, 512, stripeWidth);
    ctx.fillStyle = 'rgba(4, 47, 28, 0.14)'; // darker roller pass
    ctx.fillRect(0, z + stripeWidth, 512, stripeWidth);
  }

  // Cross-cut subtle diagonal diamond pattern (championship cross-mow)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = -512; i < 1024; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
    ctx.stroke();
  }

  // Fine grass blade noise stippling
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    data[i] = Math.min(255, Math.max(0, data[i] + noise * 0.4));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.3));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 12);
  return texture;
}

/**
 * Generates a high-frequency grass blade bump map for micro-surface light scattering.
 */
function createTurfBumpMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = 128 + (Math.random() - 0.5) * 75;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 48);
  return texture;
}

/**
 * Generates a golf ball dimple normal map for realistic physical dimples.
 */
function createBallDimpleNormalMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Neutral normal color (128, 128, 255)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 512, 256);

  // Hexagonal repeating circular dimple indentations
  const spacingX = 16;
  const spacingY = 14;
  const radius = 5.5;

  for (let y = 0; y < 256; y += spacingY) {
    const row = Math.floor(y / spacingY);
    const offsetX = (row % 2) * (spacingX / 2);
    for (let x = -spacingX; x < 512 + spacingX; x += spacingX) {
      const cx = x + offsetX;
      const cy = y;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, '#5050ff'); // deep center indentation
      grad.addColorStop(0.7, '#7070ff');
      grad.addColorStop(1, '#8080ff'); // flat normal at rim

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/**
 * Generates a high-resolution 360-degree panoramic tree-line and golf course horizon texture.
 * Features organic pine silhouettes, deciduous oak tree clusters, rolling fairway hills,
 * and atmospheric aerial depth fade.
 */
function createHorizonPanoramaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Start with clean transparency so 3D Sky dome shines through above tree crowns
  ctx.clearRect(0, 0, 2048, 512);

  // 2. Soft atmospheric aerial haze behind trees
  const hazeGrad = ctx.createLinearGradient(0, 180, 0, 430);
  hazeGrad.addColorStop(0, 'rgba(185, 225, 248, 0.0)');
  hazeGrad.addColorStop(0.5, 'rgba(185, 225, 248, 0.28)');
  hazeGrad.addColorStop(1, 'rgba(165, 215, 238, 0.65)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, 180, 2048, 250);

  // 3. Distant rolling hill ridges (background layer)
  ctx.fillStyle = 'rgba(28, 72, 48, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, 320);
  for (let x = 0; x <= 2048; x += 32) {
    const y = 300 + Math.sin(x * 0.008) * 32 + Math.cos(x * 0.015) * 18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(2048, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // 4. Dense Championship Golf Tree Line (Pines, Oaks, and Spruces)
  const drawTree = (cx: number, baseY: number, height: number, type: 'pine' | 'oak') => {
    if (type === 'pine') {
      ctx.fillStyle = '#114224';
      // Triangle tiered pine tree
      ctx.beginPath();
      ctx.moveTo(cx, baseY - height);
      ctx.lineTo(cx + height * 0.35, baseY);
      ctx.lineTo(cx - height * 0.35, baseY);
      ctx.closePath();
      ctx.fill();

      // Lower darker tier
      ctx.fillStyle = '#0a2916';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - height * 0.65);
      ctx.lineTo(cx + height * 0.45, baseY);
      ctx.lineTo(cx - height * 0.45, baseY);
      ctx.closePath();
      ctx.fill();

      // Top sun-lit highlight
      ctx.fillStyle = '#1c5e34';
      ctx.beginPath();
      ctx.moveTo(cx, baseY - height);
      ctx.lineTo(cx + height * 0.15, baseY - height * 0.4);
      ctx.lineTo(cx, baseY - height * 0.4);
      ctx.closePath();
      ctx.fill();
    } else {
      // Rounded deciduous oak cluster
      ctx.fillStyle = '#1b5a32';
      ctx.beginPath();
      ctx.arc(cx, baseY - height * 0.6, height * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#103d21';
      ctx.beginPath();
      ctx.arc(cx - height * 0.2, baseY - height * 0.45, height * 0.35, 0, Math.PI * 2);
      ctx.arc(cx + height * 0.2, baseY - height * 0.45, height * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Seeded continuous tree belt across 2048px panorama
  let seed = 1234;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let x = 0; x < 2048; x += 16) {
    const r1 = pseudoRandom();
    const r2 = pseudoRandom();
    const treeH = 95 + r1 * 115;
    const baseY = 425 + Math.sin(x * 0.01) * 18;
    const type = r2 > 0.4 ? 'pine' : 'oak';
    drawTree(x, baseY, treeH, type);
  }

  // 5. Ground fairway/rough baseline blend
  const groundGrad = ctx.createLinearGradient(0, 410, 0, 512);
  groundGrad.addColorStop(0, 'rgba(10, 36, 20, 0.0)');
  groundGrad.addColorStop(0.5, 'rgba(9, 32, 18, 0.85)');
  groundGrad.addColorStop(1.0, '#092314');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 410, 2048, 102);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export const PuttingGreenCanvas: React.FC<PuttingGreenCanvasProps> = ({
  currentShot,
  targetDistanceFt,
  stimp,
  slopeDifficulty,
  terrainSeed = 42,
  cameraMode,
  showGrid,
  showHeatmap,
  showBreakBeads = true,
  showAimLine = true,
  showStripes = true,
  holeRadiusMultiplier = 1.0,
  isRolling = false,
  onBallRollComplete,
  onOpenSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const terrainRef = useRef<GreenTerrain | null>(null);

  // Scene Objects
  const greenMeshRef = useRef<THREE.Mesh | null>(null);
  const fringeMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.LineSegments | null>(null);
  const ballMeshRef = useRef<THREE.Mesh | null>(null);
  const ballShadowRef = useRef<THREE.Mesh | null>(null);
  const cupMeshRef = useRef<THREE.Group | null>(null);
  const flagMeshRef = useRef<THREE.Mesh | null>(null);
  const outerMeadowRef = useRef<THREE.Mesh | null>(null);
  const horizonMeshRef = useRef<THREE.Mesh | null>(null);
  const cupElevRef = useRef<number>(0);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const laserAimRef = useRef<THREE.Group | null>(null);
  const breakBeadsRef = useRef<THREE.InstancedMesh | null>(null);
  const breakBeadDataRef = useRef<{ x: number; z: number; speed: number; origZ: number }[]>([]);

  // Textures
  const turfTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const turfBumpRef = useRef<THREE.CanvasTexture | null>(null);
  const dimpleNormalRef = useRef<THREE.CanvasTexture | null>(null);

  // Animation state
  const animFrameRef = useRef<number | null>(null);
  const animProgressRef = useRef<number>(1.0);
  const trajectoryPointsRef = useRef<THREE.Vector3[]>([]);
  const isRollingRef = useRef<boolean>(false);
  const hasTriggeredCupAudio = useRef<boolean>(false);

  // Mouse Orbit controls state
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitAnglesRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0,
    phi: Math.PI / 4,
    radius: 12,
  });

  // Dynamic props synced to refs for high-performance animation loop
  const camModeRef = useRef(cameraMode);
  const targetDistMRef = useRef(targetDistanceFt * 0.3048);
  const currentShotRef = useRef(currentShot);
  const onBallRollCompleteRef = useRef(onBallRollComplete);
  const showBreakBeadsRef = useRef(showBreakBeads);
  const slopeDifficultyRef = useRef(slopeDifficulty);

  useEffect(() => {
    camModeRef.current = cameraMode;
    targetDistMRef.current = targetDistanceFt * 0.3048;
    currentShotRef.current = currentShot;
    onBallRollCompleteRef.current = onBallRollComplete;
    showBreakBeadsRef.current = showBreakBeads;
    slopeDifficultyRef.current = slopeDifficulty;
  }, [
    cameraMode,
    targetDistanceFt,
    currentShot,
    onBallRollComplete,
    showBreakBeads,
    slopeDifficulty,
  ]);

  const targetDistanceM = targetDistanceFt * 0.3048;

  // Camera Mode Positioning (Declared before render loop to avoid hoisting issues)
  const updateCameraPosition = () => {
    const camera = cameraRef.current;
    if (!camera) return;

    const ball = ballMeshRef.current;
    const ballPos = ball ? ball.position : new THREE.Vector3(0, 0, 0);
    const mode = camModeRef.current;
    const targetM = targetDistMRef.current;

    switch (mode) {
      case 'behind': {
        const camDist = Math.max(1.8, targetM * 0.35);
        camera.position.set(0, 1.35, -camDist);
        camera.lookAt(0, 0.04, targetM * 0.55);
        break;
      }
      case 'overhead': {
        const midZ = targetM * 0.5;
        camera.position.set(0, Math.max(6.5, targetM * 1.1), midZ);
        camera.lookAt(0, 0, midZ);
        break;
      }
      case 'follow': {
        if (isRollingRef.current) {
          camera.position.set(ballPos.x * 0.45, ballPos.y + 0.8, ballPos.z - 1.4);
          camera.lookAt(ballPos.x, ballPos.y + 0.08, ballPos.z + 1.2);
        } else {
          camera.position.set(ballPos.x, ballPos.y + 0.72, ballPos.z - 1.3);
          camera.lookAt(ballPos.x, ballPos.y, targetM);
        }
        break;
      }
      case 'orbit': {
        const { theta, phi, radius } = orbitAnglesRef.current;
        const targetLook = new THREE.Vector3(0, 0, targetM * 0.5);
        const cx = targetLook.x + radius * Math.sin(phi) * Math.sin(theta);
        const cy = targetLook.y + radius * Math.cos(phi);
        const cz = targetLook.z + radius * Math.sin(phi) * Math.cos(theta);
        camera.position.set(cx, Math.max(0.4, cy), cz);
        camera.lookAt(targetLook);
        break;
      }
    }
  };

  // Initialize Three.js scene & procedural materials
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Atmospheric Sky Blue Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8); // Radiant daylight azure sky
    scene.fog = new THREE.Fog(0x7dd3fc, 55, 300);
    sceneRef.current = scene;

    // 2. Camera with extended far plane for expansive championship course horizon
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 450);
    cameraRef.current = camera;

    // 3. Renderer with high-fidelity soft shadows and filmic tone mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Physical Analytic Sky (Three.js Sky Shader)
    const sky = new Sky();
    sky.scale.setScalar(380); // Contained within camera.far (450) so it's fully rendered
    scene.add(sky);

    const sunVector = new THREE.Vector3();
    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 2.0;
    skyUniforms['rayleigh'].value = 2.8;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const sunElevation = 38;
    const sunAzimuth = 45;
    const phi = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);
    sunVector.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunVector);

    // 5. 360-degree Panoramic Tree-Line Horizon Cylinder
    const horizonTexture = createHorizonPanoramaTexture();
    const horizonGeo = new THREE.CylinderGeometry(75, 75, 26, 64, 1, true);
    const horizonMat = new THREE.MeshBasicMaterial({
      map: horizonTexture,
      side: THREE.BackSide,
      transparent: true,
      fog: true,
    });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    const initialTargetM = targetDistMRef.current;
    horizonMesh.position.set(0, 9.5, initialTargetM * 0.5);
    scene.add(horizonMesh);
    horizonMeshRef.current = horizonMesh;

    // 6. Expansive Outer Championship Course Fairway/Rough Meadow
    const outerMeadowGeo = new THREE.CircleGeometry(85, 64);
    outerMeadowGeo.rotateX(-Math.PI / 2);
    const outerMeadowMat = new THREE.MeshStandardMaterial({
      color: 0x092314, // Rich dark outer fairway turf
      roughness: 0.95,
      metalness: 0.02,
    });
    const outerMeadowMesh = new THREE.Mesh(outerMeadowGeo, outerMeadowMat);
    outerMeadowMesh.position.set(0, -0.035, initialTargetM * 0.5);
    outerMeadowMesh.receiveShadow = true;
    scene.add(outerMeadowMesh);
    outerMeadowRef.current = outerMeadowMesh;

    // 7. Procedural Textures
    turfTextureRef.current = createMowedTurfTexture();
    turfBumpRef.current = createTurfBumpMap();
    dimpleNormalRef.current = createBallDimpleNormalMap();

    // 8. Cinematic Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xdff0fc, 0.75); // Soft blue sky ambient
    scene.add(ambientLight);

    // Warm Sun Directional Light
    const sunLight = new THREE.DirectionalLight(0xfff8e8, 1.55);
    sunLight.position.set(4, 14, -2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -6;
    sunLight.shadow.camera.right = 6;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -4;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    // Cool Sky Rim Fill Light
    const skyRimLight = new THREE.DirectionalLight(0x7dd3fc, 0.45);
    skyRimLight.position.set(-6, 8, 12);
    scene.add(skyRimLight);

    // Pin Glow Light
    const pinGlow = new THREE.PointLight(0x10b981, 0.9, 15);
    pinGlow.position.set(0, 2.5, initialTargetM);
    scene.add(pinGlow);

    // 6. Golf Ball Mesh with Dimples and Specular Clearcoat
    const ballGeo = new THREE.SphereGeometry(0.02135, 48, 48);
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.04,
      normalMap: dimpleNormalRef.current,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);
    ballMeshRef.current = ballMesh;

    // Contact Soft Shadow Decal beneath ball
    const shadowGeo = new THREE.CircleGeometry(0.035, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
    });
    const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(ballShadow);
    ballShadowRef.current = ballShadow;

    // 7. Trail Ribbon Line
    const maxTrailPoints = 350;
    const trailPositions = new Float32Array(maxTrailPoints * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    trailLineRef.current = trailLine;

    // 8. Cup, Flag, Aim Line, and Break Beads Groups
    const cupGroup = new THREE.Group();
    scene.add(cupGroup);
    cupMeshRef.current = cupGroup;

    const laserGroup = new THREE.Group();
    scene.add(laserGroup);
    laserAimRef.current = laserGroup;

    // Handle Window & Container Resize dynamically with ResizeObserver
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Main Render Loop
    let lastTime = performance.now();
    const dummyMatrix = new THREE.Matrix4();

    const render = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // 1. Advance Ball Trajectory Animation
      if (isRollingRef.current && trajectoryPointsRef.current.length > 1) {
        animProgressRef.current += delta * 0.85;
        const pts = trajectoryPointsRef.current;
        const total = pts.length - 1;
        const idxFloat = animProgressRef.current * total;
        const idx = Math.min(Math.floor(idxFloat), total);
        const nextIdx = Math.min(idx + 1, total);
        const frac = idxFloat - idx;

        if (ballMeshRef.current && idx < total) {
          const p1 = pts[idx];
          const p2 = pts[nextIdx];
          const currX = p1.x + (p2.x - p1.x) * frac;
          const currY = p1.y + (p2.y - p1.y) * frac + 0.02135;
          const currZ = p1.z + (p2.z - p1.z) * frac;

          ballMeshRef.current.position.set(currX, currY, currZ);

          if (ballShadowRef.current) {
            ballShadowRef.current.position.set(currX, currY - 0.021, currZ);
          }

          // Rolling rotation
          const dz = p2.z - p1.z;
          const dx = p2.x - p1.x;
          const rollDist = Math.sqrt(dx * dx + dz * dz) * frac;
          ballMeshRef.current.rotation.x += rollDist / 0.02135;
          ballMeshRef.current.rotation.z -= (dx / 0.02135) * 0.5;

          // Update Trail
          if (trailLineRef.current) {
            const posAttr = trailLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
            const drawnCount = Math.min(idx + 2, total + 1);
            for (let i = 0; i < drawnCount; i++) {
              posAttr.setXYZ(i, pts[i].x, pts[i].y + 0.003, pts[i].z);
            }
            trailLineRef.current.geometry.setDrawRange(0, drawnCount);
            posAttr.needsUpdate = true;
          }
        }

        // Check Cup Drop Sound
        if (currentShotRef.current?.isHoled && animProgressRef.current >= 0.95 && !hasTriggeredCupAudio.current) {
          hasTriggeredCupAudio.current = true;
          audioEngine.playCupDrop();
        }

        if (animProgressRef.current >= 1.0) {
          isRollingRef.current = false;
          animProgressRef.current = 1.0;
          if (currentShotRef.current?.isHoled && !hasTriggeredCupAudio.current) {
            hasTriggeredCupAudio.current = true;
            audioEngine.playCupDrop();
          }
          if (onBallRollCompleteRef.current) onBallRollCompleteRef.current();
        }
      }

      // 2. Animate Cloth-Waving Flag
      if (flagMeshRef.current) {
        const flagGeo = flagMeshRef.current.geometry;
        const pos = flagGeo.attributes.position;
        const timeSec = now * 0.005;
        const baseFlagY = cupElevRef.current + 2.15 - 0.15;

        for (let i = 0; i < pos.count; i++) {
          const u = pos.getX(i); // x ranges 0 to 0.38
          // Pin is attached at x=0; cloth waves outward as x increases
          const waveZ = Math.sin(timeSec * 4.2 + u * 12) * (u * 0.22) + Math.cos(timeSec * 2.1 + u * 7) * (u * 0.07);
          const waveY = Math.cos(timeSec * 3.2 + u * 9) * (u * 0.05);
          pos.setZ(i, waveZ);
          pos.setY(i, baseFlagY + (pos.getY(i) > baseFlagY ? 0.12 : -0.12) + waveY);
        }
        pos.needsUpdate = true;
        flagGeo.computeVertexNormals();
      }

      // 3. Animate PuttView Slope Break Flow Beads
      if (
        breakBeadsRef.current &&
        terrainRef.current &&
        slopeDifficultyRef.current !== 'flat' &&
        showBreakBeadsRef.current
      ) {
        const beads = breakBeadsRef.current;
        const beadData = breakBeadDataRef.current;
        const terrain = terrainRef.current;

        for (let i = 0; i < beadData.length; i++) {
          const b = beadData[i];
          const grad = terrain.getGradient(b.x, b.z);

          // Flow downhill (-grad)
          const moveSpeed = Math.max(0.2, (Math.abs(grad.dhdx) + Math.abs(grad.dhdz)) * 25);
          b.x -= grad.dhdx * moveSpeed * delta;
          b.z -= grad.dhdz * moveSpeed * delta;

          // If bead drifts out of bounds, loop back
          const curTargetM = targetDistMRef.current;
          if (Math.abs(b.x) > 1.6 || b.z > curTargetM + 1.2 || b.z < 0.2) {
            b.x = (Math.random() - 0.5) * 2.8;
            b.z = Math.random() * curTargetM;
          }

          const y = terrain.getElevation(b.x, b.z) + 0.012;
          dummyMatrix.setPosition(b.x, y, b.z);
          beads.setMatrixAt(i, dummyMatrix);
        }
        beads.instanceMatrix.needsUpdate = true;
      }

      // 4. Update Camera Position
      updateCameraPosition();

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      turfTextureRef.current?.dispose();
      turfBumpRef.current?.dispose();
      dimpleNormalRef.current?.dispose();
    };
  }, []);

  // Projected Laser Aim Guideline and Distance Ticks
  const updateLaserAim = (
    terrain: GreenTerrain,
    targetM: number,
    visible: boolean
  ) => {
    const laserGroup = laserAimRef.current;
    if (!laserGroup) return;

    laserGroup.clear();
    if (!visible) return;

    const points: THREE.Vector3[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const z = (i / steps) * targetM;
      const x = 0;
      const y = terrain.getElevation(x, z) + 0.004;
      points.push(new THREE.Vector3(x, y, z));
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      linewidth: 2,
      dashSize: 0.15,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.75,
    });
    const laserLine = new THREE.Line(lineGeo, lineMat);
    laserLine.computeLineDistances();
    laserGroup.add(laserLine);

    // Distance chalk tick markers every 5 feet (1.524m)
    const tickIntervalM = 5 * 0.3048;
    for (let d = tickIntervalM; d < targetM; d += tickIntervalM) {
      const y = terrain.getElevation(0, d) + 0.003;
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.25, y, d),
        new THREE.Vector3(0.25, y, d),
      ]);
      const tickMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
      });
      const tick = new THREE.Line(tickGeo, tickMat);
      laserGroup.add(tick);
    }
  };

  // USGA Regulation 3D Cup and PGA Tour Striped Tournament Flagstick
  const updateCupAndFlag = (
    terrain: GreenTerrain,
    targetM: number,
    radiusMultiplier: number
  ) => {
    const cupGroup = cupMeshRef.current;
    if (!cupGroup) return;

    cupGroup.clear();

    const holeRadius = 0.054 * radiusMultiplier;
    const cupElev = terrain.getElevation(0, targetM);
    cupElevRef.current = cupElev;

    // 1. Regulation USGA White Plastic Cup Liner (top 3.8cm / 1.5" inner cylinder)
    const linerHeight = 0.038;
    const linerGeo = new THREE.CylinderGeometry(holeRadius, holeRadius, linerHeight, 48, 1, true);
    const linerMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.28,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const linerMesh = new THREE.Mesh(linerGeo, linerMat);
    linerMesh.position.set(0, cupElev - linerHeight * 0.5, targetM);
    cupGroup.add(linerMesh);

    // Beveled upper white plastic rim of the liner
    const linerRimGeo = new THREE.RingGeometry(holeRadius * 0.94, holeRadius, 48);
    linerRimGeo.rotateX(-Math.PI / 2);
    const linerRimMesh = new THREE.Mesh(linerRimGeo, linerMat);
    linerRimMesh.position.set(0, cupElev + 0.0006, targetM);
    cupGroup.add(linerRimMesh);

    // 2. Sheared Turf Cut Lip Collar (trimmed dark grass/soil bevel around hole)
    const turfCollarGeo = new THREE.RingGeometry(holeRadius, holeRadius + 0.018, 48);
    turfCollarGeo.rotateX(-Math.PI / 2);
    const turfCollarMat = new THREE.MeshStandardMaterial({
      color: 0x082515,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const turfCollarMesh = new THREE.Mesh(turfCollarGeo, turfCollarMat);
    turfCollarMesh.position.set(0, cupElev + 0.001, targetM);
    cupGroup.add(turfCollarMesh);

    // 3. Deep Dark Cup Chamber (lower 7.0cm cylinder below the white liner)
    const chamberHeight = 0.07;
    const chamberGeo = new THREE.CylinderGeometry(holeRadius * 0.98, holeRadius * 0.98, chamberHeight, 48, 1, true);
    const chamberMat = new THREE.MeshStandardMaterial({
      color: 0x060910,
      roughness: 0.95,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const chamberMesh = new THREE.Mesh(chamberGeo, chamberMat);
    chamberMesh.position.set(0, cupElev - linerHeight - chamberHeight * 0.5, targetM);
    cupGroup.add(chamberMesh);

    // 4. Perforated Cast Cup Bottom Drainage Plate
    const bottomGeo = new THREE.CircleGeometry(holeRadius * 0.97, 36);
    bottomGeo.rotateX(-Math.PI / 2);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.35,
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.position.set(0, cupElev - 0.103, targetM);
    cupGroup.add(bottomMesh);

    // 5. Central Brass Flagstick Socket
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.22,
      metalness: 0.9,
    });
    const socketGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.024, 24);
    const socketMesh = new THREE.Mesh(socketGeo, brassMat);
    socketMesh.position.set(0, cupElev - 0.091, targetM);
    cupGroup.add(socketMesh);

    // 6. Subtle Interior Cup Soft Spotlight
    const cupSpot = new THREE.PointLight(0xfffbeb, 0.75, 1.8);
    cupSpot.position.set(0, cupElev + 0.12, targetM);
    cupGroup.add(cupSpot);

    // 7. Tournament Striped Flagstick (Alternating Yellow & Black Bands)
    const poleHeight = 2.15;
    const poleRadius = 0.0065;
    const numStripes = 14;
    const stripeHeight = poleHeight / numStripes;

    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.12,
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.3,
      metalness: 0.2,
    });

    const poleGroup = new THREE.Group();
    for (let s = 0; s < numStripes; s++) {
      const stripeGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, stripeHeight, 18);
      const isYellow = s % 2 === 0;
      const stripeMesh = new THREE.Mesh(stripeGeo, isYellow ? yellowMat : blackMat);
      stripeMesh.position.set(0, s * stripeHeight + stripeHeight * 0.5, 0);
      stripeMesh.castShadow = true;
      poleGroup.add(stripeMesh);
    }

    // Top Brass Finial
    const finialGeo = new THREE.SphereGeometry(0.013, 24, 24);
    const finialMesh = new THREE.Mesh(finialGeo, brassMat);
    finialMesh.position.set(0, poleHeight + 0.008, 0);
    finialMesh.castShadow = true;
    poleGroup.add(finialMesh);

    // Bottom Ferrule
    const ferruleGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.075, 18);
    const ferruleMesh = new THREE.Mesh(ferruleGeo, brassMat);
    ferruleMesh.position.set(0, 0.038, 0);
    ferruleMesh.castShadow = true;
    poleGroup.add(ferruleMesh);

    poleGroup.position.set(0, cupElev - 0.095, targetM);
    cupGroup.add(poleGroup);

    // 8. Cloth-Waving Flag Pennant
    const flagGeo = new THREE.PlaneGeometry(0.38, 0.24, 24, 8);
    flagGeo.translate(0.19, cupElev + poleHeight - 0.15, targetM);

    const flagMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.castShadow = true;
    cupGroup.add(flagMesh);
    flagMeshRef.current = flagMesh;

    // 9. Cup Concentric Distance Ring
    const targetRingGeo = new THREE.RingGeometry(0.48, 0.51, 40);
    targetRingGeo.rotateX(-Math.PI / 2);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const targetRingMesh = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRingMesh.position.set(0, cupElev + 0.002, targetM);
    cupGroup.add(targetRingMesh);
  };

  // Rebuild 3D Green Surface, Fringe, Distance Markers, and Break Beads
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const terrain = new GreenTerrain(slopeDifficulty, terrainSeed);
    terrainRef.current = terrain;

    // Clean up previous meshes
    if (greenMeshRef.current) {
      scene.remove(greenMeshRef.current);
      greenMeshRef.current.geometry.dispose();
      greenMeshRef.current = null;
    }
    if (fringeMeshRef.current) {
      scene.remove(fringeMeshRef.current);
      fringeMeshRef.current.geometry.dispose();
      fringeMeshRef.current = null;
    }
    if (gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      gridHelperRef.current.geometry.dispose();
      gridHelperRef.current = null;
    }
    if (breakBeadsRef.current) {
      scene.remove(breakBeadsRef.current);
      breakBeadsRef.current.geometry.dispose();
      breakBeadsRef.current = null;
    }

    const greenWidth = Math.max(10.0, targetDistanceM * 1.8);
    const greenLength = Math.max(16.0, targetDistanceM + 12.0);
    const centerZ = targetDistanceM * 0.5;
    const segsX = 64;
    const segsZ = 64;

    // Update outer meadow and horizon position to align with green centerZ
    if (outerMeadowRef.current) {
      outerMeadowRef.current.position.z = centerZ;
    }
    if (horizonMeshRef.current) {
      horizonMeshRef.current.position.z = centerZ;
    }

    // A. Putting Surface Geometry
    const geo = new THREE.PlaneGeometry(greenWidth, greenLength, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, centerZ);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    let minElev = Infinity;
    let maxElev = -Infinity;

    const holeRadius = 0.054 * holeRadiusMultiplier;
    const cupCenterZ = targetDistanceM;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      let vy = terrain.getElevation(vx, vz);

      // Create a clean, authentic physical depression hole directly into the cup
      const distToHole = Math.sqrt(vx * vx + (vz - cupCenterZ) * (vz - cupCenterZ));
      if (distToHole < holeRadius * 1.05) {
        vy = terrain.getElevation(0, cupCenterZ) - 0.104;
      } else if (distToHole < holeRadius * 1.45) {
        const blend = (distToHole - holeRadius * 1.05) / (holeRadius * 0.4);
        const rimDrop = (1 - blend) * 0.01;
        vy -= rimDrop;
      }

      pos.setY(i, vy);
      if (vy < minElev) minElev = vy;
      if (vy > maxElev) maxElev = vy;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const elevSpan = Math.max(0.001, maxElev - minElev);

    // Heatmap or Augusta Emerald Shader Colors
    for (let i = 0; i < pos.count; i++) {
      const vy = pos.getY(i);
      const normElev = (vy - minElev) / elevSpan;

      let r = 0.08;
      let g = 0.68;
      let b = 0.38;

      if (showHeatmap && slopeDifficulty !== 'flat') {
        if (normElev < 0.5) {
          const t = normElev * 2;
          r = 0.1 * (1 - t) + 0.08 * t;
          g = 0.45 * (1 - t) + 0.75 * t;
          b = 0.95 * (1 - t) + 0.35 * t;
        } else {
          const t = (normElev - 0.5) * 2;
          r = 0.08 * (1 - t) + 0.96 * t;
          g = 0.75 * (1 - t) + 0.25 * t;
          b = 0.35 * (1 - t) + 0.1 * t;
        }
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Green Material with Mowed Stripes & Bump Texture
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: showStripes ? turfTextureRef.current : null,
      bumpMap: turfBumpRef.current,
      bumpScale: 0.003,
      roughness: 0.78,
      metalness: 0.04,
    });

    const greenMesh = new THREE.Mesh(geo, greenMat);
    greenMesh.receiveShadow = true;
    scene.add(greenMesh);
    greenMeshRef.current = greenMesh;

    // B. Second-Cut Rough / Fringe Border & Outer Practice Stadium Turf
    const fringeWidth = greenWidth + 3.0;
    const fringeLength = greenLength + 3.0;
    const fringeGeo = new THREE.PlaneGeometry(fringeWidth, fringeLength, 24, 24);
    fringeGeo.rotateX(-Math.PI / 2);
    fringeGeo.translate(0, 0, centerZ);

    const fringePos = fringeGeo.attributes.position;
    for (let i = 0; i < fringePos.count; i++) {
      const vx = fringePos.getX(i);
      const vz = fringePos.getZ(i);
      const vy = terrain.getElevation(vx, vz) - 0.012; // slightly recessed fringe
      fringePos.setY(i, vy);
    }
    fringePos.needsUpdate = true;
    fringeGeo.computeVertexNormals();

    const fringeMat = new THREE.MeshStandardMaterial({
      color: 0x0a2e1d, // rich deep rough green
      roughness: 0.95,
      metalness: 0.02,
    });
    const fringeMesh = new THREE.Mesh(fringeGeo, fringeMat);
    fringeMesh.receiveShadow = true;
    fringeMesh.position.y -= 0.003;
    scene.add(fringeMesh);
    fringeMeshRef.current = fringeMesh;

    // C. AR Topography Grid
    if (showGrid) {
      const wireMat = new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.16,
      });
      const wireGeo = new THREE.WireframeGeometry(geo);
      const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
      wireMesh.position.y += 0.001;
      scene.add(wireMesh);
      gridHelperRef.current = wireMesh;
    }

    // D. PuttView Animated Break Beads (80 Glowing Slope Beads)
    if (slopeDifficulty !== 'flat' && showBreakBeads) {
      const beadCount = 75;
      const beadGeo = new THREE.SphereGeometry(0.016, 12, 12);
      const beadMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.75,
      });

      const beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, beadCount);
      const beadData: { x: number; z: number; speed: number; origZ: number }[] = [];

      const dummy = new THREE.Matrix4();
      for (let i = 0; i < beadCount; i++) {
        const bx = (Math.random() - 0.5) * (greenWidth - 0.8);
        const bz = 0.3 + Math.random() * (targetDistanceM + 0.8);
        const by = terrain.getElevation(bx, bz) + 0.012;
        dummy.setPosition(bx, by, bz);
        beadMesh.setMatrixAt(i, dummy);
        beadData.push({ x: bx, z: bz, speed: 1.0, origZ: bz });
      }

      beadMesh.instanceMatrix.needsUpdate = true;
      scene.add(beadMesh);
      breakBeadsRef.current = beadMesh;
      breakBeadDataRef.current = beadData;
    }

    // E. Laser Aim Line & Distance Hash Marks
    updateLaserAim(terrain, targetDistanceM, showAimLine);

    // F. Cup & Waving Flag
    updateCupAndFlag(terrain, targetDistanceM, holeRadiusMultiplier);

    // Reset ball position on new terrain
    if (!isRollingRef.current && ballMeshRef.current) {
      const startElev = terrain.getElevation(0, 0);
      ballMeshRef.current.position.set(0, startElev + 0.02135, 0);
      if (ballShadowRef.current) {
        ballShadowRef.current.position.set(0, startElev + 0.001, 0);
      }
    }
  }, [
    targetDistanceM,
    slopeDifficulty,
    terrainSeed,
    showGrid,
    showHeatmap,
    showBreakBeads,
    showAimLine,
    showStripes,
    holeRadiusMultiplier,
  ]);


  // When a new shot arrives, start roll trajectory animation
  useEffect(() => {
    if (!currentShot || !currentShot.trajectoryPoints || currentShot.trajectoryPoints.length === 0) {
      return;
    }

    const pts = currentShot.trajectoryPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    trajectoryPointsRef.current = pts;
    animProgressRef.current = 0.0;
    isRollingRef.current = true;
    hasTriggeredCupAudio.current = false;

    audioEngine.playPutterStrike();

    if (trailLineRef.current) {
      trailLineRef.current.geometry.setDrawRange(0, 0);
    }
  }, [currentShot]);

  // Mouse Orbit Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cameraMode !== 'orbit') return;
    isDraggingRef.current = true;
    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || cameraMode !== 'orbit') return;
    const deltaX = e.clientX - previousMousePositionRef.current.x;
    const deltaY = e.clientY - previousMousePositionRef.current.y;

    orbitAnglesRef.current.theta -= deltaX * 0.008;
    orbitAnglesRef.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2 - 0.05, orbitAnglesRef.current.phi + deltaY * 0.008)
    );

    previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (cameraMode !== 'orbit') return;
    orbitAnglesRef.current.radius = Math.max(
      3.0,
      Math.min(25.0, orbitAnglesRef.current.radius + e.deltaY * 0.01)
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ width: '100%', height: '100%' }}
    >
      {/* 3D Canvas Canvas HUD Overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <div className="sp-badge-green flex items-center gap-1.5 shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>STIMP {stimp.toFixed(1)}</span>
        </div>
        <div
          className="px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border shadow-lg"
          style={{
            backgroundColor:
              slopeDifficulty === 'flat'
                ? 'rgba(56, 189, 248, 0.15)'
                : slopeDifficulty === 'mild'
                ? 'rgba(52, 211, 153, 0.15)'
                : slopeDifficulty === 'medium'
                ? 'rgba(251, 191, 36, 0.15)'
                : 'rgba(248, 113, 113, 0.15)',
            borderColor:
              slopeDifficulty === 'flat'
                ? '#38bdf8'
                : slopeDifficulty === 'mild'
                ? '#34d399'
                : slopeDifficulty === 'medium'
                ? '#fbbf24'
                : '#f87171',
            color:
              slopeDifficulty === 'flat'
                ? '#38bdf8'
                : slopeDifficulty === 'mild'
                ? '#34d399'
                : slopeDifficulty === 'medium'
                ? '#fbbf24'
                : '#f87171',
          }}
        >
          {slopeDifficulty} SLOPE
        </div>

        {onOpenSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="flex items-center gap-1 py-0.5 px-2 rounded-md bg-slate-900/80 text-slate-300 border border-slate-700/60 hover:text-emerald-400 hover:border-emerald-500/40 text-xs font-semibold shadow-lg transition-all cursor-pointer pointer-events-auto"
            title="Configure Mode & Green Settings"
          >
            <Settings className="w-3 h-3 text-emerald-400" />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* Target Distance Badge */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={onOpenSettings}
          className="bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-md border border-slate-700/60 hover:border-emerald-500/40 px-3 py-1 rounded-lg text-xs font-medium text-slate-200 shadow-lg flex items-center gap-2 cursor-pointer transition-all pointer-events-auto"
          title="Click to refine putting distance or green parameters"
        >
          <span className="text-slate-400">Target:</span>
          <span className="sp-mono font-bold text-emerald-400 text-sm">{targetDistanceFt.toFixed(1)} FT</span>
          <Settings className="w-3 h-3 text-slate-400 ml-0.5" />
        </button>
      </div>

      {/* Holed Notification Pill */}
      {currentShot?.isHoled && !isRolling && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
          <div className="bg-emerald-500/90 text-slate-950 font-black px-4 py-1.5 rounded-full text-sm shadow-xl flex items-center gap-2 tracking-wide uppercase">
            <span className="text-base">⛳</span>
            <span>PUTT HOLED!</span>
          </div>
        </div>
      )}
    </div>
  );
};
