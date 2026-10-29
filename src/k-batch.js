
  // ======================================================================
  // QUARTA LEVA: origami, mármore, pixel isométrico, pontilhismo, silhueta, câmera térmica
  // ======================================================================

  // ---------- ORIGAMI: diorama de papel dobrado ----------
  const oriWorld = new T.Group();
  oriWorld.visible = false;
  scene.add(oriWorld);
  const fishOri = new T.Group();
  fishOri.visible = false;
  fish.add(fishOri);
  const ori = { built: false, food: [] };
  const paperMats = {};
  const paperMat = (c) => paperMats[c] || (paperMats[c] = new T.MeshLambertMaterial({ color: c, side: T.DoubleSide }));
  const creaseMat = new T.LineBasicMaterial({ color: 0x6b5a4a, transparent: true, opacity: 0.5 });
  // peça de papel: faces chapadas e vincos desenhados nas dobras
  function fold(geo, color, parent = oriWorld) {
    const flat = geo.index ? geo.toNonIndexed() : geo;
    flat.computeVertexNormals();
    const m = new T.Mesh(flat, paperMat(color));
    m.castShadow = true; m.receiveShadow = true;
    m.add(new T.LineSegments(new T.EdgesGeometry(geo, 15), creaseMat));
    parent.add(m);
    return m;
  }
  function flatShape(k, y, color) {
    const s = new T.Shape();
    lakeLoop(k, 48).forEach((p, i) => (i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y)));
    const m = fold(new T.ShapeGeometry(s).rotateX(-Math.PI / 2), color);
    m.position.y = y;
    return m;
  }
  function buildOri() {
    if (ori.built) return;
    ori.built = true;
    const ro = mulberry32(12);
    // chão em sanfona: pregas de papel paralelas
    const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 46, 1);
    g.rotateX(-Math.PI / 2); g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.round((p.getX(i) - X0) / 2) % 2 ? 0.3 : 0);
    fold(g, 0xa9d48f);
    flatShape(1.15, 0.36, 0xf1dca6);
    flatShape(1.0, 0.4, 0x7cc3e0);
    flatShape(0.6, 0.43, 0x4f9fd0);
    trees.forEach((t, i) => {
      const L = treeLook[i], s = 0.8 + L.r * 0.3;
      const trunk = fold(new T.BoxGeometry(0.4, 1, 0.4), 0xb08060); trunk.position.set(t.x, 0.8, t.z);
      const c = fold(new T.ConeGeometry(1.5 * s, 3.2 * s, 4, 1), L.pink ? 0xf2a7b8 : L.tone < 0.5 ? 0x6fb86a : 0x8fcf7a);
      c.position.set(t.x, 1.2 + 1.6 * s, t.z); c.rotation.y = Math.PI / 4 + ro() * 0.4;
    });
    rocks.forEach((r) => { const m = fold(new T.OctahedronGeometry(0.75, 0), 0xc9c2b8); m.position.set(r.x, r.wet ? 0.45 : 0.55, r.z); m.scale.set(r.s, r.s * 0.6, r.s * 0.9); m.rotation.y = ro() * 3; });
    pads.forEach((pd) => {
      const m = fold(new T.CylinderGeometry(1, 1, 0.05, 8), 0x66b86a); m.position.set(pd.x, 0.48, pd.z); m.scale.set(pd.r, 1, pd.r); m.rotation.y = ro() * 3;
      if (pd.flower) { const f = fold(new T.ConeGeometry(0.32, 0.5, 6, 1, true), 0xf49ac1); f.position.set(pd.x, 0.75, pd.z); f.rotation.x = Math.PI; }
    });
    const dk = fold(new T.BoxGeometry(dock.len + 0.4, 0.12, 2.3), 0xc79a6a);
    dk.position.set((dockLand.x + dockEnd.x) / 2, 0.5, (dockLand.z + dockEnd.z) / 2); dk.rotation.y = dock.ry;
    for (let i = 0; i < foods.length; i++) { const m = fold(new T.TetrahedronGeometry(0.25, 0), 0xffc94a); ori.food.push(m); }
    // carpa de origami: prisma dobrado em losango, cauda de dois triângulos
    const V = { N: [1.5, 0, 0], T: [-1.1, 0, 0], U: [0.15, 0.38, 0], D: [0.15, -0.22, 0], L: [0.15, 0, 0.55], R: [0.15, 0, -0.55] };
    const tri = (...ks) => ks.flatMap(k => V[k]);
    const bg = new T.BufferGeometry();
    bg.setAttribute('position', new T.Float32BufferAttribute([
      ...tri('N', 'U', 'L'), ...tri('N', 'L', 'D'), ...tri('N', 'D', 'R'), ...tri('N', 'R', 'U'),
      ...tri('T', 'L', 'U'), ...tri('T', 'D', 'L'), ...tri('T', 'R', 'D'), ...tri('T', 'U', 'R'),
    ], 3));
    const holder = new T.Group();
    holder.position.y = (0.75 - FISH_Y) / FISH_SIZE;
    fishOri.add(holder);
    fold(bg, 0xff8a4d, holder);
    const spot = new T.BufferGeometry();
    spot.setAttribute('position', new T.Float32BufferAttribute([0.9, 0.17, 0, 0.15, 0.39, 0, 0.35, 0.3, 0.3, 0.9, 0.17, 0, 0.35, 0.3, -0.3, 0.15, 0.39, 0], 3));
    fold(spot, 0xfff3e6, holder);
    for (const s of [1, -1]) {
      const fin = new T.BufferGeometry();
      fin.setAttribute('position', new T.Float32BufferAttribute([0.6, 0, s * 0.4, 0.1, 0, s * 0.45, 0.3, -0.05, s * 0.95], 3));
      fold(fin, 0xffb07a, holder);
      const eye = fold(new T.OctahedronGeometry(0.07, 0), 0x2a2230, holder); eye.position.set(1.0, 0.13, s * 0.22);
    }
    const tailO = new T.Group();
    tailO.position.x = -1.1;
    const tg = new T.BufferGeometry();
    tg.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -0.9, 0.08, 0.62, -0.55, 0.15, 0, 0, 0, 0, -0.55, 0.15, 0, -0.9, 0.08, -0.62], 3));
    fold(tg, 0xffa066, tailO);
    holder.add(tailO);
    tailExtra.push(tailO);
  }
  const oriHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water];
  function oriEnter() {
    buildOri();
    oriHide.forEach(o => { o.visible = false; });
    oriWorld.visible = true; fishVox.visible = false; fishOri.visible = true;
    renderer.setClearColor(0xefe6d6, 0);
  }
  function oriExit() {
    oriHide.forEach(o => { o.visible = true; });
    oriWorld.visible = false; fishVox.visible = true; fishOri.visible = false;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function oriRender() {
    foods.forEach((f, i) => { const m = ori.food[i]; m.visible = f.on; m.position.set(f.x, 0.7, f.z); m.rotation.y = time * 1.5; });
    renderWorld();
    finish(rtScene.texture, 0.5, 0.5);
  }

  // ---------- MÁRMORE E OURO: o mundo arredondado como escultura, com um peixe de ouro ----------
  function marbleMaterial(kind, alpha = 1) {
    return new T.ShaderMaterial({
      uniforms: { uKind: { value: kind }, uAlpha: { value: alpha }, uTime: U.uTime },
      vertexShader: HOLO_VS, transparent: alpha < 1, depthWrite: alpha >= 1,
      fragmentShader: `
        uniform float uKind;
        uniform float uAlpha;
        uniform float uTime;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
        void main() {
          vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(-0.5, 0.85, 0.35)), h = normalize(L + v);
          vec2 q = vec2(vW.x * 0.5 + vW.y * 0.4, vW.z * 0.5 - vW.y * 0.3);
          float nz = fbm(q);
          float vein = 1.0 - smoothstep(0.0, 0.07, abs(sin((vW.x + vW.z * 0.6 + nz * 5.0) * 1.7)));
          vec3 c;
          float shine = 0.35;
          if (uKind < 0.5) { c = mix(vec3(0.95, 0.94, 0.92), vec3(0.84, 0.83, 0.82), nz); c = mix(c, vec3(0.46, 0.48, 0.54), vein * 0.55); }
          else if (uKind < 1.5) { c = mix(vec3(0.32, 0.33, 0.36), vec3(0.22, 0.23, 0.26), nz); c = mix(c, vec3(0.75, 0.74, 0.7), vein * 0.4); shine = 0.15; }
          else if (uKind < 2.5) { c = mix(vec3(0.95, 0.72, 0.28), vec3(0.75, 0.5, 0.15), nz); shine = 1.2; }
          else { c = vec3(0.04, 0.05, 0.07) + vec3(0.2, 0.22, 0.26) * vein; shine = 1.0; }
          float dif = clamp(dot(n, L), 0.0, 1.0) * 0.6 + 0.45;
          float spec = pow(clamp(dot(n, h), 0.0, 1.0), uKind > 1.5 && uKind < 2.5 ? 30.0 : 70.0) * shine;
          float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0) * (uKind > 1.5 && uKind < 2.5 ? 0.6 : 0.15);
          vec3 tint = uKind > 1.5 && uKind < 2.5 ? vec3(1.0, 0.85, 0.5) : vec3(1.0);
          gl_FragColor = vec4(c * dif + (spec + rim) * tint, uAlpha);
        }`,
    });
  }
  const marble = { obj: marbleMaterial(0), ground: marbleMaterial(1), gold: marbleMaterial(2), water: marbleMaterial(3, 0.5), saved: new Map() };
  function marbleSwap(on) {
    for (const root of [celWorld, fishCel]) root.traverse((o) => {
      if (!o.isMesh) return;
      if (on) {
        marble.saved.set(o, [o.material, o.visible]);
        if (o.material.type === 'ShaderMaterial' && o.material.side === T.BackSide) o.visible = false;
        else o.material = root === fishCel ? marble.gold : o.material.vertexColors ? marble.ground : marble.obj;
      } else if (marble.saved.has(o)) {
        const [m, vis] = marble.saved.get(o);
        o.material = m; o.visible = vis;
      }
    });
    if (!on) marble.saved.clear();
  }
  function marbleEnter() { celEnter(); marbleSwap(true); water.material = marble.water; renderer.setClearColor(0x2a2b30, 0); }
  function marbleExit() { marbleSwap(false); celExit(); }
  function marbleRender(dt) { holoRender(dt); }

  // ---------- PIXEL ISOMÉTRICO: pixel art em vista de cima na diagonal, como jogo antigo ----------
  const ISO = { TW: 12, TH: 6, built: false, S: 2, ox: 0, oy: 0 };
  // tipos de chão: 0 grama, 1 areia, 2 água, 3 água funda, 4 trilha, 5 píer
  const ISO_TOP = [[0x6cbf4a, 0x5aa83f, 0x82cf57], [0xf2dca0, 0xe4c98a, 0xf8e8b8], [0x4dbfc6, 0x45b2ba, 0x7fd8d0], [0x2f9db3, 0x2a8ea3, 0x4dbfc6], [0xd9b277, 0xc49a5f, 0xe7c891], [0xb8794a, 0xa66b3f, 0xc98d5a]];
  const ISO_H = [2, 1, 0, 0, 2, 3];
  function isoBuild() {
    if (ISO.built) return;
    ISO.built = true;
    const { TW, TH } = ISO, cols = X1 - X0, rows = Z1 - Z0, map = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = X0 + i + 0.5, z = Z0 + j + 0.5, v = lakeV(x, z);
      let t = v < 0.6 ? 3 : v < 1 ? 2 : v < 1.13 ? 1 : isPath(x, z) ? 4 : 0;
      const dx = x - dockLand.x, dz = z - dockLand.z, s = dx * dock.ux + dz * dock.uz, q = -dx * dock.uz + dz * dock.ux;
      if (s > -0.3 && s < dock.len + 0.3 && Math.abs(q) < 1.15) t = 5;
      map[j * cols + i] = t;
    }
    ISO.map = map; ISO.cols = cols; ISO.rows = rows;
    const hexC = (h) => '#' + h.toString(16).padStart(6, '0');
    const shade = (h, k) => '#' + [h >> 16, (h >> 8) & 255, h & 255].map(c => Math.round(c * k).toString(16).padStart(2, '0')).join('');
    // cada tipo de chão vira um losango de pixels com laterais mais escuras
    ISO.tiles = ISO_TOP.map((pal, t) => tile(TW, TH + 4, (x) => {
      const rp = mulberry32(t + 3), H = ISO_H[t];
      const diamond = (oy, colFn) => {
        for (let r = 0; r < TH; r++) {
          const w = 4 * (Math.min(r, TH - 1 - r) + 1), x0 = (TW - w) / 2;
          for (let c = 0; c < w; c++) { x.fillStyle = colFn(c < w / 2, r, c); x.fillRect(x0 + c, oy + r, 1, 1); }
        }
      };
      for (let k = H; k >= 1; k--) diamond(k, (left) => shade(pal[0], left ? 0.72 : 0.55));
      diamond(0, (left, r, c) => { const n = rp(); return r === 0 || (left && c === 0) ? hexC(pal[2]) : n < 0.18 ? hexC(pal[1]) : n > 0.93 ? hexC(pal[2]) : hexC(pal[0]); });
    }));
    const spr = (w, h, draw) => tile(w, h, draw);
    const blob = (x, cx, cy, R, body, out, light) => {
      for (let y = -R - 1; y <= R + 1; y++) for (let xx = -R - 1; xx <= R + 1; xx++) {
        const d = Math.hypot(xx, y * 1.15);
        if (d > R) continue;
        const edge = Math.hypot(xx + 1, y * 1.15) > R || Math.hypot(xx - 1, y * 1.15) > R || Math.hypot(xx, (y + 1) * 1.15) > R || Math.hypot(xx, (y - 1) * 1.15) > R;
        x.fillStyle = edge ? out : Math.hypot(xx + R * 0.35, y + R * 0.35) < R * 0.5 ? light : body;
        x.fillRect(cx + xx, cy + y, 1, 1);
      }
    };
    ISO.tree = [['#3f9a4c', '#24603a', '#5fc062'], ['#e58fae', '#9c4a6c', '#f4b4ca']].map(([b, o, l]) => spr(14, 18, (x) => {
      x.fillStyle = '#6e4426'; x.fillRect(6, 12, 2, 5);
      blob(x, 7, 7, 6, b, o, l);
    }));
    ISO.rock = spr(8, 6, (x) => blob(x, 4, 3, 3, '#a9a6b8', '#5f5b72', '#d4d2e0'));
  }
  function isoRender(dt) {
    isoBuild();
    follow2(dt); ringsTick(dt);
    const { TW, TH } = ISO, S = Math.max(2, Math.round(buf.x / 300));
    const lw = Math.ceil(buf.x / S), lh = Math.ceil(buf.y / S);
    if (!ISO.low || ISO.low.width !== lw || ISO.low.height !== lh) { ISO.low = tile(lw, lh, () => {}); ISO.lc = ISO.low.getContext('2d'); }
    const c = ISO.lc;
    // mundo -> pixel: x vai para a direita-baixo, z para a esquerda-baixo
    const cx = view2.x, cz = view2.z;
    const ox = Math.round(lw / 2 - (cx - cz) * TW / 2), oy = Math.round(lh / 2 - (cx + cz) * TH / 2);
    ISO.S = S; ISO.ox = ox; ISO.oy = oy;
    const P = (x, z, h = 0) => [Math.round((x - z) * TW / 2 + ox), Math.round((x + z) * TH / 2 + oy - h)];
    c.fillStyle = '#2a3a2a'; c.fillRect(0, 0, lw, lh);
    // percorre as células de trás para a frente
    const span = Math.ceil(Math.max(lw / TW, lh / TH)) + 4;
    const i0 = Math.floor(cx - X0) - span, i1 = Math.floor(cx - X0) + span, j0 = Math.floor(cz - Z0) - span, j1 = Math.floor(cz - Z0) + span;
    for (let sum = i0 + j0; sum <= i1 + j1; sum++) {
      for (let i = Math.max(i0, sum - j1, 0); i <= Math.min(i1, sum - j0, ISO.cols - 1); i++) {
        const j = sum - i;
        if (j < 0 || j >= ISO.rows) continue;
        const t = ISO.map[j * ISO.cols + i], [sx, sy] = P(X0 + i, Z0 + j, ISO_H[t]);
        if (sx < -TW || sy < -TH - 4 || sx > lw || sy > lh + 4) continue;
        c.drawImage(ISO.tiles[t], sx - TW / 2, sy);
        if ((t === 2 || t === 3) && hash2(i, j + Math.floor(time * 2)) > 0.93) { c.fillStyle = '#d6f7f2'; c.fillRect(sx - 1, sy + 2, 3, 1); }
      }
    }
    // objetos, também de trás para a frente
    const objs = [];
    trees.forEach((t, i) => objs.push([t.x + t.z, () => { const [sx, sy] = P(t.x, t.z, 2); c.drawImage(ISO.tree[treeLook[i].pink ? 1 : 0], sx - 7, sy - 15); }]));
    rocks.forEach((r) => objs.push([r.x + r.z, () => { const [sx, sy] = P(r.x, r.z, r.wet ? 0 : 2); c.drawImage(ISO.rock, sx - 4, sy - 2); }]));
    pads.forEach((p) => objs.push([p.x + p.z - 0.5, () => {
      const [sx, sy] = P(p.x, p.z), w = Math.round(p.r * TW * 0.9), h = Math.max(2, Math.round(w / 2));
      c.fillStyle = '#2f7d44'; c.fillRect(sx - w / 2, sy, w, h); c.fillStyle = '#4fae5c'; c.fillRect(sx - w / 2 + 1, sy, w - 2, h - 1);
      if (p.flower) { c.fillStyle = '#ff8fbf'; c.fillRect(sx - 1, sy - 1, 3, 2); }
    }]));
    for (const r of reeds) objs.push([r.x + r.z, () => { const [sx, sy] = P(r.x, r.z, 1), sw = Math.round(Math.sin(time * 1.3 + r.ph)); c.fillStyle = '#3f8f3c'; c.fillRect(sx + sw, sy - 5, 1, 5); if (r.head) { c.fillStyle = '#7a4a26'; c.fillRect(sx + sw, sy - 7, 1, 2); } }]);
    for (const f of foods) if (f.on) objs.push([f.x + f.z, () => { const [sx, sy] = P(f.x, f.z); c.fillStyle = '#9a5a1c'; c.fillRect(sx - 1, sy, 3, 2); c.fillStyle = '#f3a23a'; c.fillRect(sx - 1, sy, 2, 1); }]);
    // o peixe: cada pixel em volta é convertido de volta para o mundo e testado no formato do peixe
    objs.push([F.x + F.z, () => {
      const amp = fishAmp(), cs = Math.cos(F.heading), sn = Math.sin(F.heading), [fx, fy] = P(F.x, F.z), R = Math.ceil(2.6 * FISH_SIZE * TW / 2) + 2;
      const at = (px, py) => {
        const a = (px + 0.5 - ox) * 2 / TW, b = (py + 0.5 - oy) * 2 / TH, x = (a + b) / 2 - F.x, z = (b - a) / 2 - F.z;
        return fishPixel((x * cs - z * sn) / FISH_SIZE, (x * sn + z * cs) / FISH_SIZE, amp);
      };
      const grid = [];
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) grid.push(at(fx + x, fy + y));
      const W2 = 2 * R + 1, g = (x, y) => (x < 0 || y < 0 || x >= W2 || y >= W2) ? null : grid[y * W2 + x];
      for (let y = 0; y < W2; y++) for (let x = 0; x < W2; x++) {
        const k = g(x, y);
        if (!k) continue;
        const edge = !g(x + 1, y) || !g(x - 1, y) || !g(x, y + 1) || !g(x, y - 1);
        c.fillStyle = edge ? '#7a2e14' : FISH_PAL[k];
        c.fillRect(fx - R + x, fy - R + y, 1, 1);
      }
    }]);
    for (const b of bubbles) if (b.on) objs.push([b.x + b.z, () => { const [sx, sy] = P(b.x, b.z); c.fillStyle = '#e8fffd'; c.fillRect(sx, sy, 1, 1); }]);
    objs.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.imageSmoothingEnabled = false;
    g2.drawImage(ISO.low, 0, 0, lw * S, lh * S);
  }
  const isoToWorld = (cx, cy) => {
    const [x, y] = devXY(cx, cy), px = x / ISO.S, py = y / ISO.S;
    const a = (px - ISO.ox) * 2 / ISO.TW, b = (py - ISO.oy) * 2 / ISO.TH;
    return { x: (a + b) / 2, z: (b - a) / 2 };
  };

  // ---------- PONTILHISMO: pintura de pontinhos de cores puras ----------
  function dotsRender(dt) {
    const S = Math.max(4, Math.round(buf.x / 130)), [lw, lh] = pixDraw(dt, S);
    const img = pix.lc.getImageData(0, 0, lw, lh).data, ctx = g2, groups = new Map();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(0, 0, buf.x, buf.y);
    const add = (key, x, y) => { let a = groups.get(key); if (!a) groups.set(key, a = []); a.push(x, y); };
    const q = (v) => Math.min(255, Math.max(0, Math.round(v / 24) * 24));
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const o = (y * lw + x) * 4, r = img[o], g = img[o + 1], b = img[o + 2], gx = x + pix.ox, gy = y + pix.oy;
      // três pontos por célula: a cor, uma versão mais quente e uma mais fria, que o olho mistura
      add((q(r) << 16) | (q(g) << 8) | q(b), x * S + hash2(gx, gy) * S * 0.5, y * S + hash2(gy, gx) * S * 0.5);
      add((q(r * 1.15) << 16) | (q(g * 1.02) << 8) | q(b * 0.8), x * S + S * 0.5 + hash2(gx + 1, gy) * S * 0.4, y * S + hash2(gy + 2, gx) * S * 0.6);
      add((q(r * 0.82) << 16) | (q(g * 0.98) << 8) | q(b * 1.18), x * S + hash2(gx + 3, gy) * S * 0.7, y * S + S * 0.5 + hash2(gy + 4, gx) * S * 0.4);
    }
    const rad = S * 0.3;
    for (const [key, a] of groups) {
      ctx.fillStyle = hexStr(key);
      ctx.beginPath();
      for (let i = 0; i < a.length; i += 2) { ctx.moveTo(a[i] + rad, a[i + 1]); ctx.arc(a[i], a[i + 1], rad, 0, TAU); }
      ctx.fill();
    }
  }

  // ---------- SILHUETA AO PÔR DO SOL: tudo em preto contra a água que reflete o céu ----------
  const birds = Array.from({ length: 5 }, (_, i) => ({ y: 0.15 + i * 0.07, sp: 0.03 + i * 0.008, ph: i * 1.7 }));
  function duskRender(dt) {
    const vis = begin2D(dt, '#1a0f14'), ctx = g2, lp = DPR / view2.s, BLACK = '#120a0e';
    const sun = { x: lakeBox.x0 * 0.3, z: lakeBox.z0 * 0.4 };
    const gr = ctx.createRadialGradient(sun.x, sun.z, 0.5, sun.x, sun.z, 26);
    gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.12, '#ffc65a'); gr.addColorStop(0.45, '#ff7a4a'); gr.addColorStop(1, '#8a2e62');
    ctx.fillStyle = gr; ctx.fill(LAKE2.shore);
    ctx.save(); ctx.clip(LAKE2.shore);
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.55)'; ctx.lineWidth = 0.12;
    for (let k = -3; k <= 3; k++) { const w = 2.6 - Math.abs(k) * 0.35, z = sun.z + k * 0.45 + Math.sin(time * 1.4 + k) * 0.05; ctx.beginPath(); ctx.moveTo(sun.x - w, z); ctx.lineTo(sun.x + w, z); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(40, 10, 30, 0.45)'; ctx.lineWidth = 0.08;
    for (const g of glints2) { const dx = Math.sin(time * 0.5 + g.ph) * 0.4; ctx.beginPath(); ctx.moveTo(g.x - g.len / 2 + dx, g.z); ctx.quadraticCurveTo(g.x + dx, g.z - 0.15, g.x + g.len / 2 + dx, g.z); ctx.stroke(); }
    for (const r of rings2) { ctx.globalAlpha = Math.max(0, 1 - r.t / 1.3); ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = BLACK;
    pads.forEach((p, i) => { const n = padLook[i]; ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); ctx.fill(); });
    for (const f of foods) if (f.on) { ctx.beginPath(); ctx.arc(f.x, f.z, 0.14, 0, TAU); ctx.fill(); }
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp);
      fishTailPath(ctx, S, N, amp); ctx.fillStyle = BLACK; ctx.fill();
      for (const sg of [1, -1]) { const p = at(0.3, sg, 0.85); ctx.beginPath(); ctx.ellipse(p.x - 0.1, p.y + sg * 0.18, 0.4, 0.15, p.a - sg * 0.9, 0, TAU); ctx.fill(); }
      ctx.fill(body);
      ctx.strokeStyle = 'rgba(255, 170, 90, 0.55)'; ctx.lineWidth = 1.5 * lp / FISH_SIZE; ctx.stroke(body);
    });
    ctx.strokeStyle = BLACK; ctx.lineCap = 'round';
    reeds.forEach((r) => { const sw = Math.sin(time * 1.3 + r.ph) * 0.15; ctx.lineWidth = r.w * 1.2; ctx.beginPath(); ctx.moveTo(r.x, r.z); ctx.quadraticCurveTo(r.x + sw * r.h * 0.3, r.z - r.h * 0.2, r.x + sw * r.h, r.z - r.h * 0.4); ctx.stroke(); if (r.head) { ctx.fillStyle = BLACK; ctx.beginPath(); ctx.ellipse(r.x + sw * r.h, r.z - r.h * 0.4, 0.1, 0.24, sw, 0, TAU); ctx.fill(); } });
    rocks.forEach((r, i) => { if (vis(r.x, r.z)) { blobPath(ctx, r.x, r.z, r.s * 0.7, rockLook[i].k); ctx.fillStyle = BLACK; ctx.fill(); } });
    ctx.save(); ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux)); ctx.fillStyle = BLACK; ctx.fillRect(-0.25, -1.15, dock.len + 0.5, 2.3); ctx.restore();
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i];
      ctx.fillStyle = BLACK;
      for (let k = 0; k < 7; k++) { const a = L.a + k / 7 * TAU, d = L.r * 0.55; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, L.r * 0.5, 0, TAU); ctx.fill(); }
    });
    // pássaros cruzando o céu
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.strokeStyle = BLACK; g2.lineWidth = 2.2 * DPR; g2.lineCap = 'round';
    for (const b of birds) {
      const x = ((time * b.sp + b.ph * 0.2) % 1.2 - 0.1) * buf.x, y = b.y * buf.y + Math.sin(time * 2 + b.ph) * 6 * DPR, w = 9 * DPR, f = Math.sin(time * 8 + b.ph) * 4 * DPR;
      g2.beginPath(); g2.moveTo(x - w, y - f); g2.quadraticCurveTo(x - w / 2, y - w / 2, x, y); g2.quadraticCurveTo(x + w / 2, y - w / 2, x + w, y - f); g2.stroke();
    }
    const vg = g2.createRadialGradient(buf.x / 2, buf.y / 2, Math.min(buf.x, buf.y) * 0.3, buf.x / 2, buf.y / 2, Math.max(buf.x, buf.y) * 0.75);
    vg.addColorStop(0, 'rgba(60, 10, 40, 0)'); vg.addColorStop(1, 'rgba(60, 10, 40, 0.5)');
    g2.fillStyle = vg; g2.fillRect(0, 0, buf.x, buf.y);
  }

  // ---------- CÂMERA TÉRMICA: o peixe é a coisa mais quente do lago ----------
  const IRON = (() => {
    const stops = [[0, [0, 0, 10]], [0.2, [40, 0, 90]], [0.4, [150, 0, 120]], [0.6, [230, 60, 20]], [0.8, [255, 170, 0]], [1, [255, 255, 220]]];
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = (t - t0) / (t1 - t0);
      for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = c0[ch] + (c1[ch] - c0[ch]) * f;
    }
    return lut;
  })();
  const heat = {};
  function heatRender(dt) {
    follow2(dt); ringsTick(dt);
    view2.s = buf.x / (aspect >= 1 ? 40 : 24);
    const D = 5 * DPR, hw = Math.ceil(buf.x / D), hh = Math.ceil(buf.y / D);
    if (!heat.c || heat.c.width !== hw || heat.c.height !== hh) {
      heat.c = tile(hw, hh, () => {}); heat.x = heat.c.getContext('2d', { willReadFrequently: true });
      heat.out = tile(hw, hh, () => {}); heat.ox = heat.out.getContext('2d'); heat.img = heat.ox.createImageData(hw, hh);
    }
    const x = heat.x, s = view2.s / D;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = 'none';
    const gray = (v) => `rgb(${v},${v},${v})`;
    x.fillStyle = gray(95); x.fillRect(0, 0, hw, hh);
    x.setTransform(s, 0, 0, s, hw / 2 - view2.x * s, hh / 2 - view2.z * s);
    x.lineCap = 'round';
    for (const p of PATHS) { polyline(x, p); x.strokeStyle = gray(120); x.lineWidth = 2; x.stroke(); }
    x.fillStyle = gray(110); x.fill(LAKE2.sand);
    x.fillStyle = gray(45); x.fill(LAKE2.shore);
    x.fillStyle = gray(30); x.fill(LAKE2.b2);
    for (const r of rings2) { x.strokeStyle = `rgba(150,150,150,${Math.max(0, 0.6 - r.t / 2)})`; x.lineWidth = 0.4; x.beginPath(); x.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); x.stroke(); }
    pads.forEach((p) => { x.fillStyle = gray(70); x.beginPath(); x.arc(p.x, p.z, p.r, 0, TAU); x.fill(); });
    rocks.forEach((r) => { x.fillStyle = gray(165); x.beginPath(); x.arc(r.x, r.z, r.s * 0.7, 0, TAU); x.fill(); });
    trees.forEach((t, i) => { x.fillStyle = gray(60); x.beginPath(); x.arc(t.x, t.z, treeLook[i].r, 0, TAU); x.fill(); });
    for (const f of foods) if (f.on) { x.fillStyle = gray(190); x.beginPath(); x.arc(f.x, f.z, 0.35, 0, TAU); x.fill(); }
    inFish(x, () => {
      const amp = fishAmp(), { N, S, body } = fishBody(amp);
      fishTailPath(x, S, N, amp); x.fillStyle = gray(200); x.fill();
      x.fillStyle = gray(235); x.fill(body);
      x.fillStyle = gray(255); x.beginPath(); x.ellipse(S[5].x, S[5].y, 0.7, 0.3, 0, 0, TAU); x.fill();
    });
    // borra o calor e pinta com a paleta de câmera térmica
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = `blur(${Math.max(1, Math.round(1.6 * DPR))}px)`;
    x.drawImage(heat.c, 0, 0);
    x.filter = 'none';
    const src = x.getImageData(0, 0, hw, hh).data, out = heat.img.data;
    for (let i = 0; i < hw * hh; i++) {
      const v = Math.min(255, src[i * 4] + ((hash2(i, Math.floor(time * 20)) - 0.5) * 6 | 0)), k = Math.max(0, v) * 3;
      out[i * 4] = IRON[k]; out[i * 4 + 1] = IRON[k + 1]; out[i * 4 + 2] = IRON[k + 2]; out[i * 4 + 3] = 255;
    }
    heat.ox.putImageData(heat.img, 0, 0);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.imageSmoothingEnabled = true;
    g2.drawImage(heat.out, 0, 0, hw * D, hh * D);
    // mira no peixe, temperatura e régua de cores
    const [fx, fy] = toScreen2D(F.x, F.z), mono = `700 ${Math.round(12 * DPR)}px "JetBrains Mono", monospace`;
    g2.strokeStyle = '#ffffff'; g2.lineWidth = 1.5 * DPR;
    const r = 26 * DPR;
    g2.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g2.moveTo(fx + dx * r, fy + dy * r * 0.6); g2.lineTo(fx + dx * r, fy + dy * r); g2.lineTo(fx + dx * r * 0.6, fy + dy * r); }
    g2.stroke();
    g2.font = mono; g2.fillStyle = '#ffffff'; g2.textAlign = 'left'; g2.textBaseline = 'bottom';
    g2.fillText(`${(31.5 + Math.min(F.speed || 0, 7.5) * 0.35 + Math.sin(time) * 0.2).toFixed(1).replace('.', ',')} °C`, fx + r + 6 * DPR, fy - r * 0.4);
    const bx = buf.x - 60 * DPR, by0 = buf.y * 0.3, bh = buf.y * 0.4;
    if (buf.x / DPR >= 720) {
      for (let k = 0; k < bh; k++) { const v = Math.round((1 - k / bh) * 255) * 3; g2.fillStyle = `rgb(${IRON[v]},${IRON[v + 1]},${IRON[v + 2]})`; g2.fillRect(bx - 300 * DPR, by0 + k, 10 * DPR, 1); }
      g2.textBaseline = 'middle'; g2.textAlign = 'right';
      g2.fillText('34°', bx - 304 * DPR, by0); g2.fillText('12°', bx - 304 * DPR, by0 + bh);
    }
    g2.textAlign = 'left'; g2.textBaseline = 'alphabetic'; g2.font = `800 ${Math.round(14 * DPR)}px "JetBrains Mono", monospace`;
    g2.fillText('IR ● REC', 22 * DPR, buf.y - 84 * DPR);
  }
