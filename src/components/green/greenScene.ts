/**
 * Three.js scene for the putting green. Framework-free; the React wrapper owns its lifecycle.
 *
 * Physics coordinates (x right, z toward the hole from the default ball spot, y up) map to
 * Three.js as (x, y, -z) so the camera can use Three's -Z forward convention and screen-right
 * matches golfer-right.
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { GreenSurface, PuttingSurface, Vec2, mulberry32 } from '@/lib/green';
import { BALL_RADIUS_M, HOLE_RADIUS_M } from '@/lib/physicsEngine';
import { CameraMode } from '@/lib/types';

export interface SceneOverlays {
  grid: boolean;
  contours: boolean;
  heatmap: boolean;
  fallLines: boolean;
  aimLine: boolean;
}

export interface RingSpec {
  radiusFt: number;
  color: string;
  /** Draw a filled band (lag zone) instead of a thin ring. */
  fill?: boolean;
  /** Only the half of the ring beyond the hole (relative to the ball). */
  pastOnly?: boolean;
}

export interface MarkerSpec {
  x: number;
  z: number;
  color: string;
}

export interface SceneCallbacks {
  onStrike?: () => void;
  onCupDrop?: () => void;
  onLipOut?: () => void;
  onRollComplete?: () => void;
}

const TERRAIN_HALF = 34; // m, terrain mesh half-size (centred on hole)
const TERRAIN_SEGS = 200;
const FADE_START = 21; // m, terrain contours fade to flat beyond this radius
const FADE_END = 30;

const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, y, -z);

function insidePoly(x: number, z: number, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function grainTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(99);
  for (let i = 0; i < size * size; i++) {
    const v = 200 + Math.floor((rnd() - 0.5) * 70);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(TERRAIN_HALF * 2 * 2.2, TERRAIN_HALF * 2 * 2.2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function dimpleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 136; y += 8) {
    const off = (y / 8) % 2 ? 4 : 0;
    for (let x = -8; x < 264; x += 8) {
      const g = ctx.createRadialGradient(x + off, y, 0, x + off, y, 3.4);
      g.addColorStop(0, '#6a6aff');
      g.addColorStop(1, '#8080ff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + off, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function softShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class GreenScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private raf = 0;
  private lastT = performance.now();
  private resizeObs: ResizeObserver;
  private disposed = false;
  private cb: SceneCallbacks = {};

  // state
  private surface: PuttingSurface = new GreenSurface('flat', 1, 10);
  private ball: Vec2 = { x: 0, z: -3 };
  private holeMult = 1;
  private overlays: SceneOverlays = { grid: true, contours: false, heatmap: false, fallLines: true, aimLine: true };
  private cameraMode: CameraMode = 'behind';

  // objects
  private terrain!: THREE.Mesh;
  private terrainMat!: THREE.MeshStandardMaterial;
  private terrainUniforms = {
    uGrid: { value: 1 },
    uFlow: { value: 1 },
    uTime: { value: 0 },
    uContours: { value: 0 },
    uHeat: { value: 0 },
    uMinH: { value: 0 },
    uMaxH: { value: 1 },
    uContourStep: { value: 0.025 },
    uGreenC: { value: new THREE.Vector2() },
    uGreenU: { value: new THREE.Vector2(0, 1) },
    uGreenR: { value: new THREE.Vector2(8, 6) },
    uWobble: { value: new THREE.Vector4(0, 0, 0.06, 0.04) },
    uUseMask: { value: 0 },
    uMask: { value: null as THREE.Texture | null },
    uMaskMin: { value: new THREE.Vector2() },
    uMaskSize: { value: 1 },
    uGreenCol: { value: new THREE.Color('#5d9a3e') },
    uCollarCol: { value: new THREE.Color('#477f30') },
    uRoughCol: { value: new THREE.Color('#2f5a25') },
  };
  private ballMesh!: THREE.Mesh;
  private ballShadow!: THREE.Mesh;
  private cup = new THREE.Group();
  private pin = new THREE.Group();
  private flag!: THREE.Mesh;
  private flagBase!: Float32Array;
  private overlayGroup = new THREE.Group();
  private ringGroup = new THREE.Group();
  private markerGroup = new THREE.Group();
  private trail: Line2 | null = null;
  private idealLine: Line2 | null = null;
  private lineMats: LineMaterial[] = [];
  private sun!: THREE.DirectionalLight;
  private terrainKey = '';
  /** Vertical exaggeration for display only; physics always uses true heights. */
  private exag = 3;
  private lastOutline: { anchor?: Vec2; radiusM?: number } = {};

  // playback
  private traj: [number, number, number][] | null = null;
  private trajDt = 1 / 60;
  private playT = 0;
  private playing = false;
  private dropIndex = -1;
  private dropFired = false;
  private lipIndex = -1;
  private lipFired = false;
  private ballQuat = new THREE.Quaternion();
  private frameTimes: number[] = [];

  /** Average frames per second over the last second or so (for diagnostics). */
  get fps() {
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length);
    return avg > 0 ? 1 / avg : 0;
  }

  // camera smoothing + orbit
  private camPos = new THREE.Vector3(0, 2, 5);
  private camLook = new THREE.Vector3();
  private orbit = { theta: 0.6, phi: 1.0, radius: 9 };
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.02, 600);
    this.buildStatic();
    this.bindPointer();

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.loop();
  }

  setCallbacks(cb: SceneCallbacks) {
    this.cb = cb;
  }

  /* --------------------------------- building --------------------------------- */

  private buildStatic() {
    const s = this.scene;
    s.background = new THREE.Color('#bcd7ea');
    s.fog = new THREE.Fog('#c9dcea', 60, 220);

    const sky = new Sky();
    sky.scale.setScalar(450);
    const u = sky.material.uniforms;
    u['turbidity'].value = 3;
    u['rayleigh'].value = 1.6;
    u['mieCoefficient'].value = 0.004;
    u['mieDirectionalG'].value = 0.8;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(64), THREE.MathUtils.degToRad(235));
    u['sunPosition'].value.copy(sunDir);
    s.add(sky);

    s.add(new THREE.HemisphereLight('#dbeafe', '#3b5d2a', 0.75));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.7);
    sun.position.copy(sunDir.clone().multiplyScalar(40));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    sun.shadow.radius = 3;
    s.add(sun);
    s.add(sun.target);
    this.sun = sun;

    // Outer ground beyond the terrain mesh
    // Ring, not a disk: it starts where the terrain mesh has already faded to y = 0,
    // so it never covers low parts of the green.
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(TERRAIN_HALF - 1, 260, 64, 1).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2f5a25', roughness: 1 })
    );
    outer.position.y = -0.005;
    s.add(outer);

    // Distant tree line: one irregular band, softened by fog
    const rnd = mulberry32(7);
    const tl = new THREE.CylinderGeometry(150, 150, 1, 160, 1, true);
    const p = tl.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setY(i, 4 + rnd() * 3.5 + Math.sin(i * 0.37) * 1.5);
      else p.setY(i, -1);
    }
    tl.computeVertexNormals();
    s.add(new THREE.Mesh(tl, new THREE.MeshBasicMaterial({ color: '#1d3622', side: THREE.BackSide, fog: true })));

    // Terrain
    const geo = new THREE.PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, TERRAIN_SEGS, TERRAIN_SEGS).rotateX(-Math.PI / 2);
    this.terrainMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: grainTexture(), roughness: 0.92, metalness: 0 });
    this.terrainMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.terrainUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSpWorld;\nattribute vec2 aGrad;\nvarying vec2 vGrad;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvSpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGrad = aGrad;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vSpWorld;
varying vec2 vGrad;
uniform float uGrid, uFlow, uTime, uContours, uHeat, uMinH, uMaxH, uContourStep;
uniform vec2 uGreenC, uGreenU, uGreenR;
uniform vec4 uWobble;
uniform float uUseMask, uMaskSize;
uniform sampler2D uMask;
uniform vec2 uMaskMin;
uniform vec3 uGreenCol, uCollarCol, uRoughCol;
float spLine(float v) { float d = fwidth(v); return 1.0 - clamp(abs(fract(v - 0.5) - 0.5) / max(d, 1e-5), 0.0, 1.0); }
float spLineW(float v, float w) { float d = fwidth(v) * w; return 1.0 - clamp(abs(fract(v - 0.5) - 0.5) / max(d, 1e-5), 0.0, 1.0); }
// Dashes running along a grid line in the downhill direction of that axis' slope component c.
float spFlow(float s, float c) {
  float m = abs(c);
  if (m < 0.0015) return 0.0;
  float speed = clamp(m * 45.0, 0.12, 2.5);
  float t = fract(sign(c) * s / 0.6096 - uTime * speed);
  float head = smoothstep(0.25, 0.95, t) * (1.0 - smoothstep(0.95, 1.0, t));
  return head * clamp(m / 0.008, 0.35, 1.0);
}
vec3 spSlopeCol(float m) {
  float pct = m * 100.0;
  vec3 lo = vec3(0.45, 0.85, 1.0), mid = vec3(1.0, 0.86, 0.3), hi = vec3(1.0, 0.36, 0.25);
  return pct < 2.0 ? mix(lo, mid, smoothstep(0.5, 2.0, pct)) : mix(mid, hi, smoothstep(2.0, 3.2, pct));
}
vec3 spRamp(float t) {
  vec3 c0 = vec3(0.12, 0.30, 0.95), c1 = vec3(0.10, 0.75, 0.90), c2 = vec3(0.30, 0.85, 0.35), c3 = vec3(0.98, 0.85, 0.20), c4 = vec3(0.95, 0.25, 0.15);
  t = clamp(t, 0.0, 1.0) * 4.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  return mix(c3, c4, t - 3.0);
}`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
{
  vec2 p = vSpWorld.xz;
  vec2 d = p - uGreenC;
  vec2 V = vec2(-uGreenU.y, uGreenU.x);
  vec2 q = vec2(dot(d, uGreenU) / uGreenR.x, dot(d, V) / uGreenR.y);
  float ang = atan(q.y, q.x);
  float r = length(q) * (1.0 + uWobble.z * sin(3.0 * ang + uWobble.x) + uWobble.w * sin(5.0 * ang + uWobble.y));
  float gAmt = 1.0 - smoothstep(0.985, 1.0, r);
  float cAmt = 1.0 - smoothstep(1.075, 1.09, r);
  if (uUseMask > 0.5) {
    // real green: signed distance to the surveyed outline (metres, + outside)
    float sd = (texture2D(uMask, (p - uMaskMin) / uMaskSize).r * 255.0 - 128.0) / 20.0;
    gAmt = 1.0 - smoothstep(-0.05, 0.05, sd);
    cAmt = 1.0 - smoothstep(0.85, 1.0, sd);
  }
  vec3 base = mix(uRoughCol, uCollarCol, cAmt);
  base = mix(base, uGreenCol, gAmt);
  // mowing stripes on the green and collar
  float stripe = step(0.5, fract((p.x * 0.7071 + p.y * 0.7071) / 2.4));
  base *= 1.0 + (stripe - 0.5) * 0.07 * cAmt;
  diffuseColor.rgb *= base;
  float elev = vSpWorld.y;
  if (uHeat > 0.5) {
    float t = (elev - uMinH) / max(uMaxH - uMinH, 1e-4);
    diffuseColor.rgb = mix(diffuseColor.rgb, spRamp(t) * 0.85, 0.62 * gAmt);
  }
  if (uContours > 0.5) {
    float lv = elev / uContourStep;
    float minor = spLine(lv);
    float major = spLine(lv / 4.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (minor * 0.35 + major * 0.45) * gAmt);
  }
  if (uGrid > 0.5) {
    float g = max(spLine(p.x / 0.3048), spLine(p.y / 0.3048));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 1.0, 0.95), g * 0.22 * gAmt);
  }
  if (uFlow > 0.5) {
    // Square-style slope lines: lines running along X carry the X part of the slope,
    // lines running along Z carry the Z part. Brighter, faster and warmer = steeper.
    float lineAlongX = spLineW(p.y / 0.3048, 1.8);
    float lineAlongZ = spLineW(p.x / 0.3048, 1.8);
    float cx = -vGrad.x;
    float cz = -vGrad.y;
    diffuseColor.rgb = mix(diffuseColor.rgb, spSlopeCol(abs(cx)), lineAlongX * spFlow(p.x, cx) * gAmt);
    diffuseColor.rgb = mix(diffuseColor.rgb, spSlopeCol(abs(cz)), lineAlongZ * spFlow(p.y, cz) * gAmt);
  }
}`
        );
    };
    this.terrain = new THREE.Mesh(geo, this.terrainMat);
    this.terrain.receiveShadow = true;
    s.add(this.terrain);

    // Ball
    const ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, normalMap: dimpleTexture(), normalScale: new THREE.Vector2(0.5, 0.5) });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS_M, 40, 24), ballMat);
    this.ballMesh.castShadow = true;
    s.add(this.ballMesh);
    this.ballShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(BALL_RADIUS_M * 3.2, BALL_RADIUS_M * 3.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false })
    );
    s.add(this.ballShadow);

    s.add(this.cup, this.pin, this.overlayGroup, this.ringGroup, this.markerGroup);
    this.buildPin();
  }

  private buildPin() {
    const poleH = 2.13;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, poleH, 12),
      new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.4 })
    );
    pole.position.y = poleH / 2 - 0.05;
    pole.castShadow = true;
    const flagGeo = new THREE.PlaneGeometry(0.5, 0.33, 16, 4);
    flagGeo.translate(0.25, poleH - 0.22, 0);
    this.flagBase = Float32Array.from(flagGeo.attributes.position.array as Float32Array);
    this.flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.7, side: THREE.DoubleSide }));
    this.flag.castShadow = true;
    this.pin.add(pole, this.flag);
  }

  private fat(points: THREE.Vector3[], color: string, width: number, opacity = 1, dashed = false): Line2 {
    const g = new LineGeometry();
    g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: opacity < 1, opacity, dashed, dashSize: 0.12, gapSize: 0.08, depthTest: true });
    m.resolution.set(this.container.clientWidth, this.container.clientHeight);
    this.lineMats.push(m);
    const l = new Line2(g, m);
    if (dashed) l.computeLineDistances();
    return l;
  }

  /** Displayed (exaggerated) surface height. */
  private hh(x: number, z: number) {
    return this.surface.height(x, z) * this.exag;
  }

  private drape(x: number, z: number, lift = 0.003) {
    return toThree(x, this.hh(x, z) + lift, z);
  }

  /** Maps a physics sample (true height) onto the displayed surface, keeping any drop below it. */
  private displayY(x: number, y: number, z: number) {
    return this.hh(x, z) + (y - this.surface.height(x, z));
  }

  setExaggeration(e: number) {
    if (e === this.exag) return;
    this.exag = e;
    this.terrainKey = '';
    this.setGreen(this.surface, this.ball, this.holeMult, this.lastOutline);
  }

  /* ------------------------------ public setters ------------------------------ */

  setGreen(surface: PuttingSurface, ball: Vec2, holeMult: number, outline: { anchor?: Vec2; radiusM?: number } = {}) {
    const anchor = outline.anchor ?? ball;
    this.lastOutline = outline;
    const key = `${this.exag}|${surface.label ?? ''}|${surface.difficulty}|${surface.seed}|${surface.stimp}|${anchor.x.toFixed(3)}|${anchor.z.toFixed(3)}|${outline.radiusM ?? 0}`;
    this.surface = surface;
    this.ball = { ...ball };
    this.holeMult = holeMult;
    this.stopPlayback();
    if (key !== this.terrainKey) {
      this.terrainKey = key;
      this.rebuildTerrain(anchor, outline.radiusM);
    }
    this.rebuildCup();
    this.rebuildOverlays();
    this.placeBall(ball.x, this.hh(ball.x, ball.z), ball.z, null);
    this.updatePinVisibility();
    this.resetBeads();
  }

  setOverlays(o: SceneOverlays) {
    this.overlays = { ...o };
    this.terrainUniforms.uGrid.value = o.grid ? 1 : 0;
    this.terrainUniforms.uContours.value = o.contours ? 1 : 0;
    this.terrainUniforms.uHeat.value = o.heatmap ? 1 : 0;
    this.rebuildOverlays();
    this.resetBeads();
  }

  setCameraMode(m: CameraMode) {
    this.cameraMode = m;
    if (m === 'orbit') {
      const d = Math.hypot(this.ball.x, this.ball.z);
      this.orbit = { theta: Math.atan2(this.ball.x, this.ball.z) + Math.PI + 0.5, phi: 0.95, radius: Math.max(5, d * 1.3) };
    }
  }

  setIdealLine(samples: [number, number, number][] | null) {
    if (this.idealLine) {
      this.overlayGroup.remove(this.idealLine);
      this.idealLine.geometry.dispose();
    }
    this.idealLine = null;
    if (!samples || samples.length < 2) return;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < samples.length; i += 2) pts.push(toThree(samples[i][0], this.displayY(samples[i][0], samples[i][1], samples[i][2]) + 0.004, samples[i][2]));
    this.idealLine = this.fat(pts, '#fde047', 3, 0.9);
    this.overlayGroup.add(this.idealLine);
  }

  setRings(rings: RingSpec[]) {
    this.ringGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    this.ringGroup.clear();
    const fx = -this.ball.x;
    const fz = -this.ball.z;
    const fl = Math.hypot(fx, fz) || 1;
    for (const r of rings) {
      const R = r.radiusFt * 0.3048;
      const seg = 96;
      const a0 = r.pastOnly ? Math.atan2(fz / fl, fx / fl) - Math.PI / 2 : 0;
      const span = r.pastOnly ? Math.PI : Math.PI * 2;
      if (r.fill) {
        const inner = HOLE_RADIUS_M * this.holeMult * 1.6;
        const pos: number[] = [];
        const idx: number[] = [];
        for (let i = 0; i <= seg; i++) {
          const a = a0 + (span * i) / seg;
          for (const rad of [inner, R]) {
            const x = Math.cos(a) * rad;
            const z = Math.sin(a) * rad;
            const v = this.drape(x, z, 0.002);
            pos.push(v.x, v.y, v.z);
          }
          if (i < seg) {
            const k = i * 2;
            idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
        this.ringGroup.add(m);
      }
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (span * i) / seg;
        pts.push(this.drape(Math.cos(a) * R, Math.sin(a) * R, 0.004));
      }
      this.ringGroup.add(this.fat(pts, r.color, 2.5, 0.9));
    }
  }

  setMarkers(markers: MarkerSpec[]) {
    this.markerGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    this.markerGroup.clear();
    const geo = new THREE.CircleGeometry(0.03, 20).rotateX(-Math.PI / 2);
    for (const m of markers) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.85, depthWrite: false }));
      mesh.position.copy(this.drape(m.x, m.z, 0.004));
      this.markerGroup.add(mesh);
    }
  }

  /** Start rolling a putt; samples are physics-space contact points every dt seconds. */
  playPutt(samples: [number, number, number][], dt: number, holed: boolean, lipOut: boolean) {
    this.traj = samples;
    this.trajDt = dt;
    this.playT = 0;
    this.playing = true;
    this.dropIndex = holed ? Math.max(0, samples.length - 9) : -1;
    this.dropFired = false;
    this.lipFired = false;
    this.lipIndex = -1;
    if (lipOut) {
      const holeR = HOLE_RADIUS_M * this.holeMult;
      this.lipIndex = samples.findIndex((s) => Math.hypot(s[0], s[2]) < holeR);
    }
    if (this.trail) {
      this.overlayGroup.remove(this.trail);
      this.trail.geometry.dispose();
    }
    const pts = samples.map((s) => toThree(s[0], this.displayY(s[0], s[1], s[2]) + 0.003, s[2]));
    if (pts.length < 2) pts.push(pts[0].clone());
    this.trail = this.fat(pts, '#ffffff', 2.5, 0.75);
    (this.trail.geometry as LineGeometry).instanceCount = 0;
    this.overlayGroup.add(this.trail);
    this.cb.onStrike?.();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.unbindPointer();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* --------------------------------- rebuilds --------------------------------- */

  /** Real greens: bake the outline into a signed-distance texture for the terrain shader. */
  private buildOutlineMask() {
    const U = this.terrainUniforms;
    U.uMask.value?.dispose();
    U.uMask.value = null;
    U.uUseMask.value = 0;
    const poly = this.surface.outline;
    if (!poly || poly.length < 3) return;
    const half = 30;
    const n = 240; // 0.25 m texels
    const data = new Uint8Array(n * n);
    const step = (2 * half) / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        // texel centre in Three coords (X, Z) -> physics (x, z) = (X, -Z)
        const X = -half + (i + 0.5) * step;
        const Z = -half + (j + 0.5) * step;
        const x = X;
        const z = -Z;
        let d2 = Infinity;
        for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
          const ax = poly[m].x, az = poly[m].z, bx = poly[k].x, bz = poly[k].z;
          const ex = bx - ax, ez = bz - az;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
          const dx = x - (ax + ex * t), dz = z - (az + ez * t);
          d2 = Math.min(d2, dx * dx + dz * dz);
        }
        const sd = Math.sqrt(d2) * (insidePoly(x, z, poly) ? -1 : 1);
        data[j * n + i] = Math.max(0, Math.min(255, Math.round(128 + sd * 20)));
      }
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    U.uMask.value = tex;
    U.uMaskMin.value.set(-half, -half);
    U.uMaskSize.value = 2 * half;
    U.uUseMask.value = 1;
  }

  /** Return the ball to its starting spot after a putt, keeping the trail visible. */
  resetBall() {
    this.playing = false;
    this.traj = null;
    this.placeBall(this.ball.x, this.hh(this.ball.x, this.ball.z), this.ball.z, null);
  }

  private rebuildTerrain(anchor: Vec2, radiusM?: number) {
    const pos = this.terrain.geometry.attributes.position as THREE.BufferAttribute;
    const grad = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i);
      const Z = pos.getZ(i);
      const x = X;
      const z = -Z;
      const r = Math.hypot(x, z);
      const fade = r <= FADE_START ? 1 : r >= FADE_END ? 0 : 1 - (r - FADE_START) / (FADE_END - FADE_START);
      const f = fade * fade * (3 - 2 * fade);
      pos.setY(i, this.hh(x, z) * f);
      const g = this.surface.gradient(x, z);
      grad[i * 2] = g.dhdx * f; // dh/dX
      grad[i * 2 + 1] = -g.dhdz * f; // dh/dZ (Three's Z = -physics z)
    }
    pos.needsUpdate = true;
    this.terrain.geometry.setAttribute('aGrad', new THREE.BufferAttribute(grad, 2));
    this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();

    // Green outline: an ellipse around ball + hole (or a round green) with a gentle wobble
    const bx = anchor.x;
    const bz = anchor.z;
    const d = Math.hypot(bx, bz);
    const round = radiusM !== undefined;
    const cx = round ? 0 : bx * 0.42;
    const cz = round ? 0 : bz * 0.42;
    const ux = d > 0.01 ? -bx / d : 0;
    const uz = d > 0.01 ? -bz / d : 1;
    const rnd = mulberry32(this.surface.seed + 11);
    const U = this.terrainUniforms;
    U.uGreenC.value.set(cx, -cz);
    U.uGreenU.value.set(ux, -uz);
    if (round) U.uGreenR.value.set(radiusM, radiusM * 0.92);
    else U.uGreenR.value.set(Math.max(7.5, d * 0.58 + 5.5), Math.max(6.5, 5 + d * 0.15));
    U.uWobble.value.set(rnd() * 6.28, rnd() * 6.28, 0.05 + rnd() * 0.04, 0.02 + rnd() * 0.03);

    this.buildOutlineMask();

    // Heatmap range from the green area
    const outline = this.surface.outline;
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = -16; x <= 16; x += 0.5) {
      for (let z = -16; z <= 16; z += 0.5) {
        const dx = x - cx;
        const dz = z - cz;
        if (outline ? !insidePoly(x, z, outline) : dx * dx + dz * dz > Math.min(16, Math.max(U.uGreenR.value.x, U.uGreenR.value.y)) ** 2) continue;
        const h = this.hh(x, z);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    if (!Number.isFinite(lo) || hi - lo < 0.01) {
      lo = -0.01;
      hi = 0.01;
    }
    U.uMinH.value = lo;
    U.uMaxH.value = hi;
    U.uContourStep.value = Math.min(0.05, Math.max(0.0127, (hi - lo) / 20));

    this.sun.target.position.copy(toThree(cx, 0, cz));
    this.sun.position.copy(this.sun.target.position).add(new THREE.Vector3().setFromSphericalCoords(40, THREE.MathUtils.degToRad(64), THREE.MathUtils.degToRad(235)));
  }

  private rebuildCup() {
    this.cup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    this.cup.clear();
    const R = HOLE_RADIUS_M * this.holeMult;
    const g = this.surface.gradient(0, 0);
    const normal = new THREE.Vector3(-g.dhdx * this.exag, 1, g.dhdz * this.exag).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    const y = this.hh(0, 0);

    const mk = (geo: THREE.BufferGeometry, color: string, lift: number) => {
      const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.quaternion.copy(q);
      m.position.set(0, y + lift, 0);
      return m;
    };
    this.cup.add(mk(new THREE.CircleGeometry(R, 48), '#07120b', 0.0015));
    this.cup.add(mk(new THREE.RingGeometry(R * 0.78, R * 0.96, 48), '#e7ece9', 0.0017));
    this.cup.add(mk(new THREE.RingGeometry(R * 0.6, R * 0.78, 48), '#1a2a20', 0.0016));
    this.pin.position.set(0, y, 0);
  }

  private rebuildOverlays() {
    // keep trail & ideal line; rebuild aim line
    const keep = new Set<THREE.Object3D>([this.trail, this.idealLine].filter(Boolean) as THREE.Object3D[]);
    for (const c of [...this.overlayGroup.children]) {
      if (!keep.has(c)) {
        this.overlayGroup.remove(c);
        (c as THREE.Mesh).geometry?.dispose();
      }
    }
    if (this.overlays.aimLine) {
      const pts: THREE.Vector3[] = [];
      const n = 60;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push(this.drape(this.ball.x * (1 - t), this.ball.z * (1 - t), 0.004));
      }
      this.overlayGroup.add(this.fat(pts, '#7dd3fc', 2, 0.85, true));
    }
  }

  private updatePinVisibility() {
    const d = Math.hypot(this.ball.x, this.ball.z) * 3.28084;
    this.pin.visible = d > 14;
  }

  private resetBeads() {
    this.terrainUniforms.uFlow.value = this.overlays.fallLines && this.surface.difficulty !== 'flat' ? 1 : 0;
  }

  /* ---------------------------------- frame ---------------------------------- */

  private placeBall(x: number, y: number, z: number, travel: THREE.Vector3 | null) {
    const p = toThree(x, y + BALL_RADIUS_M, z);
    if (travel && travel.lengthSq() > 1e-12) {
      const axis = new THREE.Vector3(0, 1, 0).cross(travel).normalize();
      const dq = new THREE.Quaternion().setFromAxisAngle(axis, travel.length() / BALL_RADIUS_M);
      this.ballQuat.premultiply(dq);
      this.ballMesh.quaternion.copy(this.ballQuat);
    }
    this.ballMesh.position.copy(p);
    const surfaceY = this.hh(x, z);
    const below = y < surfaceY - 0.004;
    this.ballShadow.visible = !below;
    this.ballShadow.position.set(p.x, surfaceY + 0.0012, p.z);
  }

  private stopPlayback() {
    this.playing = false;
    this.traj = null;
    if (this.trail) {
      this.overlayGroup.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail = null;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    const now = performance.now();
    const realDt = (now - this.lastT) / 1000;
    const dt = Math.min(0.05, realDt); // for animations that may skip
    this.lastT = now;
    this.frameTimes.push(realDt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();

    // Putt playback in real time
    if (this.playing && this.traj) {
      const prevT = this.playT;
      this.playT += Math.min(realDt, 1); // putts play back in real time at any frame rate
      const n = this.traj.length - 1;
      const fi = Math.min(n, this.playT / this.trajDt);
      const i = Math.floor(fi);
      const f = fi - i;
      const a = this.traj[i];
      const b = this.traj[Math.min(n, i + 1)];
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const z = a[2] + (b[2] - a[2]) * f;
      const pfi = Math.min(n, prevT / this.trajDt);
      const pi = Math.floor(pfi);
      const pa = this.traj[pi];
      const pb = this.traj[Math.min(n, pi + 1)];
      const pf = pfi - pi;
      const px = pa[0] + (pb[0] - pa[0]) * pf;
      const pz = pa[2] + (pb[2] - pa[2]) * pf;
      this.placeBall(x, this.displayY(x, y, z), z, new THREE.Vector3(x - px, 0, -(z - pz)));
      if (this.trail) (this.trail.geometry as LineGeometry).instanceCount = Math.max(0, Math.min(i, this.dropIndex >= 0 ? this.dropIndex : n));
      if (this.dropIndex >= 0 && !this.dropFired && i >= this.dropIndex) {
        this.dropFired = true;
        this.cb.onCupDrop?.();
      }
      if (this.lipIndex >= 0 && !this.lipFired && i >= this.lipIndex) {
        this.lipFired = true;
        this.cb.onLipOut?.();
      }
      if (fi >= n) {
        this.playing = false;
        this.cb.onRollComplete?.();
      }
    }

    // Flag flutter
    if (this.pin.visible) {
      const pos = this.flag.geometry.attributes.position as THREE.BufferAttribute;
      const t = now * 0.001;
      for (let k = 0; k < pos.count; k++) {
        const bx = this.flagBase[k * 3];
        pos.setZ(k, Math.sin(t * 3.1 + bx * 9) * bx * 0.12 + Math.sin(t * 1.7 + bx * 4) * bx * 0.05);
      }
      pos.needsUpdate = true;
    }

    this.terrainUniforms.uTime.value = now / 1000;

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private updateCamera(dt: number) {
    const ball = this.ballMesh.position;
    const hole = toThree(0, this.hh(0, 0), 0);
    const toHole = hole.clone().sub(ball).setY(0);
    const dist = Math.max(0.6, toHole.length());
    const dir = toHole.clone().normalize();
    let wantPos: THREE.Vector3;
    let wantLook: THREE.Vector3;

    switch (this.cameraMode) {
      case 'overhead': {
        const mid = ball.clone().lerp(hole, 0.5);
        const span = dist + 2.5;
        const h = span / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * Math.max(1, 1 / this.camera.aspect) * 0.95;
        wantPos = mid.clone().add(new THREE.Vector3(0, h, 0)).sub(dir.clone().multiplyScalar(h * 0.18));
        wantLook = mid;
        break;
      }
      case 'follow': {
        const back = Math.min(1.6, 0.8 + dist * 0.06);
        wantPos = ball.clone().sub(dir.clone().multiplyScalar(back)).add(new THREE.Vector3(0, 0.55 + dist * 0.02, 0));
        wantLook = ball.clone().add(dir.clone().multiplyScalar(Math.min(dist, 3)));
        break;
      }
      case 'orbit': {
        const { theta, phi, radius } = this.orbit;
        const c = toThree(this.ball.x * 0.5, 0, this.ball.z * 0.5);
        wantPos = new THREE.Vector3(c.x + radius * Math.sin(phi) * Math.sin(theta), c.y + radius * Math.cos(phi), c.z + radius * Math.sin(phi) * Math.cos(theta));
        wantLook = c;
        break;
      }
      default: {
        // Behind the ball, roughly at a reading crouch for short putts, standing for long.
        const startBall = toThree(this.ball.x, this.hh(this.ball.x, this.ball.z), this.ball.z);
        const sdir = hole.clone().sub(startBall).setY(0).normalize();
        const sdist = Math.max(0.6, hole.clone().sub(startBall).setY(0).length());
        const back = 1.1 + sdist * 0.12;
        const height = 0.75 + sdist * 0.07;
        wantPos = startBall.clone().sub(sdir.clone().multiplyScalar(back)).add(new THREE.Vector3(0, height, 0));
        wantLook = startBall.clone().lerp(hole, 0.62);
      }
    }
    const k = this.cameraMode === 'orbit' ? 1 : 1 - Math.exp(-dt * 4);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Jump the camera to its target (no easing), e.g. after a layout change. */
  snapCamera() {
    this.updateCamera(10);
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 1 || h < 1) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.lineMats.forEach((m) => m.resolution.set(w, h));
  }

  /* --------------------------------- pointer --------------------------------- */

  private onDown = (e: PointerEvent) => {
    if (this.cameraMode !== 'orbit') return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.orbit.theta -= dx * 0.006;
    this.orbit.phi = Math.min(1.45, Math.max(0.15, this.orbit.phi - dy * 0.006));
  };
  private onUp = () => {
    this.dragging = false;
  };
  private onWheel = (e: WheelEvent) => {
    if (this.cameraMode !== 'orbit') return;
    e.preventDefault();
    this.orbit.radius = Math.min(40, Math.max(2, this.orbit.radius * (1 + e.deltaY * 0.001)));
  };

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointerleave', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindPointer() {
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointerleave', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
  }
}
