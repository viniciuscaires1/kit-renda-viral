# Produz um vídeo completo do Kit Renda Viral a partir de uma pasta em videos/.
# A pasta precisa ter roteiro.json (trechos) e video.json (qual cena usar). Veja o CLAUDE.md.
# Uso:
#   python scripts/produzir.py videos/teste            -> narração, render, som e final.mp4
#   python scripts/produzir.py videos/teste --imagens  -> só a narração e 12 imagens de teste (folha de contato)
import json, os, re, subprocess, sys
K = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(K)
P = sys.argv[1].rstrip("/\\").replace("\\", "/"); SO_IMAGENS = "--imagens" in sys.argv
CFG = json.load(open(f"{P}/video.json", encoding="utf-8"))
PY = sys.executable
def run(cmd, env=None, etapa=""):
    print(f"\n== {etapa}", flush=True)
    r = subprocess.run(cmd, env={**os.environ, **(env or {})})
    if r.returncode: sys.exit(f"ERRO na etapa: {etapa}. Copie a mensagem acima e peça ao Claude: 'leia esse erro e conserte'.")
os.makedirs(f"{P}/audio/tts", exist_ok=True)
run([PY, "scripts/tts.py", P, f"{P}/roteiro.json"], {"RATE": CFG.get("rate", "+2%"), "PITCH": CFG.get("pitch", "-4Hz"), "TIGHT": "1" if CFG.get("enxuta", True) else "0"}, "1/5 narração com o tempo de cada palavra")
dur = json.load(open(f"{P}/timeline.json", encoding="utf-8"))["duration"]
env = {"PAGE": f"{CFG['pagina']}?v={P}", "VIEW": CFG.get("formato", "1080x1920")}
if SO_IMAGENS:
    ts = ",".join(f"{dur * (i + .5) / 12:.2f}" for i in range(12))
    run(["node", "render.mjs", "stills", ts, f"{P}/teste"], env, "imagens de teste")
    run(["ffmpeg", "-v", "error", "-y", "-pattern_type", "glob", "-i", f"{P}/teste/*.jpg", "-vf", "scale=360:-2,tile=6x2", "-frames:v", "1", f"{P}/folha-de-teste.jpg"] if os.name != "nt" else
        ["ffmpeg", "-v", "error", "-y", "-i", f"{P}/teste/t%*.jpg", "-vf", "scale=360:-2,tile=6x2", "-frames:v", "1", f"{P}/folha-de-teste.jpg"], None, "folha de contato")
    print(f"\nPRONTO: {P}/folha-de-teste.jpg"); sys.exit(0)
run(["node", "render.mjs", "video", str(CFG.get("fps", 30)), f"{P}/video_mudo.mp4"], env, "2/5 render das cenas")
run([PY, CFG.get("mixer", "scripts/mixar.py"), P], None, "3/5 efeitos e trilha")
med = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{P}/audio/mix.wav", "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", med)[-1])
run(["ffmpeg", "-v", "error", "-y", "-i", f"{P}/audio/mix.wav", "-af", f"volume={-14 - I:.2f}dB,alimiter=limit=0.89:level=false", "-ar", "48000", f"{P}/audio/mix_final.wav"], None, "4/5 volume no padrão das redes (-14 LUFS)")
run(["ffmpeg", "-v", "error", "-y", "-i", f"{P}/video_mudo.mp4", "-i", f"{P}/audio/mix_final.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", f"{P}/final.mp4"], None, "5/5 juntando imagem e som")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{P}/final.mp4", "-vf", "fps=1/3,scale=240:-2,tile=8x4", "-frames:v", "1", f"{P}/folha-de-revisao.jpg"])
print(f"\nPRONTO: {P}/final.mp4  (revisão: {P}/folha-de-revisao.jpg)")
