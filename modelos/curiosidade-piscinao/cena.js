import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// "Você construiu um piscinão" — perfil de curiosidades
const TL = await (await fetch('/' + (new URLSearchParams(location.search).get('v') || 'videos/exemplo-piscinao') + '/timeline.json')).json();
for (const w of ['700', '800', '900']) await document.fonts.load(`${w} 60px M`);
window.DURATION = TL.duration;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3);
const eInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const eBack = k => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SEG = Object.fromEntries(TL.segments.map(s => [s.id, s]));
const WORDS = TL.words;
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '');
function WW(seg, text, nth = 0) { const ws = WORDS.filter(w => w.seg === seg && norm(w.w).startsWith(norm(text))); return ws.length ? ws[Math.min(nth, ws.length - 1)].start : SEG[seg].start; }
const S0 = s => SEG[s].start;

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const STORM = new THREE.Color(0x7a8a9e), CLEAR = new THREE.Color(0xa8c8ea);
scene.background = STORM.clone(); scene.fog = new THREE.Fog(0x7a8a9e, 45, 140);
const camera = new THREE.PerspectiveCamera(48, 1080 / 1920, .05, 400);
const hemi = new THREE.HemisphereLight(0xe3ecf7, 0x6b5a48, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-12, 22, 14); scene.add(sun); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 25, bottom: -25, near: 1, far: 80 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .035;

// ---------------------------------------------------------------- utilidades
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .85, ...o });
const emis = (c, i = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i });
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
function blk(x0, x1, y0, y1, z0, z1, m, parent = scene) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); parent.add(b); return b;
}
const M = {
  top: mat(0x7b5235), mid: mat(0x956743), deep: mat(0x6f5d50), grass: mat(0x6fae4f), conc: mat(0xbcc1c6), conc2: mat(0xa9aeb3),
  asph: mat(0x3a3d42), walk: mat(0xd2d1cb), metal: mat(0x7d868f, { metalness: .5, roughness: .4 }), dark: mat(0x1d2024),
};
function soil(x0, x1, y0, y1, z0 = -10, z1 = 0) {
  for (const [a, b, m] of [[-1.8, 1, M.top], [-5, -1.8, M.mid], [-20, -5, M.deep]]) {
    const lo = Math.max(y0, a), hi = Math.min(y1, b);
    if (hi > lo) blk(x0, x1, lo, hi, z0, z1, m);
  }
}
function waterBox(x0, x1, z0, z1, color = 0x3f8fd8) {
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, .5, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, transparent: true, opacity: .78, roughness: .08, metalness: .1 }));
  const xa = x0 + .015, xb = x1 - .015, za = z0 + .015, zb = z1 + .012;
  m.position.set((xa + xb) / 2, 0, (za + zb) / 2); m.scale.set(xb - xa, .001, zb - za); m.userData.water = true; scene.add(m);
  m.userData.set = (y0, h) => { m.position.y = y0 + .006; m.scale.y = Math.max(.001, h - .006); m.visible = h > .015; };
  return m;
}

// ---------------------------------------------------------------- diorama em corte
// rio canalizado x[-16,-10]
soil(-22, -16.4, -9, 0); blk(-22, -16.4, 0, .1, -10, 0, M.grass);
soil(-16.4, -9.6, -9, -4.4);
blk(-16, -10, -4.4, -4, -10, 0, M.conc);
blk(-16.4, -16, -4.4, .3, -10, 0, M.conc);
blk(-10, -9.6, -4.4, -3.4, -10, 0, M.conc); blk(-10, -9.6, -1.8, .3, -10, 0, M.conc); blk(-10, -9.6, -3.4, -1.8, -10, -2.4, M.conc);
// margem + rua + boca de lobo + calçada até o piscinão (galeria em z[-2.4,0], y[-3.4,-1.8])
soil(-9.6, 4.2, -1.8, 0); soil(-9.6, 8, -3.4, -1.8, -10, -2.4); soil(-9.6, 8, -9, -3.4);
soil(4.2, 5, -1.8, 0, -10, -1.6); soil(5, 8, -1.8, 0);
blk(-9.6, -6, 0, .1, -10, 0, M.grass);
const walkL = blk(-6, -4, 0, .2, -10, 0, M.walk);
blk(-4, 4.2, 0, .06, -10, 0, M.asph);
blk(4.2, 5, 0, .06, -10, -1.6, M.asph);
blk(5, 7.6, 0, .2, -10, 0, M.walk); blk(7.6, 8, 0, .1, -10, 0, M.grass);
for (let z = -9.5; z < -1.5; z += 3) blk(-.1, .1, .06, .075, z, z + 1.6, emis(0xf2f2f2, .4));
// revestimento da galeria
blk(-9.6, 8.5, -3.4, -3.34, -2.4, .012, M.conc2); blk(-9.6, 8.5, -1.86, -1.8, -2.4, .012, M.conc2); blk(-9.6, 8.5, -3.34, -1.86, -2.4, -2.36, M.conc2);
blk(4.2, 4.3, -1.8, 0, -1.56, .012, M.conc2); blk(4.9, 5, -1.8, 0, -1.56, .012, M.conc2); blk(4.2, 5, -1.8, 0, -1.6, -1.56, M.conc2);
const grateTop = new THREE.Group(); scene.add(grateTop);
for (let z = -1.5; z < 0; z += .18) blk(4.2, 5, .04, .08, z, z + .07, M.dark, grateTop);
// piscinão x[8.5,17], fundo y=-6
blk(8, 8.5, -6.4, -3.4, -10, 0, M.conc); blk(8, 8.5, -1.8, .3, -10, 0, M.conc); blk(8, 8.5, -3.4, -1.8, -10, -2.4, M.conc);
blk(8.5, 17, -6.4, -6, -10, 0, M.conc);
blk(17, 17.5, -6.4, .3, -10, 0, M.conc); blk(8.5, 17, -6.4, .3, -10.4, -10, M.conc);
soil(8, 17.5, -9, -6.4); soil(17.5, 24, -9, 0); blk(17.5, 24, 0, .1, -10, 0, M.grass);
// terra que vira piscinão (escavação)
const digFill = blk(8.5, 17, -6, 0, -10, 0, M.mid);
// fundo do cenário: terreno + prédios
blk(-30, 30, -.05, 0, -40, -10, mat(0x8fa07e));
{
  const r = rng(3);
  for (let x = -22; x < 26;) {
    const w = 3 + r() * 4, h = 5 + r() * 14, d = 5 + r() * 4;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = ['#d9cfc0', '#c7ccd1', '#e3d3b8', '#b9c2c9'][Math.floor(r() * 4)]; g.fillRect(0, 0, 64, 128);
    for (let yy = 6; yy < 124; yy += 16) for (let xx = 6; xx < 60; xx += 18) { g.fillStyle = r() < .2 ? '#f6e6a6' : '#5e7a92'; g.fillRect(xx, yy, 10, 9); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 6)));
    const side = new THREE.MeshStandardMaterial({ map: tx, roughness: .9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, mat(0x8b9096), mat(0x8b9096), side, side]);
    at(b, x + w / 2, h / 2, -14 - d / 2 - r() * 4); scene.add(b);
    x += w + .6 + r() * 1.5;
  }
}
function tree(s = 1) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.12 * s, .16 * s, 1.4 * s, 6), mat(0x6b4a2e)), 0, .7 * s, 0));
  g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(.9 * s, 0), mat(0x4f9a3f)), 0, 1.9 * s, 0));
  g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(.6 * s, 0), mat(0x5fb24c)), .4 * s, 2.4 * s, .2 * s));
  return g;
}
for (const [x, z] of [[-20, -6], [-18.5, -2], [-8, -7], [20, -5], [22.5, -2]]) scene.add(at(tree(1.1), x, .1, z));
// carros na rua
function car(color) {
  const g = new THREE.Group();
  g.add(at(rbox(1.8, .6, 4.1, .18, mat(color, { roughness: .4, metalness: .2 })), 0, .6, 0));
  g.add(at(rbox(1.55, .55, 2.1, .15, mat(0x2a3542, { roughness: .2 })), 0, 1.12, .2));
  for (const x of [-.85, .85]) for (const z of [-1.3, 1.3]) { const w = at(new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .26, 12), mat(0x111111)), x, .34, z); w.rotation.z = Math.PI / 2; g.add(w); }
  return g;
}
scene.add(at(car(0xd8432e), -2, .06, -4.5)); scene.add(at(car(0x2f6fd6), 2, .06, -8));
// mascote (camiseta amarela)
function person(o = {}) {
  const g = new THREE.Group(); const skin = mat(0xe9a477), shirt = mat(o.shirt ?? 0xffd60a), pants = mat(0x2b3a58);
  for (const s of [-1, 1]) { g.add(at(rbox(.17, .82, .2, .06, pants), s * .11, .41, 0)); g.add(at(rbox(.18, .1, .3, .04, mat(0xf3f3f3)), s * .11, .05, .05)); }
  g.add(at(rbox(.5, .62, .28, .1, shirt), 0, 1.15, 0));
  g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(.24, 1), skin), 0, 1.7, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0x2b1b12)), 0, 1.74, -.02));
  for (const s of [-1, 1]) { g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), mat(0xffffff)), s * .09, 1.74, .21)); g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), mat(0x111111)), s * .09, 1.74, .25)); }
  const arms = [];
  for (const s of [-1, 1]) { const p = at(new THREE.Group(), s * .31, 1.4, 0); g.add(p); p.add(at(rbox(.13, .6, .14, .05, shirt), 0, -.28, 0)); p.add(at(new THREE.Mesh(new THREE.SphereGeometry(.065, 6, 5), skin), 0, -.62, 0)); arms.push(p); }
  g.userData.arms = arms; return g;
}
const mascot = at(person(), -5, .2, -1.2); mascot.scale.setScalar(1.35); scene.add(mascot);
const umbrella = new THREE.Group(); mascot.userData.arms[1].add(at(umbrella, 0, -.62, 0));
umbrella.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.3, 6), M.dark), 0, .6, 0));
umbrella.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.0, .45, 8), mat(0xe0262f)), 0, 1.35, 0));
// sensor e sirene no rio
const sensor = new THREE.Group(); scene.add(at(sensor, -9.8, .3, -1.2));
sensor.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.2, 8), M.metal), 0, 1.1, 0));
sensor.add(at(rbox(.45, .35, .3, .05, mat(0xf2f2f2)), 0, 2.2, 0));
const sensorLed = at(new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), emis(0xff2020, 0)), 0, 2.45, .1); sensor.add(sensorLed);
const siren = new THREE.Group(); scene.add(at(siren, -7.6, .1, -3));
siren.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.2, 8), M.metal), 0, 1.6, 0));
const horn = at(new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 10, 1, true), mat(0xf2c230, { side: THREE.DoubleSide })), .3, 3.1, 0); horn.rotation.z = Math.PI / 2; siren.add(horn);
// árvores e canteiros da cidade-esponja
const sponge = new THREE.Group(); scene.add(sponge);
const bedL = blk(-6, -4, .2, .26, -10, 0, M.grass, sponge), bedR = blk(5, 7.6, .2, .26, -10, -1.8, M.grass, sponge);
const spongeTrees = [];
for (const [x, z] of [[-5, -8], [-5, -4.5], [6.3, -8], [6.3, -4.5]]) { const t = at(tree(.9), x, .26, z); sponge.add(t); spongeTrees.push(t); }
const seep = [];
{ const r = rng(11); for (let i = 0; i < 70; i++) { const d = at(new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), mat(0x58b6ff, { emissive: 0x1d5f99, emissiveIntensity: .5 })), 0, 0, 0); d.userData = { x: r() < .5 ? -6 + r() * 2 : 5 + r() * 2.6, z: -r() * .4, ph: r() }; sponge.add(d); seep.push(d); } }
// estação de bombeamento
const pumps = new THREE.Group(); scene.add(pumps);
for (const z of [-3.2, -5.4]) {
  pumps.add(at(rbox(1.3, 1.1, 1.4, .12, mat(0x2f6fd6, { roughness: .5 })), 9.4, -5.45, z));
  pumps.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, 1.0, 14), mat(0x2a5bb8)), 9.4, -4.4, z));
}
const pumpLed = at(new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), emis(0xff2020, 0)), 9.4, -3.75, -3.2); pumps.add(pumpLed);
const pipePts = [new THREE.Vector3(9.4, -4.2, -4.3), new THREE.Vector3(9.4, .9, -4.3), new THREE.Vector3(6.4, .9, -4.3), new THREE.Vector3(6.4, -2.6, -4.3)];
const pipePath = new THREE.CurvePath(); for (let i = 0; i < 3; i++) pipePath.add(new THREE.LineCurve3(pipePts[i], pipePts[i + 1]));
for (let i = 0; i < 3; i++) {
  const a = pipePts[i], b = pipePts[i + 1], len = a.distanceTo(b);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, len + .2, 10), M.metal);
  p.position.copy(a).add(b).multiplyScalar(.5); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); pumps.add(p);
}
const flowDots = []; for (let i = 0; i < 26; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9fe0ff })); scene.add(d); flowDots.push(d); }
// grade de retenção
const grate = new THREE.Group(); scene.add(grate);
for (let z = -2.3; z <= -.05; z += .24) blk(8.55, 8.68, -3.4, -1.8, z, z + .09, M.dark, grate);
blk(8.5, 8.75, -1.95, -1.8, -2.4, 0, M.dark, grate);
// lixo
const trash = [];
{
  const mk = [() => new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .4, 8), mat(0x6fcf6a, { transparent: true, opacity: .8 })),
    () => new THREE.Mesh(new THREE.IcosahedronGeometry(.2, 0), mat(0xf4f4f4)), () => new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 0), mat(0x2f6fd6)),
    () => new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .35, 8), mat(0xd94a3a)), () => rbox(1.2, .45, .55, .1, mat(0x8a5a3c))];
  for (let i = 0; i < 9; i++) { const o = mk[i === 4 ? 4 : i % 4](); o.userData = { i, ph: i * .37 }; scene.add(o); trash.push(o); }
}
// trator (escavadeira)
const exc = new THREE.Group(); scene.add(exc);
exc.add(at(rbox(2.0, .5, 1.4, .12, M.dark), 0, .25, 0));
exc.add(at(rbox(1.7, .8, 1.3, .12, mat(0xf2b822)), 0, .85, 0));
exc.add(at(rbox(.8, .8, .9, .08, mat(0x2a3542, { roughness: .2 })), -.35, 1.55, 0));
const boom = at(new THREE.Group(), .7, 1.0, 0); exc.add(boom);
boom.add(at(rbox(1.8, .25, .25, .06, mat(0xf2b822)), .9, 0, 0));
const stick = at(new THREE.Group(), 1.8, 0, 0); boom.add(stick);
stick.add(at(rbox(.22, 1.3, .22, .06, mat(0xf2b822)), 0, -.6, 0));
stick.add(at(rbox(.6, .35, .5, .06, M.dark), .15, -1.3, 0));
// mosquitos
const bugs = []; for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 5, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); scene.add(b); bugs.push(b); }
// águas
const wStreet = waterBox(-6, 7.6, -10, 0), wShaft = waterBox(4.3, 4.9, -1.56, 0), wGal = waterBox(-10, 8.5, -2.36, 0), wRiver = waterBox(-16, -10, -10, 0), wPit = waterBox(8.5, 17, -10, 0);
const mud = waterBox(8.5, 17, -10, 0); mud.material = mat(0x6b4a2e); mud.userData.water = false;
const fount = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5), new THREE.MeshStandardMaterial({ color: 0x7fc4ff, transparent: true, opacity: .85 })); scene.add(d); fount.push(d); }
const galDots = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xd6f0ff })); scene.add(d); galDots.push(d); }
// chuva
const RAIN = 2600;
const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(.03, .7, .03), new THREE.MeshBasicMaterial({ color: 0xd9e8ff, transparent: true, opacity: .55 }), RAIN);
rain.frustumCulled = false; scene.add(rain);
const rainSeed = []; { const r = rng(5); for (let i = 0; i < RAIN; i++) rainSeed.push([-22 + r() * 46, -14 + r() * 20, r()]); }
const tmpM = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function setRain(t, k) {
  for (let i = 0; i < RAIN; i++) {
    if (i / RAIN >= k) { rain.setMatrixAt(i, ZERO); continue; }
    const [x, z, p] = rainSeed[i]; const y = 18 - ((t * 24 + p * 18) % 18);
    tmpM.makeTranslation(x + (18 - y) * .05, y, z); rain.setMatrixAt(i, tmpM);
  }
  rain.instanceMatrix.needsUpdate = true;
}
// Pacaembu (cena separada em x=100)
const PX = 100;
const pac = new THREE.Group(); scene.add(pac);
blk(PX - 14, PX + 14, -9, -6.6, -10, 0, M.deep, pac);
blk(PX - 14, PX - 11, -6.6, 0, -10, 0, M.mid, pac); blk(PX + 11, PX + 14, -6.6, 0, -10, 0, M.mid, pac);
blk(PX - 11, PX + 11, -6.6, -6.2, -10, 0, M.conc, pac);
blk(PX - 11, PX + 11, -.6, 0, -10, 0, M.conc2, pac);
blk(PX - 11, PX + 11, -6.6, 0, -10.4, -10, M.conc, pac);
for (let x = PX - 9; x <= PX + 9; x += 3) blk(x - .25, x + .25, -6.2, -.6, -6, -5.5, M.conc, pac);
blk(PX - 14, PX + 14, 0, .25, -10, 0, mat(0xd8d2c4), pac);
const pacCover = blk(PX - 11, PX + 11, -6.2, -.6, -.6, .03, M.mid, pac); pacCover.material = M.mid.clone(); pacCover.material.transparent = true;
const wPac = waterBox(PX - 11, PX + 11, -10, 0); wPac.userData.set(-6.2, 3.6);
{ // estádio ao fundo
  const g = new THREE.Group(); at(g, PX, 0, -32); pac.add(g);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(12, 12, .1, 24), mat(0x4caa48)), 0, .05, 0));
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (.08 + .84 * i / 25) + Math.PI, r = 15;
    for (let k = 0; k < 4; k++) { const s = rbox(3.8, 1.2, 1.6, .1, mat(k % 2 ? 0xe5ddca : 0xd0c7b2)); at(s, Math.cos(a) * (r + k * 1.5), .6 + k * 1.1, Math.sin(a) * (r + k * 1.5)); s.rotation.y = -a + Math.PI / 2; g.add(s); }
  }
  const fac = blk(PX - 8, PX + 8, 0, 7, -14, -12, mat(0xe9dfc8), pac);
  for (let x = -6; x <= 6; x += 2) blk(PX + x - .4, PX + x + .4, 1, 5.5, -11.95, -11.9, mat(0x5e7a92), pac);
  for (let i = 0; i < 10; i++) { const p = person({ shirt: [0xe0262f, 0x2f6fd6, 0x18a058, 0xf2b822][i % 4] }); at(p, PX - 8 + i * 1.7, .25, -3 - (i % 3) * 2); pac.add(p); }
}

scene.traverse(o => { if (o.isMesh && o !== rain && !o.userData.water) { o.castShadow = true; o.receiveShadow = true; } });

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const UI = Object.fromEntries(['dim', 'p1', 'p2', 'num', 'pools', 'poolstxt', 'title', 'endc', 'cover', 'cap'].map(i => [i, $(i)]));
{ const p = $('pools'); for (let i = 0; i < 360; i++) p.appendChild(document.createElement('b')); }
const poolEls = [...$('pools').children];
function show(el, on, st) { el.style.display = on ? (el.id === 'pools' ? 'flex' : 'block') : 'none'; if (on && st) Object.assign(el.style, st); }
const pop = (t, t0, d = .28) => { const k = clamp((t - t0) / d); return { opacity: String(clamp(k * 2.5)), transform: `scale(${lerp(.6, 1, eBack(k))})` }; };
const tmpV = new THREE.Vector3();
function project(v) { tmpV.copy(v).project(camera); return { x: (tmpV.x + 1) / 2 * 1080, y: (1 - tmpV.y) / 2 * 1920 }; }
function pill(el, txt, color, pos3, t, t0, dy = -150) {
  if (t < t0) return;
  const q = project(pos3); el.querySelector('span').textContent = txt; el.querySelector('i').style.background = color;
  const w = 60 + txt.length * 30;
  show(el, true, { left: `${clamp(q.x - w / 2, 40, 1040 - w)}px`, top: `${clamp(q.y + dy, 160, 1060)}px`, ...pop(t, t0) });
}
const HL = { s2: ['rio'], s3: ['boca', 'lobo'], s4: ['galerias'], s5: ['sobe', 'enche', 'volta'], s6: ['piscinao'], s7: ['escondido', 'pacaembu'], s8: ['novecentos', 'milhoes', 'trezentas', 'sessenta'],
  s9: ['sozinha'], s10: ['bombas', 'estacao', 'bombeamento'], s11: ['trava', 'sofa'], s12: ['grade', 'retencao'], s13: ['raso'], s14: ['lama', 'desassoreamento'], s15: ['lixo', 'mosquito'], s16: ['cidade-esponja', 'arvores'], s17: ['sensor', 'sirene', 'guarda-chuva'], s18: ['parabens', 'piscinao'] };
const capSpan = UI.cap.querySelector('span');
function caption(t, sh) {
  if (sh === 'end' || sh === 'parabens') return show(UI.cap, false);
  let cur = null;
  for (let i = 0; i < WORDS.length; i++) { const w = WORDS[i], nx = WORDS[i + 1]; const end = nx && nx.start - w.end < .5 ? nx.start : w.end + .22; if (t >= w.start - .02 && t < end) { cur = w; break; } }
  if (!cur) return show(UI.cap, false);
  const txt = cur.w.replace(/[.,!?:;]/g, '');
  capSpan.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
  capSpan.style.color = (HL[cur.seg] || []).includes(norm(txt)) ? '#FFD60A' : '#fff';
  capSpan.style.transform = `scale(${lerp(1.18, 1, clamp((t - cur.start) / .09))})`;
  show(UI.cap, true);
}
function setCam(pos, look, fov, t) {
  camera.position.copy(pos); camera.position.x += Math.sin(t * .9) * .03; camera.position.y += Math.sin(t * 1.3) * .02;
  camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function camMove(t, S, p0, p1, l0, l1, f0, f1) { const k = eInOut((t - S.t0) / (S.t1 - S.t0)); setCam(p0.clone().lerp(p1, k), l0.clone().lerp(l1, k), lerp(f0, f1, k), t); }

// ---------------------------------------------------------------- cenas
const SHOTS = [['hook', 0], ['boca', S0('s3') - .1], ['galeria', S0('s4') - .1], ['cheia', S0('s5') - .1], ['piscinao', S0('s6') - .1], ['pacaembu', S0('s7') - .1], ['jabot', S0('s8') - .1],
  ['stuck', S0('s9') - .1], ['bombas', S0('s10') - .1], ['lixo', S0('s11') - .1], ['grade', S0('s12') - .1], ['lama', S0('s13') - .1], ['trator', S0('s14') - .1], ['abandono', S0('s15') - .1],
  ['esponja', S0('s16') - .1], ['final', S0('s17') - .1], ['parabens', S0('s18') - .1], ['end', S0('s19') - .1]];
function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[1]) s = x; const i = SHOTS.indexOf(s); return { name: s[0], t0: s[1], t1: i + 1 < SHOTS.length ? SHOTS[i + 1][1] : TL.duration }; }

function flowDotsGal(t, on, dir = -1, x0 = 4.6, x1 = -9.6) {
  galDots.forEach((d, i) => {
    d.visible = on; if (!on) return;
    const p = ((t * .35 + i / galDots.length) % 1);
    d.position.set(lerp(x0, x1, p), -3.3 + ((i * 7) % 5) * .1, -.3 - ((i * 13) % 9) * .22);
  });
}
function fountain(t, k) {
  fount.forEach((d, i) => {
    d.visible = k > .02; if (!d.visible) return;
    const p = ((t * 1.4 + i / fount.length) % 1), a = i * 2.39;
    d.position.set(4.6 + Math.cos(a) * p * .6, .1 + (p * 2.2 - p * p * 2.0) * k, -.8 + Math.sin(a) * p * .6);
  });
}

window.renderAt = function (t) {
  const S = shotAt(t), sh = S.name;
  // estado base
  let rainK = .9, sky = 0, flood = 0, shaft = 0, gal = .35, river = 1.4, pit = 0, mudH = 0, fountK = 0;
  digFill.visible = false; pumps.visible = false; grate.visible = false; exc.visible = false; sponge.visible = false;
  sensor.visible = false; siren.visible = false; umbrella.visible = false; grateTop.visible = true;
  trash.forEach(o => o.visible = false); bugs.forEach(b => b.visible = false); flowDots.forEach(d => d.visible = false); galDots.forEach(d => d.visible = false);
  wPit.material.color.setHex(0x3f8fd8); pumpLed.material.emissiveIntensity = 0; sensorLed.material.emissiveIntensity = 0;
  mascot.userData.arms[0].rotation.set(0, 0, -.1); mascot.userData.arms[1].rotation.set(0, 0, .1); mascot.rotation.y = 0;
  pacCover.material.opacity = 1; pacCover.visible = true;
  for (const id of ['dim', 'p1', 'p2', 'num', 'pools', 'poolstxt', 'title', 'endc', 'cover']) show(UI[id], false);
  canvas.style.filter = 'none';

  if (sh === 'hook') {
    flood = lerp(.05, .5, eInOut((t - .3) / (WW('s2', 'rio') - .1)));
    camMove(t, S, V(.5, 5.2, 13), V(.8, 4.0, 10.8), V(-.5, -.4, -4), V(-.3, -.3, -4), 54, 52);
    mascot.rotation.y = .5; mascot.userData.arms[0].rotation.z = -.6; mascot.userData.arms[1].rotation.z = .6;
  }
  else if (sh === 'boca') {
    const te = WW('s3', 'engole'); flood = lerp(.35, .04, eInOut((t - te) / 3)); shaft = lerp(0, 1.0, eOut((t - te) / 1.5)); gal = .35;
    camMove(t, S, V(8.6, 3.2, 6.2), V(7.4, 2.3, 4.6), V(4.6, -.7, -.8), V(4.6, -.9, -.8), 50, 46);
    pill(UI.p1, 'BOCA DE LOBO', '#FFD60A', V(4.6, .2, -.8), t, WW('s3', 'boca'));
    flowDotsGal(t, true, -1, 4.6, 4.6);
  }
  else if (sh === 'galeria') {
    flood = .1; shaft = .6; gal = .55;
    camMove(t, S, V(5, -2.2, 7), V(-7.5, -2.2, 8.5), V(4.6, -2.6, -1.2), V(-10.5, -2.4, -1.2), 50, 52);
    flowDotsGal(t, true);
    pill(UI.p1, 'GALERIA', '#FFD60A', V(camera.position.x, -1.9, -1), t, WW('s4', 'galerias'), -170);
    pill(UI.p2, 'RIO', '#3fa9ff', V(-13, -1, -1), t, WW('s4', 'rio'), -120);
  }
  else if (sh === 'cheia') {
    const tsob = WW('s5', 'sobe'), ten = WW('s5', 'enche'), tvol = WW('s5', 'volta');
    river = lerp(1.4, 4.1, eInOut((t - tsob + .6) / 1.8)); gal = lerp(.55, 1.6, eInOut((t - ten) / 1.4));
    shaft = gal >= 1.55 ? lerp(.6, 1.8, eOut((t - tvol) / .6)) : .6; fountK = ss(tvol - .1, tvol + .5, t);
    flood = lerp(.1, .45, ss(tvol, tvol + 2, t)); rainK = 1;
    { const k2 = eInOut((t - (tvol - 1.3)) / 1.1);
      setCam(V(-11.5, .2, 12).lerp(V(5.8, 2.6, 9.5), k2), V(-11, -2.2, -2).lerp(V(4.6, -.2, -1), k2), lerp(52, 50, k2), t); }
    flowDotsGal(t, t < ten + 1);
    pill(UI.p1, 'TRANSBORDA', '#ff3b3b', V(4.6, 1.5, -.8), t, tvol, -160);
  }
  else if (sh === 'piscinao') {
    const tc = WW('s6', 'cava'), tp = WW('s6', 'segura');
    digFill.visible = t < tc + 1.4; digFill.scale.y = 1 - eInOut((t - tc) / 1.3); digFill.position.y = -6 + 3 * digFill.scale.y; if (digFill.scale.y < .01) digFill.visible = false;
    pit = lerp(0, 3.6, eInOut((t - tp) / 3.5)); gal = lerp(1.6, .7, ss(tp, tp + 3, t)); river = lerp(4.1, 3.2, ss(tp, tp + 4, t)); flood = lerp(.45, .05, ss(tp, tp + 3, t));
    camMove(t, S, V(11, 3.5, 21), V(12.5, 2.4, 19), V(11.5, -2.6, -3), V(12.5, -3, -3), 52, 50);
    flowDotsGal(t, t > tp, 1, 4.6, 9.5);
    pill(UI.p1, 'PISCINÃO', '#FFD60A', V(12.8, -1.5, -2), t, WW('s6', 'piscinao'));
  }
  else if (sh === 'pacaembu') {
    const te = WW('s7', 'embaixo'), tesc = WW('s7', 'escondido');
    pacCover.material.opacity = 1 - eInOut((t - te) / 1.4);
    pacCover.visible = pacCover.material.opacity > .02;
    camMove(t, S, V(PX + 1, 9, 22), V(PX, .5, 16), V(PX, 1.5, -12), V(PX, -3, -3), 50, 54);
    pill(UI.p1, 'PRAÇA DO PACAEMBU · SP', '#3fa9ff', V(PX, 1.5, -2), t, WW('s7', 'pacaembu'), -170);
    pill(UI.p2, 'PISCINÃO ESCONDIDO', '#FFD60A', V(PX, -3, -1), t, tesc, -90);
  }
  else if (sh === 'jabot') {
    pit = 5.2; rainK = .5; gal = .8; river = 3;
    camMove(t, S, V(12.5, 4, 22), V(12.5, 3.2, 20.5), V(12.5, -3, -4), V(12.5, -3, -4), 52, 50);
    show(UI.dim, true, { opacity: '1' });
    const tn = WW('s8', 'novecentos'), tt = WW('s8', 'trezentas');
    show(UI.num, t > tn - .1, pop(t, tn - .1));
    $('numn').textContent = Math.round(900 * eOut((t - tn) / 1.2)).toLocaleString('pt-BR') + ' MILHÕES';
    if (t > tt - .2) {
      show(UI.pools, true); const n = Math.floor(360 * eOut((t - tt + .2) / 1.6));
      poolEls.forEach((b, i) => b.style.opacity = i < n ? '1' : '0');
      show(UI.poolstxt, t > tt + .9, pop(t, tt + .9));
    }
  }
  else if (sh === 'stuck') {
    rainK = 0; pit = 2.35; gal = lerp(.6, .08, ss(S.t0, S.t0 + 2, t)); river = 2.4; flood = 0; shaft = 0;
    camMove(t, S, V(9.5, -1, 10.5), V(10.2, -1.4, 9.2), V(10.5, -3.8, -3), V(10.8, -4, -3), 50, 48);
    pill(UI.p1, 'NÃO SAI SOZINHA', '#ff3b3b', V(12, -3.4, -2), t, WW('s9', 'sozinha'), -140);
  }
  else if (sh === 'bombas') {
    rainK = 0; river = 2.2; gal = .25; shaft = 0;
    const tb = WW('s10', 'bombas'), td = WW('s10', 'devolvem');
    pumps.visible = t > tb - .1; pumps.scale.setScalar(1); pumps.position.y = lerp(3, 0, eOut((t - tb + .1) / .5));
    pit = lerp(2.35, .8, eInOut((t - td) / 4));
    flowDots.forEach((d, i) => { d.visible = t > td; if (d.visible) d.position.copy(pipePath.getPointAt((t * .5 + i / flowDots.length) % 1)); });
    camMove(t, S, V(12, 1.5, 11.5), V(11, 1.2, 10.5), V(9, -2.5, -4), V(8.6, -2, -4), 52, 50);
    pill(UI.p1, 'ESTAÇÃO DE BOMBEAMENTO', '#2f6fd6', V(9.4, -2.2, -3), t, WW('s10', 'estacao'), -180);
  }
  else if (sh === 'lixo') {
    rainK = .6; pumps.visible = true; pit = 1.2; gal = .7; river = 2.6;
    const tt = WW('s11', 'trava');
    trash.forEach((o, i) => {
      o.visible = true; const p = clamp((t - S.t0 - i * .35) / 3.2);
      if (p < .7) o.position.set(lerp(3.5, 8.4, p / .7), -2.9 + Math.sin(t * 3 + i) * .05, -.4 - (i % 4) * .45);
      else o.position.set(lerp(8.4, 9.9, (p - .7) / .3), lerp(-2.9, -6 + 1.2 + .2, (p - .7) / .3), lerp(-.4 - (i % 4) * .45, -2.6 - (i % 3) * .5, (p - .7) / .3));
      o.rotation.set(t * .7 + i, t * .5, i);
    });
    pumpLed.material.emissiveIntensity = t > tt ? (Math.floor(t * 4) % 2 ? 6 : 0) : 0;
    camMove(t, S, V(6.5, -.8, 8), V(7.5, -1.3, 7.5), V(8.2, -3.2, -1.6), V(9, -3.6, -2), 50, 48);
    flowDotsGal(t, true, 1, 3.5, 8.4);
    pill(UI.p1, 'TRAVOU', '#ff3b3b', V(9.4, -3.6, -3.2), t, tt, -130);
  }
  else if (sh === 'grade') {
    rainK = .6; pumps.visible = true; pit = 1.2; gal = .7; river = 2.6;
    const tg = WW('s12', 'grade'), tr = WW('s12', 'retencao');
    grate.visible = t > tg - .1; grate.position.y = lerp(1.6, 0, eOut((t - tg + .1) / .45));
    trash.forEach((o, i) => {
      o.visible = true; const p = clamp((t - S.t0 - i * .3) / 2.6);
      o.position.set(lerp(4.5, 8.2 - (i % 3) * .3, eOut(p)), -2.9 + Math.sin(t * 3 + i) * .05, -.4 - (i % 4) * .45);
      o.rotation.set(i + p * 3, i * .5, i);
    });
    camMove(t, S, V(6.8, -1, 7.4), V(7.2, -1.4, 6.6), V(8.3, -2.8, -1.4), V(8.5, -2.8, -1.4), 48, 44);
    flowDotsGal(t, true, 1, 3.5, 9.4);
    pill(UI.p1, 'GRADE DE RETENÇÃO', '#FFD60A', V(8.6, -1.6, -1), t, tr, -150);
  }
  else if (sh === 'lama') {
    rainK = 0; pumps.visible = true; grate.visible = true; river = 2.2; gal = .15;
    mudH = lerp(.15, 1.3, eInOut((t - S.t0) / (S.t1 - S.t0))); pit = mudH + .35;
    camMove(t, S, V(13, 1, 14), V(13, .4, 12.5), V(13, -5, -4), V(13, -5, -4), 50, 48);
    pill(UI.p1, 'LAMA', '#8a5a3c', V(13.5, -5, -2), t, WW('s13', 'raso'), -140);
  }
  else if (sh === 'trator') {
    rainK = 0; pumps.visible = true; grate.visible = true; river = 2; gal = .1;
    const tt = WW('s14', 'tratores');
    mudH = lerp(1.3, .25, eInOut((t - tt - .5) / (S.t1 - tt - 1))); pit = Math.max(0, mudH - .1);
    exc.visible = t > tt - .1; exc.position.set(lerp(19, 13.5, eOut((t - tt + .1) / 1.0)), -6 + mudH, -5); exc.rotation.y = Math.PI;
    boom.rotation.z = -.35 + Math.sin(t * 2.2) * .25; stick.rotation.z = -.4 + Math.sin(t * 2.2 + 1) * .35;
    camMove(t, S, V(13, 1.2, 13), V(12.5, .6, 11.5), V(13, -4.8, -4), V(13, -4.8, -4), 50, 48);
    pill(UI.p1, 'DESASSOREAMENTO', '#FFD60A', V(13.5, -3.5, -4), t, WW('s14', 'desassoreamento'), -160);
  }
  else if (sh === 'abandono') {
    rainK = 0; pumps.visible = true; grate.visible = true; river = 2; mudH = .6; pit = 1.6;
    wPit.material.color.setHex(0x5f8f45);
    trash.forEach((o, i) => { o.visible = true; o.position.set(10 + (i * 1.7) % 6.5, -6 + pit + .05 + Math.sin(t * 2 + i) * .03, -1 - (i * 2.3) % 7); o.rotation.set(0, t * .2 + i, 0); });
    bugs.forEach((b, i) => { b.visible = true; b.position.set(10.5 + (i * 1.37) % 6 + Math.sin(t * 7 + i) * .3, -3.6 + Math.sin(t * 5 + i * 2) * .4, -1 - (i * 2.1) % 6); });
    camMove(t, S, V(12.5, -.2, 7.5), V(12.8, -.6, 6.8), V(13, -4.4, -3), V(13, -4.4, -3), 50, 46);
  }
  else if (sh === 'esponja') {
    rainK = .8; pumps.visible = true; grate.visible = true; sponge.visible = true; flood = 0; gal = .2; river = 2;
    const tp = WW('s16', 'planta'), tc = WW('s16', 'canteiros'), te = WW('s16', 'entrar');
    spongeTrees.forEach((tr, i) => tr.scale.setScalar(Math.max(.001, eBack((t - tp - i * .12) / .5))));
    bedL.visible = bedR.visible = t > tc - .1;
    seep.forEach(d => { d.visible = t > te - .3; if (!d.visible) return; const p = (t * .45 + d.userData.ph) % 1; d.position.set(d.userData.x, lerp(.15, -1.7, p), d.userData.z); });
    camMove(t, S, V(.5, 3.6, 13.5), V(.5, 2.6, 12), V(.5, -.6, -3), V(.5, -.8, -3), 54, 52);
    pill(UI.p1, 'CIDADE-ESPONJA', '#18c964', V(.5, 2, -3), t, WW('s16', 'cidade'), -150);
  }
  else if (sh === 'final') {
    rainK = .7; sponge.visible = true; spongeTrees.forEach(tr => tr.scale.setScalar(1)); bedL.visible = bedR.visible = true; river = 2.6;
    const ts = WW('s17', 'sensor'), tsi = WW('s17', 'sirene'), tg = WW('s17', 'guarda');
    sensor.visible = t > ts - .1; sensor.scale.setScalar(Math.max(.001, eBack((t - ts + .1) / .4))); sensorLed.material.emissiveIntensity = Math.floor(t * 3) % 2 ? 5 : .5;
    siren.visible = t > tsi - .1; siren.scale.setScalar(Math.max(.001, eBack((t - tsi + .1) / .4)));
    umbrella.visible = t > tg - .1; umbrella.scale.setScalar(Math.max(.001, eBack((t - tg + .1) / .4)));
    if (umbrella.visible) { mascot.userData.arms[1].rotation.z = 2.6; mascot.userData.arms[1].rotation.x = -.2; }
    mascot.rotation.y = -.25;
    camMove(t, S, V(-5.5, 3.2, 10), V(-6.2, 2.6, 8.5), V(-7, 1.4, -2), V(-7, 1.4, -2), 50, 48);
  }
  else if (sh === 'parabens') {
    rainK = 0; sky = 1; sponge.visible = true; bedL.visible = bedR.visible = true; spongeTrees.forEach(tr => tr.scale.setScalar(1));
    pumps.visible = true; grate.visible = true; sensor.visible = siren.visible = true; sensor.scale.setScalar(1); siren.scale.setScalar(1);
    umbrella.visible = true; umbrella.scale.setScalar(1); mascot.userData.arms[1].rotation.z = 2.6; river = 2; pit = .8; gal = .15;
    camMove(t, S, V(6, 3.2, 25), V(5, 2.6, 22), V(5, -2, -3), V(5, -2.2, -3), 56, 56);
    show(UI.title, true, pop(t, S.t0 + .05, .35));
  }
  else if (sh === 'end') {
    show(UI.endc, true, { opacity: String(ss(S.t0, S.t0 + .3, t)) });
    camMove(t, S, V(5, 2.6, 22), V(5, 2.6, 22), V(5, -2.2, -3), V(5, -2.2, -3), 56, 56);
  }

  // aplica níveis
  wStreet.userData.set(.06, flood); wShaft.userData.set(-1.8, shaft); wGal.userData.set(-3.4, gal); wRiver.userData.set(-4, river); wPit.userData.set(-6, pit); mud.userData.set(-6, mudH);
  fountain(t, fountK);
  setRain(t, rainK);
  scene.background.copy(STORM).lerp(CLEAR, sky); scene.fog.color.copy(scene.background);
  sun.intensity = lerp(1.3, 2.4, sky); hemi.intensity = lerp(1.5, 1.9, sky);
  caption(t, sh);
  if (window.COVER) { for (const id of ['dim', 'p1', 'p2', 'num', 'pools', 'poolstxt', 'title', 'endc', 'cap']) show(UI[id], false); show(UI.cover, true); }
  renderer.render(scene, camera);
};
for (const tt of [1, 20, 40, 60, 80, 100]) window.renderAt(tt);
window.READY = true;
