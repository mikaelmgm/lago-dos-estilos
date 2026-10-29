
  // ======================================================================
  // TERCEIRA LEVA: vitral, synthwave, cromo, ukiyo-e, terminal, raio-x, tricô, mosaico
  // ======================================================================
  const LAKE_GLSL = `
    float lakeR(float a) { return 1.0 + 0.10 * sin(3.0 * a + 0.7) + 0.06 * sin(5.0 * a + 2.1) + 0.035 * sin(7.0 * a + 4.0); }
    float lakeV(vec2 p) { vec2 d = p / vec2(${RX.toFixed(2)}, ${RZ.toFixed(2)}); return length(d) / lakeR(atan(d.y, d.x)); }
  `;
  const VERT_UV = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

  // ---------- VITRAL: o lago todo em peças de vidro, calculado na placa de vídeo ----------
  const NT = Math.max(1, trees.length);
  const glassMat = new T.ShaderMaterial({
    uniforms: {
      uView: { value: new T.Vector3() }, uRes: { value: buf }, uTime: U.uTime, uFish: { value: new T.Vector4() },
      uPads: rayU.uPads, uFood: rayU.uFood,
      uTrees: { value: Array.from({ length: NT }, (_, i) => trees[i] ? new T.Vector3(trees[i].x, trees[i].z, treeLook[i].r) : new T.Vector3(999, 999, 0.1)) },
    },
    vertexShader: VERT,
    fragmentShader: `
      #define NP ${NP}
      #define NT ${NT}
      #define FS ${FISH_SIZE.toFixed(2)}
      uniform vec3 uView;
      uniform vec2 uRes;
      uniform float uTime;
      uniform vec4 uFish;
      uniform vec3 uPads[NP];
      uniform vec4 uFood[3];
      uniform vec3 uTrees[NT];
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      ${LAKE_GLSL}
      // de que cor é o vidro neste ponto do mundo
      vec3 classify(vec2 p) {
        float c = cos(uFish.z), s = sin(uFish.z);
        vec2 q = p - uFish.xy;
        vec2 l = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / FS;
        l.y -= sin(uFish.w - (1.45 - l.x) * 1.6) * 0.2 * clamp((1.45 - l.x) / 2.7, 0.0, 1.4);
        if ((l.x - 0.15) * (l.x - 0.15) / 1.8 + l.y * l.y / 0.3 < 1.0) return (l.x > 0.7 && abs(l.y) < 0.28) ? vec3(1.0, 0.93, 0.8) : vec3(1.0, 0.38, 0.08);
        if (l.x < -1.2 && l.x > -2.3 && abs(l.y) < (-1.2 - l.x) * 0.8 + 0.1) return vec3(1.0, 0.68, 0.25);
        for (int i = 0; i < 3; i++) if (uFood[i].w > 0.5 && distance(p, uFood[i].xz) < 0.45) return vec3(1.0, 0.82, 0.2);
        for (int i = 0; i < NP; i++) if (distance(p, uPads[i].xy) < uPads[i].z) return vec3(0.25, 0.72, 0.3);
        float v = lakeV(p);
        if (v < 1.0) return mix(vec3(0.1, 0.25, 0.75), vec3(0.3, 0.62, 0.95), smoothstep(0.2, 1.0, v));
        for (int i = 0; i < NT; i++) if (distance(p, uTrees[i].xy) < uTrees[i].z) return mix(vec3(0.08, 0.4, 0.18), vec3(0.85, 0.3, 0.45), step(0.86, hash(uTrees[i].xy)));
        if (v < 1.15) return vec3(0.95, 0.75, 0.3);
        return mix(vec3(0.3, 0.6, 0.18), vec3(0.6, 0.78, 0.22), hash(floor(p * 0.4)));
      }
      void main() {
        vec2 px = vUv * uRes;
        vec2 p = uView.xy + (px - uRes * 0.5) * vec2(1.0, -1.0) / uView.z;
        vec2 g = p / 0.95, gi = floor(g), best = vec2(0.0);
        float d1 = 9.0, d2 = 9.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 cc = gi + vec2(float(i), float(j));
          vec2 site = cc + 0.15 + 0.7 * vec2(hash(cc), hash(cc + 17.3));
          float d = distance(g, site);
          if (d < d1) { d2 = d1; d1 = d; best = site; } else if (d < d2) d2 = d;
        }
        vec3 col = classify(best * 0.95);
        float edge = d2 - d1;
        float lead = 1.0 - smoothstep(0.05, 0.09, edge);
        col *= 0.78 + 0.38 * hash(best * 7.0);
        col *= 0.85 + 0.25 * sin(p.x * 0.3 + p.y * 0.2 + uTime * 0.5);
        col += 0.14 * (1.0 - smoothstep(0.0, 0.35, d1)) + 0.05 * hash(floor(px * 0.5));
        vec3 leadC = vec3(0.12, 0.12, 0.14) + 0.18 * (1.0 - smoothstep(0.0, 0.03, abs(edge - 0.035)));
        gl_FragColor = vec4(mix(col, leadC, lead), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  function glassEnter() { screenToWorld = flatToWorld; view2.x = F.x * 0.6; view2.z = F.z * 0.6; }
  function glassExit() { screenToWorld = null; }
  function glassRender(dt) {
    follow2(dt);
    view2.s = buf.x / (aspect >= 1 ? 40 : 24);
    glassMat.uniforms.uView.value.set(view2.x, view2.z, view2.s);
    glassMat.uniforms.uFish.value.set(F.x, F.z, F.heading, F.phase);
    foods.forEach((f, i) => rayU.uFood.value[i].set(f.x, f.y, f.z, f.on ? 1 : 0));
    pass(glassMat, null);
  }

  // ---------- SYNTHWAVE: grade neon, lago espelhado e sol listrado no horizonte ----------
  const synthWorld = new T.Group();
  synthWorld.visible = false;
  scene.add(synthWorld);
  const fishSyn = new T.Group();
  fishSyn.visible = false;
  fish.add(fishSyn);
  const synth = { built: false, food: [] };
  const wire = (c) => new T.MeshBasicMaterial({ color: c, wireframe: true });
  function buildSynth() {
    if (synth.built) return;
    synth.built = true;
    const floor = new T.Mesh(new T.PlaneGeometry(700, 700), new T.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      vertexShader: waterMat.vertexShader,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vW;
        ${LAKE_GLSL}
        float gl1(float x, float w) { float d = abs(fract(x + 0.5) - 0.5); return 1.0 - smoothstep(w * 0.5, w, d); }
        void main() {
          vec2 p = vW.xz;
          float v = lakeV(p), dist = length(p - cameraPosition.xz), w = 0.04 + dist * 0.0012;
          float g = max(gl1(p.x / 2.0, w), gl1(p.y / 2.0 + uTime * 0.3, w));
          vec3 c = vec3(0.07, 0.0, 0.13) + vec3(1.0, 0.17, 0.84) * g;
          if (v < 1.0) c = vec3(0.02, 0.0, 0.08) + vec3(0.09, 0.94, 1.0) * gl1(v * 7.0 - uTime * 0.4, 0.08) * 0.75;
          c += vec3(0.09, 0.94, 1.0) * (1.0 - smoothstep(0.0, 0.025, abs(v - 1.0))) * 1.6;
          gl_FragColor = vec4(c * exp(-dist * 0.004), 1.0);
        }`,
    }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2;
    synthWorld.add(floor);
    synth.horizon = new T.Group();
    synthWorld.add(synth.horizon);
    const sky = new T.Mesh(new T.PlaneGeometry(1400, 420), new T.ShaderMaterial({
      vertexShader: VERT_UV, depthWrite: false,
      fragmentShader: `
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 c = mix(vec3(1.0, 0.25, 0.55) * 0.75, vec3(0.07, 0.0, 0.14), smoothstep(0.0, 0.55, vUv.y));
          c += step(0.997, hash(floor(vUv * vec2(700.0, 210.0)))) * smoothstep(0.3, 0.8, vUv.y);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.position.set(0, 160, -330);
    const sunD = new T.Mesh(new T.PlaneGeometry(170, 170), new T.ShaderMaterial({
      uniforms: { uTime: U.uTime }, vertexShader: VERT_UV,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 q = vUv - 0.5;
          if (length(q) > 0.5) discard;
          float y = vUv.y;
          if (y < 0.47 && fract(y * 13.0 + uTime * 0.15) < (0.47 - y) * 1.9) discard;
          gl_FragColor = vec4(mix(vec3(1.0, 0.12, 0.55), vec3(1.0, 0.86, 0.25), y), 1.0);
        }`,
    }));
    sunD.position.set(0, 26, -300);
    synth.horizon.add(sky, sunD);
    const mr = mulberry32(9);
    for (let i = 0; i < 9; i++) {
      const h = 22 + mr() * 30, m = new T.Mesh(new T.ConeGeometry(h * 1.4, h, 4, 3), wire(i % 2 ? 0xff2bd6 : 0x8a3bff));
      m.position.set(-240 + i * 60 + mr() * 20, -2 + h / 2, -230 - mr() * 40); m.rotation.y = mr();
      synth.horizon.add(m);
    }
    const inst = (geo, list, c, place) => {
      const m = new T.InstancedMesh(geo, wire(c), list.length);
      list.forEach((it, i) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); place(it, dummy); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
      m.frustumCulled = false; synthWorld.add(m);
    };
    inst(new T.ConeGeometry(1.4, 3.6, 6, 2), trees, 0x16f0ff, (t, d) => d.position.set(t.x, -2 + 1.8, t.z));
    inst(new T.OctahedronGeometry(0.8, 0), rocks, 0xa66bff, (r, d) => { d.position.set(r.x, r.wet ? WATER_Y : -1.4, r.z); d.scale.setScalar(r.s); });
    inst(new T.CircleGeometry(1, 14).rotateX(-Math.PI / 2), pads, 0x3dff7a, (p, d) => { d.position.set(p.x, WATER_Y, p.z); d.scale.set(p.r, 1, p.r); });
    for (let i = 0; i < foods.length; i++) { const m = new T.Mesh(new T.OctahedronGeometry(0.28, 0), wire(0xffd23f)); synthWorld.add(m); synth.food.push(m); }
    const body = new T.Mesh(new T.SphereGeometry(0.5, 12, 8), wire(0xff7a2f));
    body.scale.set(2.5, 0.9, 1.0); body.position.x = 0.15;
    const tailS = new T.Group();
    tailS.position.x = -1.0;
    const fin = new T.Mesh(new T.ConeGeometry(0.55, 1.0, 4), wire(0xff3fa4));
    fin.rotation.z = Math.PI / 2; fin.scale.set(1, 1, 0.25); fin.position.x = -0.45;
    tailS.add(fin);
    fishSyn.add(body, tailS);
    tailExtra.push(tailS);
  }
  const synthHide = [voxelWorld, reedMesh, weedMesh, headMesh, bubMesh, foodMesh, water];
  function synthEnter() {
    buildSynth();
    synthHide.forEach(o => { o.visible = false; });
    synthWorld.visible = true; fishVox.visible = false; fishSyn.visible = true;
    camMode = 'low';
    renderer.setClearColor(0x12001f, 0);
  }
  function synthExit() {
    synthHide.forEach(o => { o.visible = true; });
    synthWorld.visible = false; fishVox.visible = true; fishSyn.visible = false;
    camMode = '';
    renderer.setClearColor(0x4f8a3a, 0);
  }
  function synthRender() {
    synth.horizon.position.set(camT.x, 0, camT.z);
    foods.forEach((f, i) => { synth.food[i].visible = f.on; synth.food[i].position.set(f.x, f.y + 0.3, f.z); synth.food[i].rotation.y = time * 2; });
    renderWorld();
    vecShow.uniforms.tIn.value = rtScene.texture;
    pass(vecShow, null);
  }

  // ---------- CROMO HOLOGRÁFICO: o mundo arredondado em metal que muda de cor ----------
  const HOLO_VS = `
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vW;
    void main() {
      mat4 m = modelMatrix;
      #ifdef USE_INSTANCING
        m = m * instanceMatrix;
      #endif
      vec4 wp = m * vec4(position, 1.0);
      vN = normalize((m * vec4(normal, 0.0)).xyz);
      vV = cameraPosition - wp.xyz;
      vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  function holoMaterial(dark, alpha = 1) {
    return new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uDark: { value: dark }, uAlpha: { value: alpha } },
      vertexShader: HOLO_VS, transparent: alpha < 1, depthWrite: alpha >= 1,
      fragmentShader: `
        uniform float uTime;
        uniform float uDark;
        uniform float uAlpha;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vW;
        vec3 spectrum(float t) { return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }
        void main() {
          vec3 n = normalize(vN), v = normalize(vV), r = reflect(-v, n);
          float f = 1.0 - clamp(dot(n, v), 0.0, 1.0);
          vec3 env = mix(vec3(0.06, 0.06, 0.1), vec3(0.95, 0.97, 1.0), smoothstep(-0.2, 0.6, r.y));
          env += smoothstep(0.93, 1.0, abs(sin(r.x * 3.0 + r.z * 2.0 + uTime * 0.2))) * 0.7;
          vec3 holo = spectrum(f * 1.4 + dot(n, vec3(0.3, 0.5, 0.2)) + vW.x * 0.03 + vW.z * 0.02 + uTime * 0.05);
          vec3 c = mix(env, env * holo * 1.6, 0.65) + pow(f, 3.0) * holo * 0.6;
          c = mix(c, c * 0.16 + holo * 0.06, uDark);
          gl_FragColor = vec4(c, uAlpha);
        }`,
    });
  }
  const holo = { obj: holoMaterial(0), ground: holoMaterial(0.96), water: holoMaterial(0.4, 0.55), saved: new Map() };
  function holoSwap(on) {
    for (const root of [celWorld, fishCel]) root.traverse((o) => {
      if (!o.isMesh) return;
      if (on) {
        holo.saved.set(o, [o.material, o.visible]);
        if (o.material.type === 'ShaderMaterial' && o.material.side === T.BackSide) o.visible = false;
        else o.material = o.material.vertexColors ? holo.ground : holo.obj;
      } else if (holo.saved.has(o)) {
        const [m, vis] = holo.saved.get(o);
        o.material = m; o.visible = vis;
      }
    });
    if (!on) holo.saved.clear();
  }
  function holoEnter() { celEnter(); holoSwap(true); water.material = holo.water; renderer.setClearColor(0x0b0b12, 0); }
  function holoExit() { holoSwap(false); celExit(); }
  function holoRender(dt) {
    copyInst(cel.reeds, reedMesh); copyInst(cel.weeds, weedMesh); copyInst(cel.heads, headMesh);
    copyInst(cel.bub, bubMesh); copyInst(cel.food, foodMesh);
    renderWorld();
    finish(rtScene.texture, 0.4, 0);
  }

  // ---------- UKIYO-E: xilogravura japonesa ----------
  const UK = { paper: '#efe2c4', ink: '#1d1a20', blue: '#1f3f73', foam: '#f4ead2', red: '#c8402b', green: '#4f7a4a', green2: '#7a9a5a', sand: '#d9b97a', koi: '#e0552b' };
  let seigaiha = null;
  function seigaihaTile(R) {
    return tile(R * 2, R, (x, w, h) => {
      x.fillStyle = UK.blue; x.fillRect(0, 0, w, h);
      for (const [cx, cy] of [[0, 0], [w, 0], [w / 2, h / 2], [0, h], [w, h]]) {
        for (let k = 4; k >= 1; k--) {
          x.beginPath(); x.arc(cx, cy, R * k / 4.2, 0, TAU);
          x.fillStyle = k % 2 ? UK.foam : UK.blue; x.fill();
        }
      }
    });
  }
  function ukiyoRender(dt) {
    const vis = begin2D(dt, UK.paper), ctx = g2, lp = DPR / view2.s, [bx0, bz0, bx1, bz1] = vis.box;
    overlay(pattern('paper4', () => grain(0.07, 61)));
    ctx.fillStyle = 'rgba(122, 154, 90, 0.35)'; ctx.fillRect(bx0, bz0, bx1 - bx0, bz1 - bz0);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const p of PATHS) { polyline(ctx, p); ctx.strokeStyle = UK.ink; ctx.lineWidth = 2.0; ctx.stroke(); ctx.strokeStyle = UK.sand; ctx.lineWidth = 2.0 - 4 * lp; ctx.stroke(); }
    ctx.fillStyle = UK.sand; ctx.fill(LAKE2.sand);
    ctx.strokeStyle = UK.ink; ctx.lineWidth = 2 * lp; ctx.stroke(LAKE2.sand);
    // água em ondas de escamas (seigaiha)
    const R = Math.round(view2.s * 1.1);
    if (!seigaiha || seigaiha.R !== R) seigaiha = { R, p: g2.createPattern(seigaihaTile(R), 'repeat') };
    ctx.save();
    ctx.clip(LAKE2.shore);
    const [ox, oy] = toScreen2D(0, 0);
    seigaiha.p.setTransform(new DOMMatrix([1, 0, 0, 1, ox % (R * 2), oy % R]));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.92; ctx.fillStyle = seigaiha.p; ctx.fillRect(0, 0, buf.x, buf.y);
    ctx.restore();
    ctx.strokeStyle = UK.foam; ctx.lineWidth = 0.35; ctx.setLineDash([0.25, 0.55]); ctx.lineDashOffset = -time * 0.4; ctx.stroke(LAKE2.b1); ctx.setLineDash([]);
    ctx.strokeStyle = UK.ink; ctx.lineWidth = 3 * lp; ctx.stroke(LAKE2.shore);
    // peixe com contorno de entalhe, escamas e nadadeiras raiadas
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = lp / FISH_SIZE;
      fishTailPath(ctx, S, N, amp); ctx.fillStyle = '#f0a070'; ctx.fill(); ctx.strokeStyle = UK.ink; ctx.lineWidth = 2 * w; ctx.stroke();
      ctx.fillStyle = UK.koi; ctx.fill(body);
      ctx.save(); ctx.clip(body);
      ctx.strokeStyle = 'rgba(29, 26, 32, 0.5)'; ctx.lineWidth = w;
      for (let i = 3; i < N; i++) { const s = S[i], a = Math.atan2(s.ty, s.tx); for (const off of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(s.x - s.ty * s.w * off, s.y + s.tx * s.w * off, s.w * 0.32, a + Math.PI / 2, a + Math.PI * 1.5); ctx.stroke(); } }
      const s = S[4]; ctx.fillStyle = UK.foam; ctx.beginPath(); ctx.ellipse(s.x, s.y, 0.42, 0.25, Math.atan2(s.ty, s.tx), 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = UK.ink; ctx.lineWidth = 2.5 * w; ctx.stroke(body);
      ctx.fillStyle = UK.ink; for (const sg of [1, -1]) { const p = at(0.06, sg, 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 0.08, 0, TAU); ctx.fill(); }
    });
    pads.forEach((p, i) => {
      const n = padLook[i];
      ctx.beginPath(); ctx.moveTo(p.x, p.z); ctx.arc(p.x, p.z, p.r, n + 0.35, n - 0.35 + TAU); ctx.closePath();
      ctx.fillStyle = UK.green; ctx.fill(); ctx.strokeStyle = UK.ink; ctx.lineWidth = 2 * lp; ctx.stroke();
      if (p.flower) { ctx.fillStyle = '#e88aa0'; ctx.beginPath(); ctx.arc(p.x, p.z, 0.3, 0, TAU); ctx.fill(); ctx.stroke(); }
    });
    rocks.forEach((r, i) => {
      if (!vis(r.x, r.z)) return;
      blobPath(ctx, r.x, r.z, r.s * 0.75, rockLook[i].k); ctx.fillStyle = '#7d8a9a'; ctx.fill(); ctx.strokeStyle = UK.ink; ctx.lineWidth = 2 * lp; ctx.stroke();
    });
    // pinheiros vistos de cima, em camadas de nuvem
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i], r = L.r;
      for (let k = 0; k < 4; k++) {
        const a = L.a + k * 1.7, x = t.x + Math.cos(a) * r * 0.45, z = t.z + Math.sin(a) * r * 0.45, rr = r * (0.55 - k * 0.05);
        ctx.beginPath(); ctx.ellipse(x, z, rr * 1.3, rr * 0.8, a, 0, TAU);
        ctx.fillStyle = L.pink ? '#e9a3b4' : k % 2 ? UK.green : UK.green2; ctx.fill(); ctx.strokeStyle = UK.ink; ctx.lineWidth = 1.8 * lp; ctx.stroke();
      }
    });
    for (const f of foods) if (f.on) { ctx.fillStyle = UK.red; ctx.beginPath(); ctx.arc(f.x, f.z, 0.18, 0, TAU); ctx.fill(); }
    // faixas de nuvem estilizadas, passando devagar
    for (let k = 0; k < 3; k++) {
      const z = -18 + k * 16, x = ((time * 0.6 + k * 23) % 90) - 45;
      ctx.beginPath(); ctx.moveTo(x - 5, z); ctx.lineTo(x + 5, z);
      ctx.strokeStyle = UK.ink; ctx.lineWidth = 0.8 + 4 * lp; ctx.stroke();
      ctx.strokeStyle = '#f6efdc'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // cartela vermelha com o título na vertical
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const cw = 34 * DPR, chh = 96 * DPR, cx = 18 * DPR, cy = buf.y - chh - 76 * DPR;
    g2.fillStyle = UK.red; g2.fillRect(cx, cy, cw, chh); g2.strokeStyle = UK.ink; g2.lineWidth = 1.5 * DPR; g2.strokeRect(cx, cy, cw, chh);
    g2.fillStyle = UK.paper; g2.font = `700 ${Math.round(22 * DPR)}px "Yu Mincho", "MS Mincho", "Hiragino Mincho ProN", serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    [...'鯉の池'].forEach((chr, i) => g2.fillText(chr, cx + cw / 2, cy + 18 * DPR + i * 28 * DPR));
  }

  // ---------- TERMINAL VERDE: o jogo inteiro em texto, num monitor de fósforo ----------
  const term = { key: '' };
  // tipos: 0 grama, 1 água, 2 água funda, 3 areia, 4 trilha, 5 árvore, 6 pedra, 7 folha d'água, 8 píer, 9 flor
  function termMap(cellW, cellH) {
    const key = cellW.toFixed(4) + ':' + cellH.toFixed(4);
    if (term.key === key) return;
    term.key = key;
    const cols = Math.ceil((X1 - X0) / cellW), rows = Math.ceil((Z1 - Z0) / cellH), m = new Uint8Array(cols * rows);
    const ds = dock.len;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = X0 + (i + 0.5) * cellW, z = Z0 + (j + 0.5) * cellH, v = lakeV(x, z);
      let t = v < 0.6 ? 2 : v < 1 ? 1 : v < 1.13 ? 3 : isPath(x, z) ? 4 : 0;
      const dx = x - dockLand.x, dz = z - dockLand.z, s = dx * dock.ux + dz * dock.uz, q = -dx * dock.uz + dz * dock.ux;
      if (s > -0.3 && s < ds + 0.3 && Math.abs(q) < 1.15) t = 8;
      for (const p of pads) if (Math.hypot(x - p.x, z - p.z) < p.r) t = 7;
      for (const r of rocks) if (Math.hypot(x - r.x, z - r.z) < r.s * 0.7) t = 6;
      if (t === 0) for (let k = 0; k < trees.length; k++) if (Math.hypot(x - trees[k].x, z - trees[k].z) < treeLook[k].r) { t = 5; break; }
      if (t === 0 && hash2(i, j) < 0.03) t = 9;
      m[j * cols + i] = t;
    }
    Object.assign(term, { cols, rows, m, cellW, cellH });
  }
  const TERM_COL = ['#1f8a3a', '#3fd06a', '#b0ffc2'];
  function termRender(dt) {
    follow2(dt); ringsTick(dt);
    view2.s = buf.x / (aspect >= 1 ? 40 : 24);
    const ctx = g2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#031006'; ctx.fillRect(0, 0, buf.x, buf.y);
    ctx.font = `${Math.round(19 * DPR)}px "VT323", "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const cw = ctx.measureText('M').width, ch = Math.round(19 * DPR);
    termMap(cw / view2.s, ch / view2.s);
    const cols = Math.ceil(buf.x / cw), rows = Math.ceil(buf.y / ch) - 1;
    const oi = Math.round((view2.x - X0) / term.cellW - cols / 2), oj = Math.round((view2.z - Z0) / term.cellH - rows / 2);
    const tick = Math.floor(time * 3);
    const lines = [[], [], []];
    for (let j = 0; j < rows; j++) {
      const row = [new Array(cols).fill(' '), new Array(cols).fill(' '), new Array(cols).fill(' ')];
      for (let i = 0; i < cols; i++) {
        const gi = i + oi, gj = j + oj;
        if (gi < 0 || gj < 0 || gi >= term.cols || gj >= term.rows) continue;
        const t = term.m[gj * term.cols + gi], h = hash2(gi, gj);
        let c = ' ', lv = 0;
        if (t === 0) { c = h < 0.25 ? '.' : h < 0.32 ? ',' : h < 0.36 ? '"' : ' '; }
        else if (t === 1 || t === 2) { const w = (gi + gj * 2 + tick) % 4; c = w === 0 ? '~' : w === 2 ? '-' : ' '; lv = t === 2 ? 1 : 0; if (t === 1 && w === 1) c = '~'; }
        else if (t === 3) { c = h < 0.5 ? ':' : '.'; }
        else if (t === 4) { c = '='; lv = 1; }
        else if (t === 5) { c = h < 0.5 ? '&' : '#'; lv = 1; }
        else if (t === 6) { c = 'o'; lv = 1; }
        else if (t === 7) { c = h < 0.3 ? '@' : 'O'; lv = 1; }
        else if (t === 8) { c = '#'; lv = 2; }
        else if (t === 9) { c = '*'; lv = 1; }
        row[lv][i] = c;
      }
      // peixe, ração e bolhas por cima
      for (let l = 0; l < 3; l++) lines[l].push(row[l]);
    }
    const put = (x, z, str, lv) => {
      const i0 = Math.round((x - X0) / term.cellW) - oi, j0 = Math.round((z - Z0) / term.cellH) - oj;
      if (j0 < 0 || j0 >= rows) return;
      for (let k = 0; k < str.length; k++) {
        const i = i0 + k;
        if (i < 0 || i >= cols) continue;
        for (let l = 0; l < 3; l++) lines[l][j0][i] = ' ';
        lines[lv][j0][i] = str[k];
      }
    };
    for (const b of bubbles) if (b.on) put(b.x, b.z, 'o', 1);
    for (const f of foods) if (f.on) put(f.x, f.z, '+', 2);
    const right = Math.cos(F.heading) >= 0, spr = right ? '><(((°>' : '<°)))><';
    put(F.x - (right ? 1 : 0.6) * (spr.length * term.cellW) / 2, F.z, spr, 2);
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = TERM_COL[l];
      ctx.shadowColor = TERM_COL[2]; ctx.shadowBlur = l === 2 ? 8 * DPR : 0;
      for (let j = 0; j < rows; j++) ctx.fillText(lines[l][j].join(''), 0, j * ch);
    }
    ctx.shadowBlur = 0;
    // linha de status embaixo, invertida
    const y = rows * ch, status = ` LAGO.EXE  PEIXE X:${F.x.toFixed(1).padStart(5)} Z:${F.z.toFixed(1).padStart(5)}  PETISCOS:${String(score).padStart(3, '0')}  [Q/E] ESTILO `;
    ctx.fillStyle = TERM_COL[2]; ctx.fillRect(0, y, buf.x, ch + 2 * DPR);
    ctx.fillStyle = '#031006'; ctx.fillText(status + (Math.floor(time * 2) % 2 ? '█' : ' '), 0, y + DPR);
    overlay(pattern('scan' + DPR, () => tile(4, 3 * DPR, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(0, 0, w, Math.max(1, DPR)); })));
    const vg = ctx.createRadialGradient(buf.x / 2, buf.y / 2, Math.min(buf.x, buf.y) * 0.3, buf.x / 2, buf.y / 2, Math.max(buf.x, buf.y) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, buf.x, buf.y);
  }

  // ---------- RAIO-X: tudo translúcido, com os ossos do peixe à mostra ----------
  function xrayRender(dt) {
    const vis = begin2D(dt, '#04101e'), ctx = g2, lp = DPR / view2.s;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(80, 160, 255, 0.07)';
    for (const p of [LAKE2.sand, LAKE2.shore, LAKE2.b1, LAKE2.b2]) ctx.fill(p);
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.35)'; ctx.lineWidth = 1.5 * lp; ctx.stroke(LAKE2.shore);
    const bone = 'rgba(225, 245, 255, 0.85)', soft = 'rgba(120, 190, 255, 0.16)';
    pads.forEach((p, i) => {
      ctx.fillStyle = soft; ctx.beginPath(); ctx.arc(p.x, p.z, p.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190, 235, 255, 0.55)'; ctx.lineWidth = lp; ctx.beginPath();
      for (let k = 0; k < 9; k++) { const a = padLook[i] + 0.4 + k / 9 * (TAU - 0.8); ctx.moveTo(p.x, p.z); ctx.lineTo(p.x + Math.cos(a) * p.r * 0.92, p.z + Math.sin(a) * p.r * 0.92); }
      ctx.stroke();
    });
    rocks.forEach((r, i) => { if (vis(r.x, r.z)) { blobPath(ctx, r.x, r.z, r.s * 0.7, rockLook[i].k); ctx.fillStyle = 'rgba(200, 230, 255, 0.35)'; ctx.fill(); } });
    trees.forEach((t, i) => {
      if (!vis(t.x, t.z)) return;
      const L = treeLook[i];
      ctx.fillStyle = soft; ctx.beginPath(); ctx.arc(t.x, t.z, L.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190, 235, 255, 0.5)'; ctx.lineWidth = 1.2 * lp; ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = L.a + k / 6 * TAU, mx = t.x + Math.cos(a) * L.r * 0.55, mz = t.z + Math.sin(a) * L.r * 0.55;
        ctx.moveTo(t.x, t.z); ctx.lineTo(mx, mz);
        for (const sg of [-0.5, 0.5]) { ctx.moveTo(mx, mz); ctx.lineTo(mx + Math.cos(a + sg) * L.r * 0.4, mz + Math.sin(a + sg) * L.r * 0.4); }
      }
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(180, 230, 255, 0.5)'; ctx.lineWidth = 1.2 * lp; ctx.beginPath();
    for (const r of reeds) { ctx.moveTo(r.x, r.z); ctx.lineTo(r.x + Math.sin(time * 1.3 + r.ph) * 0.15 * r.h, r.z - r.h * 0.35); }
    ctx.stroke();
    for (const f of foods) if (f.on) { ctx.fillStyle = bone; ctx.beginPath(); ctx.arc(f.x, f.z, 0.15, 0, TAU); ctx.fill(); }
    // o peixe: carne translúcida e esqueleto
    inFish(ctx, () => {
      const amp = fishAmp(), { N, S, body, at } = fishBody(amp), w = lp / FISH_SIZE;
      fishTailPath(ctx, S, N, amp); ctx.fillStyle = soft; ctx.fill();
      ctx.fillStyle = 'rgba(120, 190, 255, 0.22)'; ctx.fill(body);
      ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = 8 * DPR;
      ctx.strokeStyle = bone; ctx.lineCap = 'round';
      ctx.lineWidth = 3.5 * w; ctx.beginPath();
      for (let i = 1; i <= N; i++) i === 1 ? ctx.moveTo(S[i].x, S[i].y) : ctx.lineTo(S[i].x, S[i].y);
      ctx.stroke();
      ctx.lineWidth = 1.6 * w; ctx.beginPath();
      for (let i = 3; i <= 11; i++) {
        const s = S[i];
        for (const sg of [1, -1]) { ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(s.x - s.ty * s.w * 0.6 * sg - s.tx * 0.1, s.y + s.tx * s.w * 0.6 * sg - s.ty * 0.1, s.x - s.ty * s.w * 0.9 * sg - s.tx * 0.3, s.y + s.tx * s.w * 0.9 * sg - s.ty * 0.3); }
      }
      ctx.stroke();
      ctx.lineWidth = 2 * w; ctx.beginPath(); ctx.ellipse(S[1].x - 0.05, S[1].y, 0.35, S[1].w * 0.9 + 0.1, Math.atan2(S[1].ty, S[1].tx), 0, TAU); ctx.stroke();
      for (const sg of [1, -1]) { const p = at(0.06, sg, 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 0.08, 0, TAU); ctx.stroke(); }
      const e = S[N], ta = Math.atan2(e.ty, e.tx) + Math.sin(F.phase - 1.1) * amp * 1.4;
      ctx.lineWidth = w; ctx.beginPath();
      for (let k = -3; k <= 3; k++) { const a = ta + Math.PI + k * 0.22; ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 0.95, e.y + Math.sin(a) * 0.95); }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.globalCompositeOperation = 'source-over';
    overlay(pattern('film', () => grain(0.08, 91)));
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.font = `800 ${Math.round(28 * DPR)}px "JetBrains Mono", monospace`; g2.fillStyle = 'rgba(220, 240, 255, 0.75)'; g2.textAlign = 'left'; g2.textBaseline = 'alphabetic';
    g2.fillText('R', 22 * DPR, buf.y - 84 * DPR);
    g2.font = `700 ${Math.round(11 * DPR)}px "JetBrains Mono", monospace`;
    g2.fillText('KOI · DORSAL · 60 kV', 52 * DPR, buf.y - 88 * DPR);
  }

  // ---------- TRICÔ e MOSAICO ROMANO: o mundo de pixel art feito de lã ou de pedrinhas ----------
  function groupCells(img, lw, lh, S, levels) {
    const groups = new Map();
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const o = (y * lw + x) * 4;
      let r = img[o], g = img[o + 1], b = img[o + 2];
      if (levels) {
        const k = 0.86 + Math.floor(hash2(x + pix.ox, y + pix.oy) * levels) * (0.24 / (levels - 1));
        r = Math.min(255, r * k) | 0; g = Math.min(255, g * k) | 0; b = Math.min(255, b * k) | 0;
      }
      const key = (r << 16) | (g << 8) | b;
      let arr = groups.get(key);
      if (!arr) groups.set(key, arr = []);
      arr.push(x * S, y * S, x, y);
    }
    return groups;
  }
  function knitRender(dt) {
    const S = Math.max(6, Math.round(buf.x / 105)), [lw, lh] = pixDraw(dt, S);
    const groups = groupCells(pix.lc.getImageData(0, 0, lw, lh).data, lw, lh, S, 0), ctx = g2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a1f1a'; ctx.fillRect(0, 0, buf.x, buf.y);
    ctx.lineCap = 'round'; ctx.lineWidth = S * 0.36;
    // cada pixel vira um "V" de tricô: duas pernas de lã inclinadas
    for (const [key, a] of groups) {
      ctx.strokeStyle = hexStr(key);
      ctx.beginPath();
      for (let i = 0; i < a.length; i += 4) { const x = a[i], y = a[i + 1]; ctx.moveTo(x + S * 0.18, y + S * 0.12); ctx.lineTo(x + S * 0.5, y + S * 0.92); ctx.moveTo(x + S * 0.82, y + S * 0.12); ctx.lineTo(x + S * 0.5, y + S * 0.92); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = S * 0.1; ctx.beginPath();
    for (const a of groups.values()) for (let i = 0; i < a.length; i += 4) { const x = a[i], y = a[i + 1]; ctx.moveTo(x + S * 0.24, y + S * 0.2); ctx.lineTo(x + S * 0.42, y + S * 0.6); ctx.moveTo(x + S * 0.76, y + S * 0.2); ctx.lineTo(x + S * 0.6, y + S * 0.6); }
    ctx.stroke();
  }
  function mosaicRender(dt) {
    const S = Math.max(5, Math.round(buf.x / 125)), [lw, lh] = pixDraw(dt, S);
    const groups = groupCells(pix.lc.getImageData(0, 0, lw, lh).data, lw, lh, S, 3), ctx = g2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#d8cfc0'; ctx.fillRect(0, 0, buf.x, buf.y);
    // pedrinhas quadradas, cada uma um pouco torta e de tamanho diferente
    for (const [key, a] of groups) {
      ctx.fillStyle = hexStr(key);
      ctx.beginPath();
      for (let i = 0; i < a.length; i += 4) {
        const gx = a[i + 2] + pix.ox, gy = a[i + 3] + pix.oy, h1 = hash2(gx, gy), h2 = hash2(gy + 3.1, gx);
        const cx = a[i] + S / 2 + (h1 - 0.5) * S * 0.12, cy = a[i + 1] + S / 2 + (h2 - 0.5) * S * 0.12;
        const half = S * (0.39 + h2 * 0.06), ang = (h1 - 0.5) * 0.3, c = Math.cos(ang) * half, s = Math.sin(ang) * half;
        ctx.moveTo(cx - c + s, cy - s - c); ctx.lineTo(cx + c + s, cy + s - c); ctx.lineTo(cx + c - s, cy + s + c); ctx.lineTo(cx - c - s, cy - s + c); ctx.closePath();
      }
      ctx.fill();
    }
    overlay(pattern('stone', () => grain(0.12, 13)), 1);
  }
