# Lago dos Estilos

Um peixinho nadando num lago, desenhado em 45 estilos de arte diferentes. Você escolhe o estilo numa aba do lado da tela e o jogo continua de onde estava: mesmo peixe, mesmo lago, mesmos petiscos.

## Como jogar

Abra o `index.html` no navegador. Precisa de internet, porque o three.js e as fontes vêm de CDN.

- **W A S D** ou **setas**: nadar
- **Clique e segure** no lago: o peixe nada até lá
- **Q** e **E**: trocam o estilo
- No celular: toque e segure no lago para guiar o peixe

Coma os petiscos que caem na água para o placar subir.

O `ascii.html` é a primeira versão do jogo, só em ASCII.

## Estilos

★ = arte própria: um mundo desenhado do zero naquele estilo, não um efeito por cima da cena de blocos.

- **Clássicos:** Voxel puro · ASCII · Pixel art ★ · Pixel isométrico ★ · Vetorial flat ★
- **Eras dos videogames:** 8 bits ★ · Game Boy ★ · 16 bits (modo 7) ★ · 32 bits ★ · 64 bits ★
- **Desenho e pintura:** Hachura a lápis · Cel shading ★ · Aquarela · Risografia
- **Telas antigas:** CRT e VHS · Vetorial de fliperama
- **Generativos:** Campos de fluxo · L-system
- **Outros motores 3D:** Raymarching ★ · Low poly isométrico ★
- **Feito à mão:** Nanquim japonês ★ · Papel recortado ★ · Giz de cera ★ · Lousa de giz ★ · Ukiyo-e ★ · Mosaico romano ★
- **Design e gráficos:** Planta técnica ★ · Mapa antigo ★ · Bauhaus ★ · Quadrinhos ★ · Letreiro neon ★
- **Materiais 3D:** Bala de goma ★ · Massinha ★ · Blocos de montar ★ · Origami ★ · Mármore e ouro ★
- **Luz e vidro:** Vitral ★ · Cromo holográfico ★ · Raio-X ★ · Silhueta ao pôr do sol ★ · Câmera térmica ★
- **Retrô:** Synthwave ★ · Terminal verde ★
- **Física:** Tinta na água · Gelatina

## Como o código está organizado

O jogo é um arquivo HTML só (`index.html`), montado a partir das partes em `src/`:

| Arquivo | O que tem |
| --- | --- |
| `a-head.html` | Estilos da página, placar e a aba de estilos |
| `b-core.js` | O mundo de blocos, a água, o peixe, os petiscos, a câmera e o controle |
| `c-post.js` | Base dos efeitos de tela e os filtros (ASCII, hachura, riso, CRT, aquarela, fliperama) |
| `d-sims.js` | Simulações: campos de fluxo, fluido e gelatina |
| `e-worlds.js` | Low poly, L-system e raymarching |
| `g-native.js` | Base dos mundos 2D, vetorial flat, pixel art e cel shading |
| `h-more.js` | Nanquim, planta técnica, mapa, papel, neon, massinha e blocos de montar |
| `i-extra.js` | Bala de goma, Bauhaus, quadrinhos, giz de cera e lousa |
| `j-batch.js` | Vitral, synthwave, cromo holográfico, ukiyo-e, terminal, raio-x e mosaico romano |
| `k-batch.js` | Origami, mármore, pixel isométrico, pôr do sol e câmera térmica |
| `l-retro.js` | 8 bits, Game Boy, modo 7, 32 bits e 64 bits |
| `f-main.js` | A lista dos estilos, a aba, a troca de estilo e o laço principal |

Depois de mexer em `src/`, rode `./build.sh` para montar o `index.html` de novo.

Feito com [three.js](https://threejs.org/) r128, WebGL e Canvas 2D.
