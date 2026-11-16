import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- dados e utilidades
const TL = await (await fetch('/' + (new URLSearchParams(location.search).get('v') || 'videos/exemplo-mala-parte1') + '/timeline.json')).json();
for (const w of ['600', '700', '800', '900']) await document.fonts.load(`${w} 60px M`);
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
function WW(seg, text, nth = 0) {
  const ws = WORDS.filter(w => w.seg === seg && norm(w.w).startsWith(norm(text)));
  return ws.length ? ws[Math.min(nth, ws.length - 1)].start : SEG[seg].start;
}

// cortes de cena (derivados da narração)
const C = {
  s2: SEG.s2.start - 0.12, s3: SEG.s3.start - 0.06, s4: SEG.s4.start - 0.08, s5: SEG.s5.start - 0.12,
  s6m: SEG.s7.start - 0.1, s6r: SEG.s10.start - 0.08, s7: SEG.s11.start - 0.12, s8: SEG.s14.start - 0.12,
  s9a: SEG.s17.start - 0.12, s9b: SEG.s18.start - 0.1, s10: SEG.s19.start - 0.12,
};
const SHOTS = [['hook', 0], ['ext', C.s2], ['front', C.s3], ['floor', C.s4], ['pov', C.s5], ['mirror', C.s6m],
  ['radio', C.s6r], ['phone', C.s7], ['map', C.s8], ['chase', C.s9a], ['rear', C.s9b], ['choice', C.s10]];
function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[1]) s = x; const i = SHOTS.indexOf(s); return { name: s[0], t0: s[1], t1: i + 1 < SHOTS.length ? SHOTS[i + 1][1] : TL.duration }; }

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1080, 1920, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const SKY = new THREE.Color(0x0a1022);
scene.background = SKY;
scene.fog = new THREE.Fog(0x0a1022, 55, 190);
const camera = new THREE.PerspectiveCamera(45, 1080 / 1920, 0.02, 500);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(1080, 1920);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(540, 960), 0.75, 0.55, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- texturas
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); draw(g, w, h);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  tx.userData.ctx = g; return tx;
}
const glowTex = canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
function windowTex(seed) {
  const r = rng(seed);
  return canvasTex(128, 256, (g) => {
    g.fillStyle = '#121620'; g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) {
      const lit = r() < 0.38;
      g.fillStyle = lit ? ['#ffcf6e', '#ffe2a3', '#ffd890', '#a9d6ff'][Math.floor(r() * 4)] : '#1b2130';
      g.fillRect(8 + x * 30, 6 + y * 16, 20, 10);
    }
  });
}
const noteTex = canvasTex(256, 120, (g) => {
  const gr = g.createLinearGradient(0, 0, 256, 120); gr.addColorStop(0, '#3f7fbf'); gr.addColorStop(1, '#7db6e6');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 120);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(8, 8, 240, 104);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '900 54px M'; g.fillText('100', 20, 70);
  g.beginPath(); g.arc(190, 60, 30, 0, 7); g.fillStyle = 'rgba(20,50,90,.35)'; g.fill();
});
const edgeTex = canvasTex(64, 32, (g) => {
  for (let y = 0; y < 32; y += 2) { g.fillStyle = y % 4 ? '#dfe8e0' : '#b9c7c0'; g.fillRect(0, y, 64, 2); }
});
const phoneTex = canvasTex(128, 256, (g) => {
  g.fillStyle = '#0e1b2e'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#e8f3ff'; g.font = '800 34px M'; g.fillText('23:52', 22, 70);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.roundRect(10, 120, 108, 54, 12); g.fill();
  g.fillStyle = '#123'; g.font = '700 16px M'; g.fillText('Nova mensagem', 18, 152);
});
const eyesTex = canvasTex(512, 150, () => {});
function drawEyes(look, brow) {
  const g = eyesTex.userData.ctx;
  const bg = g.createLinearGradient(0, 0, 0, 150); bg.addColorStop(0, '#3a2a22'); bg.addColorStop(1, '#a8714b');
  g.fillStyle = '#20242c'; g.fillRect(0, 0, 512, 150);
  g.fillStyle = '#b77b52'; g.beginPath(); g.ellipse(256, 120, 230, 120, 0, 0, 7); g.fill();
  for (const ex of [176, 336]) {
    g.fillStyle = '#f6f2ea'; g.beginPath(); g.ellipse(ex, 92, 52, 30, 0, 0, 7); g.fill();
    const px = ex + lerp(-26, 12, look), py = 92 + lerp(-10, 2, look);
    g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(px, py, 20, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px + 6, py - 7, 5, 0, 7); g.fill();
    // pálpebra superior (desce quando desconfia)
    g.fillStyle = '#9a6442'; g.beginPath(); g.ellipse(ex, 92 - 30 + brow * 16, 56, 22 + brow * 6, 0, Math.PI, 0); g.fill();
    // sobrancelha
    g.strokeStyle = '#1a120d'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath();
    const tilt = (ex < 256 ? 1 : -1) * brow * 16;
    g.moveTo(ex - 50, 40 + brow * 10 - tilt); g.lineTo(ex + 50, 40 + brow * 10 + tilt); g.stroke();
  }
  eyesTex.needsUpdate = true;
}
const radioTex = canvasTex(256, 96, () => {});
function drawRadio(vol) {
  const g = radioTex.userData.ctx;
  g.fillStyle = '#031116'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#5ff2ff'; g.font = '800 30px M'; g.fillText('FM 98,1', 16, 40);
  const n = 14;
  for (let i = 0; i < n; i++) { g.fillStyle = i / n < vol ? (i > 10 ? '#ff5a5a' : '#5ff2ff') : '#0d2a33'; g.fillRect(16 + i * 16, 60 - i * 1.2, 11, 22 + i * 1.2); }
  radioTex.needsUpdate = true;
}

// ---------------------------------------------------------------- materiais e geometrias
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .85, metalness: 0, ...o });
const emis = (c, i = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const rbox = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function glowSprite(color, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(scale); return s;
}

// ---------------------------------------------------------------- luzes
scene.add(new THREE.HemisphereLight(0x7088cc, 0x0c0f16, 1.25));
const moon = new THREE.DirectionalLight(0xa9bcff, 1.1); moon.position.set(-30, 40, 20); scene.add(moon);
const passLight = new THREE.PointLight(0xffa64d, 0, 0, 2); scene.add(passLight);
const dashLight = new THREE.PointLight(0x48d8ff, 0, 2.5, 2); scene.add(dashLight);
const phoneLight = new THREE.PointLight(0xbfe6ff, 0, 1.6, 2); scene.add(phoneLight);
const inAmb = new THREE.AmbientLight(0x8a9cc8, 0); scene.add(inAmb);
const keyLight = new THREE.PointLight(0xffd6a8, 0, 0, 2); scene.add(keyLight);
const dbgLight = new THREE.AmbientLight(0xffffff, 0); scene.add(dbgLight);
const beamLight = new THREE.PointLight(0xfff4dc, 0, 0, 2); scene.add(beamLight);

// ---------------------------------------------------------------- mundo (rua à noite)
const world = new THREE.Group(); scene.add(world);
const SPEED = 13, ZMIN = -220, PERIOD = 280;
const scrollers = [];
function scroll(o, speedMul = 1) { o.userData.z0 = o.position.z; o.userData.sm = speedMul; scrollers.push(o); world.add(o); return o; }
world.add(at(box(16, .1, 600, mat(0x1a1d23)), 0, -.05, -150));
for (const s of [-1, 1]) world.add(at(box(3, .3, 600, mat(0x343842)), s * 10, .1, -150));
world.add(at(box(.14, .02, 600, emis(0xd9a400, .6)), -.12, .01, -150));
world.add(at(box(.14, .02, 600, emis(0xd9a400, .6)), .12, .01, -150));
for (let z = 40; z > ZMIN; z -= 7) for (const x of [-3.5, 3.5]) scroll(at(box(.16, .02, 2.6, emis(0xcfd3da, .5)), x, .015, z));
{ // prédios
  const r = rng(7); const texs = [11, 12, 13, 14, 15].map(windowTex);
  for (const s of [-1, 1]) for (let z = 50; z > ZMIN - 30;) {
    const len = 8 + r() * 9, h = 9 + r() * 34, d = 9 + r() * 6;
    const tx = texs[Math.floor(r() * texs.length)].clone(); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(Math.round(len / 4), Math.round(h / 8)); tx.needsUpdate = true;
    const side = new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: .9, roughness: .9 });
    const top = mat(0x0f121a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, len), [side, side, top, top, side, side]);
    scroll(at(b, s * (11.6 + d / 2), h / 2, z - len / 2));
    z -= len + 1 + r() * 3;
  }
}
for (let z = 30; z > ZMIN; z -= 18) for (const s of [-1, 1]) { // postes
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, 6.5, 6), mat(0x2b2f37)), 0, 3.25, 0));
  g.add(at(box(1.6, .1, .12, mat(0x2b2f37)), -s * .8, 6.4, 0));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), emis(0xffc070, 6)), -s * 1.5, 6.25, 0));
  g.add(at(glowSprite(0xffb35c, 3.2, .8), -s * 1.5, 6.2, 0));
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9c40, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; g.add(at(pool, -s * 2, .03, 0));
  scroll(at(g, s * 8.6, 0, z));
}

// ---------------------------------------------------------------- carros
function makeCar(color, opts = {}) {
  const g = new THREE.Group();
  const paint = mat(color, { roughness: .35, metalness: .3 });
  g.add(at(rbox(1.86, .62, 4.3, .2, paint), 0, .64, 0));
  g.add(at(rbox(1.62, .6, 2.25, .18, mat(0x18202c, { roughness: .15, metalness: .5 })), 0, 1.18, .3));
  g.add(at(rbox(1.52, .08, 1.75, .04, paint), 0, 1.5, .35));
  const wheels = [];
  for (const x of [-.86, .86]) for (const z of [-1.35, 1.4]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .26, 12), mat(0x0d0d0f)); w.rotation.z = Math.PI / 2; wheels.push(at(w, x, .35, z)); g.add(w);
  }
  const head = [], tail = [];
  for (const x of [-.6, .6]) {
    const h = at(box(.42, .15, .06, emis(0xfff0cf, 3)), x, .74, -2.16); g.add(h); head.push(h);
    const hs = at(glowSprite(0xfff1d6, 1.2, .9), x, .74, -2.3); g.add(hs); head.push(hs);
    const tl = at(box(.44, .13, .06, emis(0xff2020, 2.5)), x, .8, 2.16); g.add(tl); tail.push(tl);
    const ts = at(glowSprite(0xff2a2a, .9, .7), x, .8, 2.25); g.add(ts); tail.push(ts);
  }
  g.userData = { wheels, head, tail };
  return g;
}
const car = at(makeCar(0xeef1f4), 1.75, 0, 0); scene.add(car);
const black = at(makeCar(0x111317), 1.75, 0, 16); scene.add(black);
const beamSprites = [];
for (const x of [-.6, .6]) { const s = at(glowSprite(0xffffff, 1, 1), x, .76, -2.4); black.add(s); beamSprites.push(s); }
const bigFlare = at(glowSprite(0xfff6e0, 1, 0), 0, .9, -2.6); black.add(bigFlare);
{ // trânsito no sentido contrário
  const r = rng(99);
  for (let i = 0; i < 6; i++) {
    const c = makeCar([0xc0392b, 0x2c3e50, 0x7f8c8d, 0xd4ac0d, 0x1e8449, 0x34495e][i]); c.rotation.y = Math.PI;
    scroll(at(c, i % 2 ? -1.75 : -5.25, 0, -20 - i * 45 - r() * 20), 2.3);
  }
}

// ---------------------------------------------------------------- interior
const interior = new THREE.Group(); scene.add(interior);
interior.position.set(1.75, .32, 0);
const L = (x, y, z) => new THREE.Vector3(x, y, z).add(interior.position);
const fabric = mat(0x2c3039), plastic = mat(0x17191e), trim = mat(0x23262d);
interior.add(at(box(1.62, .04, 3.4, mat(0x2a2d35)), 0, 0, .3));
interior.add(at(rbox(1.5, .22, .58, .07, fabric), 0, .36, 1.2));
{ const b = at(rbox(1.5, .78, .16, .07, fabric), 0, .8, 1.52); b.rotation.x = -.13; interior.add(b); }
interior.add(at(box(1.5, .04, .4, plastic), 0, 1.2, 1.78));
for (const x of [-.42, .42]) {
  interior.add(at(rbox(.56, .16, .54, .05, fabric), x, .4, -.25));
  const bk = at(rbox(.56, .82, .16, .06, fabric), x, .86, .06); bk.rotation.x = .1; interior.add(bk);
  interior.add(at(rbox(.3, .22, .11, .05, fabric), x, 1.4, .12));
  interior.add(at(box(.05, .22, .05, plastic), x - .08, 1.27, .12)); interior.add(at(box(.05, .22, .05, plastic), x + .08, 1.27, .12));
}
interior.add(at(box(.24, .3, .8, plastic), 0, .24, -.5));
interior.add(at(rbox(1.72, .36, .62, .1, plastic), 0, .86, -1.18));
interior.add(at(box(.32, .18, .03, mat(0x0a0b0e)), 0, .83, -.855));
const radioScreen = at(new THREE.Mesh(new THREE.PlaneGeometry(.24, .09), new THREE.MeshBasicMaterial({ map: radioTex, toneMapped: false })), -.02, .84, -.838);
interior.add(radioScreen);
const knob = at(new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .03, 10), mat(0x9aa3ad, { metalness: .8, roughness: .3 })), .12, .83, -.83);
knob.rotation.x = Math.PI / 2; interior.add(knob);
const knobMark = at(box(.006, .02, .006, emis(0xffffff, 2)), .12, .845, -.812); interior.add(knobMark);
{ const sw = at(new THREE.Mesh(new THREE.TorusGeometry(.18, .028, 8, 22), plastic), -.42, 1.02, -.8); sw.rotation.x = -.35; interior.add(sw); }
for (const s of [-1, 1]) {
  interior.add(at(box(.07, .78, 3.0, trim), s * .82, .42, .3));
  const ap = at(box(.06, .7, .07, trim), s * .74, 1.36, -1.05); ap.rotation.x = -.5; ap.rotation.z = s * .12; interior.add(ap);
  interior.add(at(box(.07, .62, .1, trim), s * .8, 1.3, .55));
  const cp = at(box(.07, .55, .1, trim), s * .74, 1.42, 1.68); cp.rotation.x = .45; interior.add(cp);
}
interior.add(at(box(1.62, .05, 2.75, mat(0x2a2d33)), 0, 1.66, .35));
// retrovisor com os olhos do motorista
const mirror = new THREE.Group(); interior.add(at(mirror, 0, 1.5, -.98));
mirror.add(at(box(.03, .1, .03, plastic), 0, .07, 0));
mirror.add(at(rbox(.36, .11, .04, .025, mat(0x0b0c0f)), 0, 0, 0));
const mirrorFace = at(new THREE.Mesh(new THREE.PlaneGeometry(.33, .088), new THREE.MeshBasicMaterial({ map: eyesTex, toneMapped: false, color: 0xcfd6e6 })), 0, 0, .021);
mirror.add(mirrorFace);
mirror.rotation.y = .18; mirror.rotation.x = .08;
// motorista
const driver = new THREE.Group(); interior.add(at(driver, -.42, 0, -.18));
const skin = mat(0xc4875a), shirt = mat(0x2f5d8a);
driver.add(at(rbox(.46, .58, .28, .1, shirt), 0, .82, 0));
driver.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .1, 8), skin), 0, 1.15, -.02));
const head = at(new THREE.Mesh(new THREE.IcosahedronGeometry(.155, 1), skin), 0, 1.3, -.03); driver.add(head);
const hair = at(new THREE.Mesh(new THREE.SphereGeometry(.163, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(0x1c1410)), 0, 1.33, -.01); driver.add(hair);
for (const s of [-1, 1]) {
  driver.add(at(new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), skin), s * .155, 1.3, -.02));
  const arm = at(rbox(.11, .11, .5, .04, shirt), s * .2, .95, -.3); arm.rotation.x = .5; driver.add(arm);
  driver.add(at(new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), skin), s * .16, 1.02, -.58));
}
// pé do passageiro (você)
const foot = new THREE.Group(); interior.add(foot);
foot.add(at(rbox(.13, .1, .3, .04, mat(0xf3f3f3)), 0, .06, 0));
foot.add(at(box(.135, .025, .31, mat(0xd83a3a)), 0, .012, 0));
const leg = at(rbox(.14, .5, .14, .05, mat(0x2b3a58)), 0, .3, .12); leg.rotation.x = -.35; foot.add(leg);
// a mala
const bag = new THREE.Group(); interior.add(at(bag, -.3, .02, .52));
const shell = mat(0x262a33, { roughness: .3, metalness: .2 }), lining = mat(0x3a1a1c);
bag.add(at(box(.62, .02, .42, lining), 0, .01, 0));
for (const z of [-.215, .215]) bag.add(at(rbox(.66, .14, .03, .012, shell), 0, .07, z));
for (const x of [-.325, .325]) bag.add(at(rbox(.03, .14, .44, .012, shell), x, .07, 0));
{ const zm = mat(0x9aa3ad, { metalness: .8, roughness: .35 });
  for (const z of [-.226, .226]) bag.add(at(box(.66, .014, .012, zm), 0, .142, z));
  for (const x of [-.336, .336]) bag.add(at(box(.012, .014, .45, zm), x, .142, 0)); }
bag.add(at(rbox(.2, .035, .045, .015, shell), 0, .1, -.24));
const money = new THREE.Group(); bag.add(money);
{
  const sideM = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: .9 });
  const topM = new THREE.MeshStandardMaterial({ map: noteTex, roughness: .7 });
  const band = mat(0xe9dcb8);
  const geo = new THREE.BoxGeometry(.142, .034, .07);
  for (let l = 0; l < 3; l++) for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 5; iz++) {
    const m = new THREE.Mesh(geo, [sideM, sideM, topM, topM, sideM, sideM]);
    at(m, -.225 + ix * .15, .037 + l * .035, -.16 + iz * .08); m.rotation.y = (Math.sin(ix * 7 + iz * 3 + l) * .04);
    money.add(m); money.add(at(box(.03, .036, .072, band), m.position.x, m.position.y, m.position.z));
  }
}
const phone = new THREE.Group(); bag.add(at(phone, .17, .135, .07)); phone.rotation.y = .35;
phone.add(at(rbox(.078, .01, .158, .008, mat(0x0a0a0c)), 0, 0, 0));
const phoneScreen = at(new THREE.Mesh(new THREE.PlaneGeometry(.07, .148), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false, color: 0x000000 })), 0, .0056, 0);
phoneScreen.rotation.x = -Math.PI / 2; phone.add(phoneScreen);
const lidPivot = new THREE.Group(); bag.add(at(lidPivot, 0, .14, -.22));
lidPivot.add(at(rbox(.66, .1, .45, .025, shell), 0, .05, .22));
lidPivot.add(at(box(.6, .006, .4, lining), 0, -.002, .22));
lidPivot.add(at(box(.16, .03, .04, mat(0x9aa3ad, { metalness: .8 })), 0, .05, .46));

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const UI = {};
for (const id of ['glare', 'title', 'wm', 'chip', 'ride', 'driver', 'pill', 'sp1', 'sp2', 'phone', 'map', 'choice', 'cap', 'flash', 'm1', 'm2', 'm3', 'ty', 'cd', 'cdn', 'cta', 'oa', 'ob', 'off', 'livre', 'margok', 'etat', 'car', 'arrow', 'dev', 'route', 'ridebar', 'mapg']) UI[id] = $(id);
const capSpan = UI.cap.querySelector('span');
const show = (el, on, styles) => { el.style.display = on ? (el.dataset.disp || 'block') : 'none'; if (on && styles) Object.assign(el.style, styles); };
UI.cta.dataset.disp = 'flex'; UI.cd.dataset.disp = 'flex'; UI.ty.dataset.disp = 'flex'; UI.oa.dataset.disp = 'flex'; UI.ob.dataset.disp = 'flex';
const pop = (t, t0, d = .28) => { const k = clamp((t - t0) / d); return { opacity: String(clamp(k * 2.5)), transform: `scale(${lerp(.6, 1, eBack(k))})` }; };
// mapa: ruas e quarteirões
{
  const st = $('streets'), bl = $('blocks'), NS = 'http://www.w3.org/2000/svg';
  const xs = [160, 350, 540, 720, 900], ys = [760, 960, 1160, 1360, 1560];
  for (const x of xs) { const l = document.createElementNS(NS, 'line'); Object.entries({ x1: x, y1: 640, x2: x, y2: 1780 }).forEach(([k, v]) => l.setAttribute(k, v)); st.appendChild(l); }
  for (const y of ys) { const l = document.createElementNS(NS, 'line'); Object.entries({ x1: 40, y1: y, x2: 1040, y2: y }).forEach(([k, v]) => l.setAttribute(k, v)); st.appendChild(l); }
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const r = document.createElementNS(NS, 'rect'); Object.entries({ x: xs[i] + 22, y: ys[j] + 22, width: xs[i + 1] - xs[i] - 44, height: ys[j + 1] - ys[j] - 44, rx: 14 }).forEach(([k, v]) => r.setAttribute(k, v)); bl.appendChild(r);
  }
}
const devLen = UI.dev.getTotalLength();

// destaques da legenda (palavras em amarelo)
const HL = { s1: ['dois', 'milhoes'], s4: ['mala', 'preta'], s5: ['notas', 'cem'], s6: ['devagar'], s11: ['celular', 'vibra'], s13: ['nao', 'viu', 'nada'], s14: ['rota'], s16: ['livre'], s17: ['farol', 'alto'], s18: ['desce', 'leva', 'mala'], s19: ['cinco'] };
const HIDE_CAP = new Set(['s8', 's9', 's15']);
function caption(t, shot) {
  if (shot === 'choice') return show(UI.cap, false);
  let cur = null;
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i], nx = WORDS[i + 1];
    const end = nx && nx.start - w.end < .5 ? nx.start : w.end + .22;
    if (t >= w.start - .02 && t < end) { cur = w; break; }
  }
  if (!cur || HIDE_CAP.has(cur.seg)) return show(UI.cap, false);
  const txt = cur.w.replace(/[.,!?:;]/g, '');
  capSpan.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
  capSpan.style.color = (HL[cur.seg] || []).includes(norm(txt)) ? '#FFD60A' : '#fff';
  const k = clamp((t - cur.start) / .09);
  capSpan.style.transform = `scale(${lerp(1.18, 1, k)})`;
  show(UI.cap, true);
}

// ---------------------------------------------------------------- render de um instante
const tmpV = new THREE.Vector3();
function project(v) { tmpV.copy(v).project(camera); return { x: (tmpV.x + 1) / 2 * 1080, y: (1 - tmpV.y) / 2 * 1920 }; }
function setCam(pos, look, fov, t, shake = 0) {
  camera.position.copy(pos);
  camera.position.x += Math.sin(t * 1.3) * .006 + Math.sin(t * 23) * shake;
  camera.position.y += Math.sin(t * 1.7) * .005 + Math.sin(t * 31) * shake;
  camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(look);
}
const heart = t => { const p = (t % .82) / .82; return Math.exp(-p * 14) + .6 * Math.exp(-Math.max(0, p - .18) * 14) * (p > .18); };

window.renderAt = function (t) {
  const S = shotAt(t), sh = S.name, st = t - S.t0;
  // mundo em movimento
  for (const o of scrollers) {
    const z = o.userData.z0 + SPEED * o.userData.sm * t;
    o.position.z = ((z - ZMIN) % PERIOD + PERIOD) % PERIOD + ZMIN;
  }
  for (const w of car.userData.wheels) w.rotation.x = -t * SPEED / .35;
  for (const w of black.userData.wheels) w.rotation.x = -t * SPEED / .35;
  // luz dos postes passando pelo carro
  const lp = (t * SPEED / 18) % 1;
  passLight.position.copy(L(1.3, 2.4, lerp(-3, 4, lp)));
  passLight.intensity = 0;
  dashLight.intensity = 0; phoneLight.intensity = 0; beamLight.intensity = 0;
  const inside = !['ext', 'chase', 'map', 'choice'].includes(sh);
  interior.visible = inside; car.visible = !inside; driver.visible = inside;
  black.visible = sh === 'chase' || sh === 'rear';
  world.visible = sh !== 'map' && sh !== 'choice';
  inAmb.intensity = 0; keyLight.intensity = 0;
  if (inside) {
    inAmb.intensity = .75; keyLight.position.copy(L(.55, 1.1, .35)); keyLight.intensity = 3.2;
    passLight.intensity = 1.5 + 9 * Math.pow(Math.max(0, Math.sin(lp * Math.PI)), 6);
    dashLight.position.copy(L(0, 1.05, -.7)); dashLight.intensity = 1.2;
  }
  bloom.strength = .75;
  canvas.style.filter = 'none';
  // estado padrão da mala
  let lid = 0, bagJ = 0, glow = 0;
  bag.position.set(-.3, .02, .52); bag.rotation.set(0, 0, 0);
  foot.visible = false;
  phoneScreen.material.color.setHex(0x000000);
  drawRadio(.35);
  black.position.z = 16;
  for (const s of car.userData.head) if (s.isSprite) s.material.opacity = .9;
  for (const s of beamSprites) { s.scale.setScalar(.6); s.material.opacity = .7; }
  bigFlare.material.opacity = 0;

  // esconde toda a UI e reativa por cena
  for (const id of ['glare', 'title', 'wm', 'chip', 'ride', 'driver', 'pill', 'sp1', 'sp2', 'phone', 'map', 'choice', 'flash']) show(UI[id], false);
  if (sh !== 'hook' && sh !== 'choice' && sh !== 'map') show(UI.wm, true);

  if (sh === 'hook') {
    lid = 1.2;
    const k = eInOut(st / (S.t1 - S.t0));
    setCam(L(lerp(-.02, -.12, k), lerp(1.25, 1.02, k), lerp(1.3, 1.08, k)), L(-.3, .1, .48), lerp(52, 44, k), t);
    show(UI.title, true, { opacity: String(ss(.15, .45, t)), transform: `scale(${lerp(.85, 1, eBack(clamp((t - .15) / .4)))})` });
  }
  else if (sh === 'ext') {
    const k = eInOut(st / (S.t1 - S.t0));
    setCam(new THREE.Vector3(lerp(.2, 1.2, k), lerp(8.5, 6.2, k), lerp(17, 12, k)), new THREE.Vector3(1.75, 2.2, -22), 64, t);
    const tc = SEG.s2.start; show(UI.chip, t > tc - .05, pop(t, tc - .05));
    const tr = WW('s2', 'corrida') - .1;
    if (t > tr) { show(UI.chip, false); show(UI.ride, true, { opacity: String(ss(tr, tr + .2, t)), transform: `translateY(${lerp(-60, 0, eOut((t - tr) / .35))}px)` }); UI.ridebar.style.width = `${lerp(18, 34, clamp((t - tr) / 4))}%`; }
  }
  else if (sh === 'front') {
    const k = st / (S.t1 - S.t0);
    setCam(L(.36, 1.52, lerp(1.32, 1.18, k)), L(-.25, 1.25, -1.8), 50, t, .0015);
    const td = WW('s3', 'claudio') - .1;
    if (t > td) show(UI.driver, true, { opacity: String(ss(td, td + .2, t)), transform: `translateY(${lerp(-60, 0, eOut((t - td) / .35))}px)` });
  }
  else if (sh === 'floor') {
    const th = WW('s4', 'bate'), tm = WW('s4', 'mala'), tz = WW('s4', 'ziper');
    foot.visible = true;
    const fk = eOut((t - (th - .45)) / .45);
    foot.position.set(lerp(.32, .05, fk) - (t > th ? .03 * eOut((t - th) / .5) : 0), .02, .62);
    foot.rotation.y = .15;
    if (t > th) { const d = eOut((t - th) / .25); bag.position.x = -.3 - .02 * d; bag.rotation.y = .04 * d; bagJ = Math.exp(-(t - th) * 9) * .006; }
    lid = t > tz ? lerp(0, .13, eOut((t - tz) / .6)) : 0;
    let pos = L(-.5, 1.35, 1.3), look = L(-.08, .08, .45), fov = 55;
    keyLight.position.copy(L(-.1, 1.0, .95)); keyLight.intensity = 4.5;
    if (t > tm) { const k = eInOut((t - tm) / 1.2); pos = pos.clone().lerp(L(-.42, 1.05, 1.1), k); look = look.clone().lerp(L(-.22, .1, .5), k); fov = lerp(55, 48, k); }
    if (t > tz) { const k = eInOut((t - tz) / 1.0); pos = pos.clone().lerp(L(-.3, .62, .9), k); look = look.clone().lerp(L(-.28, .13, .6), k); fov = lerp(fov, 40, k); }
    setCam(pos, look, fov, t, bagJ);
  }
  else if (sh === 'pov') {
    const tn = WW('s5', 'notas'), tm2 = WW('s5', 'maco'), tc = SEG.s6.start, te = S.t1;
    lid = lerp(.13, 1.32, eInOut((t - SEG.s5.start) / (tn - SEG.s5.start + .3)));
    if (t > tc) lid = lerp(1.32, 0, eInOut((t - tc) / (te - tc - .15)));
    const k = st / (S.t1 - S.t0);
    const hb = heart(t) * .5;
    setCam(L(lerp(-.2, -.24, k), lerp(1.06, .9, k), lerp(1.0, .9, k)), L(-.3, .05, .46), 46 - hb, t);
    if (t > tm2 && t < tc + .6) {
      const p = project(L(-.3, .16, .5));
      show(UI.pill, true, { left: `${p.x - 230}px`, top: `${p.y - 170}px`, ...pop(t, tm2), opacity: String(clamp((t - tm2) * 5) * (1 - ss(tc + .2, tc + .6, t))) });
    }
  }
  else if (sh === 'mirror') {
    const to = WW('s7', 'olha');
    const look = ss(to - .1, to + .25, t), brow = ss(to + .1, to + .6, t);
    drawEyes(look, brow);
    const k = eInOut(st / (S.t1 - S.t0));
    setCam(L(lerp(.28, .16, k), 1.5, lerp(.55, .05, k)), L(0, 1.5, -.98), lerp(34, 30, k), t);
    if (t > SEG.s8.start - .1) { UI.sp1.querySelector('.txt').textContent = 'Tudo certo aí atrás?'; show(UI.sp1, true, { left: '110px', top: '360px', ...pop(t, SEG.s8.start - .1) }); }
    if (t > SEG.s9.start - .05) { UI.sp2.querySelector('.txt').textContent = 'Tudo.'; show(UI.sp2, true, { left: '600px', top: '1430px', ...pop(t, SEG.s9.start - .05) }); }
  }
  else if (sh === 'radio') {
    const ta = WW('s10', 'aumenta');
    const v = lerp(.35, 1, eInOut((t - ta) / 1.2));
    drawRadio(v); knob.rotation.y = v * 4; knobMark.position.set(.12 + Math.sin(v * 4) * .015, .83 + Math.cos(v * 4) * .015, -.812);
    const k = eInOut(st / (S.t1 - S.t0));
    setCam(L(lerp(.2, .1, k), lerp(1.12, 1.05, k), lerp(-.32, -.46, k)), L(.02, .84, -.85), 40, t, .002 * v);
    drawEyes(1, 1);
  }
  else if (sh === 'phone') {
    const tv = WW('s11', 'vibra'), tmsg = WW('s12', 'mensagem') - .15;
    lid = lerp(0, .32, eOut((t - SEG.s11.start) / .8));
    const on = t > tv - .15;
    if (on) { glow = 1; phoneScreen.material.color.setHex(0x9a9a9a); phoneLight.position.copy(L(-.13, .35, .6)); phoneLight.intensity = 2.5 + Math.sin(t * 40) * .4; }
    const vib = on && t < tmsg ? Math.sin(t * 90) * .004 * (Math.sin(t * 6) > 0 ? 1 : 0) : 0;
    phone.position.x = .17 + vib; bag.position.x = -.3 + vib * .3;
    const k = eInOut(st / 2.5);
    setCam(L(lerp(-.05, -.16, k), lerp(.62, .5, k), lerp(1.0, .9, k)), L(-.22, .12, .55), 42, t, vib * .5);
    if (t > tmsg) {
      const k2 = clamp((t - tmsg) / .3);
      canvas.style.filter = `brightness(${lerp(1, .4, k2)}) blur(${lerp(0, 4, k2)}px)`;
      show(UI.phone, true, { opacity: String(k2), transform: `translateY(${lerp(120, 0, eOut(k2))}px) scale(${lerp(.92, 1, eOut(k2))})` });
      const t1 = WW('s12', 'ja'), t2 = WW('s13', 'se');
      show(UI.m1, t > t1 - .05, pop(t, t1 - .05, .22)); show(UI.m2, t > t2 - .05, pop(t, t2 - .05, .22)); show(UI.m3, false);
      show(UI.ty, (t > tmsg + .2 && t < t1 - .05) || (t > WW('s13', 'outra') && t < t2 - .05));
    }
  }
  else if (sh === 'map') {
    show(UI.map, true);
    const ts = WW('s14', 'sai'), tr = WW('s14', 'rota'), tl = WW('s16', 'livre'), tmg = WW('s16', 'marginal');
    // carro: sobe a rota até o desvio e depois segue pelo caminho errado
    const total = devLen, pre = 440;
    let d = t < ts ? lerp(0, pre, (t - S.t0) / (ts - S.t0)) : lerp(pre, total, clamp((t - ts) / (S.t1 - ts - .3)));
    const p = UI.dev.getPointAtLength(d), p2 = UI.dev.getPointAtLength(Math.min(total, d + 4));
    const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI + 90;
    UI.car.setAttribute('transform', `translate(${p.x},${p.y})`); UI.arrow.setAttribute('transform', `rotate(${ang})`);
    UI.dev.style.strokeDasharray = `0 ${pre} ${Math.max(0, d - pre)} 4000`;
    UI.dev.style.opacity = t > ts ? '1' : '0';
    const off = t > tr - .1;
    UI.off.setAttribute('opacity', off ? String((.75 + .25 * Math.sin(t * 12)) * clamp((t - tr + .1) * 5)) : '0');
    UI.etat.textContent = off ? 'Recalculando rota…' : 'Chegada 23:58 · 6 min';
    UI.etat.setAttribute('fill', off ? '#ff6b6b' : '#fff');
    UI.margok.setAttribute('opacity', String(ss(tmg - .1, tmg + .3, t)));
    UI.livre.setAttribute('opacity', String(ss(tl - .1, tl + .15, t)));
    const z = lerp(1.0, 1.12, st / (S.t1 - S.t0));
    UI.mapg.setAttribute('transform', `translate(${540 - 540 * z},${900 - 900 * z}) scale(${z})`);
    if (t > SEG.s15.start - .1 && t < SEG.s16.start + .2) { UI.sp1.querySelector('.txt').textContent = 'Vou cortar caminho, a Marginal tá parada.'; show(UI.sp1, true, { left: '90px', top: '1380px', ...pop(t, SEG.s15.start - .1) }); }
  }
  else if (sh === 'chase') {
    const tf = WW('s17', 'farol');
    black.position.z = lerp(17, 8.2, eInOut(st / (S.t1 - S.t0 - .3)));
    const on = ss(tf - .05, tf + .15, t);
    for (const s of beamSprites) { s.scale.setScalar(lerp(.6, 5.5, on)); s.material.opacity = lerp(.7, 1, on); }
    bigFlare.scale.setScalar(lerp(1, 16, on)); bigFlare.material.opacity = on * .9;
    beamLight.position.copy(black.position).add(new THREE.Vector3(0, 1, -3)); beamLight.intensity = on * 60;
    bloom.strength = lerp(.75, 1.25, on);
    const k = eInOut(st / (S.t1 - S.t0));
    for (const s of car.userData.head) if (s.isSprite) s.material.opacity = .15;
    setCam(new THREE.Vector3(lerp(5.2, 4.4, k), lerp(5.8, 4.8, k), lerp(-7, -6, k)), new THREE.Vector3(1.4, .8, 6.5), 50, t, on * .02);
    show(UI.flash, t > tf - .02 && t < tf + .35, { opacity: String(.75 * (1 - clamp((t - tf) / .35))) });
  }
  else if (sh === 'rear') {
    black.position.z = 8.2;
    for (const s of beamSprites) { s.scale.setScalar(5.5); s.material.opacity = 1; }
    bigFlare.scale.setScalar(16); bigFlare.material.opacity = .9;
    passLight.intensity = 0;
    beamLight.position.copy(L(0, 1.6, 3.5)); beamLight.intensity = 14;
    bloom.strength = 1.1;
    setCam(L(.32, 1.4, .95), L(-.05, 1.35, 3.2), 50, t, .003);
    show(UI.glare, true, { opacity: String(.55 + .1 * Math.sin(t * 9)) });
    const t3 = WW('s18', 'desce');
    show(UI.phone, true, { opacity: '1', transform: 'none' });
    show(UI.m1, true, { opacity: '1', transform: 'none' }); show(UI.m2, true, { opacity: '1', transform: 'none' });
    show(UI.m3, t > t3 - .05, pop(t, t3 - .05, .22));
    show(UI.ty, t > S.t0 + .15 && t < t3 - .05);
  }
  else if (sh === 'choice') {
    show(UI.choice, true);
    const tA = SEG.s20.start, tB = SEG.s21.start, tC = SEG.s22.start, c0 = tA - .1;
    const n = t < c0 ? 5 : Math.max(1, 5 - Math.floor((t - c0) / ((tC - c0) / 5)));
    UI.cdn.textContent = String(n);
    const beat = t < c0 ? 0 : ((t - c0) % ((tC - c0) / 5)) / ((tC - c0) / 5);
    UI.cd.style.transform = `scale(${1 + .12 * Math.exp(-beat * 8)})`;
    UI.cd.style.borderColor = n <= 2 ? '#ff3b3b' : '#fff';
    show(UI.cd, t < tC);
    const aOn = t >= tA && t < tB, bOn = t >= tB && t < tC;
    UI.oa.style.filter = bOn ? 'brightness(.55)' : 'none'; UI.ob.style.filter = aOn ? 'brightness(.55)' : 'none';
    UI.oa.style.transform = `scale(${aOn ? 1.04 : 1})`; UI.ob.style.transform = `scale(${bOn ? 1.04 : 1})`;
    show(UI.cta, t >= tC - .05, pop(t, tC - .05, .3));
    show(UI.oa, true); show(UI.ob, true);
    UI.oa.style.opacity = String(ss(S.t0, S.t0 + .25, t)); UI.ob.style.opacity = String(ss(S.t0 + .1, S.t0 + .35, t));
  }

  // tampa e brilho do celular
  lidPivot.rotation.x = -lid;
  if (glow) phoneScreen.material.color.setHex(0x9a9a9a);
  caption(t, sh);
  if (window.COVER) { for (const id of ['title', 'wm', 'cap']) show(UI[id], false); show($('cover'), true); }
  if (window.DEBUG) { const D = window.DEBUG; if (D.cam) { camera.position.set(...D.cam); camera.fov = D.fov || 50; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...D.look)); } dbgLight.intensity = D.light || 0; }
  if (world.visible) composer.render(); else { renderer.setClearColor(0x000000); renderer.clear(); }
};

// aquece shaders
for (const tt of [1, 6, 11, 16, 22, 31, 35, 38, 50, 55, 59, 65]) window.renderAt(tt);
window.READY = true;
