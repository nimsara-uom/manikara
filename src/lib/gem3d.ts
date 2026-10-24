// Shared three.js gem: geometry, material and an offscreen "studio" for still shots.
// Browser-only — import from client components.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Brilliant-style cut: rings of vertices with alternating offsets so facets
// form triangles and kites, not stepped bands. [count, radius, y, angle offset]
const RINGS: [number, number, number, number][] = [
  [1, 0, 0.34, 0], // table centre
  [8, 0.55, 0.34, 0], // table edge
  [8, 0.82, 0.2, Math.PI / 8], // star / crown
  [16, 1, 0.045, 0], // girdle top
  [16, 1, 0, 0], // girdle bottom
  [8, 0.56, -0.44, Math.PI / 8], // pavilion
  [1, 0, -0.9, 0], // culet
];

type V = { a: number; v: [number, number, number] };

export function gemGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const rings: V[][] = RINGS.map(([n, r, y, off]) =>
    Array.from({ length: n }, (_, i) => {
      const a = off + (i / n) * Math.PI * 2;
      return { a, v: [r * Math.cos(a), y, r * Math.sin(a)] as [number, number, number] };
    }));
  const tri = (p: V['v'], q: V['v'], s: V['v']) => pos.push(...p, ...q, ...s);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    if (A.length === 1 || B.length === 1) {
      // Fan to a single point
      const [pt, ring, flip] = A.length === 1 ? [A[0], B, false] : [B[0], A, true];
      ring.forEach((p, i) => {
        const q = ring[(i + 1) % ring.length];
        if (flip) tri(pt.v, p.v, q.v); else tri(pt.v, q.v, p.v);
      });
      continue;
    }
    // Zip two loops together by walking whichever next vertex has the smaller angle
    let i = 0, j = 0;
    const ang = (R: V[], n: number) => R[n % R.length].a + Math.floor(n / R.length) * Math.PI * 2;
    while (i < A.length || j < B.length) {
      const nextA = ang(A, i + 1), nextB = ang(B, j + 1);
      if (j >= B.length || (i < A.length && nextA <= nextB)) { tri(A[i % A.length].v, A[(i + 1) % A.length].v, B[j % B.length].v); i++; }
      else { tri(A[i % A.length].v, B[(j + 1) % B.length].v, B[j % B.length].v); j++; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function gemMaterial(color: string): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    transmission: 0.85, thickness: 1.4, roughness: 0.03, metalness: 0.1, clearcoat: 1,
    ior: 1.77, dispersion: 4, specularIntensity: 1, envMapIntensity: 2.4, flatShading: true,
    attenuationDistance: 0.8, side: THREE.DoubleSide,
  });
  setGemColor(m, color);
  return m;
}

// Tint body + a faint inner glow so the stone stays coloured even where transmission is weak
export function setGemColor(m: THREE.MeshPhysicalMaterial, color: string) {
  const c = new THREE.Color(color);
  m.attenuationColor.copy(c);
  m.color.copy(c);
  m.emissive.copy(c);
  m.emissiveIntensity = 0.3;
}

export function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!, grd = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function environmentFor(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();
  return tex;
}

// One offscreen renderer shared by every still shot, so a page of lots uses a single WebGL context
let studio: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; gem: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> } | null = null;
const shotCache = new Map<string, string>();

function getStudio() {
  if (studio) return studio;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.environment = environmentFor(renderer);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  cam.position.set(0, 1.6, 6.2);
  cam.lookAt(0, -0.15, 0);
  const gem = new THREE.Mesh(gemGeometry(), gemMaterial('#ffffff'));
  scene.add(gem);
  for (const [x, y, z] of [[3, 4, 4], [-3, 3, 2]]) {
    const l = new THREE.PointLight(0xffffff, 30);
    l.position.set(x, y, z);
    scene.add(l);
  }
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(40,30,20,.22)', 'rgba(40,30,20,0)'), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.98;
  scene.add(shadow);
  studio = { renderer, scene, cam, gem };
  return studio;
}

/** Renders a still product shot of a gem and returns it as a JPEG data URL. */
export function shoot(color: string, bg: string, rotY = 0.4, w = 720, h = 900): string {
  const key = [color, bg, rotY, w, h].join('|');
  const hit = shotCache.get(key);
  if (hit) return hit;
  const s = getStudio();
  s.renderer.setSize(w, h);
  s.cam.aspect = w / h;
  s.cam.updateProjectionMatrix();
  s.scene.background = new THREE.Color(bg);
  setGemColor(s.gem.material, color);
  s.gem.rotation.set(0.18, rotY, 0.06);
  s.renderer.render(s.scene, s.cam);
  const url = s.renderer.domElement.toDataURL('image/jpeg', 0.92);
  shotCache.set(key, url);
  return url;
}
