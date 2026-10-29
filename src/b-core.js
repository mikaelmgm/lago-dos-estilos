(() => {
  'use strict';
  const failBox = document.getElementById('fail');
  const fail = (msg) => { failBox.textContent = msg; failBox.hidden = false; };
  const T = window.THREE;
  if (!T) { fail('Não deu para carregar o Three.js. Recarregue a página.'); return; }

  const canvas = document.getElementById('c');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); }
  catch (e) { fail('Este navegador não liberou WebGL, então o lago não pode ser desenhado.'); return; }
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x4f8a3a, 0);

  // ---------- acaso com semente e ruído ----------
  function mulberry32(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(1026);
  const rr = (a, b) => a + (b - a) * rand();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const lerpAngle = (a, b, t) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; };

  // ---------- materiais ----------
  // Cada material escreve o número do seu "tipo" no canal alfa da cena.
  // Os filtros leem esse número para saber o que é água, peixe, folha...
  const G = { EMPTY: 0, GRASS: 1, LEAF: 2, WATER: 3, SAND: 4, STONE: 5, WOOD: 6, FISH: 7, BUBBLE: 8, LILY: 9, REED: 10, FLOWER: 11 };
  const box = new T.BoxGeometry(1, 1, 1);
  const idAlpha = (id) => (id * 16 + 8) / 255;
  const matCache = {};
  function mat(id, color = 0xffffff) {
    const k = id + ':' + color;
    return matCache[k] || (matCache[k] = new T.MeshLambertMaterial({ color, opacity: idAlpha(id), transparent: false }));
  }
  const col = (hex) => new T.Color(hex);
  const hsl = (h, s, l) => new T.Color().setHSL(h, s, l);
  function jit(c, amt) {
    const o = {}; c.getHSL(o);
    return new T.Color().setHSL(o.h + (rand() - 0.5) * amt * 0.15, o.s, clamp(o.l + (rand() - 0.5) * amt, 0, 1));
  }

  // ---------- forma do lago ----------
  const RX = 16, RZ = 10.5, WATER_Y = -0.3, FISH_Y = -0.85, FISH_LIMIT = 0.72, FISH_SIZE = 1.5;
  const lakeR = (a) => 1 + 0.10 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + 0.035 * Math.sin(7 * a + 4.0);
  function lakeV(x, z) { const dx = x / RX, dz = z / RZ; return Math.hypot(dx, dz) / lakeR(Math.atan2(dz, dx)); }
  const polar = (a, k) => ({ x: RX * Math.cos(a) * k, z: RZ * Math.sin(a) * k });
  const bedTop = (v) => -0.9 - Math.round(3.0 * smooth((1 - v) / 0.32) / 0.35) * 0.35;

  const DOCK_A = -0.6, dockR = lakeR(DOCK_A);
  const dockLand = polar(DOCK_A, dockR * 1.18), dockEnd = polar(DOCK_A, dockR * 0.88);
  const LEFT_A = Math.PI + 0.25, leftShore = polar(LEFT_A, lakeR(LEFT_A) * 1.08);
  const PATHS = [
    [dockLand, { x: dockLand.x + 5, z: dockLand.z - 5 }, { x: 34, z: -18 }, { x: 50, z: -25 }],
    [leftShore, { x: leftShore.x - 6, z: leftShore.z + 3 }, { x: -36, z: 9 }, { x: -50, z: 14 }],
  ];
  function segDist(px, pz, a, b) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const t = clamp(((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
    return Math.hypot(px - a.x - vx * t, pz - a.z - vz * t);
  }
  function pathDist(x, z) {
    let m = Infinity;
    for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) m = Math.min(m, segDist(x, z, p[i], p[i + 1]));
    return m;
  }
  const isPath = (x, z) => pathDist(x, z) < 0.85 + vnoise(x * 0.4, z * 0.4) * 0.5;
  function cellTop(x, z) {
    const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5, v = lakeV(cx, cz);
    if (v < 1) return bedTop(v);
    if (v < 1.13) return -0.12;
    return isPath(cx, cz) ? -0.04 : 0;
  }

  // ---------- mundo de voxels ----------
  const scene = new T.Scene();
  const voxelWorld = new T.Group(), voxelTrees = new T.Group();
  scene.add(voxelWorld); voxelWorld.add(voxelTrees);
  const batches = new Map();
  const dummy = new T.Object3D();
  let addGroup = 'base';
  function add(id, x, y, z, sx, sy, sz, color, ry = 0, cast = true) {
    const key = addGroup + ':' + id + (cast ? 'c' : 'n');
    if (!batches.has(key)) batches.set(key, { id, cast, group: addGroup, items: [] });
    batches.get(key).items.push([x, y, z, sx, sy, sz, color, ry]);
  }
  const BOTTOM = -7;
  const column = (id, x, z, top, color) => add(id, x, (top + BOTTOM) / 2, z, 1, top - BOTTOM, 1, color);

  const X0 = -46, X1 = 46, Z0 = -40, Z1 = 30;
  const SAND_C = col(0xd9c690), DEEP_C = col(0x6aa392), PEBBLE_C = col(0x9b998c), SHORE_C = col(0xe4d29f), PATH_C = col(0xb8935f);
  for (let ix = X0; ix < X1; ix++) for (let iz = Z0; iz < Z1; iz++) {
    const x = ix + 0.5, z = iz + 0.5, v = lakeV(x, z);
    if (v < 1) {
      const s = smooth((1 - v) / 0.55);
      const c = rand() < 0.07 ? jit(PEBBLE_C, 0.12) : jit(SAND_C.clone().lerp(DEEP_C, s), 0.06);
      column(G.WATER, x, z, bedTop(v), c);
    } else if (v < 1.13) {
      column(G.SAND, x, z, -0.12, jit(SHORE_C, 0.05));
    } else if (isPath(x, z)) {
      column(G.SAND, x, z, -0.04, jit(PATH_C, 0.07));
    } else {
      const n1 = vnoise(x * 0.07, z * 0.07), n2 = vnoise(x * 0.31 + 19, z * 0.31 - 7);
      column(G.GRASS, x, z, 0, hsl(0.255 + n1 * 0.04, 0.36 + n2 * 0.07, 0.39 + n1 * 0.09 + n2 * 0.05 + (rand() - 0.5) * 0.025));
    }
  }

  // árvores (num grupo próprio, para o estilo L-system poder trocá-las)
  const trees = [];
  for (let tries = 0; trees.length < 60 && tries < 8000; tries++) {
    const x = Math.floor(rr(X0 + 3, X1 - 3)) + 0.5, z = Math.floor(rr(Z0 + 3, Z1 - 3)) + 0.5;
    if (lakeV(x, z) < (z > 0 ? 1.6 : 1.25) || pathDist(x, z) < 2.4) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 3.8)) continue;
    trees.push({ x, z });
  }
  addGroup = 'tree';
  for (const t of trees) {
    const h = 2 + Math.floor(rand() * 2);
    add(G.WOOD, t.x, h / 2, t.z, 0.8, h, 0.8, jit(col(0x7a5132), 0.05));
    const R = 1.7 + rand() * 0.9, cy = h + R * 0.55, n = Math.ceil(R) + 1, hue = 0.23 + rand() * 0.07;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
      const d = (i * i + k * k) / (R * R) + (j * j) / (R * R * 0.62);
      if (d > 1 + (rand() - 0.5) * 0.4 || d < 0.35) continue;
      add(G.LEAF, t.x + i, cy + j, t.z + k, 1, 1, 1, hsl(hue + (rand() - 0.5) * 0.02, 0.5, 0.33 + (j / n) * 0.09 + (rand() - 0.5) * 0.06));
    }
  }
  addGroup = 'base';

  // pedras na margem e na parte rasa
  const rocks = [];
  for (let placed = 0, tries = 0; placed < 18 && tries < 3000; tries++) {
    const a = rand() * Math.PI * 2, p = polar(a, lakeR(a) * rr(0.9, 1.5)), v = lakeV(p.x, p.z);
    if (v < 0.93 || pathDist(p.x, p.z) < 1.6 || segDist(p.x, p.z, dockLand, dockEnd) < 2.6) continue;
    placed++;
    const base = cellTop(p.x, p.z), wet = v < 1, parts = 1 + Math.floor(rand() * 3);
    rocks.push({ x: p.x, z: p.z, base, wet, s: 0.7 + parts * 0.25 });
    for (let j = 0; j < parts; j++) {
      const s = rr(0.6, 1.3) * (j ? 0.7 : 1);
      const top = wet ? WATER_Y + rr(0.15, 0.55) : base + rr(0.35, 1.0) * (j ? 0.6 : 1);
      const ox = j ? rr(-0.8, 0.8) : 0, oz = j ? rr(-0.8, 0.8) : 0;
      add(G.STONE, p.x + ox, (top + base - 0.3) / 2, p.z + oz, s, top - base + 0.3, s * rr(0.8, 1.2), jit(col(0xa7a59b), 0.12), rand() * Math.PI);
    }
  }

  // flores e tufos de grama
  const FLOWER_COLS = [0xfff8ec, 0xffe066, 0xff9ec4, 0xc9a7ff, 0xffffff];
  for (let placed = 0, tries = 0; placed < 170 && tries < 6000; tries++) {
    const x = rr(X0, X1), z = rr(Z0, Z1);
    if (cellTop(x, z) !== 0 || lakeV(x, z) < 1.2) continue;
    placed++;
    add(G.FLOWER, x, 0.14, z, 0.26, 0.26, 0.26, col(FLOWER_COLS[Math.floor(rand() * FLOWER_COLS.length)]), 0, false);
  }
  for (let placed = 0, tries = 0; placed < 280 && tries < 6000; tries++) {
    const x = rr(X0, X1), z = rr(Z0, Z1);
    if (cellTop(x, z) !== 0) continue;
    placed++;
    add(G.GRASS, x, 0.2, z, 0.16, 0.4, 0.16, hsl(0.26 + rand() * 0.04, 0.5, 0.3 + rand() * 0.12), rand() * 3, false);
  }

  // vitórias-régias
  const pads = [];
  for (let tries = 0; pads.length < 10 && tries < 3000; tries++) {
    const a = rand() * Math.PI * 2, p = polar(a, lakeR(a) * rr(0.3, 0.86));
    if (pads.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 3.4) || segDist(p.x, p.z, dockLand, dockEnd) < 2.5) continue;
    pads.push(p);
  }
  pads.forEach((p, idx) => {
    const r = rr(0.85, 1.35), notch = rand() * Math.PI * 2, hue = 0.28 + (rand() - 0.5) * 0.04;
    p.r = r; p.flower = idx % 3 === 0;
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const px = i * 0.45, pz = j * 0.45, d = Math.hypot(px, pz);
      if (d > r) continue;
      const ang = Math.atan2(pz, px) - notch;
      if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.34 && d > 0.2) continue;
      add(G.LILY, p.x + px, WATER_Y + 0.07, p.z + pz, 0.46, 0.08, 0.46, hsl(hue, 0.48, 0.36 + (rand() - 0.5) * 0.07 + (d < 0.5 ? 0.04 : 0)));
    }
    if (p.flower) {
      const fx = p.x + 0.15, fz = p.z - 0.1;
      for (const [ox, oz] of [[0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) add(G.FLOWER, fx + ox, WATER_Y + 0.22, fz + oz, 0.24, 0.2, 0.24, col(0xff8fbf));
      add(G.FLOWER, fx, WATER_Y + 0.32, fz, 0.18, 0.12, 0.18, col(0xffe27a));
    }
  });

  // pier de madeira
  const dock = (() => {
    const dx = dockEnd.x - dockLand.x, dz = dockEnd.z - dockLand.z, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, ry = Math.atan2(-uz, ux);
    let n = 0;
    for (let s = 0; s <= len; s += 0.56, n++) {
      add(G.WOOD, dockLand.x + ux * s, 0.14, dockLand.z + uz * s, 0.48, 0.14, 2.3, jit(col(n % 2 ? 0x9c6a3c : 0x8b5b31), 0.04), ry);
    }
    for (const s of [0.4, len * 0.5, len - 0.2]) for (const side of [-1, 1]) {
      const x = dockLand.x + ux * s - uz * side, z = dockLand.z + uz * s + ux * side, base = cellTop(x, z);
      add(G.WOOD, x, (0.32 + base) / 2, z, 0.3, 0.32 - base, 0.3, col(0x6e4727), ry);
    }
    return { len, ux, uz, ry };
  })();

  for (const b of batches.values()) {
    const mesh = new T.InstancedMesh(box, mat(b.id), b.items.length);
    b.items.forEach((it, i) => {
      dummy.position.set(it[0], it[1], it[2]);
      dummy.rotation.set(0, it[7], 0);
      dummy.scale.set(it[3], it[4], it[5]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, it[6]);
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    (b.group === 'tree' ? voxelTrees : voxelWorld).add(mesh);
  }

  // ---------- juncos e algas que balançam ----------
  const stalkGeo = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const reeds = [], weeds = [];
  for (let c = 0; c < 8; c++) {
    const a = rand() * Math.PI * 2, center = polar(a, lakeR(a) * rr(0.95, 1.05));
    if (segDist(center.x, center.z, dockLand, dockEnd) < 3) continue;
    const count = 7 + Math.floor(rand() * 7);
    for (let i = 0; i < count; i++) {
      const x = center.x + rr(-1.3, 1.3), z = center.z + rr(-1.3, 1.3), v = lakeV(x, z);
      if (v < 0.9) continue;
      const base = cellTop(x, z);
      const h = v < 1 ? (WATER_Y - base) + rr(1.2, 2.4) : rr(1.1, 2.1);
      reeds.push({ x, z, base, h, w: rr(0.12, 0.17), ph: rand() * 6.28, c: hsl(0.24 + rand() * 0.05, 0.45, 0.32 + rand() * 0.1), head: rand() < 0.35 });
    }
  }
  for (let tries = 0; weeds.length < 44 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2, p = polar(a, lakeR(a) * rr(0.15, 0.72)), tall = rr(0.6, 1.9);
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x = p.x + rr(-0.5, 0.5), z = p.z + rr(-0.5, 0.5), base = cellTop(x, z);
      const h = Math.min(tall * rr(0.6, 1), -1.55 - base);
      if (h < 0.35) continue;
      weeds.push({ x, z, base, h, w: 0.2, ph: rand() * 6.28, c: hsl(0.36 + rand() * 0.05, 0.45, 0.3 + rand() * 0.08) });
    }
  }
  function stalkMesh(list, id) {
    const m = new T.InstancedMesh(stalkGeo, mat(id), list.length);
    list.forEach((r, i) => m.setColorAt(i, r.c));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  const reedMesh = stalkMesh(reeds, G.REED), weedMesh = stalkMesh(weeds, G.REED);
  const headMesh = new T.InstancedMesh(box, mat(G.WOOD, 0x7a4a26), reeds.filter(r => r.head).length);
  headMesh.castShadow = true; headMesh.frustumCulled = false; scene.add(headMesh);

  const q = new T.Quaternion(), eul = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), up = new T.Vector3(), m4 = new T.Matrix4();
  function swayStalks(mesh, list, t, amt, speed, heads) {
    let hi = 0;
    list.forEach((r, i) => {
      const s = Math.sin(t * speed + r.ph) * amt + Math.sin(t * speed * 1.7 + r.ph * 2.3) * amt * 0.4;
      eul.set(s * 0.5, 0, s); q.setFromEuler(eul);
      pv.set(r.x, r.base, r.z); sv.set(r.w, r.h, r.w);
      m4.compose(pv, q, sv); mesh.setMatrixAt(i, m4);
      if (heads && r.head) {
        up.set(0, r.h - 0.25, 0).applyQuaternion(q).add(pv); sv.set(0.26, 0.55, 0.26);
        m4.compose(up, q, sv); heads.setMatrixAt(hi++, m4);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (heads) heads.instanceMatrix.needsUpdate = true;
  }

  // ---------- água ----------
  // A água mistura a cor normalmente, mas não toca no canal alfa:
  // assim o que está embaixo dela (o peixe, as algas) continua com o próprio tipo.
  const waterMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vW;
      void main() {
        vec2 p = vW.xz;
        float w1 = sin(p.x * 0.9 + uTime * 1.2 + sin(p.y * 0.7 + uTime * 0.5) * 1.5);
        float w2 = sin(p.y * 1.3 - uTime * 1.0 + sin(p.x * 0.5 - uTime * 0.4) * 1.2);
        float h = (w1 + w2) * 0.25 + 0.5;
        vec3 c = mix(vec3(0.38, 0.76, 0.80), vec3(0.68, 0.93, 0.93), h * 0.65);
        float sp = smoothstep(0.86, 1.0, h * 0.55 + 0.45 * sin(p.x * 2.3 + p.y * 1.7 + uTime * 2.0));
        c += sp * 0.3;
        gl_FragColor = vec4(c, 0.36 + sp * 0.2);
      }`,
    transparent: true, depthWrite: false,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation, blendSrc: T.SrcAlphaFactor, blendDst: T.OneMinusSrcAlphaFactor,
    blendEquationAlpha: T.AddEquation, blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor,
  });
  const water = new T.Mesh(new T.PlaneGeometry(RX * 2.6, RZ * 2.6), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y;
  scene.add(water);

  // ---------- o peixe (uma carpa koi de blocos) ----------
  const fish = new T.Group();
  scene.add(fish);
  const fishVox = new T.Group();
  fish.add(fishVox);
  function part(parent, color, sx, sy, sz, x, y, z) {
    const m = new T.Mesh(box, mat(G.FISH, color));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
    parent.add(m);
    return m;
  }
  const ORANGE = 0xff6418, ORANGE2 = 0xff7f2e, CREAM = 0xfff1dc, RED = 0xe0441c, FIN = 0xffcf9e;
  part(fishVox, ORANGE, 1.3, 0.62, 0.66, 0.1, 0, 0);
  part(fishVox, ORANGE2, 0.55, 0.54, 0.56, 0.95, 0, 0);
  part(fishVox, 0xffb46a, 0.22, 0.36, 0.4, 1.32, -0.03, 0);
  part(fishVox, 0x161616, 0.13, 0.15, 0.08, 1.05, 0.11, 0.29);
  part(fishVox, 0x161616, 0.13, 0.15, 0.08, 1.05, 0.11, -0.29);
  part(fishVox, CREAM, 0.38, 0.07, 0.3, 0.38, 0.33, 0.1);
  part(fishVox, CREAM, 0.22, 0.07, 0.22, 0.95, 0.29, -0.08);
  part(fishVox, RED, 0.42, 0.07, 0.34, -0.2, 0.33, -0.08);
  part(fishVox, ORANGE2, 0.7, 0.22, 0.1, -0.05, 0.42, 0);
  const finL = part(fishVox, FIN, 0.36, 0.06, 0.42, 0.55, -0.12, 0.47);
  const finR = part(fishVox, FIN, 0.36, 0.06, 0.42, 0.55, -0.12, -0.47);
  const rear = new T.Group(); rear.position.set(-0.55, 0, 0); fishVox.add(rear);
  part(rear, ORANGE, 0.72, 0.5, 0.52, -0.35, 0, 0);
  part(rear, CREAM, 0.3, 0.07, 0.3, -0.3, 0.27, 0.06);
  const tail = new T.Group(); tail.position.set(-0.7, 0, 0); rear.add(tail);
  part(tail, 0xff9a52, 0.3, 0.36, 0.3, -0.1, 0, 0);
  part(tail, FIN, 0.52, 0.1, 1.1, -0.48, 0, 0);
  part(tail, 0xffe0bd, 0.3, 0.08, 0.36, -0.84, 0, 0.42);
  part(tail, 0xffe0bd, 0.3, 0.08, 0.36, -0.84, 0, -0.42);
  fish.scale.setScalar(FISH_SIZE);
  const tailExtra = [];   // caudas de outros modelos de peixe, animadas junto
  const F = { x: 0, z: 2, vx: 0, vz: 0, heading: 0.4, phase: 0, speed: 0 };
  let screenToWorld = null;

  // ração e bolhas
  const foods = Array.from({ length: 3 }, (_, i) => ({ on: false, x: 0, y: 0, z: 0, at: 0.6 + i * 1.2, ph: Math.random() * 6 }));
  const foodMesh = new T.InstancedMesh(box, mat(G.SAND), foods.length);
  foods.forEach((f, i) => foodMesh.setColorAt(i, col(0xf3a23a)));
  foodMesh.instanceColor.needsUpdate = true;
  foodMesh.castShadow = true; foodMesh.frustumCulled = false; scene.add(foodMesh);

  const bubbles = Array.from({ length: 48 }, () => ({ on: false, x: 0, y: 0, z: 0, s: 0, vy: 0, ph: 0 }));
  const bubMesh = new T.InstancedMesh(box, mat(G.BUBBLE, 0xe9fbff), bubbles.length);
  bubMesh.frustumCulled = false; scene.add(bubMesh);
  function emitBubble(x, y, z) {
    const b = bubbles.find(b => !b.on);
    if (b) Object.assign(b, { on: true, x, y, z, s: 0.12 + Math.random() * 0.12, vy: 0.7 + Math.random() * 0.6, ph: Math.random() * 6.28 });
  }

  // ---------- luz e câmeras ----------
  scene.add(new T.HemisphereLight(0xfff3d6, 0x5d7f4c, 0.6));
  const sun = new T.DirectionalLight(0xfff0d0, 0.44);
  sun.position.set(-30, 52, -14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, near: 1, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const camera = new T.PerspectiveCamera(30, 1, 1, 400);
  const isoCam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  let activeCam = camera;
  const camT = new T.Vector3(0, 0, 1.5);
  let camScale = 1, follow = 0.55, aspect = 1;
  let camMode = '';
  function placeCamera() {
    if (activeCam === isoCam) {
      isoCam.position.set(camT.x + 40, 40, camT.z + 40);
      isoCam.lookAt(camT.x, 0, camT.z);
    } else if (camMode === 'low') {
      // câmera baixa, olhando para o horizonte
      camera.position.set(camT.x, 9 * camScale, camT.z + 26 * camScale);
      camera.lookAt(camT.x, 0, camT.z - 14);
    } else {
      camera.position.set(camT.x, 39 * camScale, camT.z + 31 * camScale);
      camera.lookAt(camT.x, -0.6, camT.z);
    }
  }
  function sizeIso() {
    const hh = 15 * camScale;
    Object.assign(isoCam, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    isoCam.updateProjectionMatrix();
  }

  // ---------- controles ----------
  const scoreEl = document.getElementById('score');
  let time = 0, lastInput = -100, score = 0, nextBubble = 1, focus = 0.5;
  const keys = new Set();
  const buf = new T.Vector2(1, 1);
  const fishScreen = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, speed: 0 };
  const eatHooks = [];

  let pointerDown = false, pointerX = 0, pointerY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    pointerDown = true; pointerX = e.clientX; pointerY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', (e) => { pointerX = e.clientX; pointerY = e.clientY; });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { pointerDown = false; });

  const ray = new T.Raycaster(), ndc = new T.Vector2(), fishPlane = new T.Plane(new T.Vector3(0, 1, 0), -FISH_Y), hit = new T.Vector3(), proj = new T.Vector3();
  const camFwd = new T.Vector3();
  const wander = { x: 0, z: 0, until: 0 };
  function randomLakePoint(maxV) { const a = Math.random() * Math.PI * 2; return polar(a, Math.sqrt(Math.random()) * maxV * lakeR(a)); }

  // Devolve a direção desejada: teclado, ponteiro, ou piloto automático quando ninguém mexe.
  function steer() {
    const kx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const kz = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
    if (kx || kz) {
      lastInput = time;
      // "para cima" é para onde a câmera olha, mesmo na vista isométrica
      activeCam.getWorldDirection(camFwd); camFwd.y = 0; camFwd.normalize();
      const mx = -camFwd.z * kx - camFwd.x * kz, mz = camFwd.x * kx - camFwd.z * kz;
      const l = Math.hypot(mx, mz) || 1;
      return [mx / l, mz / l];
    }
    let tx, tz, gain = 1;
    if (pointerDown && screenToWorld) {
      // mundos 2D sabem converter a tela direto para o lago
      const w = screenToWorld(pointerX, pointerY);
      lastInput = time; tx = w.x; tz = w.z;
    } else if (pointerDown) {
      const r = canvas.getBoundingClientRect();
      ndc.set((pointerX - r.left) / r.width * 2 - 1, -(pointerY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ndc, activeCam);
      if (!ray.ray.intersectPlane(fishPlane, hit)) return [0, 0];
      lastInput = time; tx = hit.x; tz = hit.z;
    } else if (time - lastInput > 6) {
      let best = null, bd = Infinity;
      for (const f of foods) if (f.on) { const d = Math.hypot(f.x - F.x, f.z - F.z); if (d < bd) { bd = d; best = f; } }
      if (best) { tx = best.x; tz = best.z; }
      else {
        if (time > wander.until || Math.hypot(wander.x - F.x, wander.z - F.z) < 1.5) { Object.assign(wander, randomLakePoint(0.7)); wander.until = time + 5; }
        tx = wander.x; tz = wander.z;
      }
      gain = 0.5;
    } else return [0, 0];
    const dx = tx - F.x, dz = tz - F.z, d = Math.hypot(dx, dz);
    if (d < 0.4) return [0, 0];
    const s = Math.min(1, d / 2.5) * gain;
    return [dx / d * s, dz / d * s];
  }

  function spawnPoint() {
    let p = randomLakePoint(0.66);
    for (let i = 0; i < 20 && Math.hypot(p.x - F.x, p.z - F.z) < 6; i++) p = randomLakePoint(0.66);
    return p;
  }
  function eat(f) {
    score++;
    scoreEl.textContent = score;
    scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop');
    for (let i = 0; i < 7; i++) emitBubble(f.x + (Math.random() - 0.5) * 0.8, FISH_Y + Math.random() * 0.3, f.z + (Math.random() - 0.5) * 0.8);
    for (const h of eatHooks) h(f);
  }
  function toScreen(x, y, z, out) {
    proj.set(x, y, z).project(activeCam);
    out.x = (proj.x * 0.5 + 0.5) * buf.x; out.y = (proj.y * 0.5 + 0.5) * buf.y;
    return out;
  }
  const tmpS = { x: 0, y: 0 };

  // ---------- simulação ----------
  function update(dt) {
    time += dt;
    const [ax, az] = steer();
    F.vx += ax * 20 * dt; F.vz += az * 20 * dt;
    const drag = Math.exp(-2.4 * dt);
    F.vx *= drag; F.vz *= drag;
    let sp = Math.hypot(F.vx, F.vz);
    if (sp > 7.5) { F.vx *= 7.5 / sp; F.vz *= 7.5 / sp; sp = 7.5; }
    F.x += F.vx * dt; F.z += F.vz * dt;
    const v = lakeV(F.x, F.z);
    if (v > FISH_LIMIT) {
      F.x *= FISH_LIMIT / v; F.z *= FISH_LIMIT / v;
      let nx = F.x / (RX * RX), nz = F.z / (RZ * RZ);
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const vn = F.vx * nx + F.vz * nz;
      if (vn > 0) { F.vx -= nx * vn; F.vz -= nz * vn; }
    }
    if (sp > 0.25) F.heading = lerpAngle(F.heading, Math.atan2(-F.vz, F.vx), 1 - Math.exp(-6 * dt));
    F.phase += dt * (2.6 + sp * 1.5);
    F.speed = sp;
    const amp = 0.3 + Math.min(sp / 7.5, 1) * 0.7;
    rear.rotation.y = Math.sin(F.phase) * 0.2 * amp;
    tail.rotation.y = Math.sin(F.phase - 1.1) * 0.55 * amp;
    for (const t of tailExtra) t.rotation.y = Math.sin(F.phase - 1.1) * 0.55 * amp;
    finL.rotation.x = 0.25 + Math.sin(F.phase * 0.7) * 0.35;
    finR.rotation.x = -finL.rotation.x;
    fish.position.set(F.x, FISH_Y + Math.sin(time * 1.6) * 0.04, F.z);
    fish.rotation.y = F.heading - Math.sin(F.phase) * 0.07 * amp;

    const cs = Math.cos(F.heading), sn = Math.sin(F.heading);
    const mx = F.x + cs * 1.4 * FISH_SIZE, mz = F.z - sn * 1.4 * FISH_SIZE;
    if (time > nextBubble) {
      emitBubble(mx, FISH_Y + 0.15, mz);
      if (Math.random() < 0.4) emitBubble(mx, FISH_Y + 0.1, mz);
      nextBubble = time + 0.5 + Math.random() * 1.1;
    }
    bubbles.forEach((b, i) => {
      if (b.on) {
        b.y += b.vy * dt;
        b.x += Math.sin(time * 3 + b.ph) * 0.25 * dt;
        if (b.y > WATER_Y - 0.06) b.on = false;
      }
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.ph, 0); dummy.scale.setScalar(b.on ? b.s : 0.0001);
      dummy.updateMatrix(); bubMesh.setMatrixAt(i, dummy.matrix);
    });
    bubMesh.instanceMatrix.needsUpdate = true;

    foods.forEach((f, i) => {
      if (!f.on && time > f.at) { const p = spawnPoint(); f.x = p.x; f.z = p.z; f.y = WATER_Y + 0.08; f.on = true; }
      if (f.on) {
        f.y = Math.max(FISH_Y + 0.05, f.y - 0.22 * dt);
        if (f.y < WATER_Y && Math.hypot(f.x - mx, f.z - mz) < 0.95) { f.on = false; f.at = time + 1.2 + Math.random() * 1.5; eat(f); }
      }
      dummy.position.set(f.x, f.y + Math.sin(time * 2 + f.ph) * 0.05, f.z);
      dummy.rotation.set(time * 0.8 + f.ph, time * 1.3 + f.ph, 0);
      dummy.scale.setScalar(f.on ? 0.34 : 0.0001);
      dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix);
    });
    foodMesh.instanceMatrix.needsUpdate = true;

    swayStalks(reedMesh, reeds, time, 0.07, 1.3, headMesh);
    swayStalks(weedMesh, weeds, time, 0.16, 0.9, null);
    waterMat.uniforms.uTime.value = time;

    const k = 1 - Math.exp(-2.2 * dt);
    camT.x += (F.x * follow - camT.x) * k;
    camT.z += (F.z * follow + (activeCam === isoCam ? 0 : 1.5) - camT.z) * k;
    placeCamera();
    activeCam.updateMatrixWorld();

    // onde o peixe está na tela (em pixels do canvas), usado por vários estilos
    const px0 = fishScreen.x, py0 = fishScreen.y;
    toScreen(F.x, FISH_Y, F.z, fishScreen);
    fishScreen.vx = dt > 0 ? (fishScreen.x - px0) / dt : 0;
    fishScreen.vy = dt > 0 ? (fishScreen.y - py0) / dt : 0;
    toScreen(F.x - cs * 1.7 * FISH_SIZE, FISH_Y, F.z + sn * 1.7 * FISH_SIZE, tmpS);
    fishScreen.tx = tmpS.x; fishScreen.ty = tmpS.y;
    focus += ((fishScreen.y / buf.y) - focus) * (1 - Math.exp(-3 * dt));
  }
