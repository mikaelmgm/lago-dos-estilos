
  // ---------- BALA DE GOMA: material translúcido de estúdio ----------
  const gumWorld = new T.Group();
  gumWorld.visible = false;
  scene.add(gumWorld);
  const fishGum = new T.Group();
  fishGum.visible = false;
  fish.add(fishGum);
  const gum = { built: false, sq: 0, sqv: 0, prev: 0, foods: [] };
  const GUM_FLOOR = -1.65;
  const GUM_VS = `
    uniform float uTime;
    uniform float uWob;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec3 p = position + normal * sin(position.x * 5.0 + uTime * 9.0) * cos(position.z * 4.0 + uTime * 6.0) * uWob;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vV = cameraPosition - wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  // casca colorida e transparente por cima de um miolo leitoso, com dois brilhos de estúdio
  const GUM_FS = `
    uniform vec3 uColor;
    uniform vec3 uInner;
    uniform float uAlpha;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec3 n = normalize(vN), v = normalize(vV);
      if (!gl_FrontFacing) n = -n;
      vec3 L = normalize(vec3(-0.5, 0.85, 0.35)), L2 = normalize(vec3(0.7, 0.45, -0.3));
      float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);
      float wrap = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uInner, uColor, 0.45 + 0.55 * fres) * (0.62 + 0.5 * wrap);
      float s1 = pow(clamp(dot(n, normalize(L + v)), 0.0, 1.0), 110.0) * 1.5;
      float s2 = pow(clamp(dot(n, normalize(L2 + v)), 0.0, 1.0), 50.0) * 0.5;
      gl_FragColor = vec4(c + s1 + s2 + fres * 0.18, clamp(uAlpha + fres * 0.35 + s1, 0.0, 1.0));
    }`;
  function gumMat(color, inner, alpha, wob = 0) {
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uInner: { value: new T.Color(inner) }, uAlpha: { value: alpha }, uTime: U.uTime, uWob: { value: wob } },
      vertexShader: GUM_VS, fragmentShader: GUM_FS, transparent: alpha < 1, depthWrite: alpha >= 1,
    });
  }
  let gumShadowTex = null;
  // sombra colorida e macia no chão do estúdio
  function gumShadow(color, x, z, sx, sz, rot = 0, op = 0.5) {
    gumShadowTex = gumShadowTex || new T.CanvasTexture(tile(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }));
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: gumShadowTex, color: new T.Color(color).multiplyScalar(0.55), transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    m.position.set(x, GUM_FLOOR + 0.01, z); m.scale.set(sx, sz, 1);
    gumWorld.add(m);
    return m;
  }
  function buildGum() {
    if (gum.built) return;
    gum.built = true;
    const floor = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshBasicMaterial({ color: 0xe8e4dc }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = GUM_FLOOR;
    gumWorld.add(floor);
    const sph = new T.SphereGeometry(1, 32, 22);
    // o lago vira um bloco de gelatina com bordas arredondadas
    const shape = new T.Shape();
    lakeLoop(1.02, 120).forEach((p, i) => (i ? shape.lineTo(p.x, -p.y) : shape.moveTo(p.x, -p.y)));
    const slab = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.5, bevelSegments: 5, curveSegments: 4 }), gumMat(0x7fd8e6, 0xeefcff, 0.2));
    slab.rotation.x = -Math.PI / 2; slab.position.y = GUM_FLOOR + 0.35; slab.renderOrder = 3;
    gumWorld.add(slab);
    gumShadow(0x5fc8d8, 0.9, 0.7, (lakeBox.x1 - lakeBox.x0) * 1.2, (lakeBox.z1 - lakeBox.z0) * 1.25, 0, 0.45);
    pads.forEach((p, i) => {
      const m = new T.Mesh(sph, gumMat(0x57d17a, 0xd9ffe4, 0.75));
      m.scale.set(p.r, 0.14, p.r); m.position.set(p.x, 0.02, p.z); m.renderOrder = 4;
      gumWorld.add(m);
      if (p.flower) {
        const f = new T.Mesh(sph, gumMat(0xff5c8a, 0xffe0ea, 0.7));
        f.scale.set(0.32, 0.22, 0.32); f.position.set(p.x, 0.2, p.z); f.renderOrder = 5;
        gumWorld.add(f);
      }
    });
    rocks.forEach((r, i) => {
      const c = [0xff5c8a, 0xffc93c, 0x9b6bff, 0xff8a3d][i % 4], s = r.s * 0.55;
      const m = new T.Mesh(sph, gumMat(c, 0xfff4f8, 0.62));
      m.scale.set(s * 1.4, s * 0.75, s * 0.85); m.rotation.y = i;
      m.position.set(r.x, r.wet ? 0.05 : GUM_FLOOR + s * 0.6, r.z);
      gumWorld.add(m);
      if (!r.wet) gumShadow(c, r.x + 0.5, r.z + 0.35, s * 3.4, s * 2.4, -i);
    });
    trees.forEach((t, i) => {
      const c = [0x4cd964, 0xff5c8a, 0xffc93c, 0x5aa9ff, 0xff8a3d][i % 5], s = 1.1 + treeLook[i].r * 0.35;
      const m = new T.Mesh(sph, gumMat(c, 0xffffff, 0.6));
      m.scale.set(s, s * 1.15, s); m.position.set(t.x, GUM_FLOOR + s * 0.75, t.z);
      gumWorld.add(m);
      gumShadow(c, t.x + s * 0.7, t.z + s * 0.5, s * 3, s * 2.2);
    });
    for (let i = 0; i < foods.length; i++) {
      const m = new T.Mesh(sph, gumMat(0x3d7bff, 0xdfe9ff, 0.7));
      m.scale.setScalar(0.2); m.renderOrder = 2;
      gumWorld.add(m);
      gum.foods.push(m);
    }
    // carpa de goma: casca laranja translúcida sobre um miolo leitoso
    const fsph = new T.SphereGeometry(0.5, 40, 28);
    gum.shell = gumMat(0xff5a1f, 0xffb98f, 0.62, 0.012);
    const core = new T.Mesh(fsph, gumMat(0xfff4e6, 0xffffff, 1, 0.012));
    core.scale.set(2.1, 0.62, 0.72); core.position.set(0.2, -0.08, 0);
    const shell = new T.Mesh(fsph, gum.shell);
    shell.scale.set(2.6, 1.0, 1.1); shell.position.x = 0.15; shell.renderOrder = 1;
    fishGum.add(core, shell);
    const finMat = gumMat(0xffa070, 0xffe0cc, 0.45);
    for (const s of [1, -1]) {
      const f = new T.Mesh(fsph, finMat);
      f.scale.set(0.75, 0.1, 0.45); f.position.set(0.5, -0.12, s * 0.55); f.rotation.y = s * 0.5; f.renderOrder = 1;
      const eye = new T.Mesh(fsph, gumMat(0x0d0d10, 0x2a2a30, 1));
      eye.scale.setScalar(0.17); eye.position.set(1.12, 0.14, s * 0.33);
      fishGum.add(f, eye);
    }
    const tailG = new T.Group();
    tailG.position.set(-1.05, 0, 0);
    for (const s of [1, -1]) {
      const l = new T.Mesh(fsph, finMat);
      l.scale.set(0.95, 0.12, 0.58); l.position.set(-0.35, 0, s * 0.24); l.rotation.y = s * 0.55; l.renderOrder = 1;
      tailG.add(l);
    }
    fishGum.add(tailG);
    tailExtra.push(tailG);
    gum.fishShadow = gumShadow(0xff6a2b, 0, 0, 5.5, 2.0);
  }
  const gumHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water];
  function gumEnter() {
    buildGum();
    gumHide.forEach(o => { o.visible = false; });
    gumWorld.visible = true; fishVox.visible = false; fishGum.visible = true;
    renderer.setClearColor(0xe8e4dc, 0);
  }
  function gumExit() {
    gumHide.forEach(o => { o.visible = true; });
    gumWorld.visible = false; fishVox.visible = true; fishGum.visible = false;
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function gumRender(dt) {
    // mola que amassa e estica o peixe quando ele acelera, freia ou come
    const sp = F.speed || 0, acc = (sp - gum.prev) / Math.max(dt, 1e-3);
    gum.prev = sp;
    gum.sqv += (-gum.sq * 120 - gum.sqv * 8 + clamp(acc, -40, 40) * 0.6) * dt;
    gum.sq += gum.sqv * dt;
    const k = clamp(gum.sq * 0.02, -0.25, 0.25);
    fishGum.scale.set(1 + k, 1 - k * 0.7, 1 - k * 0.5);
    gum.shell.uniforms.uWob.value = 0.01 + Math.min(sp / 7.5, 1) * 0.02;
    gum.fishShadow.position.set(F.x + 0.9, GUM_FLOOR + 0.012, F.z + 0.6);
    gum.fishShadow.rotation.z = F.heading;
    foods.forEach((f, i) => { gum.foods[i].visible = f.on; gum.foods[i].position.set(f.x, Math.max(f.y, -1.3), f.z); });
    renderWorld();
    finish(rtScene.texture, 0.35, 0);
  }

  // ---------- BAUHAUS ----------
  const BH = { red: '#d7372a', yellow: '#f2b705', blue: '#1f4e9a', black: '#1a1a1a', cream: '#f1ebdd', white: '#fbf8f0' };
  function bauhausRender(dt) {
    const vis = begin2D(dt, BH.cream), ctx = g2;
    // grandes formas de fundo
    ctx.fillStyle = BH.yellow; ctx.beginPath(); ctx.arc(-24, -18, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = BH.red; ctx.beginPath(); ctx.moveTo(24, 14); ctx.arc(24, 14, 10, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = BH.blue; ctx.fillRect(-34, 10, 7, 7);
    ctx.strokeStyle = BH.black; ctx.lineCap = 'butt';
    for (const p of PATHS) { polyline(ctx, p); ctx.lineWidth = 0.7; ctx.stroke(); }
    // lago azul com círculos concêntricos
    ctx.fillStyle = BH.blue; ctx.fill(LAKE2.shore);
    ctx.save(); ctx.clip(LAKE2.shore);
    ctx.strokeStyle = 'rgba(251, 248, 240, 0.55)'; ctx.lineWidth = 0.18;
    for (let r = 2; r < 24; r += 2.2) { ctx.beginPath(); ctx.arc(-2, 1, r + Math.sin(time * 0.6) * 0.3, 0, TAU); ctx.stroke(); }
    for (const rg of rings2) { ctx.strokeStyle = BH.white; ctx.lineWidth = 0.22; ctx.globalAlpha = Math.max(0, 1 - rg.t / 1.3); ctx.beginPath(); ctx.arc(rg.x, rg.z, 0.3 + rg.t * 2.2 * rg.big, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.strokeStyle = BH.black; ctx.lineWidth = 0.35; ctx.stroke(LAKE2.shore);
    pads.forEach((p, i) => {
      ctx.fillStyle = BH.white; ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = p.flower ? BH.red : BH.yellow; ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, padLook[i], padLook[i] + Math.PI / 2); ctx.closePath(); ctx.fill();
    });
    rocks.forEach((r) => {
      if (!vis(r.x, r.z)) return;
      const s = r.s * 0.8;
      ctx.fillStyle = BH.black; ctx.beginPath(); ctx.moveTo(r.x, r.z - s); ctx.lineTo(r.x + s * 0.9, r.z + s * 0.6); ctx.lineTo(r.x - s * 0.9, r.z + s * 0.6); ctx.closePath(); ctx.fill();
    });
    ctx.save();
    ctx.translate(dockLand.x, dockLand.z); ctx.rotate(Math.atan2(dock.uz, dock.ux));
    for (let d = 0, n = 0; d <= dock.len; d += 0.56, n++) { ctx.fillStyle = n % 2 ? BH.black : BH.white; ctx.fillRect(d - 0.25, -1.15, 0.56, 2.3); }
    ctx.restore();
    const cols = [BH.red, BH.yellow, BH.blue, BH.black];
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i], r = L.r, c1 = cols[i % 4], c2 = cols[(i + 1) % 4];
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(t.x, t.z, r, 0, TAU); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(t.x, t.z, r, L.a, L.a + Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = BH.cream; ctx.beginPath(); ctx.arc(t.x + Math.cos(L.a + 2) * r * 0.4, t.z + Math.sin(L.a + 2) * r * 0.4, r * 0.18, 0, TAU); ctx.fill();
    });
    for (const f of foods) if (f.on) { ctx.save(); ctx.translate(f.x, f.z); ctx.rotate(time * 2); ctx.fillStyle = BH.black; ctx.fillRect(-0.18, -0.18, 0.36, 0.36); ctx.restore(); }
    ctx.fillStyle = BH.white;
    for (const b of bubbles) if (b.on) { ctx.beginPath(); ctx.arc(b.x, b.z, b.s * 0.7, 0, TAU); ctx.fill(); }
    // carpa geométrica: corpo vermelho, cauda preta, cabeça com círculo amarelo
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp);
      ctx.fillStyle = BH.black; fishTailPath(ctx, S, N, amp); ctx.fill();
      ctx.fillStyle = BH.red; ctx.fill(body);
      ctx.save(); ctx.clip(body);
      const h = S[3], m = S[10];
      ctx.fillStyle = BH.yellow; ctx.beginPath(); ctx.arc(h.x, h.y, 0.55, 0, TAU); ctx.fill();
      ctx.fillStyle = BH.white; ctx.beginPath(); ctx.arc(m.x, m.y, 0.6, Math.atan2(m.ty, m.tx), Math.atan2(m.ty, m.tx) + Math.PI); ctx.closePath(); ctx.fill();
      ctx.restore();
      for (const sg of [1, -1]) {
        const p = at(0.07, sg, 0.55);
        ctx.fillStyle = BH.white; ctx.beginPath(); ctx.arc(p.x, p.y, 0.12, 0, TAU); ctx.fill();
        ctx.fillStyle = BH.black; ctx.beginPath(); ctx.arc(p.x, p.y, 0.06, 0, TAU); ctx.fill();
      }
    });
    if (buf.x / DPR >= 720) {
      g2.setTransform(1, 0, 0, 1, 0, 0);
      g2.font = `800 ${Math.round(64 * DPR)}px "Figtree", sans-serif`; g2.fillStyle = BH.black; g2.textAlign = 'center'; g2.textBaseline = 'alphabetic';
      g2.fillText('LAGO', buf.x / 2, buf.y - 26 * DPR);
      g2.fillStyle = BH.red; g2.fillRect(buf.x / 2 + 100 * DPR, buf.y - 76 * DPR, 22 * DPR, 22 * DPR);
    }
  }

  // ---------- QUADRINHOS (pop art) ----------
  function dotTile(color, r) {
    return tile(10 * DPR, 10 * DPR, (x, w) => {
      x.fillStyle = color;
      for (const [cx, cy] of [[0, 0], [w, 0], [0, w], [w, w], [w / 2, w / 2]]) { x.beginPath(); x.arc(cx, cy, r * DPR, 0, TAU); x.fill(); }
    });
  }
  const comic = { pops: [], next: 3 };
  function dots(ctx, key, color, r, build) {
    const p = pattern(key + DPR, () => dotTile(color, r));
    ctx.save(); build(); ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = p; ctx.fillRect(0, 0, buf.x, buf.y);
    ctx.restore();
  }
  function burst(ctx, x, y, r, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, rr = i % 2 ? r * 0.62 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  function comicRender(dt) {
    const vis = begin2D(dt, '#8fdc5e'), ctx = g2, lp = DPR / view2.s, ink = '#111111';
    dots(ctx, 'gdots', 'rgba(40, 120, 30, 0.35)', 1.6, () => { ctx.beginPath(); ctx.rect(vis.box[0] - 2, vis.box[1] - 2, vis.box[2] - vis.box[0] + 4, vis.box[3] - vis.box[1] + 4); });
    ctx.lineJoin = ctx.lineCap = 'round';
    for (const p of PATHS) { polyline(ctx, p); ctx.strokeStyle = ink; ctx.lineWidth = 2.1; ctx.stroke(); ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2.1 - 5 * lp; ctx.stroke(); }
    ctx.fillStyle = '#ffd36b'; ctx.fill(LAKE2.sand);
    ctx.fillStyle = '#3fb6e8'; ctx.fill(LAKE2.shore);
    ctx.save(); ctx.clip(LAKE2.b2); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = pattern('wdots' + DPR, () => dotTile('rgba(20, 80, 180, 0.35)', 2)); ctx.fillRect(0, 0, buf.x, buf.y); ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 4 * lp; ctx.stroke(LAKE2.shore); ctx.stroke(LAKE2.sand);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 3 * lp;
    for (const g of glints2) { if (Math.sin(time * 1.5 + g.ph) < 0.3) continue; ctx.beginPath(); ctx.moveTo(g.x - g.len / 2, g.z); ctx.lineTo(g.x + g.len / 2, g.z); ctx.stroke(); }
    pads.forEach((p, i) => {
      const n = padLook[i];
      ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath();
      ctx.fillStyle = '#4ccf5a'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3 * lp; ctx.stroke();
    });
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      blobPath(ctx, r.x, r.z, r.s * 0.75, rockLook[i].k); ctx.fillStyle = '#b8b4c8'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3 * lp; ctx.stroke();
    });
    // peixe: laranja com retícula, contorno grosso e linhas de velocidade
    const sp = F.speed || 0;
    if (sp > 2.5) {
      ctx.strokeStyle = ink; ctx.lineWidth = 2.5 * lp;
      const cs = Math.cos(F.heading), sn = Math.sin(F.heading);
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        const ox = F.x - cs * 3.2 * FISH_SIZE + sn * k * 0.45, oz = F.z + sn * 3.2 * FISH_SIZE + cs * k * 0.45, len = 1.5 + (k * k) * -0.2 + sp * 0.2;
        ctx.moveTo(ox, oz); ctx.lineTo(ox - cs * len, oz + sn * len);
      }
      ctx.stroke();
    }
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = lp / FISH_SIZE;
      fishTailPath(ctx, S, N, amp); ctx.fillStyle = '#ffb347'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3.5 * w; ctx.stroke();
      ctx.fillStyle = '#ff6b1a'; ctx.fill(body);
      ctx.save(); ctx.clip(body); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = pattern('fdots' + DPR, () => dotTile('rgba(200, 30, 20, 0.5)', 1.8)); ctx.fillRect(0, 0, buf.x, buf.y);
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      const s = S[5];
      ctx.beginPath(); ctx.ellipse(s.x - s.ty * s.w * 0.4, s.y + s.tx * s.w * 0.4, 0.45, 0.12, Math.atan2(s.ty, s.tx), 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 4 * w; ctx.stroke(body);
      for (const sg of [1, -1]) {
        const p = at(0.07, sg, 0.55);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 0.13, 0, TAU); ctx.fill(); ctx.lineWidth = 2 * w; ctx.stroke();
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(p.x + 0.03, p.y, 0.06, 0, TAU); ctx.fill();
      }
    });
    for (const f of foods) if (f.on) { ctx.beginPath(); ctx.arc(f.x, f.z, 0.22, 0, TAU); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5 * lp; ctx.stroke(); }
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const r = treeLook[i].r, build = () => { ctx.beginPath(); ctx.arc(t.x, t.z, r, 0, TAU); };
      build(); ctx.fillStyle = treeLook[i].pink ? '#ff7eb6' : '#2fbf4a'; ctx.fill();
      dots(ctx, 'tdots', 'rgba(0, 60, 20, 0.4)', 1.8, () => { ctx.beginPath(); ctx.arc(t.x + r * 0.35, t.z + r * 0.35, r * 0.8, 0, TAU); });
      build(); ctx.strokeStyle = ink; ctx.lineWidth = 4 * lp; ctx.stroke();
    });
    // onomatopeias: "NHAC!" ao comer, "GLUB!" de vez em quando
    if (time > comic.next) { comic.pops.push({ x: F.x + 1.5, z: F.z - 2.5, t: 0, txt: 'GLUB!', c: '#7fe3ff' }); comic.next = time + 5 + Math.random() * 4; }
    g2.setTransform(1, 0, 0, 1, 0, 0);
    for (const p of comic.pops) {
      p.t += dt;
      const [x, y] = toScreen2D(p.x, p.z), k = Math.min(1, p.t * 6), r = (48 + (p.txt.length > 5 ? 10 : 0)) * DPR * (0.6 + 0.4 * k);
      g2.globalAlpha = Math.max(0, 1 - Math.max(0, p.t - 0.7) / 0.3);
      burst(g2, x, y, r, 12); g2.fillStyle = p.c; g2.fill(); g2.lineWidth = 3 * DPR; g2.strokeStyle = ink; g2.stroke();
      g2.font = `${Math.round(r * 0.55)}px "Bangers", "Impact", sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillStyle = '#e8261b'; g2.fillText(p.txt, x, y); g2.lineWidth = 1.2 * DPR; g2.strokeText(p.txt, x, y);
      g2.globalAlpha = 1;
    }
    comic.pops = comic.pops.filter(p => p.t < 1);
    // moldura de quadrinho
    g2.strokeStyle = '#ffffff'; g2.lineWidth = 14 * DPR; g2.strokeRect(0, 0, buf.x, buf.y);
    g2.strokeStyle = ink; g2.lineWidth = 4 * DPR; g2.strokeRect(9 * DPR, 9 * DPR, buf.x - 18 * DPR, buf.y - 18 * DPR);
  }

  // ---------- GIZ DE CERA e LOUSA ----------
  // os dois são "desenho à mão": contornos tremidos e preenchimento rabiscado que se redesenha 6x por segundo
  const SKETCH = {
    crayon: { bg: '#fbf8f1', grain: 'rgba(255,255,255,1)', alpha: 0.85, lw: 0.2, grass: '#7bc950', lake: '#3a9be0', deep: '#2a6fc4', sand: '#f5c451', tree: ['#2f9e44', '#69c35b', '#e8559c'], trunk: '#8a5a2b', rock: '#9a8f87', pad: '#3fae5a', fish: '#ff7b1c', line: '#3a2f2a', path: '#d9a35f', grassFill: true },
    chalk: { bg: '#22302a', grain: 'rgba(255,255,255,0.6)', alpha: 0.72, lw: 0.16, grass: '#cfe8b8', lake: '#a9d8f0', deep: '#7fb6e0', sand: '#f2e2a0', tree: ['#a8e0a0', '#d6f0c0', '#f4b6cf'], trunk: '#e8d0b0', rock: '#d8d4e0', pad: '#b8e8b0', fish: '#ffb38a', line: '#f2f2ea', path: '#f0d8b0', grassFill: false, gapK: 1.8 },
  };
  const sketchLake = lakeLoop(1.0, 90), sketchSand = lakeLoop(1.15, 90), sketchDeep = lakeLoop(0.6, 70);
  function roughPoly(ctx, pts, j, seed) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const dx = (hash2(i * 1.3 + seed, seed) - 0.5) * j, dz = (hash2(seed, i * 2.1 + seed) - 0.5) * j;
      i ? ctx.lineTo(p.x + dx, p.y + dz) : ctx.moveTo(p.x + dx, p.y + dz);
    });
    ctx.closePath();
  }
  const circlePts = (x, z, r, n = 16) => Array.from({ length: n }, (_, i) => ({ x: x + Math.cos(i / n * TAU) * r, y: z + Math.sin(i / n * TAU) * r }));
  function scribble(ctx, x0, z0, x1, z1, gap, ang, seed, amp) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.hypot(x1 - x0, z1 - z0) / 2 + 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.beginPath();
    let k = 0;
    for (let t = -R; t <= R; t += gap, k++) {
      for (let u = -R, i = 0; u <= R + 0.01; u += 0.7, i++) {
        const w = (hash2(k * 7.1 + seed, i * 3.3) - 0.5) * amp;
        const x = cx + ca * u - sa * (t + w), z = cz + sa * u + ca * (t + w);
        i ? ctx.lineTo(x, z) : ctx.moveTo(x, z);
      }
    }
    ctx.stroke();
  }
  // pinta uma forma: rabisco por dentro (recortado) e contorno tremido duas vezes
  function sketchShape(ctx, th, pts, fill, line, seed, gap, box) {
    ctx.save();
    roughPoly(ctx, pts, 0.15, seed); ctx.clip();
    ctx.strokeStyle = fill; ctx.lineWidth = th.lw * 1.3;
    scribble(ctx, box[0], box[1], box[2], box[3], gap * (th.gapK || 1), 0.6 + (seed % 3) * 0.4, seed, 0.25);
    ctx.restore();
    ctx.strokeStyle = line; ctx.lineWidth = th.lw * 0.7;
    roughPoly(ctx, pts, 0.18, seed + 1); ctx.stroke();
    roughPoly(ctx, pts, 0.22, seed + 2); ctx.stroke();
  }
  function sketchRender(dt, th) {
    const vis = begin2D(dt, th.bg), ctx = g2, boil = Math.floor(time * 6);
    ctx.globalAlpha = th.alpha; ctx.lineCap = ctx.lineJoin = 'round';
    const [bx0, bz0, bx1, bz1] = vis.box;
    if (th.grassFill) { ctx.strokeStyle = th.grass; ctx.lineWidth = th.lw; scribble(ctx, bx0, bz0, bx1, bz1, 0.75, 0.9, boil, 0.3); }
    else {
      ctx.strokeStyle = th.grass; ctx.lineWidth = th.lw * 0.6; ctx.beginPath();
      for (const f of flowers2) { if (!vis(f.x, f.z)) continue; ctx.moveTo(f.x - 0.2, f.z); ctx.lineTo(f.x - 0.05, f.z - 0.35); ctx.moveTo(f.x + 0.2, f.z); ctx.lineTo(f.x + 0.05, f.z - 0.35); }
      ctx.stroke();
    }
    for (const p of PATHS) { polyline(ctx, p); ctx.strokeStyle = th.path; ctx.lineWidth = 1.6; ctx.stroke(); }
    const lb = [lakeBox.x0 - 3, lakeBox.z0 - 3, lakeBox.x1 + 3, lakeBox.z1 + 3];
    sketchShape(ctx, th, sketchSand, th.sand, th.line, boil * 3 + 1, 0.5, lb);
    sketchShape(ctx, th, sketchLake, th.lake, th.line, boil * 3 + 2, 0.42, lb);
    ctx.save(); roughPoly(ctx, sketchDeep, 0.2, boil); ctx.clip(); ctx.strokeStyle = th.deep; ctx.lineWidth = th.lw * 1.2; scribble(ctx, lb[0], lb[1], lb[2], lb[3], 0.55 * (th.gapK || 1), -0.7, boil + 9, 0.3); ctx.restore();
    pads.forEach((p, i) => sketchShape(ctx, th, circlePts(p.x, p.z, p.r, 12), th.pad, th.line, boil * 5 + i, 0.3, [p.x - p.r, p.z - p.r, p.x + p.r, p.z + p.r]));
    rocks.forEach((r, i) => { if (vis(r.x, r.z)) { const s = r.s * 0.7; sketchShape(ctx, th, circlePts(r.x, r.z, s, 9), th.rock, th.line, boil * 7 + i, 0.3, [r.x - s, r.z - s, r.x + s, r.z + s]); } });
    for (const f of foods) if (f.on) { ctx.fillStyle = th.fish; ctx.beginPath(); ctx.arc(f.x, f.z, 0.2, 0, TAU); ctx.fill(); }
    // peixe desenhado à mão, com olho de bolinha e sorriso
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = 1 / FISH_SIZE;
      const outline = [];
      for (let i = 0; i <= N; i += 2) { const s = S[i]; outline.push({ x: s.x - s.ty * s.w, y: s.y + s.tx * s.w }); }
      for (let i = N; i >= 0; i -= 2) { const s = S[i]; outline.push({ x: s.x + s.ty * s.w, y: s.y - s.tx * s.w }); }
      ctx.save(); fishTailPath(ctx, S, N, amp); ctx.clip(); ctx.strokeStyle = th.fish; ctx.lineWidth = th.lw * w * 1.2; scribble(ctx, -4, -1.5, 0, 1.5, 0.22, 1.2, boil, 0.15); ctx.restore();
      ctx.strokeStyle = th.line; ctx.lineWidth = th.lw * 0.7 * w; fishTailPath(ctx, S, N, amp); ctx.stroke();
      sketchShape(ctx, { lw: th.lw * w }, outline, th.fish, th.line, boil * 11, 0.18, [-1.6, -0.8, 1.6, 0.8]);
      for (const sg of [1, -1]) {
        const p = at(0.08, sg, 0.5);
        ctx.fillStyle = th.line; ctx.beginPath(); ctx.arc(p.x, p.y, 0.07, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = th.line; ctx.lineWidth = th.lw * 0.6 * w;
      ctx.beginPath(); ctx.arc(S[0].x - 0.25, S[0].y, 0.14, -0.9, 0.9); ctx.stroke();
    });
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i], r = L.r * 0.95, c = L.pink ? th.tree[2] : th.tree[i % 2];
      sketchShape(ctx, th, circlePts(t.x, t.z, r, 14), c, th.line, boil * 13 + i, 0.32, [t.x - r, t.z - r, t.x + r, t.z + r]);
    });
    ctx.strokeStyle = th.line; ctx.lineWidth = th.lw * 0.5;
    for (const rg of rings2) { ctx.beginPath(); ctx.arc(rg.x, rg.z, 0.3 + rg.t * 2.2 * rg.big, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    overlay(pattern('sk' + th.bg, () => grain(th === SKETCH.chalk ? 0.12 : 0.18, 77)), 1);
    if (th === SKETCH.chalk) {
      g2.setTransform(1, 0, 0, 1, 0, 0);
      g2.strokeStyle = '#7a5532'; g2.lineWidth = 16 * DPR; g2.strokeRect(0, 0, buf.x, buf.y);
      if (buf.x / DPR >= 720) {
        g2.font = `${Math.round(30 * DPR)}px "Caveat", "Comic Sans MS", cursive`; g2.fillStyle = 'rgba(242, 242, 234, 0.85)'; g2.textAlign = 'center'; g2.textBaseline = 'alphabetic';
        g2.fillText('lição de hoje: o lago', buf.x / 2, buf.y - 34 * DPR);
      }
    } else if (buf.x / DPR >= 720) {
      // sol de desenho de criança no canto
      const [sx, sy] = [buf.x / 2 + 260 * DPR, buf.y - 70 * DPR];
      g2.setTransform(1, 0, 0, 1, 0, 0); g2.strokeStyle = '#f5b301'; g2.fillStyle = '#ffd43b'; g2.lineWidth = 4 * DPR; g2.lineCap = 'round';
      g2.beginPath(); g2.arc(sx, sy, 26 * DPR, 0, TAU); g2.fill();
      g2.beginPath();
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + time * 0.3; g2.moveTo(sx + Math.cos(a) * 34 * DPR, sy + Math.sin(a) * 34 * DPR); g2.lineTo(sx + Math.cos(a) * 48 * DPR, sy + Math.sin(a) * 48 * DPR); }
      g2.stroke();
    }
  }
