
  // ======================================================================
  // ERAS DOS VIDEOGAMES: 8 bits, Game Boy, 16 bits (modo 7), 32 bits, 64 bits
  // ======================================================================
  const NES = { k: '#000000', w: '#fcfcfc', g1: '#005800', g2: '#00a800', g3: '#b8f818', b0: '#0000bc', b1: '#0058f8', b2: '#3cbcfc', b3: '#a4e4fc', s1: '#f8d878', s2: '#fca044', br: '#ac7c00', bd: '#503000', gr: '#bcbcbc', pk: '#f878f8', or: '#f83800', rd: '#a81000' };
  const GB = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
  const retro = { S: 2, ox: 0, oy: 0 };
  function px8(fn, w = 8, h = 8) {
    return tile(w, h, (x) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(i, j); if (c) { x.fillStyle = c; x.fillRect(i, j, 1, 1); } } });
  }
  function pixBall(cx, cy, r, body, out, light, w, h, extra) {
    return px8((i, j) => {
      const e = extra && extra(i, j);
      if (e) return e;
      const d = Math.hypot(i - cx, j - cy);
      if (d > r) return null;
      if (d > r - 1) return out;
      return Math.hypot(i - cx + r * 0.4, j - cy + r * 0.4) < r * 0.45 ? light : body;
    }, w, h);
  }
  function retroTiles() {
    if (retro.tiles) return;
    const water = (f, deep) => px8((i, j) => (((i + f * 2 + (j >> 1) * 3) % 8) < 2 && j % 4 === 1 ? (deep ? NES.b1 : NES.b2) : (deep ? NES.b0 : NES.b1)));
    retro.tiles = [
      [px8((i, j) => ((i * 3 + j * 5) % 11 === 0 ? NES.g1 : (i * 7 + j * 3) % 23 === 0 ? NES.g3 : NES.g2))],
      [px8((i, j) => ((i * 5 + j * 3) % 9 === 0 ? NES.s2 : NES.s1))],
      [water(0, false), water(1, false)],
      [water(0, true), water(1, true)],
      [px8((i, j) => ((i * 7 + j * 5) % 13 === 0 ? NES.br : NES.s2))],
      [px8((i, j) => (j === 0 || j === 4 ? NES.bd : NES.br))],
    ];
    const trunk = (i, j) => (j >= 12 && i >= 6 && i <= 9 ? NES.bd : null);
    retro.tree = [pixBall(7.5, 6.5, 6.5, NES.g2, NES.k, NES.g3, 16, 16, trunk), pixBall(7.5, 6.5, 6.5, NES.pk, NES.k, NES.w, 16, 16, trunk)];
    retro.rock = pixBall(3.5, 3.5, 3.4, NES.gr, NES.k, NES.w, 8, 8);
    retro.pad = pixBall(3.5, 3.5, 3.4, NES.g2, NES.g1, NES.g3, 8, 8, (i, j) => (i > 3 && Math.abs(j - 3.5) < (i - 3) * 0.5 ? NES.b1 : null));
  }
  const FISH_NES = { body: NES.or, light: NES.s2, white: NES.w, red: NES.rd, fin: NES.s2, eye: NES.k };
  // peixe em pixels; no 8 bits ele só vira em 8 direções e a cauda tem 2 quadros
  function retroFish(c, ox, oy, PU, pal, outline, snap) {
    const h = snap ? Math.round(F.heading / (Math.PI / 4)) * (Math.PI / 4) : F.heading;
    const saved = F.phase;
    if (snap) F.phase = Math.floor(F.phase / Math.PI) * Math.PI + Math.PI / 2;
    const amp = fishAmp(), cs = Math.cos(h), sn = Math.sin(h);
    const cx = (F.x - X0) * PU - ox, cy = (F.z - Z0) * PU - oy, R = Math.ceil(2.6 * FISH_SIZE * PU) + 1, size = 2 * R + 1;
    const x0 = Math.floor(cx) - R, y0 = Math.floor(cy) - R, grid = new Array(size * size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const wx = (x0 + i + 0.5 + ox) / PU + X0 - F.x, wz = (y0 + j + 0.5 + oy) / PU + Z0 - F.z;
      grid[j * size + i] = fishPixel((wx * cs - wz * sn) / FISH_SIZE, (wx * sn + wz * cs) / FISH_SIZE, amp);
    }
    F.phase = saved;
    const at = (i, j) => (i < 0 || j < 0 || i >= size || j >= size) ? null : grid[j * size + i];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const k = grid[j * size + i];
      if (!k) continue;
      c.fillStyle = (!at(i + 1, j) || !at(i - 1, j) || !at(i, j + 1) || !at(i, j - 1)) ? outline : pal[k];
      c.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
  function retroRender(dt, gb) {
    isoBuild(); retroTiles();
    follow2(dt); ringsTick(dt);
    const S = Math.max(2, Math.round(buf.x / (gb ? 160 : 256))), lw = Math.ceil(buf.x / S), lh = Math.ceil(buf.y / S), PU = 8;
    if (!retro.low || retro.low.width !== lw || retro.low.height !== lh) { retro.low = tile(lw, lh, () => {}); retro.lc = retro.low.getContext('2d', { willReadFrequently: true }); }
    const c = retro.lc;
    const ox = Math.round((view2.x - X0) * PU - lw / 2), oy = Math.round((view2.z - Z0) * PU - lh / 2);
    Object.assign(retro, { S, ox, oy });
    const fr = Math.floor(time * 2) % 2, P = (x, z) => [Math.round((x - X0) * PU - ox), Math.round((z - Z0) * PU - oy)];
    c.fillStyle = NES.g2; c.fillRect(0, 0, lw, lh);
    const i0 = Math.max(0, Math.floor(ox / PU)), i1 = Math.min(ISO.cols - 1, Math.floor((ox + lw) / PU)), j0 = Math.max(0, Math.floor(oy / PU)), j1 = Math.min(ISO.rows - 1, Math.floor((oy + lh) / PU));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const set = retro.tiles[ISO.map[j * ISO.cols + i]]; c.drawImage(set[fr % set.length], i * PU - ox, j * PU - oy); }
    for (const f of flowers2) { const [x, y] = P(f.x, f.z); c.fillStyle = f.c === 0xffe066 ? NES.s1 : f.c === 0xff9ec4 ? NES.pk : NES.w; c.fillRect(x, y, 1, 1); }
    pads.forEach(p => { const [x, y] = P(p.x, p.z); c.drawImage(retro.pad, x - 4, y - 4); });
    rocks.forEach(r => { const [x, y] = P(r.x, r.z); c.drawImage(retro.rock, x - 4, y - 4); });
    c.fillStyle = NES.g1;
    for (const r of reeds) { const [x, y] = P(r.x, r.z); c.fillRect(x + Math.round(Math.sin(time * 1.3 + r.ph)), y - 4, 1, 4); }
    for (const f of foods) if (f.on) { const [x, y] = P(f.x, f.z); c.fillStyle = NES.s2; c.fillRect(x - 1, y - 1, 2, 2); }
    c.fillStyle = NES.w;
    for (const b of bubbles) if (b.on) { const [x, y] = P(b.x, b.z); c.fillRect(x, y, 1, 1); }
    c.fillStyle = NES.b3;
    for (const r of rings2) {
      const rad = (0.3 + r.t * 2.2 * r.big) * PU, [x, y] = P(r.x, r.z), n = Math.max(12, Math.round(rad * 5));
      for (let k = 0; k < n; k += r.t > 0.6 ? 2 : 1) { const a = k / n * TAU; c.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad), 1, 1); }
    }
    retroFish(c, ox, oy, PU, FISH_NES, NES.k, true);
    trees.map((t, i) => [t, i]).sort((a, b) => a[0].z - b[0].z).forEach(([t, i]) => { const [x, y] = P(t.x, t.z); c.drawImage(retro.tree[treeLook[i].pink ? 1 : 0], x - 8, y - 12); });
    c.fillStyle = NES.k; c.fillRect(0, lh - 12, lw, 12);
    c.font = '8px "Press Start 2P", monospace'; c.fillStyle = NES.w; c.textBaseline = 'top'; c.textAlign = 'left';
    c.fillText('PETISCOS x' + String(score).padStart(2, '0'), 4, lh - 10);
    if (gb) {
      // só 4 tons de verde, como a tela do portátil
      const im = c.getImageData(0, 0, lw, lh), d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], g = GB[l < 50 ? 0 : l < 110 ? 1 : l < 175 ? 2 : 3];
        d[i] = g[0]; d[i + 1] = g[1]; d[i + 2] = g[2];
      }
      c.putImageData(im, 0, 0);
    }
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.imageSmoothingEnabled = false;
    g2.drawImage(retro.low, 0, 0, lw * S, lh * S);
    if (gb) { g2.fillStyle = pattern('gbgrid' + S, () => tile(S, S, (x) => { x.fillStyle = 'rgba(15, 56, 15, 0.22)'; x.fillRect(0, 0, S, 1); x.fillRect(0, 0, 1, S); })); g2.fillRect(0, 0, buf.x, buf.y); }
  }
  const retroToWorld = (cx, cy) => { const [x, y] = devXY(cx, cy); return { x: X0 + (x / retro.S + retro.ox) / 8, z: Z0 + (y / retro.S + retro.oy) / 8 }; };

  // ---------- 16 BITS: chão de pixel em perspectiva (modo 7) e sprites de pé ----------
  const m7World = new T.Group();
  m7World.visible = false;
  scene.add(m7World);
  const m7 = { built: false, food: [] };
  const nearestTex = (cv) => { const t = new T.CanvasTexture(cv); t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t; };
  function buildM7() {
    if (m7.built) return;
    m7.built = true;
    pixInit();
    const cv = tile(pix.ground.width, pix.ground.height, (x) => {
      x.drawImage(pix.ground, 0, 0);
      for (const p of pads) {
        const cx = (p.x - X0) * PIX, cy = (p.z - Z0) * PIX, R = p.r * PIX;
        for (let y = -R; y <= R; y++) for (let xx = -R; xx <= R; xx++) {
          const d = Math.hypot(xx, y);
          if (d > R) continue;
          x.fillStyle = d > R - 1 ? '#2f7d44' : Math.hypot(xx + R * 0.3, y + R * 0.3) < R * 0.5 ? '#74cf6f' : '#4fae5c';
          x.fillRect(Math.round(cx + xx), Math.round(cy + y), 1, 1);
        }
      }
    });
    const floor = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: nearestTex(cv) }));
    floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    m7World.add(floor);
    const treeSpr = (body, out, light) => nearestTex(px8((i, j) => {
      if (j >= 17 && i >= 7 && i <= 9) return j === 17 ? '#3d2410' : '#6e4426';
      const d = Math.hypot(i - 8, (j - 9) * 1.05);
      if (d > 8) return null;
      if (d > 7) return out;
      const sh = (i - 8) * 0.5 + (j - 9) * 0.7;
      return sh < -2.5 ? light : sh > 3 ? out : body;
    }, 17, 24));
    const tex = [treeSpr('#3f9a4c', '#24603a', '#7bd47b'), treeSpr('#e58fae', '#9c4a6c', '#ffd0df')];
    trees.forEach((t, i) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex[treeLook[i].pink ? 1 : 0] }));
      const k = 0.85 + treeLook[i].r * 0.3;
      s.scale.set(3.4 * k, 4.8 * k, 1); s.position.set(t.x, 2.4 * k, t.z);
      m7World.add(s);
    });
    const rockT = nearestTex(px8((i, j) => { const d = Math.hypot(i - 4, (j - 4) * 1.3); return d > 4 ? null : d > 3 ? '#5f5b72' : j < 3 ? '#d4d2e0' : '#a9a6b8'; }, 9, 8));
    rocks.forEach((r) => { const s = new T.Sprite(new T.SpriteMaterial({ map: rockT })); s.scale.set(1.3 * r.s, 1.1 * r.s, 1); s.position.set(r.x, 0.5 * r.s, r.z); m7World.add(s); });
    const foodT = nearestTex(px8((i, j) => (Math.hypot(i - 2, j - 2) < 2.2 ? (i + j < 3 ? '#ffd08a' : '#f3a23a') : null), 5, 5));
    for (let i = 0; i < foods.length; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: foodT })); s.scale.set(0.5, 0.5, 1); m7World.add(s); m7.food.push(s); }
    // o peixe é uma placa deitada sobre a água, redesenhada pixel a pixel a cada quadro
    m7.fishCv = tile(48, 48, () => {});
    m7.fishTex = nearestTex(m7.fishCv);
    m7.fish = new T.Mesh(new T.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: m7.fishTex, transparent: true }));
    m7World.add(m7.fish);
    // horizonte: céu em degradê com nuvens e montanhas de pixel
    const sky = tile(256, 96, (x) => {
      for (let y = 0; y < 96; y++) { const t = y / 96; x.fillStyle = `rgb(${Math.round(90 + 90 * t)}, ${Math.round(160 + 60 * t)}, ${Math.round(255 - 20 * t)})`; x.fillRect(0, y, 256, 1); }
      const r = mulberry32(4);
      for (let k = 0; k < 7; k++) { const cx = r() * 256, cy = 20 + r() * 30, w = 18 + r() * 26; for (let i = -w; i < w; i++) { const hh = Math.round(Math.sqrt(Math.max(0, 1 - (i / w) ** 2)) * 7); x.fillStyle = '#ffffff'; x.fillRect(Math.round(cx + i), Math.round(cy - hh), 1, hh); } }
      for (let i = 0; i < 256; i++) { const hh = Math.round(14 + Math.sin(i * 0.07) * 6 + Math.sin(i * 0.19) * 4); x.fillStyle = '#5a6fa8'; x.fillRect(i, 96 - hh, 1, hh); }
    });
    m7.horizon = new T.Mesh(new T.PlaneGeometry(520, 195), new T.MeshBasicMaterial({ map: nearestTex(sky), fog: false }));
    m7World.add(m7.horizon);
  }
  const m7Hide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water, fish];
  function m7Enter() {
    buildM7();
    m7Hide.forEach(o => { o.visible = false; });
    m7World.visible = true;
    camMode = 'low';
    scene.fog = new T.Fog(0xb4dcff, 40, 120);
    renderer.setClearColor(0xb4dcff, 0);
  }
  function m7Exit() {
    m7Hide.forEach(o => { o.visible = true; });
    m7World.visible = false;
    camMode = '';
    scene.fog = null;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  let rtLow = null;
  const lowShow = new T.ShaderMaterial({
    uniforms: { tIn: { value: null } }, vertexShader: VERT,
    fragmentShader: 'uniform sampler2D tIn; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tIn, vUv).rgb, 1.0); }',
    depthTest: false, depthWrite: false,
  });
  function lowTarget(w, filter) {
    const h = Math.max(2, Math.round(w / aspect));
    if (!rtLow || rtLow.width !== w || rtLow.height !== h || rtLow.texture.magFilter !== filter) {
      if (rtLow) rtLow.dispose();
      rtLow = new T.WebGLRenderTarget(w, h, rtOpts(filter, { depthBuffer: true }));
    }
    return rtLow;
  }
  function m7Render() {
    m7.horizon.position.set(camT.x, 40, camT.z - 190);
    foods.forEach((f, i) => { m7.food[i].visible = f.on; m7.food[i].position.set(f.x, 0.3, f.z); });
    const c = m7.fishCv.getContext('2d');
    c.clearRect(0, 0, 48, 48);
    const amp = fishAmp();
    const grid = [];
    for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) grid.push(fishPixel(((i + 0.5) / 48 - 0.5) * 6, ((j + 0.5) / 48 - 0.5) * 6, amp));
    const at = (i, j) => (i < 0 || j < 0 || i >= 48 || j >= 48) ? null : grid[j * 48 + i];
    for (let j = 0; j < 48; j++) for (let i = 0; i < 48; i++) {
      const k = grid[j * 48 + i];
      if (!k) continue;
      c.fillStyle = (!at(i + 1, j) || !at(i - 1, j) || !at(i, j + 1) || !at(i, j - 1)) ? '#5a1e0c' : FISH_PAL[k];
      c.fillRect(i, j, 1, 1);
    }
    m7.fishTex.needsUpdate = true;
    m7.fish.position.set(F.x, 0.04, F.z);
    m7.fish.scale.setScalar(FISH_SIZE);
    m7.fish.rotation.y = F.heading;
    const rt = lowTarget(Math.max(160, Math.round(buf.x / DPR / 3.2)), T.NearestFilter);
    U.uNear.value = camera.near; U.uFar.value = camera.far; U.uOrtho.value = 0;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    lowShow.uniforms.tIn.value = rt.texture;
    pass(lowShow, null);
  }

  // ---------- 32 e 64 BITS: o mesmo mundo 3D, com o jeito de cada geração ----------
  const psxWorld = new T.Group();
  psxWorld.visible = false;
  scene.add(psxWorld);
  const fishPsx = new T.Group();
  fishPsx.visible = false;
  fish.add(fishPsx);
  const PSX_U = {
    uSnap: { value: new T.Vector2(160, 120) }, uSnapOn: { value: 1 }, uAffine: { value: 1 },
    uFogC: { value: new T.Color(0x1a1e2c) }, uFogN: { value: 30 }, uFogF: { value: 80 },
    uLight: { value: new T.Vector3(-0.5, 0.85, 0.35).normalize() },
  };
  const PSX_VS = `
    uniform vec2 uSnap;
    uniform float uSnapOn;
    uniform vec3 uLight;
    varying vec2 vUvA;
    varying vec2 vUvP;
    varying float vW;
    varying vec3 vCol;
    varying float vDist;
    void main() {
      mat4 m = modelMatrix;
      #ifdef USE_INSTANCING
        m = m * instanceMatrix;
      #endif
      vec4 wp = m * vec4(position, 1.0);
      vec4 cp = projectionMatrix * viewMatrix * wp;
      // 32 bits: os vértices ficam presos numa grade de baixa resolução e tremem
      if (uSnapOn > 0.5) cp.xy = floor(cp.xy / cp.w * uSnap + 0.5) / uSnap * cp.w;
      gl_Position = cp;
      vec3 n = normalize((m * vec4(normal, 0.0)).xyz);
      vec3 c = vec3(0.5 + 0.65 * max(dot(n, uLight), 0.0));
      #ifdef USE_COLOR
        c *= color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        c *= instanceColor;
      #endif
      vCol = c;
      vUvA = uv * cp.w; vW = cp.w; vUvP = uv;
      vDist = length(wp.xyz - cameraPosition);
    }`;
  const PSX_FS = `
    uniform sampler2D map;
    uniform float uAffine;
    uniform vec3 uFogC;
    uniform float uFogN;
    uniform float uFogF;
    uniform vec2 uScroll;
    uniform float uAlpha;
    varying vec2 vUvA;
    varying vec2 vUvP;
    varying float vW;
    varying vec3 vCol;
    varying float vDist;
    void main() {
      // 32 bits: textura sem correção de perspectiva (entorta); 64 bits: textura correta e lisa
      vec2 uv = (uAffine > 0.5 ? vUvA / vW : vUvP) + uScroll;
      vec3 c = texture2D(map, uv).rgb * vCol * 1.2;
      gl_FragColor = vec4(mix(c, uFogC, smoothstep(uFogN, uFogF, vDist)), uAlpha);
    }`;
  const psx = { built: false, texes: [], food: [] };
  function psxTex(fn) {
    const t = new T.CanvasTexture(px8(fn, 32, 32));
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false;
    psx.texes.push(t);
    return t;
  }
  function psxMat(tex, opts = {}) {
    return new T.ShaderMaterial({
      uniforms: Object.assign({ map: { value: tex }, uScroll: { value: new T.Vector2() }, uAlpha: { value: opts.alpha || 1 } }, PSX_U),
      vertexShader: PSX_VS, fragmentShader: PSX_FS, vertexColors: !!opts.vc, transparent: !!opts.alpha, depthWrite: !opts.alpha, side: opts.side || T.FrontSide,
    });
  }
  const rgb = (r, g, b) => `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  function buildPsx() {
    if (psx.built) return;
    psx.built = true;
    const rp = mulberry32(21), n = (i, j) => hash2(i * 1.3, j * 2.7);
    const T_DETAIL = psxTex((i, j) => { const v = 175 + n(i, j) * 70; return rgb(v, v, v); });
    const T_LEAF = psxTex((i, j) => { const v = n(i, j); return v > 0.85 ? '#b8f070' : v > 0.45 ? '#4fae4a' : '#2f7d3a'; });
    const T_BARK = psxTex((i, j) => ((i + (j >> 2)) % 5 === 0 ? '#3d2410' : n(i, j) > 0.5 ? '#7a4a26' : '#6a3e1e'));
    const T_WATER = psxTex((i, j) => { const w = Math.sin(i * 0.4 + j * 0.25) + Math.sin(j * 0.6 - i * 0.1); return w > 1.3 ? '#bff0ff' : w > 0.2 ? '#3f9ed0' : '#2a78b0'; });
    const T_ROCK = psxTex((i, j) => { const v = 120 + n(i, j) * 90; return rgb(v, v, v + 12); });
    const T_WOOD = psxTex((i, j) => (j % 8 === 0 ? '#4a2a12' : n(i, j >> 3) > 0.5 ? '#b07a44' : '#9a6a3a'));
    const T_FISH = psxTex((i, j) => {
      if (Math.hypot(i - 8, j - 12) < 5 || Math.hypot(i - 22, j - 20) < 6) return '#fff3e2';
      if (Math.hypot(i - 16, j - 8) < 3) return '#c8301a';
      return ((i + j) % 6 === 0) ? '#e8551e' : '#ff7a2c';
    });
    // chão em polígonos grandes com cor por vértice
    const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 46, 35);
    g.rotateX(-Math.PI / 2); g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv, colors = new Float32Array(p.count * 3), tc = new T.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = celHeight(x, z);
      p.setY(i, y);
      uv.setXY(i, uv.getX(i) * 23, uv.getY(i) * 17.5);
      if (y < -0.3) tc.setRGB(0.55, 0.72, 0.68).lerp(new T.Color(0.3, 0.45, 0.55), clamp((-y - 0.35) / 2.3, 0, 1));
      else if (y < -0.02 || lakeV(x, z) < 1.1) tc.setRGB(0.95, 0.84, 0.55);
      else if (isPath(x, z)) tc.setRGB(0.85, 0.66, 0.42);
      else tc.setRGB(0.42, 0.72, 0.3).lerp(new T.Color(0.55, 0.8, 0.35), vnoise(x * 0.2, z * 0.2));
      colors[i * 3] = tc.r; colors[i * 3 + 1] = tc.g; colors[i * 3 + 2] = tc.b;
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    psxWorld.add(new T.Mesh(g, psxMat(T_DETAIL, { vc: true })));
    const wg = new T.PlaneGeometry(RX * 2.6, RZ * 2.6, 16, 12).rotateX(-Math.PI / 2);
    const wu = wg.attributes.uv; for (let i = 0; i < wu.count; i++) wu.setXY(i, wu.getX(i) * 8, wu.getY(i) * 6);
    psx.water = new T.Mesh(wg, psxMat(T_WATER, { alpha: 0.5 }));
    psx.water.position.y = WATER_Y; psx.water.renderOrder = 2;
    psxWorld.add(psx.water);
    const inst = (geo, tex, list, place) => {
      const m = new T.InstancedMesh(geo, psxMat(tex), list.length);
      list.forEach((it, i) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); const c = place(it, dummy, i); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, c || new T.Color(1, 1, 1)); });
      m.instanceColor.needsUpdate = true; m.frustumCulled = false;
      psxWorld.add(m);
      return m;
    };
    inst(new T.CylinderGeometry(0.25, 0.35, 2.2, 5).translate(0, 1.1, 0), T_BARK, trees, (t, d) => { d.position.set(t.x, celHeight(t.x, t.z), t.z); });
    inst(new T.IcosahedronGeometry(1.6, 0), T_LEAF, trees, (t, d, i) => {
      const k = 0.8 + treeLook[i].r * 0.3; d.position.set(t.x, celHeight(t.x, t.z) + 2.6 * k, t.z); d.scale.setScalar(k); d.rotation.y = rp() * 3;
      return treeLook[i].pink ? new T.Color(1.6, 0.75, 1.0) : null;
    });
    inst(new T.DodecahedronGeometry(0.8, 0), T_ROCK, rocks, (r, d) => { d.position.set(r.x, r.wet ? WATER_Y : celHeight(r.x, r.z) + 0.2, r.z); d.scale.set(r.s, r.s * 0.65, r.s * 0.85); });
    inst(new T.CylinderGeometry(1, 1, 0.08, 8), T_LEAF, pads, (pd, d) => { d.position.set(pd.x, WATER_Y + 0.05, pd.z); d.scale.set(pd.r, 1, pd.r); });
    const dk = new T.Mesh(new T.BoxGeometry(dock.len + 0.4, 0.2, 2.3), psxMat(T_WOOD));
    dk.position.set((dockLand.x + dockEnd.x) / 2, 0.15, (dockLand.z + dockEnd.z) / 2); dk.rotation.y = dock.ry;
    psxWorld.add(dk);
    for (let i = 0; i < foods.length; i++) { const m = new T.Mesh(new T.OctahedronGeometry(0.22, 0), psxMat(T_FISH)); psxWorld.add(m); psx.food.push(m); }
    const body = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), psxMat(T_FISH));
    body.scale.set(2.5, 0.95, 1.05); body.position.x = 0.15;
    const tailP = new T.Group(); tailP.position.x = -1.0;
    const fin = new T.Mesh(new T.ConeGeometry(0.55, 1.0, 4), psxMat(T_FISH, { side: T.DoubleSide }));
    fin.rotation.z = Math.PI / 2; fin.scale.set(1, 1, 0.25); fin.position.x = -0.45;
    tailP.add(fin);
    const eyeM = psxMat(T_ROCK);
    for (const s of [1, -1]) { const e = new T.Mesh(new T.OctahedronGeometry(0.09, 0), eyeM); e.position.set(1.05, 0.13, s * 0.3); fishPsx.add(e); }
    fishPsx.add(body, tailP);
    tailExtra.push(tailP);
  }
  const psxHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water, fishVox];
  const psxShow = new T.ShaderMaterial({
    uniforms: { tIn: { value: null }, uLow: { value: new T.Vector2(320, 240) }, uN64: { value: 0 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: `
      uniform sampler2D tIn;
      uniform vec2 uLow;
      uniform float uN64;
      varying vec2 vUv;
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      void main() {
        if (uN64 > 0.5) {
          // 64 bits: imagem pequena ampliada com filtro, um pouco borrada
          vec2 e = 1.0 / uLow;
          vec3 c = texture2D(tIn, vUv).rgb * 0.5 + (texture2D(tIn, vUv + vec2(e.x, 0.0)).rgb + texture2D(tIn, vUv - vec2(e.x, 0.0)).rgb + texture2D(tIn, vUv + vec2(0.0, e.y)).rgb + texture2D(tIn, vUv - vec2(0.0, e.y)).rgb) * 0.125;
          gl_FragColor = vec4(c, 1.0);
          return;
        }
        // 32 bits: pixels duros e só 15 bits de cor, com pontilhado
        vec2 cell = floor(vUv * uLow);
        vec3 c = texture2D(tIn, (cell + 0.5) / uLow).rgb;
        c = floor((c + (bayer4(cell) - 0.5) / 31.0) * 31.0 + 0.5) / 31.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  function psxEnter(n64) {
    buildPsx();
    psxHide.forEach(o => { o.visible = false; });
    psxWorld.visible = true; fishPsx.visible = true;
    camMode = 'low';
    PSX_U.uSnapOn.value = n64 ? 0 : 1;
    PSX_U.uAffine.value = n64 ? 0 : 1;
    PSX_U.uFogC.value.set(n64 ? 0xa8d4f0 : 0x1a1e2c);
    PSX_U.uFogN.value = n64 ? 22 : 30; PSX_U.uFogF.value = n64 ? 70 : 80;
    for (const t of psx.texes) { t.magFilter = t.minFilter = n64 ? T.LinearFilter : T.NearestFilter; t.needsUpdate = true; }
    psxShow.uniforms.uN64.value = n64 ? 1 : 0;
    renderer.setClearColor(n64 ? 0xa8d4f0 : 0x1a1e2c, 0);
  }
  function psxExit() {
    psxHide.forEach(o => { o.visible = true; });
    psxWorld.visible = false; fishPsx.visible = false;
    camMode = '';
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function psxRender() {
    psx.water.material.uniforms.uScroll.value.set(time * 0.03, time * 0.02);
    foods.forEach((f, i) => { psx.food[i].visible = f.on; psx.food[i].position.set(f.x, f.y, f.z); psx.food[i].rotation.y = time * 2; });
    const n64 = psxShow.uniforms.uN64.value > 0.5;
    const rt = lowTarget(320, n64 ? T.LinearFilter : T.NearestFilter);
    PSX_U.uSnap.value.set(rt.width / 2, rt.height / 2);
    psxShow.uniforms.uLow.value.set(rt.width, rt.height);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    psxShow.uniforms.tIn.value = rt.texture;
    pass(psxShow, null);
  }
