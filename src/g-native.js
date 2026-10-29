
  // ======================================================================
  // ESTILOS COM ARTE PRÓPRIA: cada um desenha o próprio mundo, sem passar pelos voxels.
  // Só a lógica (peixe, ração, forma do lago) é compartilhada.
  // ======================================================================

  // ---------- base 2D (vetorial e pixel art) ----------
  const c2 = document.getElementById('c2');
  const g2 = c2.getContext('2d');
  const view2 = { x: 0, z: 1, s: 30 };
  const r2 = mulberry32(2024);
  const flowers2 = [], blobs2 = [], glints2 = [], rings2 = [];
  const FLOWER_HEX = [0xfffaf0, 0xffe066, 0xff9ec4, 0xc9a7ff];
  for (let n = 0, t = 0; n < 220 && t < 8000; t++) {
    const x = X0 + r2() * (X1 - X0), z = Z0 + r2() * (Z1 - Z0);
    if (cellTop(x, z) !== 0 || lakeV(x, z) < 1.2) continue;
    n++;
    flowers2.push({ x, z, c: FLOWER_HEX[Math.floor(r2() * 4)], s: 0.15 + r2() * 0.1, a: r2() * 6 });
  }
  for (let i = 0; i < 70; i++) {
    blobs2.push({ x: X0 + r2() * (X1 - X0), z: Z0 + r2() * (Z1 - Z0), rx: 1.5 + r2() * 4, rz: 0.8 + r2() * 2.2, a: r2() * Math.PI, c: r2() < 0.6 ? '#8cc75a' : '#b0dc78' });
  }
  for (let i = 0; i < 42; i++) {
    const a = r2() * Math.PI * 2, p = polar(a, Math.sqrt(r2()) * 0.9 * lakeR(a));
    glints2.push({ x: p.x, z: p.z, ph: r2() * 6.28, len: 0.6 + r2() * 1.2 });
  }
  const treeLook = trees.map(() => ({ r: 1.5 + r2() * 0.9, pink: r2() < 0.15, a: r2() * 6, tone: r2() }));
  const rockLook = rocks.map(() => ({ k: Array.from({ length: 7 }, () => 0.75 + r2() * 0.35) }));
  const padLook = pads.map(() => r2() * Math.PI * 2);
  const hexStr = (h) => '#' + h.toString(16).padStart(6, '0');

  function lakeLoop(k, n = 160) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, p = polar(a, lakeR(a) * k); pts.push({ x: p.x, y: p.z }); }
    return pts;
  }
  // curva suave fechada passando pelos pontos médios
  function smoothPath(pts, path = new Path2D()) {
    const n = pts.length, mid = (i) => ({ x: (pts[i % n].x + pts[(i + 1) % n].x) / 2, y: (pts[i % n].y + pts[(i + 1) % n].y) / 2 });
    const s = mid(0);
    path.moveTo(s.x, s.y);
    for (let i = 1; i <= n; i++) { const c = pts[i % n], e = mid(i); path.quadraticCurveTo(c.x, c.y, e.x, e.y); }
    path.closePath();
    return path;
  }
  const LAKE2 = {
    sand: smoothPath(lakeLoop(1.15)), wet: smoothPath(lakeLoop(1.05)), shore: smoothPath(lakeLoop(1.0)),
    b1: smoothPath(lakeLoop(0.82)), b2: smoothPath(lakeLoop(0.6)), b3: smoothPath(lakeLoop(0.38)),
  };

  // forma do peixe: uma espinha que ondula e uma largura que afina até a cauda
  const FISH_HEAD = 1.45, FISH_LEN = 2.7;
  const fishWidth = (u) => Math.max(0.6 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.65)), 0.9), 0.12 * u);
  const fishAmp = () => 0.12 + Math.min((F.speed || 0) / 7.5, 1) * 0.25;
  function fishWave(x, amp) {
    const d = FISH_HEAD - x;
    return Math.sin(F.phase - d * 1.6) * amp * Math.pow(clamp(d / FISH_LEN, 0, 1.4), 1.5);
  }

  let nextRing = 0;
  function ringsTick(dt) {
    if ((F.speed || 0) > 3.5 && time > nextRing) {
      rings2.push({ x: F.x, z: F.z, t: 0, big: 0.6 });
      nextRing = time + 0.45;
    }
    for (const r of rings2) r.t += dt;
    while (rings2.length && rings2[0].t > 1.3) rings2.shift();
  }
  function devXY(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return [(cx - r.left) * buf.x / r.width, (cy - r.top) * buf.y / r.height];
  }
  function follow2(dt) {
    const k = 1 - Math.exp(-2.2 * dt);
    view2.x += (F.x * 0.6 - view2.x) * k;
    view2.z += (F.z * 0.6 - view2.z) * k;
  }
  function twoDEnter(toWorld) {
    c2.width = buf.x; c2.height = buf.y;
    c2.hidden = false;
    screenToWorld = toWorld;
    view2.x = F.x * 0.6; view2.z = F.z * 0.6;
  }
  function twoDExit() { c2.hidden = true; screenToWorld = null; }

  // ---------- VETORIAL FLAT ----------
  function fishBody(amp) {
    const N = 18, S = [], L = [], R = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = FISH_HEAD - u * FISH_LEN, y = fishWave(x, amp);
      const y2 = fishWave(x - 0.05, amp);
      let tx = 0.05, ty = y - y2;
      const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
      const w = fishWidth(u);
      S.push({ x, y, tx, ty, w });
      L.push({ x: x - ty * w, y: y + tx * w });
      R.push({ x: x + ty * w, y: y - tx * w });
    }
    const outline = L.concat(R.slice().reverse());
    const body = new Path2D();
    body.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length - 1; i++) {
      const c = outline[i], e = outline[i + 1];
      body.quadraticCurveTo(c.x, c.y, (c.x + e.x) / 2, (c.y + e.y) / 2);
    }
    body.closePath();
    const at = (u, side, k) => { const s = S[Math.round(u * N)]; return { x: s.x - s.ty * s.w * side * k, y: s.y + s.tx * s.w * side * k, a: Math.atan2(s.ty, s.tx) }; };
    return { N, S, body, at };
  }
  function flatFish(ctx) {
    const amp = fishAmp(), { N, S, body, at } = fishBody(amp);

    // cauda em leque
    const e = S[N], ta = Math.atan2(e.ty, e.tx) + Math.sin(F.phase - 1.1) * amp * 1.4;
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(ta);
    ctx.fillStyle = '#ffb27a';
    ctx.beginPath();
    ctx.moveTo(0.05, 0.1);
    ctx.quadraticCurveTo(-0.35, 0.75, -1.0, 0.8);
    ctx.quadraticCurveTo(-0.72, 0.32, -0.6, 0);
    ctx.quadraticCurveTo(-0.72, -0.32, -1.0, -0.8);
    ctx.quadraticCurveTo(-0.35, -0.75, 0.05, -0.1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd2ad'; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
    for (const [x, y] of [[-0.85, 0.55], [-0.7, 0.25], [-0.7, -0.25], [-0.85, -0.55]]) { ctx.beginPath(); ctx.moveTo(-0.05, 0); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.restore();

    // nadadeiras do peito, batendo
    const flap = 0.65 + 0.35 * Math.sin(F.phase * 0.7);
    ctx.fillStyle = '#ffc59a';
    for (const side of [1, -1]) {
      const p = at(0.3, side, 0.85);
      ctx.beginPath();
      ctx.ellipse(p.x - 0.1, p.y + side * 0.18, 0.4, 0.17 * flap, p.a - side * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // corpo, com uma faixa mais clara no meio que dá volume
    ctx.fillStyle = '#ff7a2f'; ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = '#ff9552';
    ctx.beginPath();
    S.forEach((s, i) => { const x = s.x - s.ty * s.w * 0.35, y = s.y + s.tx * s.w * 0.35; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = N; i >= 0; i--) { const s = S[i]; ctx.lineTo(s.x + s.ty * s.w * 0.25, s.y - s.tx * s.w * 0.25); }
    ctx.fill();
    // manchas da carpa koi
    const spot = (u, off, rx, ry, color) => {
      const s = S[Math.round(u * N)];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(s.x - s.ty * off, s.y + s.tx * off, rx, ry, Math.atan2(s.ty, s.tx), 0, Math.PI * 2);
      ctx.fill();
    };
    spot(0.17, 0.1, 0.4, 0.27, '#fff4e6');
    spot(0.37, -0.06, 0.3, 0.2, '#e5431f');
    spot(0.56, -0.12, 0.46, 0.3, '#fff4e6');
    spot(0.8, 0.05, 0.22, 0.12, '#e5431f');
    ctx.restore();
    ctx.strokeStyle = '#d9541f'; ctx.lineWidth = 0.05; ctx.stroke(body);
    // olhos
    for (const side of [1, -1]) {
      const p = at(0.06, side, 0.62);
      ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.075, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x + 0.025, p.y - 0.02, 0.025, 0, Math.PI * 2); ctx.fill();
    }
  }

  function blobPath(ctx, x, z, r, k) {
    const pts = k.map((m, i) => { const a = i / k.length * Math.PI * 2; return { x: x + Math.cos(a) * r * m, y: z + Math.sin(a) * r * m }; });
    ctx.beginPath();
    smoothPath(pts, ctx);
  }

  function flatRender(dt) {
    follow2(dt); ringsTick(dt);
    const W = buf.x, H = buf.y, ctx = g2, TAU = Math.PI * 2;
    view2.s = W / (aspect >= 1 ? 40 : 24);
    const s = view2.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#9fd468'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, W / 2 - view2.x * s, H / 2 - view2.z * s);
    const vx0 = view2.x - W / 2 / s - 4, vx1 = view2.x + W / 2 / s + 4, vz0 = view2.z - H / 2 / s - 4, vz1 = view2.z + H / 2 / s + 4;
    const vis = (x, z) => x > vx0 && x < vx1 && z > vz0 && z < vz1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    for (const b of blobs2) if (vis(b.x, b.z)) { ctx.fillStyle = b.c; ctx.beginPath(); ctx.ellipse(b.x, b.z, b.rx, b.rz, b.a, 0, TAU); ctx.fill(); }
    for (const p of PATHS) {
      ctx.beginPath(); ctx.moveTo(p[0].x, p[0].z);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].z);
      ctx.strokeStyle = '#e3c486'; ctx.lineWidth = 2.3; ctx.stroke();
      ctx.strokeStyle = '#efd7a2'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    // lago em faixas de profundidade
    ctx.fillStyle = '#f6e2a8'; ctx.fill(LAKE2.sand);
    ctx.fillStyle = '#e8cf8e'; ctx.fill(LAKE2.wet);
    ctx.fillStyle = '#8fe3dc'; ctx.fill(LAKE2.shore);
    ctx.fillStyle = '#66d0d4'; ctx.fill(LAKE2.b1);
    ctx.fillStyle = '#45bccb'; ctx.fill(LAKE2.b2);
    ctx.fillStyle = '#34a7bd'; ctx.fill(LAKE2.b3);
    // embaixo d'água: algas, sombra, ração, peixe, bolhas
    ctx.strokeStyle = '#2f9a8a'; ctx.lineWidth = 0.2;
    for (const w of weeds) {
      const sw = Math.sin(time * 0.9 + w.ph) * 0.35;
      ctx.beginPath(); ctx.moveTo(w.x, w.z); ctx.quadraticCurveTo(w.x + sw * 0.5, w.z - w.h * 0.4, w.x + sw, w.z - w.h * 0.75); ctx.stroke();
    }
    ctx.save();
    ctx.translate(F.x + 0.6, F.z + 0.8); ctx.rotate(-F.heading);
    ctx.fillStyle = 'rgba(20, 80, 100, 0.22)';
    ctx.beginPath(); ctx.ellipse(-0.3 * FISH_SIZE, 0, 2.0 * FISH_SIZE, 0.6 * FISH_SIZE, 0, 0, TAU); ctx.fill();
    ctx.restore();
    for (const f of foods) if (f.on) {
      ctx.fillStyle = '#e0892a'; ctx.beginPath(); ctx.arc(f.x, f.z, 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffc06a'; ctx.beginPath(); ctx.arc(f.x - 0.06, f.z - 0.06, 0.09, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.translate(F.x, F.z); ctx.rotate(-F.heading); ctx.scale(FISH_SIZE, FISH_SIZE);
    flatFish(ctx);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 0.06;
    for (const b of bubbles) if (b.on) { ctx.beginPath(); ctx.arc(b.x, b.z, b.s * 0.9, 0, TAU); ctx.stroke(); }
    // brilhos e ondinhas na superfície
    ctx.save();
    ctx.clip(LAKE2.shore);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.12;
    for (const g of glints2) {
      const a = Math.sin(time * 1.3 + g.ph);
      if (a < 0.2) continue;
      ctx.globalAlpha = (a - 0.2) / 0.8 * 0.6;
      const dx = Math.sin(time * 0.5 + g.ph) * 0.4;
      ctx.beginPath(); ctx.moveTo(g.x - g.len / 2 + dx, g.z); ctx.quadraticCurveTo(g.x + dx, g.z - 0.2, g.x + g.len / 2 + dx, g.z); ctx.stroke();
    }
    for (const r of rings2) {
      ctx.globalAlpha = Math.max(0, 1 - r.t / 1.3) * 0.7;
      ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 0.14;
    ctx.setLineDash([0.8, 0.6]); ctx.lineDashOffset = -time * 0.6;
    ctx.stroke(LAKE2.shore);
    ctx.setLineDash([]);
    // pedras
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      const k = rockLook[i].k, rad = r.s * 0.75;
      ctx.fillStyle = 'rgba(30, 60, 40, 0.18)'; blobPath(ctx, r.x + 0.25, r.z + 0.3, rad, k); ctx.fill();
      ctx.fillStyle = '#aaa6bd'; blobPath(ctx, r.x, r.z, rad, k); ctx.fill();
      ctx.fillStyle = '#d4d1e1'; blobPath(ctx, r.x - rad * 0.18, r.z - rad * 0.2, rad * 0.6, k); ctx.fill();
    });
    // vitórias-régias
    pads.forEach((p, i) => {
      const n = padLook[i];
      ctx.fillStyle = 'rgba(20, 80, 90, 0.2)';
      ctx.beginPath(); ctx.arc(p.x + 0.15, p.z + 0.2, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5fbf6a';
      ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4aa858'; ctx.lineWidth = 0.06;
      for (let k = 1; k <= 5; k++) {
        const a = n + 0.35 + k / 6 * (TAU - 0.7);
        ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.lineTo(p.x + Math.cos(a) * p.r * 0.8, p.z + Math.sin(a) * p.r * 0.8); ctx.stroke();
      }
      if (p.flower) {
        ctx.fillStyle = '#ff8fbf';
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + time * 0.1; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 0.25, p.z + Math.sin(a) * 0.25, 0.24, 0.12, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(p.x, p.z, 0.13, 0, TAU); ctx.fill();
      }
    });
    // juncos
    for (const r of reeds) {
      const sw = Math.sin(time * 1.3 + r.ph) * 0.15, tx = r.x + sw * r.h, tz = r.z - r.h * 0.35;
      ctx.strokeStyle = '#4c9a4a'; ctx.lineWidth = r.w * 0.9;
      ctx.beginPath(); ctx.moveTo(r.x, r.z); ctx.lineTo(tx, tz); ctx.stroke();
      if (r.head) { ctx.fillStyle = '#8a5530'; ctx.beginPath(); ctx.ellipse(tx, tz, 0.09, 0.22, sw, 0, TAU); ctx.fill(); }
    }
    // píer
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    ctx.fillStyle = 'rgba(20, 60, 60, 0.2)'; ctx.fillRect(0.2, -0.95, dock.len, 2.3);
    for (let d = 0, n = 0; d <= dock.len; d += 0.56, n++) { ctx.fillStyle = n % 2 ? '#c98d5a' : '#b97d4c'; ctx.fillRect(d - 0.25, -1.15, 0.5, 2.3); }
    ctx.fillStyle = '#7a4c2b';
    for (const d of [0.4, dock.len * 0.5, dock.len - 0.2]) for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(d, side * 1.0, 0.16, 0, TAU); ctx.fill(); }
    ctx.restore();
    // flores
    for (const f of flowers2) {
      if (!vis(f.x, f.z)) continue;
      ctx.fillStyle = hexStr(f.c);
      for (let k = 0; k < 5; k++) { const a = f.a + k / 5 * TAU; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * f.s, f.z + Math.sin(a) * f.s, f.s * 0.75, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(f.x, f.z, f.s * 0.6, 0, TAU); ctx.fill();
    }
    // árvores vistas de cima, por cima de tudo
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i], r = L.r;
      const pal = L.pink ? ['#d9799c', '#f0a3bf', '#ffd0df'] : L.tone < 0.5 ? ['#3f9a52', '#4fae5c', '#7bd47b'] : ['#3a8f5a', '#4aa868', '#7ccf86'];
      ctx.fillStyle = 'rgba(30, 70, 30, 0.2)';
      ctx.beginPath(); ctx.ellipse(t.x + 0.9, t.z + 1.1, r * 1.05, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.arc(t.x, t.z, r, 0, TAU); ctx.fill();
      for (let k = 0; k < 6; k++) { const a = L.a + k / 6 * TAU; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * r * 0.78, t.z + Math.sin(a) * r * 0.78, r * 0.35, 0, TAU); ctx.fill(); }
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(t.x - r * 0.18, t.z - r * 0.2, r * 0.78, 0, TAU); ctx.fill();
      ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(t.x - r * 0.42, t.z - r * 0.45, r * 0.32, 0, TAU); ctx.fill();
    });
  }
  const flatToWorld = (cx, cy) => {
    const [x, y] = devXY(cx, cy);
    return { x: view2.x + (x - buf.x / 2) / view2.s, z: view2.z + (y - buf.y / 2) / view2.s };
  };

  // ---------- PIXEL ART ----------
  const PIX = 4;   // pixels de arte por unidade do mundo
  const pix = {};
  function pixInit() {
    if (pix.ground) return true;
    const ww = (X1 - X0) * PIX, wh = (Z1 - Z0) * PIX;
    const mk = () => { const c = document.createElement('canvas'); c.width = ww; c.height = wh; return c; };
    pix.ground = mk(); pix.over = mk();
    pix.S = 4; pix.ox = 0; pix.oy = 0;
    const gi = pix.ground.getContext('2d').createImageData(ww, wh), oi = pix.over.getContext('2d').createImageData(ww, wh);
    const put = (img, x, y, hex) => {
      if (x < 0 || y < 0 || x >= ww || y >= wh) return;
      const o = (y * ww + x) * 4;
      img.data[o] = hex >> 16; img.data[o + 1] = (hex >> 8) & 255; img.data[o + 2] = hex & 255; img.data[o + 3] = 255;
    };
    const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const rp = mulberry32(31);
    const toPx = (x, z) => [Math.round((x - X0) * PIX), Math.round((z - Z0) * PIX)];
    const WATER4 = [0x7fd8d0, 0x4dbfc6, 0x2f9db3, 0x237f9e];
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
      const wx = X0 + (x + 0.5) / PIX, wz = Z0 + (y + 0.5) / PIX, v = lakeV(wx, wz), b = B4[(y & 3) * 4 + (x & 3)] / 16;
      let c;
      if (v < 1) {
        if (v > 0.975) c = 0xe9fbf6;
        else { c = WATER4[Math.floor(clamp((1 - v) / 0.62 * 3 + (b - 0.5) * 0.7, 0, 3.99))]; if (rp() < 0.012) c = 0x9ee6dc; }
      } else if (v < 1.05) c = rp() < 0.08 ? 0xd4b676 : 0xe4c98a;
      else if (v < 1.15) c = rp() < 0.06 ? 0xe0c486 : 0xf2dca0;
      else if (isPath(wx, wz)) { const n = rp(); c = n < 0.08 ? 0xc49a5f : n < 0.14 ? 0xe7c891 : 0xd9b277; }
      else {
        const n = vnoise(wx * 0.25, wz * 0.25) + (b - 0.5) * 0.15;
        c = n < 0.35 ? 0x5aa83f : n > 0.7 ? 0x82cf57 : 0x6cbf4a;
        const q = rp();
        if (q < 0.05) c = 0x4e9a38; else if (q < 0.075) c = 0x9be06a;
      }
      put(gi, x, y, c);
    }
    // sombras das árvores no chão
    trees.forEach((t, i) => {
      const R = treeLook[i].r * PIX, [cx, cy] = toPx(t.x + 0.9, t.z + 1.1);
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        if (x * x + y * y * 1.4 > R * R) continue;
        const wx = X0 + (cx + x + 0.5) / PIX, wz = Z0 + (cy + y + 0.5) / PIX;
        if (lakeV(wx, wz) > 1.15 && !isPath(wx, wz)) put(gi, cx + x, cy + y, 0x4d9636);
      }
    });
    // flores (um sinalzinho de + de pixels)
    for (const f of flowers2) {
      const [x, y] = toPx(f.x, f.z);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(gi, x + dx, y + dy, f.c);
      put(gi, x, y, 0xffcf3f);
    }
    // forma redonda com contorno de 1 pixel e luz no canto de cima
    function sprite(img, cx, cy, R, wob, inside, cols) {
      const r0 = Math.ceil(R * 1.2) + 1;
      const isIn = (x, y) => { const d = Math.hypot(x, y), a = Math.atan2(y, x); return d < R * (1 + wob(a)) && inside(x, y); };
      for (let y = -r0; y <= r0; y++) for (let x = -r0; x <= r0; x++) {
        if (!isIn(x, y)) continue;
        const edge = !isIn(x + 1, y) || !isIn(x - 1, y) || !isIn(x, y + 1) || !isIn(x, y - 1);
        let c = cols.body;
        if (edge) c = cols.out;
        else if (Math.hypot(x + R * 0.45, y + R * 0.45) < R * 0.2) c = cols.hi;
        else if (Math.hypot(x + R * 0.3, y + R * 0.3) < R * 0.6) c = cols.light;
        put(img, cx + x, cy + y, c);
      }
    }
    rocks.forEach((r, i) => {
      const [cx, cy] = toPx(r.x, r.z), k = rockLook[i].k;
      sprite(gi, cx, cy, r.s * 0.75 * PIX, (a) => (k[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 7) % 7] - 0.9) * 0.5, () => true,
        { body: 0xa9a6b8, out: 0x5f5b72, light: 0xc4c1d2, hi: 0xe6e4ef });
    });
    // píer
    {
      const len = dock.len, ux = dock.ux, uz = dock.uz;
      for (let y = -40; y <= 40; y++) for (let x = -40; x <= 40; x++) {
        const [bx, by] = toPx(dockLand.x, dockLand.z), px = bx + x, py = by + y;
        const wx = X0 + (px + 0.5) / PIX - dockLand.x, wz = Z0 + (py + 0.5) / PIX - dockLand.z;
        const s = wx * ux + wz * uz, t = -wx * uz + wz * ux;
        if (s < -0.25 || s > len + 0.25 || Math.abs(t) > 1.15) continue;
        const n = Math.floor((s + 0.25) / 0.56), f = (s + 0.25) / 0.56 - n;
        let c = n % 2 ? 0xb8794a : 0xa66b3f;
        if (f < 0.12) c = 0x6e4426;
        if (Math.abs(t) > 1.0) c = 0x7a4c2b;
        put(gi, px, py, c);
      }
    }
    // camada de cima: vitórias-régias e copas das árvores
    pads.forEach((p, i) => {
      const [cx, cy] = toPx(p.x, p.z), n = padLook[i];
      sprite(oi, cx, cy, p.r * PIX, () => 0, (x, y) => {
        const a = Math.atan2(y, x) - n;
        return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 0.4 || Math.hypot(x, y) < 1.2;
      }, { body: 0x4fae5c, out: 0x2f7d44, light: 0x5fc066, hi: 0x86dc7c });
      if (p.flower) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) put(oi, cx + dx, cy + dy, 0xff8fbf);
        put(oi, cx, cy, 0xffe27a);
      }
    });
    trees.forEach((t, i) => {
      const L = treeLook[i], [cx, cy] = toPx(t.x, t.z);
      sprite(oi, cx, cy, L.r * PIX, (a) => 0.09 * Math.sin(a * 6 + L.a), () => true, L.pink
        ? { body: 0xe58fae, out: 0x9c4a6c, light: 0xf4b4ca, hi: 0xffe0ea }
        : { body: 0x3f9a4c, out: 0x24603a, light: 0x5fc062, hi: 0x8ee07e });
    });
    pix.ground.getContext('2d').putImageData(gi, 0, 0);
    pix.over.getContext('2d').putImageData(oi, 0, 0);
    return true;
  }

  // o peixe é rasterizado na hora, pixel por pixel, em qualquer ângulo
  const FISH_PAL = { body: '#ff7a2f', light: '#ff9d57', white: '#fff4e6', red: '#e5431f', fin: '#ffc59a', eye: '#1d1420' };
  function fishPixel(lx, ly, amp) {
    const y = ly - fishWave(lx, amp), ay = Math.abs(y);
    if (lx <= FISH_HEAD && lx >= FISH_HEAD - FISH_LEN) {
      const u = (FISH_HEAD - lx) / FISH_LEN, w = Math.max(fishWidth(u), 0.26 * u);
      if (ay < w) {
        if (u > 0.03 && u < 0.11 && Math.abs(ay - 0.24) < 0.09) return 'eye';
        if ((lx - 0.95) ** 2 / 0.09 + (y - 0.1) ** 2 / 0.05 < 1) return 'white';
        if ((lx + 0.15) ** 2 / 0.12 + (y + 0.12) ** 2 / 0.06 < 1) return 'white';
        if ((lx - 0.4) ** 2 / 0.05 + (y - 0.04) ** 2 / 0.035 < 1) return 'red';
        if (ay < w * 0.35 && u > 0.12 && u < 0.75) return 'light';
        return 'body';
      }
    }
    if ((lx - 0.55) ** 2 / 0.11 + (ay - 0.62) ** 2 / 0.03 < 1) return 'fin';
    const tx = FISH_HEAD - FISH_LEN - lx;
    if (tx > 0 && tx < 1.0 && ay < 0.12 + tx * 0.78 && !(tx > 0.6 && ay < (tx - 0.6) * 1.3)) return 'fin';
    return null;
  }
  function pixFish(c, ox, oy) {
    const amp = fishAmp(), cs = Math.cos(F.heading), sn = Math.sin(F.heading);
    const cx = (F.x - X0) * PIX - ox, cy = (F.z - Z0) * PIX - oy;
    const R = Math.ceil(2.5 * FISH_SIZE * PIX) + 2, size = R * 2 + 1;
    const x0 = Math.floor(cx) - R, y0 = Math.floor(cy) - R;
    if (!pix.grid || pix.grid.length < size * size) pix.grid = new Array(size * size);
    const grid = pix.grid;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const wx = (x0 + i + 0.5 + ox) / PIX + X0 - F.x, wz = (y0 + j + 0.5 + oy) / PIX + Z0 - F.z;
      grid[j * size + i] = fishPixel((wx * cs - wz * sn) / FISH_SIZE, (wx * sn + wz * cs) / FISH_SIZE, amp);
    }
    const at = (i, j) => (i < 0 || j < 0 || i >= size || j >= size) ? null : grid[j * size + i];
    c.fillStyle = '#1f6f8a';
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) if (grid[j * size + i]) c.fillRect(x0 + i + 2, y0 + j + 3, 1, 1);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const k = grid[j * size + i];
      if (!k) continue;
      const edge = !at(i + 1, j) || !at(i - 1, j) || !at(i, j + 1) || !at(i, j - 1);
      c.fillStyle = edge ? (k === 'fin' ? '#c7653a' : '#7a2e14') : FISH_PAL[k];
      c.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
  // desenha o mundo de pixels numa tela pequena (S = tamanho de cada pixel na tela)
  function pixDraw(dt, S) {
    follow2(dt); ringsTick(dt);
    const lw = Math.ceil(buf.x / S), lh = Math.ceil(buf.y / S);
    if (!pix.low || pix.low.width !== lw || pix.low.height !== lh) {
      pix.low = document.createElement('canvas');
      pix.low.width = lw; pix.low.height = lh;
      pix.lc = pix.low.getContext('2d', { willReadFrequently: true });
    }
    pix.S = S;
    const ox = Math.round((view2.x - X0) * PIX - lw / 2), oy = Math.round((view2.z - Z0) * PIX - lh / 2);
    pix.ox = ox; pix.oy = oy;
    const c = pix.lc, P = (x, z) => [Math.round((x - X0) * PIX - ox), Math.round((z - Z0) * PIX - oy)];
    c.fillStyle = '#6cbf4a'; c.fillRect(0, 0, lw, lh);
    c.drawImage(pix.ground, -ox, -oy);
    // algas, brilhos, ração e bolhas
    c.fillStyle = '#2a8a86';
    for (const w of weeds) { const [x, y] = P(w.x, w.z); c.fillRect(x + Math.round(Math.sin(time * 0.9 + w.ph)), y - 2, 1, 3); }
    for (const g of glints2) {
      const a = Math.sin(time * 2 + g.ph);
      if (a < 0.6) continue;
      const [x, y] = P(g.x + Math.sin(time * 0.5 + g.ph) * 0.4, g.z);
      c.fillStyle = '#d6f7f2'; c.fillRect(x, y, a > 0.85 ? 3 : 2, 1);
    }
    for (const f of foods) if (f.on) {
      const [x, y] = P(f.x, f.z);
      c.fillStyle = '#9a5a1c'; c.fillRect(x - 1, y - 1, 3, 3);
      c.fillStyle = '#f3a23a'; c.fillRect(x - 1, y - 1, 2, 2);
      c.fillStyle = '#ffd08a'; c.fillRect(x - 1, y - 1, 1, 1);
    }
    pixFish(c, ox, oy);
    c.fillStyle = '#e8fffd';
    for (const b of bubbles) if (b.on) {
      const [x, y] = P(b.x, b.z);
      if (b.s > 0.18) { c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x, y - 1, 1, 1); c.fillRect(x, y + 1, 1, 1); }
      else c.fillRect(x, y, 1, 1);
    }
    c.fillStyle = '#d6f7f2';
    for (const r of rings2) {
      const rad = (0.3 + r.t * 2.2 * r.big) * PIX, [x, y] = P(r.x, r.z), n = Math.max(12, Math.round(rad * 6));
      for (let k = 0; k < n; k++) {
        if (r.t > 0.6 && k % 2) continue;
        const a = k / n * Math.PI * 2;
        c.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad), 1, 1);
      }
    }
    c.drawImage(pix.over, -ox, -oy);
    for (const r of reeds) {
      const [x, y] = P(r.x, r.z), sw = Math.round(Math.sin(time * 1.3 + r.ph));
      c.fillStyle = '#3f8f3c'; c.fillRect(x + sw, y - 3, 1, 3);
      c.fillStyle = '#2c6b2c'; c.fillRect(x, y, 1, 1);
      if (r.head) { c.fillStyle = '#7a4a26'; c.fillRect(x + sw, y - 5, 1, 2); }
    }
    return [lw, lh];
  }
  function pixRender(dt) {
    const S = Math.max(2, Math.round(buf.x / 190)), [lw, lh] = pixDraw(dt, S);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.imageSmoothingEnabled = false;
    g2.drawImage(pix.low, 0, 0, lw * S, lh * S);
  }
  const pixToWorld = (cx, cy) => {
    const [x, y] = devXY(cx, cy);
    return { x: X0 + (x / pix.S + pix.ox) / PIX, z: Z0 + (y / pix.S + pix.oy) / PIX };
  };

  // ---------- CEL SHADING: um mundo 3D arredondado, de desenho animado ----------
  const celWorld = new T.Group();
  celWorld.visible = false;
  scene.add(celWorld);
  const fishCel = new T.Group();
  fishCel.visible = false;
  fish.add(fishCel);
  const cel = { built: false, stars: [] };
  // contorno preto: a mesma forma, um pouco inflada, desenhada só por dentro
  const HULL_VS = `
    uniform float uThick;
    void main() {
      mat4 m = modelMatrix;
      #ifdef USE_INSTANCING
        m = m * instanceMatrix;
      #endif
      vec4 wp = m * vec4(position, 1.0);
      wp.xyz += normalize((m * vec4(normal, 0.0)).xyz) * uThick;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const hullMats = {};
  function hullMat(thick) {
    return hullMats[thick] || (hullMats[thick] = new T.ShaderMaterial({
      uniforms: { uThick: { value: thick }, uColor: { value: new T.Color(0x2b2033) } },
      vertexShader: HULL_VS,
      fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
      side: T.BackSide,
    }));
  }
  const toonCache = {};
  const toon = (color, extra) => {
    const k = color + (extra ? JSON.stringify(Object.keys(extra)) : '');
    return toonCache[k] || (toonCache[k] = new T.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, extra)));
  };
  function celHeight(x, z) {
    const v = lakeV(x, z);
    if (v < 1) return -0.35 - 2.3 * smooth((1 - v) / 0.5);
    if (v < 1.1) return -0.1 * (1 - smooth((v - 1) / 0.1));
    return Math.max(0, (vnoise(x * 0.07, z * 0.07) - 0.4) * 2.4 * smooth((v - 1.2) / 0.8));
  }
  function celInst(geo, list, place, thick) {
    const m = new T.InstancedMesh(geo, toon(0xffffff), list.length);
    list.forEach((it, i) => {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      const c = place(it, dummy, i);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    celWorld.add(m);
    if (thick) {
      const h = new T.InstancedMesh(geo, hullMat(thick), list.length);
      h.instanceMatrix = m.instanceMatrix;
      h.frustumCulled = false;
      celWorld.add(h);
    }
    return m;
  }
  function buildCel() {
    if (cel.built) return;
    cel.built = true;
    const rc = mulberry32(88);
    // chão liso com cores por altura
    const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 184, 140);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position, colors = new Float32Array(p.count * 3), tc = new T.Color();
    const GR = col(0x7ed957), GR2 = col(0x6cc94c), HILL = col(0xa8e66e), SANDC = col(0xffe3a3), BED = col(0xa4eadf), DEEP = col(0x46b6c8), PATHC = col(0xf2cf8f);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = celHeight(x, z);
      p.setY(i, y);
      if (y < -0.3) tc.copy(BED).lerp(DEEP, clamp((-y - 0.35) / 2.3, 0, 1));
      else if (y < -0.02 || lakeV(x, z) < 1.1) tc.copy(SANDC);
      else if (isPath(x, z)) tc.copy(PATHC);
      else tc.copy(GR).lerp(GR2, vnoise(x * 0.15, z * 0.15)).lerp(HILL, clamp(y / 2, 0, 0.6));
      colors[i * 3] = tc.r; colors[i * 3 + 1] = tc.g; colors[i * 3 + 2] = tc.b;
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const ground = new T.Mesh(g, toon(0xffffff, { vertexColors: true }));
    ground.receiveShadow = true;
    celWorld.add(ground);

    // árvores fofinhas: tronco e três bolas de folhas
    const sphere = new T.SphereGeometry(1, 20, 14);
    celInst(new T.CylinderGeometry(0.3, 0.42, 2.2, 12).translate(0, 1.1, 0), trees, (t, d) => {
      d.position.set(t.x, celHeight(t.x, t.z), t.z); return col(0xa0663c);
    }, 0.06);
    const blobs = [];
    trees.forEach((t, i) => {
      const L = treeLook[i], base = celHeight(t.x, t.z), s = 0.8 + L.r * 0.3;
      const c = L.pink ? [0xff9ec7, 0xffb3d4] : L.tone < 0.5 ? [0x57c84d, 0x6bd65a] : [0x45b45a, 0x5cc96a];
      blobs.push({ x: t.x, y: base + 3.0 * s, z: t.z, r: 1.55 * s, c: c[0] });
      blobs.push({ x: t.x + 0.9 * s, y: base + 2.55 * s, z: t.z + 0.4 * s, r: 1.1 * s, c: c[1] });
      blobs.push({ x: t.x - 0.8 * s, y: base + 2.5 * s, z: t.z - 0.35 * s, r: 1.0 * s, c: c[1] });
    });
    celInst(sphere, blobs, (b, d) => { d.position.set(b.x, b.y, b.z); d.scale.setScalar(b.r); return col(b.c); }, 0.07);
    celInst(sphere, rocks, (r, d) => {
      const s = r.s * 0.7;
      d.position.set(r.x, r.wet ? WATER_Y : celHeight(r.x, r.z) + 0.1, r.z);
      d.scale.set(s, s * 0.62, s * 0.85); d.rotation.y = rc() * 6;
      return col(0xc9c3d9);
    }, 0.05);
    celInst(new T.CylinderGeometry(1, 1, 0.1, 28), pads, (pd, d) => {
      d.position.set(pd.x, WATER_Y + 0.06, pd.z); d.scale.set(pd.r, 1, pd.r);
      return col(0x63d26f);
    }, 0.04);
    const petals = [];
    pads.filter(pd => pd.flower).forEach(pd => {
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; petals.push({ x: pd.x + Math.cos(a) * 0.24, y: WATER_Y + 0.24, z: pd.z + Math.sin(a) * 0.24, r: 0.2, c: 0xff8fbf }); }
      petals.push({ x: pd.x, y: WATER_Y + 0.3, z: pd.z, r: 0.12, c: 0xffe066 });
    });
    if (petals.length) celInst(sphere, petals, (b, d) => { d.position.set(b.x, b.y, b.z); d.scale.set(b.r, b.r * 0.6, b.r); return col(b.c); }, 0.025);
    // píer
    const planks = [];
    for (let s = 0, n = 0; s <= dock.len; s += 0.56, n++) planks.push({ s, n });
    celInst(new T.BoxGeometry(1, 1, 1), planks, (pl, d) => {
      d.position.set(dockLand.x + dock.ux * pl.s, 0.16, dockLand.z + dock.uz * pl.s);
      d.rotation.y = dock.ry; d.scale.set(0.46, 0.16, 2.3);
      return col(pl.n % 2 ? 0xe09a5c : 0xcf8a4e);
    }, 0.03);
    // juncos, algas, bolhas e ração redondos (copiam o movimento dos de voxel)
    const stalk = new T.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0);
    const copyOf = (geo, src, colorFn, thick) => {
      const list = Array.from({ length: src.count }, (_, i) => i);
      const m = celInst(geo, list, (i) => colorFn(i), thick);
      return m;
    };
    cel.reeds = copyOf(stalk, reedMesh, () => col(0x5cb85a), 0.03);
    cel.weeds = copyOf(stalk, weedMesh, () => col(0x3fae8a), 0);
    cel.heads = copyOf(sphere, headMesh, () => col(0x9a5a2e), 0.03);
    cel.bub = copyOf(new T.SphereGeometry(0.5, 12, 8), bubMesh, () => col(0xffffff), 0);
    cel.food = copyOf(new T.SphereGeometry(0.5, 12, 8), foodMesh, () => col(0xffb03a), 0.03);
    for (const m of [cel.weeds, cel.bub]) m.castShadow = false;

    // estrelinhas que pulam quando o peixe come
    const star = new T.Shape();
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.14 : 0.34;
      k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = new T.ExtrudeGeometry(star, { depth: 0.08, bevelEnabled: false }).center();
    for (let i = 0; i < 12; i++) {
      const m = new T.Mesh(starGeo, toon(0xffd23f));
      m.add(new T.Mesh(starGeo, hullMat(0.03)));
      m.visible = false;
      celWorld.add(m);
      cel.stars.push({ m, t: 9, v: new T.Vector3(), spin: 0 });
    }

    // carpa koi arredondada
    const part2 = (parent, geo, color, sx, sy, sz, x, y, z, ry = 0, thick = 0.035) => {
      const m = new T.Mesh(geo, toon(color));
      m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true;
      if (thick) m.add(new T.Mesh(geo, hullMat(thick)));
      parent.add(m);
      return m;
    };
    const ball = new T.SphereGeometry(0.5, 24, 16);
    part2(fishCel, ball, 0xff6a2b, 2.5, 0.95, 1.05, 0.15, 0, 0);
    part2(fishCel, ball, 0xfff6ea, 0.75, 0.2, 0.5, 0.6, 0.36, 0.06, 0.2, 0.02);
    part2(fishCel, ball, 0xfff6ea, 0.65, 0.18, 0.42, -0.4, 0.33, -0.1, -0.3, 0.02);
    part2(fishCel, ball, 0xe8401c, 0.38, 0.14, 0.3, 0.05, 0.4, 0.14, 0, 0.02);
    part2(fishCel, ball, 0xff8a45, 0.6, 0.24, 0.1, -0.1, 0.45, 0, 0, 0.025);
    for (const s of [1, -1]) {
      part2(fishCel, ball, 0x1d1420, 0.17, 0.17, 0.17, 1.12, 0.12, s * 0.3, 0, 0);
      part2(fishCel, ball, 0xffffff, 0.06, 0.06, 0.06, 1.19, 0.17, s * 0.33, 0, 0);
      part2(fishCel, ball, 0xffc59a, 0.7, 0.08, 0.45, 0.5, -0.12, s * 0.55, s * 0.5, 0.025);
    }
    const tailCel = new T.Group();
    tailCel.position.set(-1.05, 0, 0);
    for (const s of [1, -1]) part2(tailCel, ball, 0xffb070, 0.9, 0.1, 0.55, -0.35, 0, s * 0.24, s * 0.55, 0.03);
    fishCel.add(tailCel);
    tailExtra.push(tailCel);
  }
  // água de desenho animado: cor chapada, faixas brancas de brilho e espuma na margem
  const celWaterMat = new T.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: waterMat.vertexShader,
    fragmentShader: `
      #define RX ${RX.toFixed(2)}
      #define RZ ${RZ.toFixed(2)}
      uniform float uTime;
      varying vec3 vW;
      float lakeR(float a) { return 1.0 + 0.10 * sin(3.0 * a + 0.7) + 0.06 * sin(5.0 * a + 2.1) + 0.035 * sin(7.0 * a + 4.0); }
      void main() {
        vec2 p = vW.xz, d = p / vec2(RX, RZ);
        float ang = atan(d.y, d.x), v = length(d) / lakeR(ang);
        float w = sin(p.x * 0.8 + uTime * 1.1 + sin(p.y * 0.6 + uTime * 0.4) * 1.6) + sin(p.y * 1.1 - uTime * 0.9 + sin(p.x * 0.5) * 1.3);
        float hi = step(1.3, w);
        float foam = step(0.94 + 0.02 * sin(ang * 18.0 + uTime * 2.0), v);
        vec3 c = mix(vec3(0.33, 0.8, 0.9), vec3(0.93, 1.0, 1.0), max(hi * 0.8, foam));
        gl_FragColor = vec4(c, 0.3 + max(hi, foam) * 0.6);
      }`,
    transparent: true, depthWrite: false,
  });
  const celHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh];
  function celEnter() {
    buildCel();
    celHide.forEach(o => { o.visible = false; });
    celWorld.visible = true;
    fishVox.visible = false; fishCel.visible = true;
    water.material = celWaterMat;
    renderer.setClearColor(0x7ed957, 0);
  }
  function celExit() {
    celHide.forEach(o => { o.visible = true; });
    celWorld.visible = false;
    fishVox.visible = true; fishCel.visible = false;
    water.material = waterMat;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function copyInst(dst, src) { dst.instanceMatrix.array.set(src.instanceMatrix.array); dst.instanceMatrix.needsUpdate = true; }
  function celStars(f) {
    let n = 0;
    for (const s of cel.stars) {
      if (s.t < 0.9 || n >= 6) continue;
      const a = n / 6 * Math.PI * 2;
      s.t = 0; s.spin = (Math.random() - 0.5) * 12;
      s.m.position.set(f.x, WATER_Y + 0.3, f.z);
      s.v.set(Math.cos(a) * 2.5, 4 + Math.random() * 2, Math.sin(a) * 2.5);
      s.m.visible = true;
      n++;
    }
  }
  function celRender(dt) {
    copyInst(cel.reeds, reedMesh); copyInst(cel.weeds, weedMesh); copyInst(cel.heads, headMesh);
    copyInst(cel.bub, bubMesh); copyInst(cel.food, foodMesh);
    celWaterMat.uniforms.uTime.value = time;
    for (const s of cel.stars) {
      if (s.t >= 0.9) { s.m.visible = false; continue; }
      s.t += dt;
      s.v.y -= 9 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.quaternion.copy(camera.quaternion);
      s.m.rotateZ(s.t * s.spin);
      s.m.scale.setScalar(Math.max(0.01, 1.2 * (1 - s.t / 0.9)));
    }
    renderWorld();
    finish(rtScene.texture, 0.5);
  }
