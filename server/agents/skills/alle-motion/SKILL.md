---
name: alle-motion
description: Escreve roteiros de vídeo motion (cenas, camadas SVG e animações) na identidade da Alle Energia, que a plataforma renderiza em MP4 na aba Motion.
---

# Motion da Alle Energia

O vídeo é um **roteiro JSON** que o servidor transforma em MP4 (resvg quadro a quadro + ffmpeg, 30 fps).
Você não gera pixels: descreve cenas, camadas em SVG e como cada camada entra, se mexe e sai.
Tudo que vale para as artes vale aqui: carregue a skill **alle-design** (cores, Montserrat, logos `alle:*`,
fotos da Ane, layout da parceria, contraste alto, nada de texto escuro nas peças da parceria, desconto
PJ até 35% e PF até 15% com a ressalva na legenda).

## Formato

```json
{
  "format": "story_9x16",          // story_9x16 (1080×1920) | feed_4x5 (1080×1350) | feed_1x1 (1080×1080) | landscape_16x9 (1920×1080)
  "fps": 30,
  "music": "mixkit-801",           // id de shared/musicLibrary ou null
  "musicVolume": 0.5,
  "background": "<svg…fragmento…>",// fundo geral (pode ter <defs> com gradientes usados pelas camadas)
  "scenes": [
    {
      "name": "frase",
      "duration": 4.2,              // segundos (vídeo inteiro: até 60 s)
      "transition": "fade",         // passagem para a próxima: fade | cut | slide-left | zoom
      "background": "…opcional…",
      "layers": [
        {
          "name": "título",
          "svg": "<text x=\"540\" y=\"600\" font-family=\"Montserrat\" …>…</text>",
          "origin": [540, 600],     // centro para escala/rotação (padrão: centro da arte)
          "in":  { "preset": "slide-up", "at": 0.3, "dur": 0.6, "ease": "out", "distance": 70 },
          "out": { "preset": "fade", "at": 3.6, "dur": 0.4 },
          "loop": { "kind": "pulse", "period": 1.4, "amount": 0.05, "from": 1 },
          "counter": { "from": 0, "to": 15, "at": 0.6, "dur": 1.6, "decimals": 0 },   // troca {{n}} no svg
          "typewriter": { "text": "e fale com a Ane", "at": 1.2, "cps": 24 }          // troca {{t}} no svg
        }
      ]
    }
  ]
}
```

- `svg` é um **fragmento** nas coordenadas da arte inteira (sem a tag `<svg>`). As camadas são desenhadas
  na ordem: a primeira fica atrás.
- Presets de entrada/saída: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `rise` (sobe de
  baixo, bom para a Ane), `pop` (cresce do zero, use com `ease: "back"`), `zoom-in`, `zoom-out`, `spin-in`,
  `wipe-right` (revela da esquerda para a direita).
- `ease`: `linear`, `out`, `in-out`, `back` (passa um pouco e volta), `elastic`.
- `loop`: `pulse` (respira), `float` (flutua), `wiggle` (balança), `glow` (pisca leve), `spin`.
- `out` sem `at` sai no fim da cena. A cena já faz fade no fim quando a transição é `fade`.

## Ritmo e regras

- 6 a 15 segundos para Reels/Stories; uma ideia por cena; 2 a 4 cenas.
- Primeiro segundo já com movimento e com a frase principal entrando (o gancho).
- Escalone as entradas (0,1 a 0,2 s entre linhas) em vez de mostrar tudo junto.
- No 9:16 a zona segura do texto é de y=250 a y=1600 (o Instagram cobre o resto).
- No 16:9 (YouTube, telas, apresentações), texto numa coluna à esquerda (centro em x≈580, até ~880 px de largura) e a Ane à direita, encostada na borda de baixo.
- Última cena: a ação ("Ative seu benefício", QR na recepção, falar com a Ane) parada por pelo menos 1,5 s.
- Nada de número inventado; percentual só "até 15%" (PF) ou "até 35%" para empresas, com a ressalva na legenda.
- Varie as composições e as fotos da Ane como nas artes.
