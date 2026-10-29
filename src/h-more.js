
  // ======================================================================
  // FORA DA CAIXA: mais estilos com mundo próprio
  // ======================================================================
  const TAU = Math.PI * 2;
  function toWorld2D() { const s = view2.s; g2.setTransform(s, 0, 0, s, buf.x / 2 - view2.x * s, buf.y / 2 - view2.z * s); }
  // limpa a tela 2D, segue o peixe e devolve um teste "está na tela?"
  function begin2D(dt, bg) {
    follow2(dt); ringsTick(dt);
    view2.s = buf.x / (aspect >= 1 ? 40 : 24);
    const s = view2.s;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.globalAlpha = 1; g2.shadowBlur = 0; g2.setLineDash([]); g2.globalCompositeOperation = 'source-over';
    if (bg) { g2.fillStyle = bg; g2.fillRect(0, 0, buf.x, buf.y); }
    toWorld2D();
    const x0 = view2.x - buf.x / 2 / s, x1 = view2.x + buf.x / 2 / s, z0 = view2.z - buf.y / 2 / s, z1 = view2.z + buf.y / 2 / s;
    const vis = (x, z, m = 4) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
    vis.box = [x0, z0, x1, z1];
    return vis;
  }
  const toScreen2D = (x, z) => [(x - view2.x) * view2.s + buf.x / 2, (z - view2.z) * view2.s + buf.y / 2];
  function label(text, x, z, size, font, color, align = 'center', rot = 0) {
    const [sx, sy] = toScreen2D(x, z);
    g2.save();
    g2.setTransform(1, 0, 0, 1, sx, sy);
    if (rot) g2.rotate(rot);
    g2.font = font.replace('#', Math.round(size * DPR) + 'px');
    g2.fillStyle = color; g2.textAlign = align; g2.textBaseline = 'middle';
    g2.fillText(text, 0, 0);
    g2.restore();
  }
  function tile(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    draw(c.getContext('2d'), c.width, c.height);
    return c;
  }
  // grão de papel que se repete
  function grain(alphaMax, seed) {
    return tile(256, 256, (x, w, h) => {
      const img = x.createImageData(w, h), r = mulberry32(seed);
      for (let i = 0; i < w * h; i++) {
        const v = r(), o = i * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v < 0.5 ? 0 : 255;
        img.data[o + 3] = Math.abs(v - 0.5) * 2 * alphaMax * 255;
      }
      x.putImageData(img, 0, 0);
    });
  }
  const patterns = {};
  const pattern = (key, make) => patterns[key] || (patterns[key] = g2.createPattern(make(), 'repeat'));
  function overlay(fill, alpha = 1, op = 'source-over') {
    g2.save();
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.globalAlpha = alpha; g2.globalCompositeOperation = op; g2.fillStyle = fill;
    g2.fillRect(0, 0, buf.x, buf.y);
    g2.restore();
  }
  function inFish(ctx, fn) {
    ctx.save();
    ctx.translate(F.x, F.z); ctx.rotate(-F.heading); ctx.scale(FISH_SIZE, FISH_SIZE);
    fn();
    ctx.restore();
  }
  // converte um deslocamento do mundo para as coordenadas locais do peixe (para sombras)
  function fishLocalOffset(ox, oz) {
    const cs = Math.cos(F.heading), sn = Math.sin(F.heading);
    return [(ox * cs - oz * sn) / FISH_SIZE, (ox * sn + oz * cs) / FISH_SIZE];
  }
  function polyline(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0].x, p[0].z); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].z); }
  function fishTailPath(ctx, S, N, amp) {
    const e = S[N], ta = Math.atan2(e.ty, e.tx) + Math.sin(F.phase - 1.1) * amp * 1.4;
    ctx.save();
    ctx.translate(e.x, e.y); ctx.rotate(ta);
    ctx.beginPath();
    ctx.moveTo(0.05, 0.1);
    ctx.quadraticCurveTo(-0.35, 0.75, -1.0, 0.8);
    ctx.quadraticCurveTo(-0.72, 0.32, -0.6, 0);
    ctx.quadraticCurveTo(-0.72, -0.32, -1.0, -0.8);
    ctx.quadraticCurveTo(-0.35, -0.75, 0.05, -0.1);
    ctx.closePath();
    ctx.restore();
  }
  const lakeBox = (() => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of lakeLoop(1.0)) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); }
    return { x0, x1, z0, z1 };
  })();

  // ---------- NANQUIM JAPONÊS (sumi-e) ----------
  const INK = (a) => `rgba(24, 22, 28, ${a})`;
  const sumiShore = [];
  (() => {
    const r = mulberry32(7);
    for (let i = 0; i < 7; i++) {
      const a0 = r() * TAU, len = 0.5 + r() * 0.7, pts = [];
      for (let k = 0; k <= 14; k++) { const a = a0 + len * k / 14, p = polar(a, lakeR(a) * (1 + (r() - 0.5) * 0.015)); pts.push({ x: p.x, y: p.z }); }
      sumiShore.push(pts);
    }
  })();
  // pincelada: uma fita que começa grossa e termina afinando
  function brush(ctx, pts, w0, w1, seed) {
    const n = pts.length;
    if (n < 2) return;
    const Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const t = i / (n - 1);
      const w = (w0 + (w1 - w0) * t) * (0.8 + 0.4 * hash2(i * 1.7 + seed, seed * 3.1)) * Math.min(1, (1 - t) * 5 + 0.15) * (0.55 + 0.45 * Math.min(1, t * 6));
      Lp.push(pts[i].x - ty * w / 2, pts[i].y + tx * w / 2);
      Rp.push(pts[i].x + ty * w / 2, pts[i].y - tx * w / 2);
    }
    ctx.beginPath();
    ctx.moveTo(Lp[0], Lp[1]);
    for (let i = 2; i < Lp.length; i += 2) ctx.lineTo(Lp[i], Lp[i + 1]);
    for (let i = Rp.length - 2; i >= 0; i -= 2) ctx.lineTo(Rp[i], Rp[i + 1]);
    ctx.closePath();
    ctx.fill();
  }
  function sumiRender(dt) {
    const vis = begin2D(dt, '#f1e9d6'), ctx = g2;
    overlay(pattern('paper', () => grain(0.08, 11)));
    ctx.fillStyle = INK(0.045);
    for (const p of [LAKE2.shore, LAKE2.b1, LAKE2.b2, LAKE2.b3]) ctx.fill(p);
    ctx.fillStyle = INK(0.82);
    sumiShore.forEach((pts, i) => brush(ctx, pts, 0.42, 0.1, i + 1));
    ctx.strokeStyle = INK(0.35); ctx.lineWidth = 0.05; ctx.lineCap = 'round';
    for (const g of glints2) {
      const a = Math.sin(time * 0.8 + g.ph);
      if (a < 0) continue;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(g.x - g.len / 2, g.z); ctx.quadraticCurveTo(g.x, g.z - 0.25, g.x + g.len / 2, g.z); ctx.stroke();
    }
    for (const r of rings2) { ctx.globalAlpha = Math.max(0, 1 - r.t / 1.3); ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0.3, TAU - 0.5); ctx.stroke(); }
    ctx.globalAlpha = 1;
    pads.forEach((p, i) => {
      const n = padLook[i];
      ctx.fillStyle = 'rgba(70, 90, 70, 0.2)';
      ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); ctx.fill();
      const pts = [];
      for (let k = 0; k <= 12; k++) { const a = n + 0.5 + k / 12 * (TAU - 1.2); pts.push({ x: p.x + Math.cos(a) * p.r, y: p.z + Math.sin(a) * p.r }); }
      ctx.fillStyle = INK(0.6); brush(ctx, pts, 0.12, 0.03, i * 7 + 3);
      if (p.flower) {
        ctx.fillStyle = 'rgba(200, 50, 40, 0.75)';
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 0.22, p.z + Math.sin(a) * 0.22, 0.2, 0.09, a, 0, TAU); ctx.fill(); }
      }
    });
    ctx.fillStyle = INK(0.75);
    reeds.forEach((r, i) => {
      const sw = Math.sin(time * 1.3 + r.ph) * 0.25, pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push({ x: r.x + sw * t * t * r.h * 0.5, y: r.z - t * r.h * 0.6 }); }
      brush(ctx, pts, 0.12, 0.02, i + 50);
      if (r.head) { ctx.beginPath(); ctx.ellipse(pts[5].x, pts[5].y, 0.08, 0.2, 0, 0, TAU); ctx.fill(); }
    });
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      const k = rockLook[i].k, rad = r.s * 0.7;
      ctx.fillStyle = INK(0.12); blobPath(ctx, r.x, r.z, rad, k); ctx.fill();
      const pts = [];
      for (let m = 0; m <= 8; m++) { const a = 3.6 + m / 8 * 2.6; pts.push({ x: r.x + Math.cos(a) * rad * k[m % 7], y: r.z + Math.sin(a) * rad * k[m % 7] }); }
      ctx.fillStyle = INK(0.7); brush(ctx, pts, 0.16, 0.04, i + 90);
    });
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i];
      for (let k = 0; k < 7; k++) {
        const a = L.a + k * 0.9, d = L.r * 0.55 * ((k * 37) % 10) / 10;
        ctx.fillStyle = INK(k % 3 ? 0.18 : 0.5);
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, L.r * 0.5, L.r * 0.22, a, 0, TAU); ctx.fill();
      }
    });
    ctx.fillStyle = INK(0.8);
    for (const f of foods) if (f.on) { ctx.beginPath(); ctx.arc(f.x, f.z, 0.13, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = INK(0.5); ctx.lineWidth = 0.04;
    for (const b of bubbles) if (b.on) { ctx.beginPath(); ctx.arc(b.x, b.z, b.s * 0.8, 0, TAU); ctx.stroke(); }
    // a carpa em vermelhão, com o papel aparecendo nas manchas
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp);
      const e = S[N], ta = Math.atan2(e.ty, e.tx) + Math.sin(F.phase - 1.1) * amp * 1.4;
      ctx.save();
      ctx.translate(e.x, e.y); ctx.rotate(ta);
      ctx.fillStyle = INK(0.55);
      for (const sg of [1, -1]) brush(ctx, [{ x: 0, y: 0 }, { x: -0.4, y: sg * 0.35 }, { x: -0.95, y: sg * 0.7 }], 0.22, 0.04, sg + 5);
      brush(ctx, [{ x: 0, y: 0 }, { x: -0.5, y: 0.02 }, { x: -0.8, y: 0 }], 0.16, 0.03, 9);
      ctx.restore();
      for (const sg of [1, -1]) {
        const p = at(0.3, sg, 0.9);
        brush(ctx, [{ x: p.x, y: p.y }, { x: p.x - 0.25, y: p.y + sg * 0.3 }, { x: p.x - 0.45, y: p.y + sg * 0.45 }], 0.14, 0.03, sg + 20);
      }
      ctx.fillStyle = 'rgba(206, 58, 34, 0.9)'; ctx.fill(body);
      ctx.save();
      ctx.clip(body);
      ctx.fillStyle = '#f1e9d6';
      for (const [u, off, rx, ry] of [[0.2, 0.15, 0.36, 0.22], [0.6, -0.1, 0.45, 0.26]]) {
        const s = S[Math.round(u * N)];
        ctx.beginPath(); ctx.ellipse(s.x - s.ty * off, s.y + s.tx * off, rx, ry, Math.atan2(s.ty, s.tx), 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = INK(0.55); ctx.lineWidth = 0.05; ctx.stroke(body);
      ctx.fillStyle = INK(0.95);
      for (const sg of [1, -1]) { const p = at(0.06, sg, 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 0.07, 0, TAU); ctx.fill(); }
    });
    // selo vermelho de carimbo
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const z = 54 * DPR, sx = 18 * DPR, sy = buf.y - z - 80 * DPR;
    g2.globalAlpha = 0.88; g2.fillStyle = '#c3302a';
    g2.beginPath(); g2.moveTo(sx + 3 * DPR, sy); g2.lineTo(sx + z, sy + 2 * DPR); g2.lineTo(sx + z - 2 * DPR, sy + z); g2.lineTo(sx, sy + z - 3 * DPR); g2.closePath(); g2.fill();
    g2.globalAlpha = 1; g2.fillStyle = '#f1e9d6';
    g2.font = `700 ${Math.round(z * 0.62)}px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", "Songti SC", serif`;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText('鯉', sx + z / 2, sy + z / 2 + 2 * DPR);
  }

  // ---------- PLANTA TÉCNICA ----------
  const BP = '#1d4e89', BPL = (a) => `rgba(232, 241, 255, ${a})`;
  const MONO = '700 # "JetBrains Mono", ui-monospace, monospace';
  const UNIT = 0.25;   // 1 unidade do jogo = 25 cm
  const fmt = (v) => (v * UNIT).toFixed(1).replace('.', ',');
  function blueRender(dt) {
    const vis = begin2D(dt, BP), ctx = g2, lp = DPR / view2.s;
    const [bx0, bz0, bx1, bz1] = vis.box;
    ctx.lineWidth = lp;
    for (let x = Math.floor(bx0); x <= Math.ceil(bx1); x++) { ctx.strokeStyle = BPL(x % 5 === 0 ? 0.22 : 0.08); ctx.beginPath(); ctx.moveTo(x, bz0); ctx.lineTo(x, bz1); ctx.stroke(); }
    for (let z = Math.floor(bz0); z <= Math.ceil(bz1); z++) { ctx.strokeStyle = BPL(z % 5 === 0 ? 0.22 : 0.08); ctx.beginPath(); ctx.moveTo(bx0, z); ctx.lineTo(bx1, z); ctx.stroke(); }
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const p of PATHS) {
      polyline(ctx, p);
      ctx.strokeStyle = BPL(0.6); ctx.lineWidth = 2.2; ctx.stroke();
      ctx.strokeStyle = BP; ctx.lineWidth = 2.2 - 2.4 * lp; ctx.stroke();
    }
    ctx.strokeStyle = BPL(0.95); ctx.lineWidth = 2 * lp; ctx.stroke(LAKE2.shore);
    ctx.lineWidth = lp;
    ctx.setLineDash([6 * lp, 4 * lp]); ctx.stroke(LAKE2.sand);
    ctx.setLineDash([3 * lp, 3 * lp]);
    for (const p of [LAKE2.b1, LAKE2.b2, LAKE2.b3]) ctx.stroke(p);
    ctx.setLineDash([]);
    [[0.82, '-0,5 m'], [0.6, '-1,2 m'], [0.38, '-2,0 m']].forEach(([k, t]) => { const p = polar(-0.95, lakeR(-0.95) * k); label(t, p.x, p.z, 10, MONO, BPL(0.9)); });
    // cotas do lago
    const zD = lakeBox.z1 + 2.2, xD = lakeBox.x1 + 2.6;
    ctx.strokeStyle = BPL(0.85); ctx.lineWidth = lp;
    ctx.beginPath();
    ctx.moveTo(lakeBox.x0, zD); ctx.lineTo(lakeBox.x1, zD);
    for (const x of [lakeBox.x0, lakeBox.x1]) { ctx.moveTo(x, lakeBox.z1 + 0.5); ctx.lineTo(x, zD + 0.6); ctx.moveTo(x - 0.35, zD + 0.35); ctx.lineTo(x + 0.35, zD - 0.35); }
    ctx.moveTo(xD, lakeBox.z0); ctx.lineTo(xD, lakeBox.z1);
    for (const z of [lakeBox.z0, lakeBox.z1]) { ctx.moveTo(lakeBox.x1 + 0.5, z); ctx.lineTo(xD + 0.6, z); ctx.moveTo(xD - 0.35, z + 0.35); ctx.lineTo(xD + 0.35, z - 0.35); }
    ctx.stroke();
    label(fmt(lakeBox.x1 - lakeBox.x0) + ' m', (lakeBox.x0 + lakeBox.x1) / 2, zD - 0.7, 11, MONO, BPL(0.95));
    label(fmt(lakeBox.z1 - lakeBox.z0) + ' m', xD + 0.8, (lakeBox.z0 + lakeBox.z1) / 2, 11, MONO, BPL(0.95), 'center', -Math.PI / 2);
    // árvores, pedras, vitórias-régias, juncos, píer
    ctx.strokeStyle = BPL(0.8); ctx.lineWidth = lp;
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const r = treeLook[i].r;
      ctx.setLineDash([4 * lp, 3 * lp]); ctx.beginPath(); ctx.arc(t.x, t.z, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(t.x - 0.4, t.z); ctx.lineTo(t.x + 0.4, t.z); ctx.moveTo(t.x, t.z - 0.4); ctx.lineTo(t.x, t.z + 0.4); ctx.stroke();
      if (i % 5 === 0) label('ÁRVORE Ø ' + fmt(r * 2), t.x, t.z + r + 0.7, 9, MONO, BPL(0.75));
    });
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      const k = rockLook[i].k, rad = r.s * 0.7;
      blobPath(ctx, r.x, r.z, rad, k); ctx.stroke();
      ctx.save(); blobPath(ctx, r.x, r.z, rad, k); ctx.clip();
      ctx.lineWidth = 0.7 * lp;
      for (let d = -rad * 2; d < rad * 2; d += 0.25) { ctx.beginPath(); ctx.moveTo(r.x + d - rad, r.z - rad); ctx.lineTo(r.x + d + rad, r.z + rad); ctx.stroke(); }
      ctx.restore();
    });
    pads.forEach((p, i) => { const n = padLook[i]; ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); ctx.stroke(); });
    ctx.beginPath();
    for (const r of reeds) { ctx.moveTo(r.x - 0.15, r.z - 0.15); ctx.lineTo(r.x + 0.15, r.z + 0.15); ctx.moveTo(r.x + 0.15, r.z - 0.15); ctx.lineTo(r.x - 0.15, r.z + 0.15); }
    ctx.stroke();
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    ctx.strokeRect(-0.25, -1.15, dock.len + 0.5, 2.3);
    ctx.beginPath(); for (let d = 0.31; d < dock.len; d += 0.56) { ctx.moveTo(d, -1.15); ctx.lineTo(d, 1.15); } ctx.stroke();
    ctx.restore();
    label('PÍER', (dockLand.x + dockEnd.x) / 2, (dockLand.z + dockEnd.z) / 2 - 1.9, 10, MONO, BPL(0.9));
    for (const f of foods) if (f.on) {
      ctx.beginPath(); ctx.arc(f.x, f.z, 0.25, 0, TAU);
      ctx.moveTo(f.x - 0.45, f.z); ctx.lineTo(f.x + 0.45, f.z); ctx.moveTo(f.x, f.z - 0.45); ctx.lineTo(f.x, f.z + 0.45); ctx.stroke();
    }
    ctx.setLineDash([3 * lp, 3 * lp]);
    for (const r of rings2) { ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
    // o peixe, com eixo e etiqueta medindo ao vivo
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body } = fishBody(amp), w = lp / FISH_SIZE;
      ctx.strokeStyle = BPL(1); ctx.lineWidth = 2 * w;
      fishTailPath(ctx, S, N, amp); ctx.stroke();
      ctx.stroke(body);
      ctx.lineWidth = w; ctx.setLineDash([8 * w, 3 * w, 2 * w, 3 * w]);
      ctx.beginPath(); S.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x + 0.3, s.y)); ctx.lineTo(S[N].x - 1.1, S[N].y); ctx.stroke();
      ctx.setLineDash([]);
    });
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const [hx, hy] = toScreen2D(F.x + Math.cos(F.heading) * 1.5 * FISH_SIZE, F.z - Math.sin(F.heading) * 1.5 * FISH_SIZE);
    const lx = hx + 46 * DPR, ly = hy - 46 * DPR;
    g2.strokeStyle = BPL(0.9); g2.lineWidth = DPR;
    g2.beginPath(); g2.moveTo(hx, hy); g2.lineTo(lx, ly); g2.lineTo(lx + 150 * DPR, ly); g2.stroke();
    g2.beginPath(); g2.arc(hx, hy, 3 * DPR, 0, TAU); g2.fillStyle = BPL(1); g2.fill();
    g2.font = `700 ${Math.round(11 * DPR)}px "JetBrains Mono", monospace`; g2.textAlign = 'left'; g2.textBaseline = 'bottom';
    g2.fillText(`KOI · ${fmt(3.7 * FISH_SIZE)} m`, lx + 4 * DPR, ly - 3 * DPR);
    g2.textBaseline = 'top';
    g2.fillText(`v = ${fmt(F.speed || 0)} m/s`, lx + 4 * DPR, ly + 4 * DPR);
    // carimbo do projeto e norte
    if (buf.x / DPR >= 720) {
      const w = 300 * DPR, h = 62 * DPR, x = buf.x / 2 - w / 2, y = buf.y - h - 20 * DPR;
      g2.fillStyle = BP; g2.fillRect(x, y, w, h);
      g2.strokeStyle = BPL(0.9); g2.lineWidth = 1.5 * DPR; g2.strokeRect(x, y, w, h);
      g2.beginPath(); g2.moveTo(x, y + h / 2); g2.lineTo(x + w, y + h / 2); g2.stroke();
      g2.fillStyle = BPL(0.95); g2.textBaseline = 'middle';
      g2.font = `800 ${Math.round(12 * DPR)}px "JetBrains Mono", monospace`;
      g2.fillText('LAGO DOS ESTILOS · PLANTA BAIXA', x + 10 * DPR, y + h / 4);
      g2.font = `700 ${Math.round(10 * DPR)}px "JetBrains Mono", monospace`;
      g2.fillText('ESC. 1:50   FOLHA 01/01   UNID.: METROS', x + 10 * DPR, y + h * 3 / 4);
      const nx = x + w + 34 * DPR, ny = y + h / 2;
      g2.beginPath(); g2.moveTo(nx, ny - 22 * DPR); g2.lineTo(nx + 9 * DPR, ny + 12 * DPR); g2.lineTo(nx, ny + 5 * DPR); g2.lineTo(nx - 9 * DPR, ny + 12 * DPR); g2.closePath(); g2.fill();
      g2.textAlign = 'center'; g2.font = `800 ${Math.round(12 * DPR)}px "JetBrains Mono", monospace`;
      g2.fillText('N', nx, ny - 31 * DPR);
    }
  }

  // ---------- MAPA ANTIGO ----------
  const INKM = (a) => `rgba(74, 52, 36, ${a})`;
  const FELL = 'italic # "IM Fell English", Georgia, "Times New Roman", serif';
  const mapCoast = [0.985, 0.962, 0.935, 0.9, 0.86, 0.81].map(k => smoothPath(lakeLoop(k, 140)));
  function stainTile() {
    return tile(512, 512, (x, w, h) => {
      const r = mulberry32(5);
      for (let i = 0; i < 26; i++) {
        const cx = r() * w, cy = r() * h, rad = 30 + r() * 110;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad);
          g.addColorStop(0, 'rgba(120, 80, 30, 0.10)'); g.addColorStop(1, 'rgba(120, 80, 30, 0)');
          x.fillStyle = g; x.fillRect(0, 0, w, h);
        }
      }
    });
  }
  function mapRender(dt) {
    const vis = begin2D(dt, '#ead8ac'), ctx = g2, lp = DPR / view2.s;
    overlay(pattern('stain', stainTile));
    overlay(pattern('paper2', () => grain(0.06, 23)));
    ctx.fillStyle = 'rgba(110, 150, 140, 0.28)'; ctx.fill(LAKE2.shore);
    ctx.strokeStyle = INKM(1);
    mapCoast.forEach((p, i) => { ctx.globalAlpha = 0.75 - i * 0.11; ctx.lineWidth = (1.1 - i * 0.12) * lp; ctx.stroke(p); });
    ctx.globalAlpha = 1; ctx.lineWidth = 2.2 * lp; ctx.stroke(LAKE2.shore);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = '#9a2e1f'; ctx.lineWidth = 1.6 * lp; ctx.setLineDash([0.35, 0.45]);
    for (const p of PATHS) { polyline(ctx, p); ctx.stroke(); }
    ctx.setLineDash([]);
    const xm = PATHS[1][2];
    ctx.lineWidth = 3 * lp; ctx.beginPath();
    ctx.moveTo(xm.x - 0.6, xm.z - 0.6); ctx.lineTo(xm.x + 0.6, xm.z + 0.6); ctx.moveTo(xm.x + 0.6, xm.z - 0.6); ctx.lineTo(xm.x - 0.6, xm.z + 0.6);
    ctx.stroke();
    ctx.strokeStyle = INKM(0.55); ctx.lineWidth = lp;
    ctx.beginPath();
    for (const f of flowers2) {
      if (!vis(f.x, f.z)) continue;
      ctx.moveTo(f.x - 0.25, f.z); ctx.lineTo(f.x - 0.1, f.z - 0.3); ctx.moveTo(f.x, f.z); ctx.lineTo(f.x, f.z - 0.38); ctx.moveTo(f.x + 0.25, f.z); ctx.lineTo(f.x + 0.1, f.z - 0.3);
    }
    ctx.stroke();
    // pedras viram montanhinhas
    for (const r of rocks) {
      if (!vis(r.x, r.z)) continue;
      const h = r.s * 0.9, x = r.x, z = r.z;
      ctx.fillStyle = '#e6d2a3';
      ctx.beginPath(); ctx.moveTo(x - h, z + h * 0.3); ctx.lineTo(x - h * 0.2, z - h * 0.8); ctx.lineTo(x + h * 0.2, z - h * 0.3); ctx.lineTo(x + h * 0.5, z - h * 0.6); ctx.lineTo(x + h, z + h * 0.3); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = INKM(0.9); ctx.lineWidth = 1.2 * lp; ctx.stroke();
      ctx.lineWidth = 0.8 * lp; ctx.beginPath();
      for (let k = 1; k <= 3; k++) { ctx.moveTo(x - h * 0.2 + k * 0.1, z - h * 0.8 + k * 0.22); ctx.lineTo(x - h * 0.2 + k * 0.22, z + h * 0.25); }
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    ctx.fillStyle = '#d8bf8a'; ctx.fillRect(-0.25, -1.15, dock.len + 0.5, 2.3);
    ctx.strokeStyle = INKM(0.9); ctx.lineWidth = 1.2 * lp; ctx.strokeRect(-0.25, -1.15, dock.len + 0.5, 2.3);
    ctx.lineWidth = 0.8 * lp; ctx.beginPath(); for (let d = 0.31; d < dock.len; d += 0.56) { ctx.moveTo(d, -1.15); ctx.lineTo(d, 1.15); } ctx.stroke();
    ctx.restore();
    pads.forEach((p) => {
      ctx.strokeStyle = INKM(0.8); ctx.lineWidth = lp;
      ctx.beginPath(); ctx.arc(p.x, p.z, p.r * 0.85, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - p.r * 0.4, p.z + p.r * 0.1); ctx.lineTo(p.x + p.r * 0.4, p.z - p.r * 0.1); ctx.stroke();
    });
    // árvores como símbolos de pirulito com hachura
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const r = treeLook[i].r * 0.55;
      for (const [ox, oz, sc] of [[-r * 0.8, r * 0.6, 0.7], [r * 0.9, r * 0.5, 0.75], [0, 0, 1]]) {
        const x = t.x + ox, z = t.z + oz, rr = r * sc;
        ctx.strokeStyle = INKM(0.9); ctx.lineWidth = 1.2 * lp;
        ctx.beginPath(); ctx.moveTo(x, z + rr); ctx.lineTo(x, z + rr * 1.8); ctx.stroke();
        ctx.fillStyle = '#d9c48f';
        ctx.beginPath(); ctx.arc(x, z, rr, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.lineWidth = 0.8 * lp; ctx.beginPath();
        for (let d = 0; d < rr * 1.6; d += rr * 0.28) { ctx.moveTo(x + d - rr * 0.2, z - rr); ctx.lineTo(x + d + rr * 0.6, z + rr); }
        ctx.stroke(); ctx.restore();
      }
    });
    ctx.strokeStyle = INKM(0.6); ctx.lineWidth = lp;
    for (const r of rings2) { ctx.globalAlpha = Math.max(0, 1 - r.t / 1.3); ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = INKM(0.85);
    for (const f of foods) if (f.on) { ctx.beginPath(); ctx.arc(f.x, f.z, 0.12, 0, TAU); ctx.fill(); }
    // o peixe como gravura: escamas em arco e cauda riscada
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = lp / FISH_SIZE;
      fishTailPath(ctx, S, N, amp);
      ctx.fillStyle = 'rgba(200, 120, 70, 0.45)'; ctx.fill(); ctx.strokeStyle = INKM(1); ctx.lineWidth = 1.2 * w; ctx.stroke();
      ctx.fillStyle = 'rgba(200, 105, 55, 0.55)'; ctx.fill(body);
      ctx.save(); ctx.clip(body);
      ctx.strokeStyle = INKM(0.45); ctx.lineWidth = 0.9 * w;
      for (let i = 3; i < N - 1; i++) {
        const s = S[i], a = Math.atan2(s.ty, s.tx);
        for (const off of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(s.x - s.ty * s.w * off, s.y + s.tx * s.w * off, s.w * 0.35, a - Math.PI / 2, a + Math.PI / 2); ctx.stroke(); }
      }
      ctx.restore();
      ctx.strokeStyle = INKM(1); ctx.lineWidth = 1.4 * w; ctx.stroke(body);
      ctx.fillStyle = INKM(1);
      for (const sg of [1, -1]) { const p = at(0.06, sg, 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 0.07, 0, TAU); ctx.fill(); }
    });
    label('Lago dos Estilos', 0, lakeBox.z0 - 2.4, 26, FELL, INKM(0.95));
    label('aqui há peixes', F.x, F.z - 2.6 * FISH_SIZE, 14, FELL, INKM(0.9));
    label('Píer Velho', dockEnd.x + 1.5, dockEnd.z - 2.2, 13, FELL, INKM(0.85));
    if (trees[0]) label('Bosque Sombrio', trees[0].x, trees[0].z + 3, 13, FELL, INKM(0.85));
    // rosa dos ventos, moldura e bordas queimadas
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const cx = 74 * DPR, cy = buf.y - 150 * DPR, R = 40 * DPR;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 - Math.PI / 2, len = k % 2 ? R * 0.55 : R, side = R * 0.14;
      for (const sg of [1, -1]) {
        g2.fillStyle = sg > 0 ? INKM(0.85) : '#f3e3bb';
        g2.beginPath(); g2.moveTo(cx, cy); g2.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g2.lineTo(cx + Math.cos(a + sg * Math.PI / 2) * side, cy + Math.sin(a + sg * Math.PI / 2) * side); g2.closePath(); g2.fill();
      }
    }
    g2.strokeStyle = INKM(0.85); g2.lineWidth = DPR;
    g2.beginPath(); g2.arc(cx, cy, R * 0.62, 0, TAU); g2.stroke();
    g2.font = `italic ${Math.round(16 * DPR)}px "IM Fell English", Georgia, serif`; g2.fillStyle = INKM(0.95); g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText('N', cx, cy - R - 12 * DPR);
    g2.lineWidth = 2 * DPR; g2.strokeRect(10 * DPR, 10 * DPR, buf.x - 20 * DPR, buf.y - 20 * DPR);
    g2.lineWidth = DPR; g2.strokeRect(16 * DPR, 16 * DPR, buf.x - 32 * DPR, buf.y - 32 * DPR);
    const vg = g2.createRadialGradient(buf.x / 2, buf.y / 2, Math.min(buf.x, buf.y) * 0.35, buf.x / 2, buf.y / 2, Math.max(buf.x, buf.y) * 0.75);
    vg.addColorStop(0, 'rgba(90, 50, 10, 0)'); vg.addColorStop(1, 'rgba(90, 50, 10, 0.4)');
    g2.fillStyle = vg; g2.fillRect(0, 0, buf.x, buf.y);
  }

  // ---------- PAPEL RECORTADO ----------
  function paperLake(k, seed) {
    const pts = [];
    for (let i = 0; i < 140; i++) {
      const a = i / 140 * TAU, p = polar(a, lakeR(a) * k * (1 + 0.012 * Math.sin(a * 13 + seed) + 0.006 * Math.sin(a * 29 + seed * 2)));
      pts.push({ x: p.x, y: p.z });
    }
    return smoothPath(pts);
  }
  const PAPER = [[0.38, '#2b84a6'], [0.6, '#3fa3c0'], [0.82, '#74cbd6'], [1.0, '#f0d69c'], [1.15, '#86c95f']].map(([k, c], i) => ({ c, path: paperLake(k, i * 3.7) }));
  // folha de papel: sombra deslocada (sem desfoque, como recorte de verdade) e depois a cor
  function pp(ctx, build, color, ox = 0.16, oz = 0.22, rule) {
    ctx.save();
    ctx.translate(ox, oz); ctx.fillStyle = 'rgba(40, 28, 12, 0.2)'; build(); ctx.fill(rule || 'nonzero');
    ctx.translate(-ox * 0.45, -oz * 0.45); ctx.fillStyle = 'rgba(40, 28, 12, 0.12)'; build(); ctx.fill(rule || 'nonzero');
    ctx.restore();
    ctx.fillStyle = color; build(); ctx.fill(rule || 'nonzero');
  }
  function paperRender(dt) {
    const vis = begin2D(dt, '#1d6584'), ctx = g2;
    const [x0, z0, x1, z1] = vis.box;
    const sheet = (i) => {
      const p = new Path2D();
      p.rect(x0 - 3, z0 - 3, x1 - x0 + 6, z1 - z0 + 6);
      p.addPath(PAPER[i].path);
      ctx.save(); ctx.translate(0.22, 0.3); ctx.fillStyle = 'rgba(10, 30, 40, 0.28)'; ctx.fill(p, 'evenodd');
      ctx.translate(-0.12, -0.16); ctx.fillStyle = 'rgba(10, 30, 40, 0.18)'; ctx.fill(p, 'evenodd'); ctx.restore();
      ctx.fillStyle = PAPER[i].c; ctx.fill(p, 'evenodd');
    };
    sheet(0); sheet(1); sheet(2);
    // embaixo da folha de areia: ração, peixe, bolhas e vitórias-régias
    for (const f of foods) if (f.on) pp(ctx, () => { ctx.beginPath(); ctx.arc(f.x, f.z, 0.2, 0, TAU); }, '#f3a23a', 0.06, 0.08);
    const [sx, sz] = fishLocalOffset(0.25, 0.35);
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp);
      pp(ctx, () => fishTailPath(ctx, S, N, amp), '#ffb070', sx, sz);
      for (const sg of [1, -1]) {
        const p = at(0.3, sg, 0.85);
        pp(ctx, () => { ctx.beginPath(); ctx.ellipse(p.x - 0.1, p.y + sg * 0.18, 0.4, 0.17, p.a - sg * 0.9, 0, TAU); }, '#ffc59a', sx * 0.6, sz * 0.6);
      }
      pp(ctx, () => { ctx.beginPath(); ctx.rect(-9, -9, 0, 0); }, '#000', 0, 0);
      ctx.save(); ctx.translate(sx, sz); ctx.fillStyle = 'rgba(10, 30, 40, 0.3)'; ctx.fill(body); ctx.restore();
      ctx.fillStyle = '#ff7a2f'; ctx.fill(body);
      ctx.save(); ctx.clip(body);
      for (const [u, off, rx, ry, c] of [[0.17, 0.1, 0.4, 0.27, '#fff1de'], [0.37, -0.06, 0.3, 0.2, '#e5431f'], [0.56, -0.12, 0.46, 0.3, '#fff1de']]) {
        const s = S[Math.round(u * N)];
        pp(ctx, () => { ctx.beginPath(); ctx.ellipse(s.x - s.ty * off, s.y + s.tx * off, rx, ry, Math.atan2(s.ty, s.tx), 0, TAU); }, c, sx * 0.3, sz * 0.3);
      }
      ctx.restore();
      ctx.fillStyle = '#2a2230';
      for (const sg of [1, -1]) { const p = at(0.06, sg, 0.62); ctx.beginPath(); ctx.arc(p.x, p.y, 0.08, 0, TAU); ctx.fill(); }
    });
    for (const b of bubbles) if (b.on) pp(ctx, () => { ctx.beginPath(); ctx.arc(b.x, b.z, b.s * 0.7, 0, TAU); }, '#f4fbff', 0.04, 0.05);
    pads.forEach((p, i) => {
      const n = padLook[i] + Math.sin(time * 0.6 + i) * 0.08;
      pp(ctx, () => { ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); }, '#63c46f');
      if (p.flower) for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU + 0.3;
        pp(ctx, () => { ctx.beginPath(); ctx.ellipse(p.x + Math.cos(a) * 0.22, p.z + Math.sin(a) * 0.22, 0.24, 0.12, a, 0, TAU); }, k % 2 ? '#ff9fc6' : '#ff7fb3', 0.05, 0.07);
      }
    });
    sheet(3); sheet(4);
    // em cima da grama: trilhas, pedras, píer, flores e árvores
    for (const p of PATHS) {
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.save(); ctx.translate(0.12, 0.18); polyline(ctx, p); ctx.strokeStyle = 'rgba(40, 28, 12, 0.2)'; ctx.lineWidth = 2.1; ctx.stroke(); ctx.restore();
      polyline(ctx, p); ctx.strokeStyle = '#ecd29a'; ctx.lineWidth = 2.1; ctx.stroke();
    }
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      const k = rockLook[i].k, rad = r.s * 0.75;
      pp(ctx, () => blobPath(ctx, r.x, r.z, rad, k), '#b7b2c6');
      pp(ctx, () => blobPath(ctx, r.x - rad * 0.15, r.z - rad * 0.18, rad * 0.55, k), '#d6d2e2', 0.05, 0.07);
    });
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    for (let d = 0, n = 0; d <= dock.len; d += 0.56, n++) pp(ctx, () => { ctx.beginPath(); ctx.rect(d - 0.25, -1.15, 0.48, 2.3); }, n % 2 ? '#d69a62' : '#c58753', 0.08, 0.12);
    ctx.restore();
    for (const f of flowers2) {
      if (!vis(f.x, f.z)) continue;
      pp(ctx, () => { ctx.beginPath(); ctx.arc(f.x, f.z, f.s * 1.3, 0, TAU); }, hexStr(f.c), 0.05, 0.07);
    }
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i], r = L.r;
      const pal = L.pink ? ['#d9799c', '#f0a3bf', '#ffd0df'] : ['#3f8f4f', '#56aa5f', '#7ccb76'];
      pp(ctx, () => { ctx.beginPath(); ctx.arc(t.x, t.z, r, 0, TAU); }, pal[0], 0.3, 0.42);
      pp(ctx, () => { ctx.beginPath(); ctx.arc(t.x - r * 0.15, t.z - r * 0.18, r * 0.72, 0, TAU); }, pal[1], 0.18, 0.25);
      pp(ctx, () => { ctx.beginPath(); ctx.arc(t.x - r * 0.3, t.z - r * 0.34, r * 0.4, 0, TAU); }, pal[2], 0.1, 0.14);
    });
    overlay(pattern('paper3', () => grain(0.1, 41)));
  }

  // ---------- LETREIRO NEON ----------
  const NEON = {
    cyan: ['#25d9ff', '#d2f8ff'], blue: ['#3a7bff', '#d6e3ff'], pink: ['#ff3fa4', '#ffd6ec'], orange: ['#ff7a2f', '#ffe3cf'],
    green: ['#3dff7a', '#d6ffe4'], purple: ['#a66bff', '#ebe0ff'], yellow: ['#ffd23f', '#fff6cc'],
  };
  function brickTile() {
    return tile(120 * DPR, 60 * DPR, (x, w, h) => {
      x.fillStyle = '#100d14'; x.fillRect(0, 0, w, h);
      const bw = w / 2, bh = h / 2, m = 3 * DPR, r = mulberry32(3);
      for (let row = 0; row < 2; row++) for (let i = -1; i < 3; i++) {
        const v = 24 + Math.floor(r() * 10), ox = row ? bw / 2 : 0;
        x.fillStyle = `rgb(${v + 6}, ${v - 2}, ${v + 12})`;
        x.fillRect(i * bw + ox + m / 2, row * bh + m / 2, bw - m, bh - m);
      }
    });
  }
  const flick = (seed) => (hash2(Math.floor(time * 14), seed) > 0.985 ? 0.25 : 1);
  // tubo de neon: brilho largo e borrado por baixo, núcleo quase branco por cima
  function tube(ctx, shape, col, w, f = 1) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const draw = () => { if (shape instanceof Path2D) ctx.stroke(shape); else { shape(); ctx.stroke(); } };
    ctx.shadowColor = col[0]; ctx.shadowBlur = 16 * DPR;
    ctx.strokeStyle = col[0]; ctx.globalAlpha = 0.5 * f; ctx.lineWidth = w * 2.4; draw();
    ctx.shadowBlur = 5 * DPR; ctx.globalAlpha = f; ctx.lineWidth = w; ctx.strokeStyle = col[1]; draw();
    ctx.restore();
  }
  function neonRender(dt) {
    const vis = begin2D(dt, '#100d14'), ctx = g2, lp = DPR / view2.s;
    overlay(pattern('brick' + DPR, brickTile));
    ctx.fillStyle = 'rgba(8, 24, 50, 0.5)'; ctx.fill(LAKE2.shore);
    tube(ctx, LAKE2.shore, NEON.cyan, 2.6 * lp, flick(1));
    tube(ctx, LAKE2.b2, NEON.blue, 1.5 * lp, flick(2));
    pads.forEach((p, i) => {
      const n = padLook[i];
      tube(ctx, () => { ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath(); }, p.flower ? NEON.pink : NEON.green, 1.6 * lp, flick(10 + i));
    });
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      tube(ctx, () => { ctx.beginPath(); ctx.arc(t.x, t.z, treeLook[i].r * 0.85, 0, TAU); }, treeLook[i].pink ? NEON.pink : NEON.green, 1.8 * lp, flick(30 + i));
    });
    rocks.forEach((r, i) => { if (vis(r.x, r.z)) tube(ctx, () => blobPath(ctx, r.x, r.z, r.s * 0.65, rockLook[i].k), NEON.purple, 1.6 * lp, flick(80 + i)); });
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    tube(ctx, () => { ctx.beginPath(); ctx.rect(-0.25, -1.15, dock.len + 0.5, 2.3); }, NEON.yellow, 1.8 * lp, flick(99));
    ctx.restore();
    ctx.strokeStyle = '#a8ff7a'; ctx.lineWidth = 1.4 * lp; ctx.lineCap = 'round'; ctx.beginPath();
    for (const r of reeds) { const sw = Math.sin(time * 1.3 + r.ph) * 0.15; ctx.moveTo(r.x, r.z); ctx.lineTo(r.x + sw * r.h, r.z - r.h * 0.35); }
    ctx.stroke();
    for (const r of rings2) tube(ctx, () => { ctx.beginPath(); ctx.arc(r.x, r.z, 0.3 + r.t * 2.2 * r.big, 0, TAU); }, NEON.cyan, 1.2 * lp, Math.max(0, 1 - r.t / 1.3));
    for (const f of foods) if (f.on) tube(ctx, () => { ctx.beginPath(); ctx.arc(f.x, f.z, 0.12, 0, TAU); }, NEON.yellow, 2 * lp);
    ctx.fillStyle = '#bff4ff';
    for (const b of bubbles) if (b.on) { ctx.beginPath(); ctx.arc(b.x, b.z, b.s * 0.4, 0, TAU); ctx.fill(); }
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = lp / FISH_SIZE;
      tube(ctx, () => fishTailPath(ctx, S, N, amp), NEON.orange, 2.2 * w);
      tube(ctx, body, NEON.orange, 2.6 * w);
      tube(ctx, () => { ctx.beginPath(); for (let i = 3; i <= 13; i++) i === 3 ? ctx.moveTo(S[i].x, S[i].y) : ctx.lineTo(S[i].x, S[i].y); }, NEON.pink, 1.8 * w);
      for (const sg of [1, -1]) { const p = at(0.07, sg, 0.6); tube(ctx, () => { ctx.beginPath(); ctx.arc(p.x, p.y, 0.05, 0, TAU); }, NEON.cyan, 1.6 * w); }
    });
    // letreiro piscando, letra por letra
    if (buf.x / DPR >= 720) {
      g2.setTransform(1, 0, 0, 1, 0, 0);
      const txt = 'lago aberto', size = 46 * DPR;
      g2.font = `${Math.round(size)}px "Tilt Neon", "Figtree", sans-serif`;
      g2.textBaseline = 'middle'; g2.textAlign = 'left';
      let x = buf.x / 2 - g2.measureText(txt).width / 2;
      const y = buf.y - 60 * DPR;
      [...txt].forEach((ch, i) => {
        const f = i === 6 && Math.sin(time * 1.7) > 0.6 ? 0.2 : flick(200 + i);
        g2.save();
        g2.globalAlpha = f; g2.shadowColor = NEON.pink[0]; g2.shadowBlur = 24 * DPR;
        g2.fillStyle = NEON.pink[1]; g2.fillText(ch, x, y);
        g2.restore();
        x += g2.measureText(ch).width;
      });
    }
  }

  // ---------- PONTO-CRUZ ----------
  // usa o mundo de pixel art como "gráfico" do bordado e costura cada pixel como um X
  const STITCH_SKIP = new Set([0x6cbf4a, 0x5aa83f, 0x82cf57, 0x4e9a38, 0x9be06a, 0x4d9636]);
  function fabricTile(S) {
    return tile(S, S, (x, w, h) => {
      x.fillStyle = '#efe7d3'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(150, 130, 95, 0.25)'; x.fillRect(0, 0, w, Math.max(1, w * 0.08)); x.fillRect(0, 0, Math.max(1, w * 0.08), h);
      x.fillStyle = 'rgba(120, 100, 70, 0.45)'; x.beginPath(); x.arc(0.5, 0.5, Math.max(1, w * 0.1), 0, TAU); x.fill();
    });
  }
  function stitchRender(dt) {
    const S = Math.max(5, Math.round(buf.x / 130)), [lw, lh] = pixDraw(dt, S);
    const img = pix.lc.getImageData(0, 0, lw, lh).data;
    const ctx = g2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pattern('fabric' + S, () => fabricTile(S));
    ctx.fillRect(0, 0, buf.x, buf.y);
    const groups = new Map(), all = [];
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const o = (y * lw + x) * 4, key = (img[o] << 16) | (img[o + 1] << 8) | img[o + 2];
      if (STITCH_SKIP.has(key)) continue;
      let g = groups.get(key);
      if (!g) groups.set(key, g = []);
      g.push(x * S, y * S);
      all.push(x * S, y * S);
    }
    const ins = S * 0.17;
    ctx.lineCap = 'round';
    // sombra da linha no tecido
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.25)'; ctx.lineWidth = S * 0.3;
    ctx.beginPath();
    for (let i = 0; i < all.length; i += 2) { const x = all[i] + S * 0.06, y = all[i + 1] + S * 0.08; ctx.moveTo(x + ins, y + ins); ctx.lineTo(x + S - ins, y + S - ins); ctx.moveTo(x + S - ins, y + ins); ctx.lineTo(x + ins, y + S - ins); }
    ctx.stroke();
    for (const [key, pts] of groups) {
      ctx.strokeStyle = hexStr(key);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; ctx.moveTo(x + ins, y + ins); ctx.lineTo(x + S - ins, y + S - ins); ctx.moveTo(x + S - ins, y + ins); ctx.lineTo(x + ins, y + S - ins); }
      ctx.stroke();
    }
    // brilho da linha na perna de cima de cada X
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = S * 0.09;
    ctx.beginPath();
    for (let i = 0; i < all.length; i += 2) { const x = all[i], y = all[i + 1]; ctx.moveTo(x + S - ins * 1.4, y + ins * 1.6); ctx.lineTo(x + ins * 1.6, y + S - ins * 1.4); }
    ctx.stroke();
  }

  // ---------- MASSINHA (stop-motion) ----------
  const clayWorld = new T.Group();
  clayWorld.visible = false;
  scene.add(clayWorld);
  const fishClay = new T.Group();
  fishClay.visible = false;
  scene.add(fishClay);
  const clay = { built: false, acc: 0 };
  const clayMats = {};
  const clayMat = (color, extra) => {
    const k = color + (extra ? ':' + Object.keys(extra).join() : '');
    return clayMats[k] || (clayMats[k] = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.78, metalness: 0 }, extra)));
  };
  // deforma a geometria com ruído: parece moldado com os dedos
  function lumpy(geo, amt, freq, seed) {
    const p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = vnoise(v.x * freq + seed, v.y * freq + v.z * freq * 0.7 - seed) - 0.5;
      v.multiplyScalar(1 + n * amt);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function clayInst(geo, list, place) {
    const m = new T.InstancedMesh(geo, clayMat(0xffffff), list.length);
    list.forEach((it, i) => {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      const c = place(it, dummy, i);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    clayWorld.add(m);
    return m;
  }
  function buildClay() {
    if (clay.built) return;
    clay.built = true;
    const rc = mulberry32(64);
    const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 92, 70);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position, colors = new Float32Array(p.count * 3), tc = new T.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = celHeight(x, z) + (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.14;
      p.setY(i, y);
      if (y < -0.3) tc.set(0x8ad8e8).lerp(col(0x3a9fd0), clamp((-y - 0.35) / 2.3, 0, 1));
      else if (y < 0.02 || lakeV(x, z) < 1.1) tc.set(0xffd98a);
      else if (isPath(x, z)) tc.set(0xe8b878);
      else tc.set(0x6fcf5a).lerp(col(0x5cbf4c), vnoise(x * 0.2, z * 0.2));
      colors[i * 3] = tc.r; colors[i * 3 + 1] = tc.g; colors[i * 3 + 2] = tc.b;
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const ground = new T.Mesh(g, clayMat(0xffffff, { vertexColors: true }));
    ground.receiveShadow = true;
    clayWorld.add(ground);
    const blob = [0, 1, 2].map(k => lumpy(new T.IcosahedronGeometry(1, 3), 0.28, 1.6, k * 7));
    clayInst(lumpy(new T.CylinderGeometry(0.32, 0.45, 2.2, 10, 4).translate(0, 1.1, 0), 0.2, 2.5, 3), trees, (t, d) => {
      d.position.set(t.x, celHeight(t.x, t.z), t.z); d.rotation.y = rc() * 6; return col(0x8b5a3c);
    });
    const crowns = [[], [], []];
    trees.forEach((t, i) => crowns[i % 3].push({ t, L: treeLook[i] }));
    crowns.forEach((list, k) => clayInst(blob[k], list, ({ t, L }, d) => {
      const s = 1.3 + L.r * 0.35;
      d.position.set(t.x, celHeight(t.x, t.z) + 2.6 + s * 0.5, t.z); d.scale.set(s, s * 0.9, s); d.rotation.set(rc() * 3, rc() * 3, 0);
      return col(L.pink ? 0xff8fb8 : L.tone < 0.5 ? 0x5ccf4f : 0x43b84a);
    }));
    clayInst(blob[1], rocks, (r, d) => {
      const s = r.s * 0.62;
      d.position.set(r.x, r.wet ? WATER_Y : celHeight(r.x, r.z) + 0.1, r.z); d.scale.set(s, s * 0.6, s * 0.85); d.rotation.y = rc() * 6;
      return col(0xa9a3c8);
    });
    clayInst(lumpy(new T.CylinderGeometry(1, 1, 0.16, 22, 1), 0.1, 2.2, 5), pads, (pd, d) => {
      d.position.set(pd.x, WATER_Y + 0.08, pd.z); d.scale.set(pd.r, 1, pd.r); return col(0x58c96a);
    });
    const petals = [];
    pads.filter(pd => pd.flower).forEach(pd => {
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; petals.push({ x: pd.x + Math.cos(a) * 0.25, z: pd.z + Math.sin(a) * 0.25, r: 0.2, c: 0xff7fb0 }); }
      petals.push({ x: pd.x, z: pd.z, r: 0.13, c: 0xffe066 });
    });
    if (petals.length) clayInst(blob[2], petals, (b, d) => { d.position.set(b.x, WATER_Y + 0.28, b.z); d.scale.set(b.r, b.r * 0.6, b.r); return col(b.c); });
    const planks = [];
    for (let s = 0, n = 0; s <= dock.len; s += 0.56, n++) planks.push({ s, n });
    clayInst(lumpy(new T.BoxGeometry(1, 1, 1, 3, 2, 6), 0.12, 2, 9), planks, (pl, d) => {
      d.position.set(dockLand.x + dock.ux * pl.s, 0.16, dockLand.z + dock.uz * pl.s); d.rotation.y = dock.ry; d.scale.set(0.46, 0.18, 2.3);
      return col(pl.n % 2 ? 0xd08a4e : 0xbf7a42);
    });
    const stalk = lumpy(new T.CylinderGeometry(0.55, 0.55, 1, 8, 4).translate(0, 0.5, 0), 0.25, 3, 2);
    const copyOf = (geo, src, c) => clayInst(geo, Array.from({ length: src.count }, (_, i) => i), () => col(c));
    clay.reeds = copyOf(stalk, reedMesh, 0x5cb85a);
    clay.weeds = copyOf(stalk, weedMesh, 0x3fae8a);
    clay.heads = copyOf(blob[0], headMesh, 0x9a5a2e);
    clay.food = copyOf(blob[1], foodMesh, 0xffa42e);
    clay.bub = copyOf(new T.SphereGeometry(0.5, 10, 8), bubMesh, 0xffffff);
    clay.weeds.castShadow = false; clay.bub.castShadow = false;
    // água de massinha azul, mexendo aos trancos
    const wg = new T.PlaneGeometry(RX * 2.6, RZ * 2.6, 64, 44);
    wg.rotateX(-Math.PI / 2);
    clay.waterBase = Float32Array.from(wg.attributes.position.array);
    clay.water = new T.Mesh(wg, clayMat(0x5ec8e8, { transparent: true, opacity: 0.55, roughness: 0.25 }));
    clay.water.position.y = WATER_Y;
    clayWorld.add(clay.water);
    // carpa de massinha com olhos esbugalhados
    const part = (parent, geo, color, sx, sy, sz, x, y, z, ry = 0) => {
      const m = new T.Mesh(geo, clayMat(color));
      m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true;
      parent.add(m);
      return m;
    };
    const ball = lumpy(new T.SphereGeometry(0.5, 28, 20), 0.07, 3, 11), small = new T.SphereGeometry(0.5, 16, 12);
    part(fishClay, ball, 0xff6f2e, 2.5, 0.95, 1.05, 0.15, 0, 0);
    part(fishClay, ball, 0xfff3e2, 0.75, 0.22, 0.5, 0.55, 0.36, 0.08, 0.2);
    part(fishClay, ball, 0xfff3e2, 0.6, 0.2, 0.42, -0.45, 0.33, -0.1, -0.3);
    part(fishClay, ball, 0xe8401c, 0.36, 0.16, 0.3, 0.05, 0.4, 0.14);
    for (const s of [1, -1]) {
      part(fishClay, small, 0xffffff, 0.42, 0.42, 0.42, 0.95, 0.3, s * 0.26);
      part(fishClay, small, 0x111111, 0.2, 0.2, 0.2, 1.1, 0.38, s * 0.3);
      part(fishClay, ball, 0xffb27a, 0.7, 0.1, 0.42, 0.5, -0.1, s * 0.55, s * 0.5);
    }
    clay.tail = new T.Group();
    clay.tail.position.set(-1.05, 0, 0);
    for (const s of [1, -1]) part(clay.tail, ball, 0xffa35e, 0.9, 0.12, 0.55, -0.35, 0, s * 0.24, s * 0.55);
    fishClay.add(clay.tail);
    fishClay.scale.setScalar(FISH_SIZE);
  }
  const clayHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water, fish];
  let hemi = null;
  function clayEnter() {
    buildClay();
    clayHide.forEach(o => { o.visible = false; });
    clayWorld.visible = true; fishClay.visible = true;
    hemi = hemi || scene.children.find(o => o.isHemisphereLight);
    if (hemi) hemi.intensity = 0.9;
    sun.intensity = 0.8;
    renderer.setClearColor(0x6fcf5a, 0);
    clay.acc = 1;
  }
  function clayExit() {
    clayHide.forEach(o => { o.visible = true; });
    clayWorld.visible = false; fishClay.visible = false;
    if (hemi) hemi.intensity = 0.6;
    sun.intensity = 0.44;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  // tudo se mexe só 12 vezes por segundo, com um tremidinho, como animação quadro a quadro
  function clayStep() {
    fishClay.position.copy(fish.position);
    fishClay.position.x += (Math.random() - 0.5) * 0.05; fishClay.position.z += (Math.random() - 0.5) * 0.05;
    fishClay.rotation.set(0, fish.rotation.y + (Math.random() - 0.5) * 0.06, 0);
    clay.tail.rotation.y = tail.rotation.y;
    copyInst(clay.reeds, reedMesh); copyInst(clay.weeds, weedMesh); copyInst(clay.heads, headMesh);
    copyInst(clay.food, foodMesh); copyInst(clay.bub, bubMesh);
    const a = clay.water.geometry.attributes.position, b = clay.waterBase;
    for (let i = 0; i < a.count; i++) {
      const x = b[i * 3], z = b[i * 3 + 2];
      a.array[i * 3 + 1] = Math.sin(x * 0.7 + time * 1.4) * 0.07 + Math.cos(z * 0.9 - time) * 0.05 + (Math.random() - 0.5) * 0.015;
    }
    a.needsUpdate = true;
    clay.water.geometry.computeVertexNormals();
  }
  function clayRender(dt) {
    clay.acc += dt;
    if (clay.acc >= 1 / 12) { clay.acc %= 1 / 12; clayStep(); }
    renderWorld();
    finish(rtScene.texture, 0.6);
  }

  // ---------- BLOCOS DE MONTAR ----------
  const brickGroup = new T.Group();
  brickGroup.visible = false;
  scene.add(brickGroup);
  const brick = { built: false, map: new Map() };
  function buildBricks() {
    if (brick.built) return;
    brick.built = true;
    const list = [];
    for (const b of batches.values()) for (const it of b.items) if (it[3] >= 0.9 && it[5] >= 0.9) list.push(it);
    const m = new T.InstancedMesh(new T.CylinderGeometry(0.28, 0.28, 0.2, 14), new T.MeshPhongMaterial({ color: 0xffffff, shininess: 80, specular: 0x555555 }), list.length);
    list.forEach((it, i) => {
      dummy.position.set(it[0], it[1] + it[4] / 2 + 0.1, it[2]); dummy.rotation.set(0, it[7], 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, it[6]);
    });
    m.instanceColor.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    brickGroup.add(m);
  }
  // troca o material fosco por plástico brilhante (e desfaz ao sair)
  function plastic(on) {
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      if (on && m.isMeshLambertMaterial) {
        if (!brick.map.has(m)) {
          const p = new T.MeshPhongMaterial({ color: m.color, opacity: m.opacity, transparent: false, shininess: 70, specular: 0x444444, vertexColors: m.vertexColors, side: m.side });
          p.userData.lambert = m;
          brick.map.set(m, p);
        }
        o.material = brick.map.get(m);
      } else if (!on && m.isMeshPhongMaterial && m.userData.lambert) o.material = m.userData.lambert;
    });
  }
  function brickEnter() { buildBricks(); plastic(true); brickGroup.visible = true; }
  function brickExit() { plastic(false); brickGroup.visible = false; }
  function brickRender() { renderWorld(); finish(rtScene.texture, 0.7); }
