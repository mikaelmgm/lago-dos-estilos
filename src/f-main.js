
  // ---------- estilos ----------
  const osdEl = document.getElementById('osd'), osdTime = document.getElementById('osdTime');
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  function osdOn() { osdEl.hidden = false; }
  function osdOff() { osdEl.hidden = true; }
  function lsysEnter() { buildLsys(); voxelTrees.visible = false; lsysGroup.visible = true; lsys.grow = 0; }
  function lsysExit() { voxelTrees.visible = true; lsysGroup.visible = false; }
  function lowEnter() {
    buildLow();
    voxelWorld.visible = false; lowWorld.visible = true;
    fishVox.visible = false; fishLow.visible = true;
    activeCam = isoCam; follow = 0.9;
    renderer.setClearColor(0xa3d07f, 0);
  }
  function lowExit() {
    voxelWorld.visible = true; lowWorld.visible = false;
    fishVox.visible = true; fishLow.visible = false;
    activeCam = camera; follow = aspect < 1 ? 0.92 : 0.55;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function pulseEnter() { if (!musicStart()) showNote('Este navegador não deixou tocar som, então o lago pulsa sem música.'); }
  function plain() { renderWorld(); finish(rtScene.texture); }

  const MODES = [
    { name: 'Voxel puro', group: 'Clássicos', desc: 'A cena 3D de blocos como ela é, sem filtro nenhum.', render: plain },
    { name: 'ASCII', group: 'Clássicos', desc: 'Cada pedacinho da tela vira uma letra, escolhida pelo material e pelo brilho.', cell: [5, 18, 9], onCell: rebuildAscii, render: filtered(asciiMat) },
    { name: 'Pixel art', group: 'Clássicos', native: true, twoD: true, desc: 'Desenhado pixel por pixel em baixa resolução: água em faixas, árvores e pedras como sprites, e o peixe montado pixel a pixel em qualquer ângulo.', init: pixInit, enter: () => twoDEnter(pixToWorld), exit: twoDExit, render: pixRender },
    { name: 'Pixel isométrico', group: 'Clássicos', native: true, twoD: true, desc: 'Pixel art em vista diagonal, como jogo antigo: chão em losangos com degraus, árvores e pedras como sprites, e o peixe montado pixel a pixel.', enter: () => twoDEnter(isoToWorld), exit: twoDExit, render: isoRender },
    { name: '8 bits', group: 'Eras dos videogames', native: true, twoD: true, desc: 'Como os consoles de 8 bits: paleta curta, blocos de 8 pixels, água com 2 quadros de animação e o peixe virando em só 8 direções.', enter: () => twoDEnter(retroToWorld), exit: twoDExit, render: (dt) => retroRender(dt, false) },
    { name: 'Game Boy', group: 'Eras dos videogames', native: true, twoD: true, desc: 'Tela de portátil: 160 pixels de largura, só 4 tons de verde e a grade da tela de matriz.', enter: () => twoDEnter(retroToWorld), exit: twoDExit, render: (dt) => retroRender(dt, true) },
    { name: '16 bits (modo 7)', group: 'Eras dos videogames', native: true, desc: 'O truque dos 16 bits: o chão de pixel art inclinado em perspectiva, árvores e pedras como sprites de pé e céu com nuvens no horizonte.', enter: m7Enter, exit: m7Exit, render: m7Render },
    { name: '32 bits', group: 'Eras dos videogames', native: true, desc: '3D dos anos 90 em 32 bits: polígonos que tremem, texturas que entortam, pixels duros, pontilhado de cor e neblina escura.', enter: () => psxEnter(false), exit: psxExit, render: psxRender },
    { name: '64 bits', group: 'Eras dos videogames', native: true, desc: '3D em 64 bits: o mesmo mundo, mas com texturas lisas e borradas, imagem suave e neblina azul-clara.', enter: () => psxEnter(true), exit: psxExit, render: psxRender },
    { name: 'Vetorial flat', group: 'Clássicos', native: true, twoD: true, desc: 'Ilustração de formas chapadas e curvas limpas, vista de cima, como um desenho de Illustrator. O peixe é uma curva que ondula.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: flatRender },
    { name: 'Hachura a lápis', group: 'Desenho e pintura', desc: 'Sombras feitas de riscos cruzados no papel. As linhas tremem como desenho animado feito à mão.', cell: [4, 12, 6], render: filtered(hatchMat, 0.5, 0) },
    { name: 'Cel shading', group: 'Desenho e pintura', native: true, desc: 'Outro mundo 3D, todo arredondado: árvores fofas, peixe liso, luz em três tons e contorno preto, como anime.', enter: celEnter, exit: celExit, render: celRender },
    { name: 'Aquarela', group: 'Desenho e pintura', desc: 'Tinta que se espalha no papel molhado, com bordas mais escuras onde o pigmento seca.', render: filtered(waterColorMat, 0.4, 0) },
    { name: 'Risografia', group: 'Desenho e pintura', desc: 'Impressão em três tintas (rosa, azul e amarelo) com retícula de pontos e registro levemente torto.', cell: [4, 14, 7], render: filtered(risoMat, 0) },
    { name: 'CRT e VHS', group: 'Telas antigas', desc: 'Tela de tubo curva, linhas de varredura e a faixa de chiado da fita.', enter: osdOn, exit: osdOff, osd: true, render: filtered(crtMat, 0) },
    { name: 'Vetorial de fliperama', group: 'Telas antigas', desc: 'Só os contornos, em linhas de neon que deixam rastro no fósforo.', render: renderVector },
    { name: 'Campos de fluxo', group: 'Generativos', desc: 'Milhares de pinceladas seguindo um vento invisível. O peixe faz redemoinhos.', init: flowInit, enter: flowEnter, render: flowRender },
    { name: 'L-system', group: 'Generativos', desc: 'As árvores viram plantas fractais que crescem por regras, galho por galho.', enter: lsysEnter, exit: lsysExit, render: (dt) => { growLsys(dt); plain(); } },
    { name: 'Raymarching', group: 'Outros motores 3D', native: true, desc: 'Nada de blocos: o lago inteiro é calculado por fórmulas de distância, com formas que se derretem.', init: rayInit, render: rayRender },
    { name: 'Low poly isométrico', group: 'Outros motores 3D', native: true, desc: 'Outro cenário, todo facetado em tons pastel, visto de lado como uma maquete.', enter: lowEnter, exit: lowExit, render: plain },
    { name: 'Nanquim japonês', group: 'Feito à mão', native: true, twoD: true, desc: 'Pinceladas de tinta preta em papel de arroz, a carpa em vermelhão e um selo de carimbo no canto.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: sumiRender },
    { name: 'Papel recortado', group: 'Feito à mão', native: true, twoD: true, desc: 'Folhas de papel empilhadas, uma para cada profundidade, com sombra entre as camadas. O peixe é um recorte.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: paperRender },
    { name: 'Giz de cera', group: 'Feito à mão', native: true, twoD: true, desc: 'Desenho de criança: rabiscos de giz de cera, contornos tremidos e um sol no canto.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: (dt) => sketchRender(dt, SKETCH.crayon) },
    { name: 'Lousa de giz', group: 'Feito à mão', native: true, twoD: true, desc: 'O lago desenhado a giz num quadro-negro, com poeira de giz e moldura de madeira.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: (dt) => sketchRender(dt, SKETCH.chalk) },
    { name: 'Ukiyo-e', group: 'Feito à mão', native: true, twoD: true, desc: 'Xilogravura japonesa: água em ondas de escamas, contornos de entalhe, nuvens em faixa e cartela vermelha.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: ukiyoRender },
    { name: 'Mosaico romano', group: 'Feito à mão', native: true, twoD: true, desc: 'Pedrinhas quadradas assentadas à mão em argamassa clara, cada uma um pouco torta e de um tom diferente.', init: pixInit, enter: () => twoDEnter(pixToWorld), exit: twoDExit, render: mosaicRender },
    { name: 'Planta técnica', group: 'Design e gráficos', native: true, twoD: true, desc: 'O lago como projeto de engenharia: grade, cotas, curvas de nível e uma etiqueta que mede o peixe ao vivo.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: blueRender },
    { name: 'Mapa antigo', group: 'Design e gráficos', native: true, twoD: true, desc: 'Pergaminho com linhas de costa, rosa dos ventos, trilha pontilhada e "aqui há peixes" seguindo a carpa.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: mapRender },
    { name: 'Bauhaus', group: 'Design e gráficos', native: true, twoD: true, desc: 'Composição geométrica em vermelho, amarelo, azul e preto: círculos, meias-luas e triângulos.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: bauhausRender },
    { name: 'Quadrinhos', group: 'Design e gráficos', native: true, twoD: true, desc: 'Pop art de gibi: retícula de pontos, contorno grosso, linhas de velocidade e "NHAC!" quando o peixe come.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: comicRender },
    { name: 'Letreiro neon', group: 'Design e gráficos', native: true, twoD: true, desc: 'Tubos de neon numa parede de tijolos: o lago, o peixe e as árvores brilham e às vezes piscam.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: neonRender },
    { name: 'Bala de goma', group: 'Materiais 3D', native: true, desc: 'Peixe de goma translúcida, com casca colorida sobre miolo leitoso, num estúdio claro com sombras coloridas. Ele amassa e balança como gelatina.', enter: gumEnter, exit: gumExit, render: gumRender },
    { name: 'Massinha', group: 'Materiais 3D', native: true, desc: 'Tudo modelado em massinha, com olhos esbugalhados, animado a 12 quadros por segundo como stop-motion.', enter: clayEnter, exit: clayExit, render: clayRender },
    { name: 'Blocos de montar', group: 'Materiais 3D', native: true, desc: 'O mundo de blocos virou brinquedo de montar: plástico brilhante e um pino em cima de cada peça.', enter: brickEnter, exit: brickExit, render: brickRender },
    { name: 'Origami', group: 'Materiais 3D', native: true, desc: 'Um diorama de papel dobrado: chão em sanfona, lago em camadas de papel, árvores em pirâmide e uma carpa de origami com vincos.', enter: oriEnter, exit: oriExit, render: oriRender },
    { name: 'Mármore e ouro', group: 'Materiais 3D', native: true, desc: 'O mundo arredondado esculpido em mármore com veios, sobre pedra escura, e a carpa como estátua de ouro.', enter: marbleEnter, exit: marbleExit, render: marbleRender },
    { name: 'Vitral', group: 'Luz e vidro', native: true, desc: 'O lago inteiro montado em peças de vidro colorido com chumbo entre elas, e a luz passando. Calculado direto na placa de vídeo.', enter: glassEnter, exit: glassExit, render: glassRender },
    { name: 'Cromo holográfico', group: 'Luz e vidro', native: true, desc: 'O mundo arredondado em metal espelhado que muda de cor conforme o ângulo, como bolha de sabão.', enter: holoEnter, exit: holoExit, render: holoRender },
    { name: 'Raio-X', group: 'Luz e vidro', native: true, twoD: true, desc: 'Tudo translúcido em filme de raio-x: nervuras nas folhas, galhos nas árvores e o esqueleto do peixe brilhando.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: xrayRender },
    { name: 'Silhueta ao pôr do sol', group: 'Luz e vidro', native: true, twoD: true, desc: 'Contra a luz: tudo vira silhueta preta, e só a água brilha, refletindo o céu laranja com o sol no meio.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: duskRender },
    { name: 'Câmera térmica', group: 'Luz e vidro', native: true, twoD: true, desc: 'Visão infravermelha: o peixe é a coisa mais quente do lago, as pedras guardam o calor do sol e a água é fria.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: heatRender },
    { name: 'Synthwave', group: 'Retrô', native: true, desc: 'Anos 80: grade neon, lago espelhado com anéis, montanhas de arame e um sol listrado no horizonte, com câmera baixa.', enter: synthEnter, exit: synthExit, render: synthRender },
    { name: 'Terminal verde', group: 'Retrô', native: true, twoD: true, desc: 'O jogo inteiro em texto num monitor de fósforo verde: ~ é água, & é árvore e o peixe é ><(((°>.', enter: () => twoDEnter(flatToWorld), exit: twoDExit, render: termRender },
    { name: 'Tinta na água', group: 'Física', desc: 'Um fluido de verdade: o peixe solta tinta colorida que gira e se espalha.', init: flInit, screen: true, render: flRender },
    { name: 'Gelatina', group: 'Física', desc: 'A imagem inteira presa numa malha de molas. O peixe empurra e tudo balança.', init: jellyInit, screen: true, render: jellyRender },
  ];

  // reações ao peixe comer, em alguns estilos
  eatHooks.push((f) => {
    if (cur && cur.render === celRender) celStars(f);
    if (cur && cur.twoD) rings2.push({ x: f.x, z: f.z, t: 0, big: 1.2 });
    if (cur && cur.render === comicRender) comic.pops.push({ x: f.x, z: f.z - 1, t: 0, txt: 'NHAC!', c: '#ffe14d' });
    if (cur && cur.render === gumRender) gum.sqv += 30;
    toScreen(f.x, f.y, f.z, tmpS);
    if (cur && cur.render === flRender) fl.burst = { x: tmpS.x / buf.x, y: tmpS.y / buf.y };
    if (cur && cur.render === jellyRender) jelly.kicks.push({ x: tmpS.x / buf.x * 2 - 1, y: tmpS.y / buf.y * 2 - 1 });
    if (cur && cur.render === sandRender) sand.queue.push({ x: tmpS.x, y: tmpS.y });
  });

  // ---------- aba de estilos ----------
  const listEl = document.getElementById('styleList'), stylesEl = document.getElementById('styles'), toggleEl = document.getElementById('stylesToggle');
  const numEl = document.getElementById('styleNum'), nameEl = document.getElementById('styleName'), descEl = document.getElementById('styleDesc');
  const noteEl = document.getElementById('note'), sizeRow = document.getElementById('sizeRow'), cellInput = document.getElementById('cell');
  const narrow = () => window.matchMedia('(max-width: 720px)').matches;
  document.getElementById('styleCount').textContent = MODES.length;
  const btns = [];
  let lastGroup = '';
  MODES.forEach((m, i) => {
    if (m.group !== lastGroup) {
      const h = document.createElement('h2');
      h.textContent = m.group;
      listEl.appendChild(h);
      lastGroup = m.group;
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'style-btn'; b.setAttribute('aria-pressed', 'false');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1).padStart(2, '0');
    const t = document.createElement('span'); t.textContent = m.name;
    b.append(n, t);
    if (m.native) { const g = document.createElement('span'); g.className = 'tag'; g.textContent = 'própria'; b.append(g); }
    b.addEventListener('click', () => { setMode(i); b.blur(); if (narrow()) setPanel(false); });
    listEl.appendChild(b);
    btns.push(b);
    if (m.cell) m.cellCss = m.cell[2];
  });
  function setPanel(open) {
    stylesEl.classList.toggle('closed', !open);
    toggleEl.setAttribute('aria-expanded', String(open));
  }
  toggleEl.addEventListener('click', () => setPanel(stylesEl.classList.contains('closed')));
  setPanel(!narrow());

  let cur = null, curIndex = 0, noteTimer = 0;
  function showNote(msg) {
    noteEl.textContent = msg; noteEl.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { noteEl.hidden = true; }, 7000);
  }
  function applyCell() {
    if (!cur || !cur.cell) return;
    U.uCell.value = Math.max(2, Math.round(cur.cellCss * DPR));
    if (cur.onCell) cur.onCell();
  }
  function setMode(i) {
    i = (i + MODES.length) % MODES.length;
    const m = MODES[i];
    if (m === cur) return;
    if (m.init && !m.ready) {
      let ok = false;
      try { ok = m.init() !== false; } catch (e) { ok = false; }
      if (!ok) { showNote(`O estilo ${m.name} precisa de um recurso de vídeo que este aparelho não tem.`); return; }
      m.ready = true;
    }
    if (cur && cur.exit) cur.exit();
    cur = m; curIndex = i;
    if (m.enter) m.enter();
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    if (!stylesEl.classList.contains('closed')) btns[i].scrollIntoView({ block: 'nearest' });
    numEl.textContent = String(i + 1).padStart(2, '0');
    nameEl.textContent = m.name;
    descEl.textContent = m.desc;
    document.getElementById('styleTag').hidden = !m.native;
    sizeRow.hidden = !m.cell;
    if (m.cell) { cellInput.min = m.cell[0]; cellInput.max = m.cell[1]; cellInput.value = m.cellCss; applyCell(); }
    try { localStorage.setItem('lago-estilo', String(i)); } catch (_) {}
  }
  cellInput.addEventListener('input', () => { if (cur && cur.cell) { cur.cellCss = +cellInput.value; applyCell(); } });

  window.addEventListener('keydown', (e) => {
    if (e.target === cellInput) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyQ') { if (!e.repeat) setMode(curIndex - 1); return; }
    if (e.code === 'KeyE') { if (!e.repeat) setMode(curIndex + 1); return; }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', () => {
    if (cur && cur.music && music.ctx && music.ctx.state !== 'running') music.ctx.resume();
  });

  // ---------- tamanho da tela ----------
  function resizeOne(rt, scale) {
    const k = sized.findIndex(s => s[0] === rt);
    if (k >= 0) sized[k][1] = scale;
    rt.setSize(Math.max(1, Math.round(buf.x * scale)), Math.max(1, Math.round(buf.y * scale)));
  }
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    aspect = w / h;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(buf);
    for (const [rt, s] of sized) rt.setSize(Math.max(1, Math.round(buf.x * s)), Math.max(1, Math.round(buf.y * s)));
    camera.aspect = aspect; camera.updateProjectionMatrix();
    camScale = clamp(0.8 / aspect, 1, 1.55);
    follow = activeCam === isoCam ? 0.9 : (aspect < 1 ? 0.92 : 0.55);
    sizeIso();
    if (!c2.hidden) { c2.width = buf.x; c2.height = buf.y; }
    for (const m of MODES) {
      if (!m.screen || !m.ready) continue;
      if (m === cur) m.init(); else m.ready = false;
    }
    applyCell();
  }
  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('800 16px "JetBrains Mono"'), document.fonts.load('700 16px "Bricolage Grotesque"')]).then(applyCell, () => {});
  }

  // ---------- laço principal ----------
  let last = performance.now(), osdSec = -1;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    U.uTime.value = time;
    if (cur.osd && Math.floor(time) !== osdSec) {
      osdSec = Math.floor(time);
      const d = new Date();
      osdTime.textContent = `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
    cur.render(dt);
    requestAnimationFrame(frame);
  }

  // Mantém placar, peixe e estilo quando a página é atualizada com o jogo aberto.
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    hot.snapshot(() => ({ score, x: F.x, z: F.z, heading: F.heading, mode: curIndex }));
  }
  function start(data) {
    data = data || {};
    if (Number.isFinite(data.score)) { score = data.score; scoreEl.textContent = score; }
    if (Number.isFinite(data.x) && Number.isFinite(data.z)) { F.x = data.x; F.z = data.z; }
    if (Number.isFinite(data.heading)) F.heading = data.heading;
    resize();
    camT.set(F.x * follow, 0, F.z * follow + 1.5);
    placeCamera();
    let initial = 1;
    try { const s = parseInt(localStorage.getItem('lago-estilo'), 10); if (s >= 0 && s < MODES.length) initial = s; } catch (_) {}
    if (Number.isFinite(data.mode)) initial = data.mode;
    if (MODES[initial] && MODES[initial].music) initial = 1;  // o som só começa com um clique
    setMode(initial);
    if (!cur) setMode(0);
    requestAnimationFrame(frame);
  }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start(hot && hot.data);
})();
</script>
