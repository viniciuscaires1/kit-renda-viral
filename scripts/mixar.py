# Mixagem padrão do Kit Renda Viral: voz na frente, um "whoosh" curto em cada troca de trecho,
# um "pop" nas palavras em destaque e, se houver, uma trilha bem baixinha que abaixa sob a voz.
# Uso: python scripts/mixar.py videos/<nome>      (lê timeline.json, audio/narracao.wav e video.json)
import json, sys, os, wave, subprocess, unicodedata, re
import numpy as np
P = sys.argv[1]; SR = 48000
TL = json.load(open(f"{P}/timeline.json", encoding="utf-8"))
CFG = json.load(open(f"{P}/video.json", encoding="utf-8")) if os.path.exists(f"{P}/video.json") else {}
norm = lambda s: re.sub(r"[^a-z0-9]", "", "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn"))
with wave.open(f"{P}/audio/narracao.wav") as w:
    voz = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
DUR = max(len(voz) / SR, TL["duration"]) + 0.8
N = int(DUR * SR); t = lambda d: np.arange(int(SR * d)) / SR
rng = np.random.default_rng(7)
def lowpass(x, k):  # filtro simples de média móvel (abafa o agudo)
    return np.convolve(x, np.ones(k) / k, mode="same")
def whoosh(d=.35):
    n = rng.standard_normal(int(SR * d)); env = np.sin(np.pi * np.linspace(0, 1, len(n))) ** 2
    return lowpass(n, 18) * env * .5
def pop():
    tt = t(.09); f = 900 - 5000 * tt
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 45) * .5
efeitos = np.zeros(N)
def add(buf, x, at):
    i = int(at * SR); j = min(N, i + len(x))
    if 0 <= i < N: buf[i:j] += x[:j - i]
for s in TL["segments"][1:]: add(efeitos, whoosh(), s["start"] - .25)
dest = {norm(w) for w in CFG.get("destaques", [])}
for w in TL["words"]:
    if norm(w["w"]) in dest: add(efeitos, pop(), w["start"])
v = np.zeros(N); v[:len(voz)] = voz
trilha = np.zeros(N)
if CFG.get("trilha") and os.path.exists(CFG["trilha"]):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(CFG.get("trilha_inicio", 0)), "-i", CFG["trilha"], "-t", str(DUR), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
    m = np.frombuffer(raw, dtype=np.float32)[:N]; m = m / (np.sqrt(np.mean(m ** 2)) + 1e-9)
    trilha[:len(m)] = m
    env = np.convolve(np.abs(v), np.ones(int(SR * .25)) / int(SR * .25), mode="same")      # abaixa a trilha sob a voz
    duck = 1 - 0.6 * np.clip(env / (env.max() + 1e-9) * 4, 0, 1)
    fade = np.minimum(1, np.minimum(np.arange(N) / (2 * SR), (N - np.arange(N)) / (2.5 * SR)))
    trilha *= 10 ** (CFG.get("trilha_db", -40) / 20) * duck * fade
mix = v + efeitos * .35 + trilha
mix = mix / max(1, np.abs(mix).max() / .95)
st = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
with wave.open(f"{P}/audio/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print("mixagem pronta:", f"{P}/audio/mix.wav")
