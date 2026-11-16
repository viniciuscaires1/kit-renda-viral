# Gera efeitos sonoros e trilha sintetizados (sem bancos de som de terceiros) e mixa com a narração.
import json, sys, wave, unicodedata, re
import numpy as np

M = sys.argv[1]
SR = 48000
TL = json.load(open(f"{M}/timeline.json"))
DUR = TL["duration"]
N = int(SR * (DUR + 0.2))
rng = np.random.default_rng(7)
SEG = {s["id"]: s for s in TL["segments"]}
WORDS = TL["words"]

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9-]", "", "".join(c for c in s if unicodedata.category(c) != "Mn"))
def WW(seg, text, nth=0):
    ws = [w for w in WORDS if w["seg"] == seg and norm(w["w"]).startswith(norm(text))]
    return ws[min(nth, len(ws) - 1)]["start"] if ws else SEG[seg]["start"]

# mesmos cortes de cena do main.js
C = dict(s2=SEG["s2"]["start"] - .12, s3=SEG["s3"]["start"] - .06, s4=SEG["s4"]["start"] - .08, s5=SEG["s5"]["start"] - .12,
         s6m=SEG["s7"]["start"] - .1, s6r=SEG["s10"]["start"] - .08, s7=SEG["s11"]["start"] - .12, s8=SEG["s14"]["start"] - .12,
         s9a=SEG["s17"]["start"] - .12, s9b=SEG["s18"]["start"] - .1, s10=SEG["s19"]["start"] - .12)

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

# ------------------------------------------------------------ pistas
mix = np.zeros((N, 2))
def put(sig, t0, gain_db=0.0, pan=0.0):
    g = 10 ** (gain_db / 20); o = int(t0 * SR)
    if o >= N or o + len(sig) <= 0: return
    s = sig[: max(0, N - o)] * g
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[o:o + len(s), 0] += s * l * 1.414; mix[o:o + len(s), 1] += s * r * 1.414

T_END = C["s10"]
# cama: ronco da estrada + drone de suspense
tt = np.arange(N) / SR
brown = np.cumsum(rng.standard_normal(N)); brown = fft_filter(brown - np.convolve(brown, np.ones(4801) / 4801, "same"), lo=25, hi=160)
brown = norm_peak(brown) * .5
road = brown * (tt > C["s2"] - .3) * (tt < T_END)
drone = (np.sin(2 * np.pi * 55 * tt) + .7 * np.sin(2 * np.pi * 82.4 * tt) + .5 * np.sin(2 * np.pi * 110.3 * tt) + .25 * np.sin(2 * np.pi * 164.8 * tt))
drone *= (.6 + .4 * np.sin(2 * np.pi * .18 * tt)) * .25
swell = np.interp(tt, [0, 3, C["s5"], SEG["s7"]["start"], C["s7"], C["s8"], C["s9a"], T_END, T_END + .05, DUR],
                       [.55, .45, .5, .8, .7, .75, 1.0, 1.0, .9, .7])
drone *= swell
# rádio: batida abafada a 100 BPM, sobe em "aumenta"
radio = np.zeros(N); beat = 60 / 100
for i in range(int(DUR / beat) + 1):
    o = int(i * beat * SR)
    k = np.sin(2 * np.pi * (58 * t_(.25) - 40 * t_(.25) ** 2)) * decay(.25, 16)
    radio[o:o + len(k)] += k[: max(0, N - o)]
    if i % 2 == 1:
        sn = rng.standard_normal(int(.12 * SR)) * decay(.12, 30) * .5; radio[o:o + len(sn)] += sn[: max(0, N - o)]
    bass = np.sin(2 * np.pi * [55, 55, 65.4, 49][i % 4] * t_(beat)) * decay(beat, 4) * .5
    radio[o:o + len(bass)] += bass[: max(0, N - o)]
radio = fft_filter(radio, lo=90, hi=900)
radio = norm_peak(radio) * .6
ta = WW("s10", "aumenta")
rgain = np.interp(tt, [0, C["s2"], ta, ta + 1.2, C["s7"], C["s8"], T_END, T_END + .1], [0, .08, .08, .38, .16, .12, .12, 0])
radio *= rgain

# ------------------------------------------------------------ eventos
put(thud(.5, 55, 8), 0.0, -4)                       # porta do carro
put(boom(), 0.12, -6)                              # impacto do título
for k in ["s2", "s3", "s4", "s5", "s6m", "s6r", "s7", "s8", "s9a", "s9b", "s10"]:
    put(whoosh(), C[k] - .2, -14, pan=.3 if k in ("s3", "s6m") else -.2)
put(pop(), SEG["s2"]["start"] - .05, -14)          # chip SEXTA
put(pop(1200, 800), WW("s2", "corrida") - .1, -12)  # card da corrida
put(pop(1200, 800), WW("s3", "claudio") - .1, -12)  # card do motorista
put(thud(.4, 70, 10), WW("s4", "bate"), -2)        # pé bate na mala
put(zipper(.9, 50), SEG["s5"]["start"] + .1, -10)  # abre o zíper
put(pop(900, 1400, .12), WW("s5", "maco"), -12)    # etiqueta 2 milhões
put(zipper(2.2, 18), SEG["s6"]["start"] + .05, -12)  # fecha devagar
for t0 in np.arange(SEG["s5"]["start"], SEG["s10"]["end"] + .3, .82): put(heartbeat(), t0, -9)
put(pop(), SEG["s8"]["start"] - .1, -14)
put(pop(1300, 900), SEG["s9"]["start"] - .05, -14)
tv = WW("s11", "vibra")
for t0 in (tv - .1, tv + .55, tv + 1.2): put(vibrate(), t0, -8)
put(plim(), WW("s12", "ja") - .05, -9)
put(plim(), WW("s13", "se") - .05, -9)
put(beep_err(), WW("s14", "rota") - .1, -10)
put(pop(), SEG["s15"]["start"] - .1, -14)
put(pop(1100, 1500, .1), WW("s16", "livre") - .1, -12)
put(engine_roar(3.2), C["s9a"] - .2, -6, pan=-.2)
tf = WW("s17", "farol")
put(riser(1.4), tf - 1.4, -10)
put(boom(1.2), tf - .02, -5)
put(whoosh(.6), tf - .05, -8)
put(plim(), WW("s18", "desce") - .05, -8)
for t0 in np.arange(SEG["s17"]["start"], T_END, .7): put(heartbeat(), t0, -8)
# contagem regressiva
tA, tC = SEG["s20"]["start"], SEG["s22"]["start"]; c0 = tA - .1; step = (tC - c0) / 5
put(boom(1.4), T_END + .02, -8)
for i in range(5): put(tick(), c0 + i * step, -6)
for t0 in np.arange(T_END, tC, .5): put(tick() * .35, t0 + .25, -16)
put(boom(1.8), tC - .05, -5)
put(riser(1.0) * .6, tC - 1.0, -14)

# ------------------------------------------------------------ narração + mix
with wave.open(f"{M}/audio/narracao.wav") as w:
    nar = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
nar = np.pad(nar, (0, max(0, N - len(nar))))[:N]
# ducking: abaixa cama/rádio quando há voz
envn = np.convolve(np.abs(nar), np.ones(2400) / 2400, "same"); duck = 1 - .45 * np.clip(envn / (envn.max() * .25), 0, 1)
bed = (road * .55 + drone * .5 + radio) * duck
mix[:, 0] += bed; mix[:, 1] += bed
mix *= .55
mix[:, 0] += nar * 1.0; mix[:, 1] += nar * 1.0
mix = np.tanh(mix * .9) / .9
out = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(f"{M}/audio/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print("mix ok", round(N / SR, 2), "s")
