// Cena de teste do Kit Renda Viral: um quarteirão low-poly, um carro andando e a legenda palavra por palavra.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const V = new URLSearchParams(location.search).get('v') || 'videos/teste';
const TL = await (await fetch(`/${V}/timeline.json`)).json();
await document.fonts.load('900 40px M');
window.DURATION = TL.duration + 0.6;
const AMARELO = ['estudio', 'funcionando', 'claude', 'tema'];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1080, 1920, false); renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#8fb6dc'); scene.fog = new THREE.Fog('#8fb6dc', 40, 90);
const cam = new THREE.PerspectiveCamera(52, 1080 / 1920, 0.1, 200);
scene.add(new THREE.HemisphereLight('#ffffff', '#6b7a5a', 1.4));
const sun = new THREE.DirectionalLight('#fff4dd', 2.2); sun.position.set(12, 20, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20; sun.shadow.normalBias = 0.03;
scene.add(sun);
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 });
const box = (w, h, d, c, x, y, z, r = .25) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
box(60, 1, 60, '#7fae5a', 0, -.5, 0, .1);                       // grama
box(60, .2, 6, '#3a3f48', 0, .1, 0, .05);                        // rua
for (let x = -27; x < 30; x += 4) box(2, .05, .3, '#f2f2f2', x, .23, 0, .02); // faixas
const cores = ['#e8d6b0', '#c96f53', '#6d8fb3', '#f0c419', '#9bb7a6', '#d9a6a6', '#b8b8c8'];
[[-9, 5, 8], [-3, 7, 12], [4, 6, 9], [10, 7, 14], [-8, -6, 10], [1, -7, 7], [9, -6, 11]].forEach(([x, z, h], i) => {
  const b = box(4.2, h, 4.2, cores[i], x, h / 2, z, .3);
  for (let y = 1.5; y < h - .5; y += 1.6) for (const dx of [-1, 1]) box(1, .9, .1, '#2c3e57', x + dx * .9, y, z + Math.sign(-z) * 2.12, .05);
});
const car = new THREE.Group(); scene.add(car);
const body = new THREE.Mesh(new RoundedBoxGeometry(3, 1, 1.6, 3, .3), mat('#FFD60A')); body.position.y = .8; body.castShadow = true; car.add(body);
const top = new THREE.Mesh(new RoundedBoxGeometry(1.6, .8, 1.4, 3, .25), mat('#222831')); top.position.set(-.2, 1.6, 0); top.castShadow = true; car.add(top);
for (const [x, z] of [[-1, .8], [1, .8], [-1, -.8], [1, -.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 16), mat('#111')); w.rotation.x = Math.PI / 2; w.position.set(x, .42, z); car.add(w); }
car.position.z = 1.4;

// legenda palavra por palavra e elementos de tela
const cap = document.getElementById('cap'), pill = document.getElementById('pill'), title = document.getElementById('title');
const W = TL.words;
const tFunc = (W.find(w => norm(w.w).startsWith('funcionando')) || W[0]).start;
const tS2 = (TL.segments[1] || TL.segments[0]).start;
const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
window.renderAt = async t => {
  const a = -0.6 + t * 0.06;
  cam.position.set(Math.sin(a) * 30, 34, Math.cos(a) * 30); cam.lookAt(0, 1, 0);
  car.position.x = -26 + ((t * 7) % 52);
  let w = null; for (const x of W) if (t >= x.start - .02) w = x;
  const last = W[W.length - 1];
  cap.textContent = w && t < last.end + .4 ? w.w.replace(/[.,:!?]/g, '').toUpperCase() : '';
  cap.className = w && AMARELO.includes(norm(w.w)) ? 'y' : '';
  const kp = ease((t - tFunc) / .35); pill.style.opacity = t < tS2 ? kp : 1 - ease((t - tS2) / .3);
  pill.style.transform = `translateX(-50%) scale(${.8 + .2 * kp})`;
  const kt = ease((t - tS2) / .4); title.style.opacity = kt; title.style.transform = `scale(${.85 + .15 * kt})`;
  renderer.render(scene, cam);
  await new Promise(r => requestAnimationFrame(() => r()));
};
await window.renderAt(0.5);
window.READY = true;
