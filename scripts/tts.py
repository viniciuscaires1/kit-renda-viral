import asyncio, json, subprocess, sys, wave, os
import numpy as np, edge_tts
M = sys.argv[1]; ROT = sys.argv[2] if len(sys.argv) > 2 else f"{M}/scripts/roteiro.json"
VOICES = {
  "narr":    dict(voice="pt-BR-AntonioNeural", rate=os.environ.get("RATE", "+6%"), pitch=os.environ.get("PITCH", "-6Hz")),
  "claudio": dict(voice="pt-BR-AntonioNeural", rate="-6%",  pitch="-22Hz"),
  "voce":    dict(voice="pt-BR-AntonioNeural", rate="+0%",  pitch="+4Hz"),
}
SR = 48000
TIGHT = os.environ.get("TIGHT") == "1"   # narração enxuta: corta silêncios longos dentro e entre as frases
def tighten(a, max_gap=.16, thr=.012):
    """Encurta silêncios internos maiores que max_gap. Devolve o áudio e uma função que converte tempos antigos em novos."""
    fr = int(.01 * SR); n = len(a) // fr
    if n == 0: return a, (lambda x: x)
    rms = np.sqrt(np.mean(a[:n * fr].reshape(n, fr) ** 2, axis=1)); silent = rms < thr
    cuts, i = [], 0
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]: j += 1
            if (j - i) * fr / SR > max_gap:
                cs, ce = i * fr + int(max_gap / 2 * SR), j * fr - int(max_gap / 2 * SR)
                if ce > cs: cuts.append((cs, ce))
            i = j
        else: i += 1
    out, prev, rem, bps = [], 0, 0, [(0.0, 0.0)]
    for cs, ce in cuts:
        out.append(a[prev:cs]); bps.append((cs / SR, (cs - rem) / SR)); rem += ce - cs; bps.append((ce / SR, (ce - rem) / SR)); prev = ce
    out.append(a[prev:]); bps.append((len(a) / SR, (len(a) - rem) / SR))
    xs, ys = zip(*bps)
    return np.concatenate(out), (lambda x: float(np.interp(x, xs, ys)))
async def synth(sid, who, text):
    v = VOICES[who]
    c = edge_tts.Communicate(text, v["voice"], rate=v["rate"], pitch=v["pitch"], boundary="WordBoundary")
    mp3 = f"{M}/audio/tts/{sid}.mp3"; words = []
    with open(mp3, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append(dict(w=ch["text"], t=ch["offset"]/1e7, d=ch["duration"]/1e7))
    raw = subprocess.run(["ffmpeg","-v","error","-i",mp3,"-f","f32le","-ac","1","-ar",str(SR),"-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32), words
async def main():
    rot = json.load(open(ROT))
    lead = .15 if TIGHT else .35
    parts, segs, allw, t = [], [], [], lead   # respiro inicial
    parts.append(np.zeros(int(SR*lead), np.float32))
    for sid, who, text, pause in rot:
        a, words = await synth(sid, who, text)
        # corta silêncio final/inicial muito longo do TTS
        nz = np.where(np.abs(a) > 0.01)[0]
        s0 = max(0, nz[0]-int(0.03*SR)); s1 = min(len(a), nz[-1]+int(0.06*SR))
        a = a[s0:s1]; off = s0/SR
        fmap = (lambda x: x)
        if TIGHT:
            a, fmap = tighten(a)
            pause = pause if sid == rot[-1][0] else min(pause, .18)
        dur = len(a)/SR
        segs.append(dict(id=sid, who=who, text=text, start=round(t,3), end=round(t+dur,3)))
        for w in words:
            allw.append(dict(seg=sid, who=who, w=w["w"], start=round(t + fmap(w["t"] - off),3), end=round(t + fmap(w["t"] - off + w["d"]),3)))
        parts += [a, np.zeros(int(SR*pause), np.float32)]
        t += dur + pause
        print(f"{sid:4} {who:7} {segs[-1]['start']:6.2f}-{segs[-1]['end']:6.2f} words={len(words)}")
    audio = np.concatenate(parts)
    with wave.open(f"{M}/audio/narracao.wav","wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(audio,-1,1)*32767).astype(np.int16).tobytes())
    json.dump(dict(duration=round(len(audio)/SR,3), segments=segs, words=allw), open(f"{M}/timeline.json","w"), ensure_ascii=False, indent=1)
    print("TOTAL", round(len(audio)/SR,2), "s; palavras", len(allw))
asyncio.run(main())
