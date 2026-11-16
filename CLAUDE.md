# Kit Renda Viral: guia para o Claude

Este repositório é um estúdio de vídeos curtos animados em 3D (1080x1920, para Reels, TikTok e Shorts). A pessoa que está usando é aluna do curso Renda Viral e, em geral, **não é programadora**: explique em português simples, peça permissão antes de instalar qualquer coisa e mostre o resultado (imagens e vídeos) sempre que terminar uma etapa.

## Como o estúdio funciona
1. **Roteiro** em trechos (`videos/<nome>/roteiro.json`).
2. **Narração** com o tempo de cada palavra (`scripts/tts.py` → `audio/narracao.wav` e `timeline.json`).
3. **Cena 3D** em uma página web (Three.js) que desenha qualquer instante do vídeo. Tudo na tela é sincronizado pelo `timeline.json`.
4. **Render** quadro a quadro no Chrome headless (`render.mjs`) → `video_mudo.mp4`.
5. **Som**: voz, efeitos e trilha (`scripts/mixar.py` ou o `sfx.py` do modelo) → `audio/mix.wav`.
6. **Final**: volume em -14 LUFS e junção → `videos/<nome>/final.mp4`, mais uma folha de revisão.

O comando que faz tudo: `python3 scripts/produzir.py videos/<nome>` (no Windows: `python scripts\produzir.py videos/<nome>`).
Só narração + 12 imagens de teste: acrescente `--imagens`.

## Estrutura
```
render.mjs                 render quadro a quadro (acha o Chrome no Mac, Windows ou Linux)
scripts/tts.py             narração (edge-tts) + timeline.json com o tempo de cada palavra
scripts/mixar.py           mixagem padrão: voz, whoosh nas trocas, pop nos destaques, trilha opcional
scripts/produzir.py        executa todas as etapas
teste/                     cena do vídeo de teste (10 s)
modelos/curiosidade-piscinao/   cena + som do vídeo real "Você construiu um piscinão" (formato curiosidade)
modelos/historia-ab-mala/       cena + som do vídeo real "A mala no Uber, parte 1" (formato história A ou B)
videos/<nome>/             cada vídeo: roteiro.json, video.json e os arquivos gerados
```

## Instalação (faça uma vez)
Precisa de: Node.js 18+, Python 3.10+, ffmpeg e Google Chrome.
- **Mac:** use o Homebrew (`brew install node python ffmpeg`). Se o Homebrew não existir, explique e peça para a pessoa instalá-lo pelo site oficial. Se o sistema pedir a senha do Mac, a pessoa digita no Terminal; nunca peça a senha no chat.
- **Windows:** `winget install OpenJS.NodeJS.LTS Python.Python.3.12 Gyan.FFmpeg Google.Chrome`. Depois, oriente a fechar e abrir o app do Claude para os programas entrarem no PATH. Evite pastas sincronizadas com OneDrive.
- **Nuvem / celular (Claude Code na web):** instale ffmpeg pelo gerenciador de pacotes do ambiente e um Chrome próprio do projeto: `npx @puppeteer/browsers install chrome-headless-shell@stable --path .chrome` (o `render.mjs` encontra sozinho o que estiver em `.chrome/`). Sem placa de vídeo, o render usa SwiftShader e fica mais lento.
- Depois: `npm install` e `python3 -m pip install -r requirements.txt` (se o pip reclamar de ambiente gerenciado, crie um venv: `python3 -m venv .venv` e use o Python dele).
- Teste: `python3 scripts/produzir.py videos/teste`. Deu certo se `videos/teste/final.mp4` tiver imagem, voz e legenda.

## Fazendo um vídeo novo
### 1. Roteiro
Formato curiosidade “Você construiu um [TEMA]”: gancho “Se você [ação ingênua], [consequência absurda]”, de 6 a 12 ciclos (problema “Mas...” → solução “Então você...” → nome técnico “Esse é o...”), um tempero a cada 3 ou 4 ciclos (“Parece mentira, mas...” com número real, ou “É por isso que...”), fechamento “Parabéns! Você construiu um [TEMA]!” e chamada para seguir. 400 a 600 palavras, linguagem falada, números por extenso.
Formato história A ou B: 60 a 80 s, segunda pessoa, gancho absurdo, escalada em 4 passos, escolha entre duas opções arriscadas com contagem regressiva, “Comenta A ou B”.
**Confira todos os números em fontes confiáveis antes de gravar.** Na dúvida, tire o número e mantenha a frase. Nunca invente dados.

### 2. Arquivos do vídeo
`videos/<nome>/roteiro.json`: lista de trechos `[id, voz, texto, pausa_depois_em_segundos]`. Vozes prontas: `narr` (narrador), `claudio` (voz grave) e `voce` (voz do protagonista), todas em `scripts/tts.py`.
```json
[["s1", "narr", "Se você asfaltar uma cidade inteira, quando chover forte, a água não tem pra onde ir.", 0.2],
 ["s2", "narr", "E a rua vira um rio.", 0.2]]
```
`videos/<nome>/video.json`:
```json
{"pagina": "cenas/<nome>/cena.html", "formato": "1080x1920", "rate": "+4%", "pitch": "-4Hz", "enxuta": true,
 "destaques": ["piscinão", "galeria"], "trilha": "caminho/da/trilha.mp3", "trilha_db": -40, "mixer": "scripts/mixar.py"}
```
`enxuta: true` corta silêncios longos da narração. `trilha` é opcional (use só música com licença para uso comercial).

### 3. Cena
Copie o modelo mais parecido para `cenas/<nome>/` (`modelos/curiosidade-piscinao` ou `modelos/historia-ab-mala`) e adapte. Contrato que toda cena precisa cumprir (o `render.mjs` depende disso):
- ler o vídeo pela URL: `?v=videos/<nome>` e carregar `/<v>/timeline.json`;
- definir `window.DURATION` (segundos), `window.renderAt = async (t) => {...}` (desenha o instante `t` de forma determinística, sem depender do relógio) e, no fim do carregamento, `window.READY = true`;
- sincronizar eventos pelas palavras: procure a palavra no `timeline.json` (veja a função `WW(trecho, palavra)` nos modelos);
- opcional: `window.COVER` (modo capa: esconde a legenda e mostra o título da capa).
Reaproveite as peças dos modelos (cidade, rua, carros, interior de carro, corte de terreno, personagens, água, chuva, etiquetas). Peças coplanares causam “quadros tremendo” (z-fighting): afaste-as milímetros e use `shadow.normalBias`.
Antes do render completo, gere as imagens de teste (`--imagens`) e mostre a folha de contato para a pessoa aprovar.

### 4. Padrão visual
- Legenda: uma palavra por vez, grande, branca com contorno preto, um pouco abaixo do meio. Nomes técnicos e palavras fortes em amarelo `#FFD60A`.
- Etiquetas flutuantes: pílula branca com bolinha colorida (azul = informação, vermelho = problema, amarelo = nome técnico), presas no objeto.
- Área segura do Instagram: nada importante nos 20% de baixo nem na faixa direita (botões e nome do perfil).
- Tipografia Montserrat 900 (já vem em `node_modules/@fontsource/montserrat`).

### 5. Som
Hierarquia: voz > efeitos > trilha (trilha quase imperceptível, por volta de -40 dB). Um efeito a cada ~2 s (whoosh nas trocas, pop nas etiquetas, impacto quando algo desaba). **Nunca deixe som de fundo contínuo alto** (chuva, vento, motor): use gotas/eventos individuais, abafe o agudo e mantenha baixo. Volume final: -14 LUFS (o `produzir.py` já ajusta).

### 6. Revisão e entrega
Abra `folha-de-revisao.jpg` (um quadro a cada 3 s) e confira: voz clara, legenda sincronizada, nenhum quadro tremendo, cenas com luz suficiente, objeto principal visível, nada cortado na borda ou na área dos botões.
Capa: `COVER=1 PAGE="cenas/<nome>/cena.html?v=videos/<nome>" node render.mjs stills <segundo> videos/<nome>/capa` (no Windows, defina as variáveis com `set`). Texto no centro: a grade do Instagram mostra só o meio (4:5).
Exportação: 1080x1920, 30 fps, H.264, AAC, -14 LUFS (é o `final.mp4`).

### 7. Modo celular (repositório no GitHub)
Salve o vídeo final em `videos/<nome>/final.mp4` e faça commit e push. O `.gitignore` já ignora áudio intermediário e o vídeo mudo. Se o arquivo passar de 50 MB, gere uma versão comprimida (`-crf 24`) antes do push. Quando a pessoa pedir, apague do repositório vídeos que ela já postou.

## Regras importantes
- Voz: a voz gratuita (edge-tts) é ótima para aprender e testar, mas não é um produto oficial para uso comercial. Quando o perfil começar a monetizar, recomende trocar por uma ferramenta com licença comercial; como tudo segue o `timeline.json`, basta gerar a narração de novo.
- Histórias de ficção: lembre a pessoa de avisar na legenda do post (“Ficção. Narração com voz gerada por IA.”) e ativar o rótulo de IA da plataforma.
- Não use marcas, personagens ou músicas de terceiros sem licença.
- Se algo der erro, leia a mensagem, explique em uma frase o que aconteceu e conserte.
