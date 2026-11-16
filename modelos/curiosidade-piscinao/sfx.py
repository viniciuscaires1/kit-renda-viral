# Efeitos e trilha do vídeo "Você construiu um piscinão". Uso: sfx_cur.py <pasta>
import json, sys, wave, unicodedata, re
import numpy as np
M = sys.argv[1]; EP = 0
SR = 48000
TL = json.load(open(f"{M}/timeline.json"))
DUR = TL["duration"]
N = int(SR * (DUR + 0.2))
rng = np.random.default_rng(21)
SEG = {s["id"]: s for s in TL["segments"]}
WORDS = TL["words"]
def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9-]", "", "".join(c for c in s if unicodedata.category(c) != "Mn"))
def WW(seg, text, nth=0):
    ws = [w for w in WORDS if w["seg"] == seg and norm(w["w"]).startswith(norm(text))]
    return ws[min(nth, len(ws) - 1)]["start"] if ws else SEG[seg]["start"]
def S0(s): return SEG[s]["start"]
# ------------------------------------------------------------ utilidades de síntese
def t_(d): return np.arange(int(SR * d)) / SR
def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if hi: m *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo: m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X * m, len(x))
def decay(d, k): return np.exp(-t_(d) * k)
def fade(x, a=.005, r=.02):
    n = len(x); e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return x * e
def norm_peak(x, p=1.0): m = np.max(np.abs(x)) or 1; return x / m * p

def thud(d=.45, f=62, k=9):
    tt = t_(d); s = np.sin(2 * np.pi * (f * tt - 18 * tt * tt)) * decay(d, k)
    n = fft_filter(rng.standard_normal(len(tt)), hi=700) * decay(d, 35) * .6
    return fade(norm_peak(s + n))
def boom(d=1.6):
    tt = t_(d); s = np.sin(2 * np.pi * (48 * tt - 8 * tt * tt)) * decay(d, 3.2)
    n = fft_filter(rng.standard_normal(len(tt)), hi=400) * decay(d, 6) * .8
    return fade(np.tanh(2.2 * norm_peak(s + n)) * .9)
def whoosh(d=.42):
    tt = t_(d); n = rng.standard_normal(len(tt))
    env = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 2
    a = fft_filter(n, lo=300, hi=2500) * env; b = fft_filter(n, lo=1500, hi=6000) * env * np.linspace(.2, 1, len(tt))
    return fade(norm_peak(a + .5 * b))
def pop(f0=1000, f1=620, d=.09):
    tt = t_(d); ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, len(tt))) / SR
    return fade(np.sin(ph) * decay(d, 45), .001, .01)
def plim():
    out = np.zeros(int(SR * .5))
    for i, f in enumerate([1318.5, 1760]):
        tt = t_(.32); s = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt)) * decay(.32, 11)
        o = int(i * .11 * SR); out[o:o + len(s)] += s
    return fade(norm_peak(out) * .8)
def vibrate(d=.42):
    tt = t_(d); s = np.sign(np.sin(2 * np.pi * 168 * tt)) * (1 + .3 * np.sin(2 * np.pi * 22 * tt))
    return fade(fft_filter(s, hi=900) * .7, .01, .03)
def zipper(d=.8, rate=55):
    n = int(SR * d); out = np.zeros(n); pos = 0.0
    while pos < d - .01:
        o = int(pos * SR); L = int(.004 * SR); out[o:o + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4))
        pos += 1 / (rate * (1 + .25 * np.sin(pos * 9)))
    out = fft_filter(out, lo=1800, hi=7000)
    return fade(norm_peak(out) * .8, .02, .05)
def beep_err():
    out = []
    for f in (880, 660):
        tt = t_(.13); out.append(fade(np.sign(np.sin(2 * np.pi * f * tt)) * .35, .002, .01)); out.append(np.zeros(int(.04 * SR)))
    return fft_filter(np.concatenate(out), hi=4000)
def tick():
    tt = t_(.06); s = np.sin(2 * np.pi * 2100 * tt) * decay(.06, 90) + fft_filter(rng.standard_normal(len(tt)), lo=3000) * decay(.06, 150) * .5
    return fade(norm_peak(s) * .9, .0005, .01)
def riser(d=1.6):
    tt = t_(d); f = 120 * (12 ** (tt / d)); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * .4
    n = fft_filter(rng.standard_normal(len(tt)), lo=800, hi=8000) * (tt / d) ** 2
    return fade(norm_peak((s + n) * (tt / d) ** 1.5), .05, .02)
def heartbeat(d=.5):
    out = np.zeros(int(SR * d))
    for o, a in ((0, 1.0), (.17, .7)):
        tt = t_(.16); s = np.sin(2 * np.pi * (52 * tt - 30 * tt * tt)) * decay(.16, 22) * a
        k = int(o * SR); out[k:k + len(s)] += s
    return np.tanh(1.5 * out)
def engine_roar(d=3.0):
    tt = t_(d); f = 38 + 22 * (tt / d)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .5 + fft_filter(rng.standard_normal(len(tt)), hi=300) * 2
    return fade(fft_filter(s, hi=500) * (tt / d) ** 1.4, .1, .3)

def clac():
    out = np.zeros(int(SR * .25))
    for o, f in ((0, 2600), (.035, 1800)):
        tt = t_(.03); s = np.sin(2 * np.pi * f * tt) * decay(.03, 120) + fft_filter(rng.standard_normal(len(tt)), lo=1500) * decay(.03, 200) * .6
        k = int(o * SR); out[k:k + len(s)] += s
    th = thud(.2, 90, 25) * .6; out[:len(th)] += th
    return fade(norm_peak(out) * .9, .0005, .02)
def ringback(d):
    tt = t_(d); s = np.sin(2 * np.pi * 425 * tt) * ((tt % 5) < 1) * .5
    return fade(fft_filter(s, lo=300, hi=3400), .005, .05)
def ringtone(d):
    out = np.zeros(int(SR * d)); notes = [659.3, 830.6, 987.8, 1318.5]; k, tp = 0, 0.0
    while tp < d - .12:
        if (tp % 1.6) < 1.0:
            f = notes[k % 4]; tt = t_(.1); s = (np.sin(2 * np.pi * f * tt) + .4 * np.sin(4 * np.pi * f * tt)) * decay(.1, 18)
            o = int(tp * SR); out[o:o + len(s)] += s[:max(0, len(out) - o)]
        k += 1; tp += .11
    return fade(norm_peak(out) * .7)
def siren(d=1.2):
    tt = t_(d); f = 600 + 500 * np.sin(np.pi * np.clip(tt / d, 0, 1)); s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .4
    return fade(fft_filter(s, hi=2500) * np.sin(np.pi * tt / d), .02, .1)
def siren_bed(n):
    tt = np.arange(n) / SR; f = 750 + 350 * np.sin(2 * np.pi * tt / 2.4)
    return fft_filter(np.sin(2 * np.pi * np.cumsum(f) / SR), lo=400, hi=1500) * .3
def paper(d=.25):
    tt = t_(d); return fade(norm_peak(fft_filter(rng.standard_normal(len(tt)), lo=600, hi=5000) * decay(d, 20)) * .8)
def cuff_click():
    out = np.zeros(int(SR * .35))
    for o in (0, .06, .11, .15):
        tt = t_(.05); s = (np.sin(2 * np.pi * 3200 * tt) + np.sin(2 * np.pi * 4700 * tt)) * decay(.05, 90); k = int(o * SR); out[k:k + len(s)] += s
    return fade(norm_peak(out) * .8, .0005, .02)
def typekey():
    tt = t_(.03); s = fft_filter(rng.standard_normal(len(tt)), lo=1500) * decay(.03, 160) + np.sin(2 * np.pi * 180 * tt) * decay(.03, 90) * .5
    return fade(norm_peak(s) * .7, .0005, .005)
def brakes(d=1.0):
    tt = t_(d); s = np.sin(2 * np.pi * (2900 + 80 * np.sin(2 * np.pi * 7 * tt)) * tt) * .3 + fft_filter(rng.standard_normal(len(tt)), lo=2000, hi=6000) * .4
    return fade(s * np.minimum(1, tt * 8) * np.exp(-tt * 1.5), .02, .1)

mix = np.zeros((N, 2))
def put(sig, t0, gain_db=0.0, pan=0.0):
    g = 10 ** (gain_db / 20); o = int(t0 * SR)
    if o >= N or o + len(sig) <= 0: return
    s = sig[: max(0, N - o)] * g
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[o:o + len(s), 0] += s * l * 1.414; mix[o:o + len(s), 1] += s * r * 1.414
tt = np.arange(N) / SR
brown = np.cumsum(rng.standard_normal(N)); brown = norm_peak(fft_filter(brown - np.convolve(brown, np.ones(4801) / 4801, "same"), lo=25, hi=160)) * .5
drone = (np.sin(2 * np.pi * 55 * tt) + .7 * np.sin(2 * np.pi * 82.4 * tt) + .5 * np.sin(2 * np.pi * 110.3 * tt) + .25 * np.sin(2 * np.pi * 164.8 * tt)) * (.6 + .4 * np.sin(2 * np.pi * .18 * tt)) * .25
def env(points): xs, ys = zip(*points); return np.interp(tt, xs, ys)
def countdown(tA, tC, tStart):
    c0 = tA - .1; step = (tC - c0) / 5
    put(boom(1.4), tStart + .02, -8)
    for i in range(5): put(tick(), c0 + i * step, -6)
    for t0 in np.arange(tStart, tC, .5): put(tick() * .35, t0 + .25, -16)
    put(boom(1.8), tC - .05, -5); put(riser(1.0) * .6, tC - 1.0, -14)
def hearts(a, b, step=.8, g=-9):
    for t0 in np.arange(a, b, step): put(heartbeat(), t0, g)
def whooshes(ts):
    for i, c in enumerate(ts): put(whoosh(), c - .2, -14, pan=.3 if i % 2 else -.2)

# ------------------------------------------------------------ sons novos
def thunder(d=3.5):
    tt_ = t_(d); crack = fft_filter(rng.standard_normal(len(tt_)), lo=1500) * decay(d, 25) * .6
    rumble = fft_filter(rng.standard_normal(len(tt_)), hi=180) * (np.exp(-tt_ * 1.1) * (1 + .5 * np.sin(2 * np.pi * 3 * tt_)))
    return fade(norm_peak(crack + rumble * 3) * .95, .002, .3)
def splash(d=.6):
    tt_ = t_(d); n = fft_filter(rng.standard_normal(len(tt_)), lo=400, hi=5000) * decay(d, 9)
    out = n.copy()
    for k in range(8):
        o = int(rng.uniform(0, d * .7) * SR); L = int(.05 * SR); f = rng.uniform(500, 1400)
        b = np.sin(2 * np.pi * np.cumsum(np.linspace(f, f * 1.8, L)) / SR) * np.exp(-np.arange(L) / (L / 3)) * .4
        out[o:o + L] += b[:max(0, len(out) - o)]
    return fade(norm_peak(out) * .8)
def clang():
    tt_ = t_(1.4); s = sum(a * np.sin(2 * np.pi * f * tt_) * np.exp(-tt_ * k) for f, a, k in ((523, 1, 3), (1371, .6, 5), (2093, .4, 7), (3120, .25, 9)))
    return fade(norm_peak(s + thud(1.4, 70, 6) * .5) * .9, .001, .1)
def alarm(d=1.6):
    tt_ = t_(d); s = np.sign(np.sin(2 * np.pi * 980 * tt_)) * ((tt_ % .3) < .15) * .35
    return fade(fft_filter(s, hi=4000), .005, .05)
def mosquito(d=3.0):
    tt_ = t_(d); f = 600 + 40 * np.sin(2 * np.pi * 7 * tt_) + 60 * np.sin(2 * np.pi * .7 * tt_)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR); s = np.sign(s) * np.abs(s) ** .5
    return fade(fft_filter(s, lo=300, hi=3000) * (.6 + .4 * np.sin(2 * np.pi * 1.3 * tt_)) * .5, .2, .3)
def chirp():
    out = np.zeros(int(SR * .5))
    for k in range(3):
        L = int(.07 * SR); f0 = rng.uniform(2800, 3600)
        s = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f0 * 1.4, L)) / SR) * np.sin(np.pi * np.arange(L) / L)
        o = int(k * .1 * SR); out[o:o + L] += s
    return out * .5
def fanfare():
    out = np.zeros(int(SR * 1.6))
    for i, f in enumerate([523.3, 659.3, 784.0, 1046.5]):
        tt_ = t_(1.0 if i == 3 else .35); s = (np.sin(2 * np.pi * f * tt_) + .35 * np.sin(4 * np.pi * f * tt_) + .15 * np.sin(6 * np.pi * f * tt_)) * decay(len(tt_) / SR, 4 if i == 3 else 9)
        o = int(i * .12 * SR); out[o:o + len(s)] += s[:max(0, len(out) - o)]
    return fade(norm_peak(out) * .8)
def hum_bed(n):
    tt_ = np.arange(n) / SR
    s = np.sin(2 * np.pi * 50 * tt_) + .5 * np.sin(2 * np.pi * 100 * tt_) + .3 * np.sin(2 * np.pi * 150 * tt_) + .15 * np.sign(np.sin(2 * np.pi * 25 * tt_))
    return fft_filter(s, hi=600) * .3
def pluck_bed(n, bpm=104):
    out = np.zeros(n); beat = 60 / bpm / 2; notes = [523.3, 659.3, 784.0, 880.0, 784.0, 659.3, 587.3, 659.3]
    bass = [130.8, 130.8, 110.0, 110.0, 87.3, 87.3, 98.0, 98.0]
    i = 0; tp = 0.0
    while tp < n / SR:
        o = int(tp * SR); f = notes[i % 8]; L = int(.3 * SR)
        s = (np.sin(2 * np.pi * f * np.arange(L) / SR) + .3 * np.sin(4 * np.pi * f * np.arange(L) / SR)) * np.exp(-np.arange(L) / SR * 14) * .5
        out[o:o + L] += s[:max(0, n - o)]
        if i % 2 == 0:
            fb = bass[(i // 2) % 8]; Lb = int(.45 * SR); sb = np.sin(2 * np.pi * fb * np.arange(Lb) / SR) * np.exp(-np.arange(Lb) / SR * 6) * .6
            out[o:o + Lb] += sb[:max(0, n - o)]
        i += 1; tp += beat
    return fft_filter(out, hi=5000)

# ------------------------------------------------------------ linha do tempo (igual ao cur.js)
cuts = {"boca": S0("s3") - .1, "galeria": S0("s4") - .1, "cheia": S0("s5") - .1, "piscinao": S0("s6") - .1, "pacaembu": S0("s7") - .1, "jabot": S0("s8") - .1,
        "stuck": S0("s9") - .1, "bombas": S0("s10") - .1, "lixo": S0("s11") - .1, "grade": S0("s12") - .1, "lama": S0("s13") - .1, "trator": S0("s14") - .1,
        "abandono": S0("s15") - .1, "esponja": S0("s16") - .1, "final": S0("s17") - .1, "parabens": S0("s18") - .1, "end": S0("s19") - .1}
rk = [(0, .9), (cuts["cheia"], 1), (cuts["piscinao"], .9), (cuts["jabot"], .5), (cuts["stuck"], 0), (cuts["lixo"], .6), (cuts["lama"], 0), (cuts["esponja"], .8), (cuts["final"], .7), (cuts["parabens"], 0)]
rainK = np.zeros(N)
for i, (a, v) in enumerate(rk):
    b = rk[i + 1][0] if i + 1 < len(rk) else DUR + 1
    rainK[int(a * SR):int(b * SR)] = v
rainK = np.convolve(rainK, np.ones(9600) / 9600, "same")
def rain_tex(n):
    # gotas individuais (impulsos curtos) + um "lavado" grave, tudo abafado: soa como chuva, não como chiado
    imp = np.zeros(n); k = int(n / SR * 650); pos = rng.integers(0, n, k)
    imp[pos] = rng.uniform(-1, 1, k) * rng.uniform(.15, 1, k) ** 2
    L = int(.004 * SR); ker = np.sin(2 * np.pi * 2000 * np.arange(L) / SR) * np.exp(-np.arange(L) / (L / 4))
    drops = np.fft.irfft(np.fft.rfft(imp, n + L) * np.fft.rfft(ker, n + L), n + L)[:n]
    wash = fft_filter(rng.standard_normal(n), lo=200, hi=1300)
    return fft_filter(norm_peak(drops) * .35 + norm_peak(wash) * .65, hi=2200)
rain = rain_tex(N)
water = norm_peak(fft_filter(rng.standard_normal(N), lo=120, hi=650)) * (.7 + .3 * np.sin(2 * np.pi * .4 * tt))
water_g = env([(0, .3), (cuts["boca"], .4), (WW("s3", "engole"), .9), (cuts["galeria"], .8), (cuts["cheia"], .8), (WW("s5", "volta"), 1.2), (cuts["piscinao"], 1.0), (cuts["pacaembu"], .2), (cuts["stuck"], .0),
               (WW("s10", "devolvem"), .6), (cuts["lixo"], .7), (cuts["lama"], 0), (cuts["esponja"], .3), (cuts["parabens"], 0), (DUR, 0)])
hum_g = env([(0, 0), (WW("s10", "bombas"), 0), (WW("s10", "bombas") + .4, 1), (WW("s11", "trava"), 1), (WW("s11", "trava") + .3, .15), (cuts["grade"], .9), (cuts["lama"], 0), (DUR, 0)])
music_g = env([(0, .5), (cuts["parabens"], .5), (cuts["parabens"] + .3, .9), (DUR, .9)])

put(thunder(), .05, -4); put(thunder(3.0), WW("s5", "tempestade") - .1, -5, pan=.3)
whooshes([cuts[k] for k in cuts])
put(splash(.8), WW("s3", "engole"), -8)
put(splash(1.0), WW("s5", "volta"), -5)
for i in range(4): put(thud(.35, 60, 10), WW("s6", "cava") + i * .3, -8)
put(splash(1.2), WW("s6", "segura"), -9)
put(boom(1.4), WW("s7", "escondido") - .05, -10)
tn, tt3 = WW("s8", "novecentos"), WW("s8", "trezentas")
for i in range(10): put(tick() * .5, tn + i * .12, -14)
for i in range(14): put(pop(900 + i * 40, 700 + i * 40, .06), tt3 - .2 + i * .11, -16)
put(clac() * .6, WW("s10", "bombas"), -8)
put(alarm(), WW("s11", "trava"), -9)
put(clang(), WW("s12", "grade") - .05, -6)
put(engine_roar(4.0), WW("s14", "tratores") - .2, -9)
for i in range(5): put(thud(.3, 75, 14), WW("s14", "tratores") + 1.2 + i * .9, -12)
put(mosquito(3.0), cuts["abandono"] + .1, -12)
for w in ("planta", "canteiros"): put(pop(800, 1200, .1), WW("s16", w), -12)
put(pop(1000, 1400, .1), WW("s17", "sensor"), -12); put(siren(1.0), WW("s17", "sirene"), -12); put(whoosh(.35), WW("s17", "guarda") - .1, -10)
put(fanfare(), S0("s18") - .05, -6)
for i in range(4): put(chirp(), cuts["parabens"] + .4 + i * .7, -18, pan=.5 if i % 2 else -.5)
for k in ("boca", "galeria", "piscinao", "bombas", "grade", "trator", "esponja"):
    pass

bed = rain * rainK * .09 + water * water_g * .11 + hum_bed(N) * hum_g * .5 + pluck_bed(N) * music_g * .22
bed = fft_filter(bed, hi=6500)
with wave.open(f"{M}/audio/narracao.wav") as w:
    nar = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
nar = np.pad(nar, (0, max(0, N - len(nar))))[:N]
envn = np.convolve(np.abs(nar), np.ones(2400) / 2400, "same"); duck = 1 - .5 * np.clip(envn / (envn.max() * .25), 0, 1)
mix[:, 0] += bed * duck; mix[:, 1] += bed * duck
mix *= .55
mix[:, 0] += nar; mix[:, 1] += nar
mix = np.tanh(mix * .9) / .9
with wave.open(f"{M}/audio/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print("mix ok", round(N / SR, 2), "s")
