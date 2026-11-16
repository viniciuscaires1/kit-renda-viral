// Renderiza uma cena web quadro a quadro no Chrome headless e gera o vídeo com o ffmpeg.
// Uso:  node render.mjs video 30 saida.mp4 [inicio fim]   |   node render.mjs stills 1.5,10,20 pasta_saida
// Variáveis: PAGE (página com ?v=pasta-do-video), VIEW (LxA, padrão 1080x1920), CHROME (caminho do Chrome, opcional), COVER=1 (modo capa)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const [VW, VH] = (process.env.VIEW || '1080x1920').split('x').map(Number);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const size = fs.statSync(f).size, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// acha o Chrome no Mac, no Windows ou no Linux (ou use a variável CHROME)
const local = path.join(ROOT, '.chrome');
const found = fs.existsSync(local) ? fs.readdirSync(local, { recursive: true }).map(p => path.join(local, p)).find(p => /(chrome-headless-shell|chrome)(\.exe)?$/.test(p) && fs.statSync(p).isFile()) : null;
const CANDIDATES = [process.env.CHROME, found,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const exe = CANDIDATES.find(p => fs.existsSync(p));
if (!exe) { console.error('ERRO: Chrome não encontrado. Instale o Google Chrome ou rode: npx @puppeteer/browsers install chrome-headless-shell@stable --path .chrome'); process.exit(1); }
const gl = os.platform() === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : os.platform() === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  userDataDir: path.join(os.tmpdir(), 'renda-viral-chrome-' + process.pid),
  args: [...gl, '--ignore-gpu-blocklist', '--hide-scrollbars', '--mute-audio', `--window-size=${VW},${VH}`,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-sandbox'],
});
browser.on('disconnected', () => { if (!globalThis.FIM) { console.error('ERRO: o Chrome fechou no meio do render'); process.exit(2); } });
let ULTIMO = Date.now();
setInterval(() => { if (!globalThis.FIM && Date.now() - ULTIMO > 120000) { console.error('ERRO: render travado há 2 minutos'); process.exit(4); } }, 10000).unref();
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[erro na página]', e.message));
await page.goto(`http://127.0.0.1:${port}/${process.env.PAGE || 'teste/cena.html?v=videos/teste'}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.READY === true', { timeout: 120000 });
ULTIMO = Date.now();

const mode = process.argv[2];
if (mode === 'stills') {
  const times = process.argv[3].split(',').map(Number), out = process.argv[4];
  fs.mkdirSync(out, { recursive: true });
  if (process.env.COVER) await page.evaluate(() => { window.COVER = true; });   // modo capa: a cena esconde a legenda e mostra o título da capa
  for (const t of times) {
    await page.evaluate(t => window.renderAt(t), t);
    fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
    ULTIMO = Date.now();
  }
  console.log('imagens prontas:', times.length);
} else if (mode === 'video') {
  const fps = +process.argv[3] || 30, out = process.argv[4];
  const dur = await page.evaluate('window.DURATION');
  const a = process.argv[5] ? +process.argv[5] : 0, b = process.argv[6] ? +process.argv[6] : dur;
  const n0 = Math.round(a * fps), n1 = Math.ceil(b * fps);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let acabou = false;
  ff.on('exit', c => { if (!acabou) { console.error('ERRO: o ffmpeg parou no meio do render, código', c); process.exit(3); } });
  ff.stdin.on('error', e => { console.error('ERRO ao enviar quadros ao ffmpeg:', e.message); process.exit(3); });
  const t0 = Date.now();
  for (let i = n0; i < n1; i++) {
    await page.evaluate(t => window.renderAt(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, optimizeForSpeed: true });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    ULTIMO = Date.now();
    if ((i - n0) % 150 === 0) console.log(`quadro ${i - n0}/${n1 - n0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  acabou = true; ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('vídeo renderizado em', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
globalThis.FIM = true;
await Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
process.exit(0);
