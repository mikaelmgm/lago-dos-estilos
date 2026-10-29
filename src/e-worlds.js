
  // ---------- low poly: outro cenário, facetado, com câmera isométrica ----------
  const lowWorld = new T.Group();
  lowWorld.visible = false;
  scene.add(lowWorld);
  const fishLow = new T.Group();
  fishLow.visible = false;
  fish.add(fishLow);
  let lowBuilt = false;
  function flatGeo(g) { const n = g.toNonIndexed(); n.computeVertexNormals(); return n; }
  function lowHeight(x, z) {
    const v = lakeV(x, z);
    if (v < 1) return -0.45 - 2.4 * smooth((1 - v) / 0.45);
    if (v < 1.12) return -0.06;
    return Math.max(0, (vnoise(x * 0.09, z * 0.09) - 0.35) * 2.6 * smooth((v - 1.15) / 0.7));
  }
  function buildLow() {
    if (lowBuilt) return;
    lowBuilt = true;
    const lr = mulberry32(55);
    const lj = (c, a) => { const o = {}; c.getHSL(o); return new T.Color().setHSL(o.h + (lr() - 0.5) * a * 0.1, o.s, clamp(o.l + (lr() - 0.5) * a, 0, 1)); };
    const lowMat = (id, extra) => new T.MeshLambertMaterial(Object.assign({ opacity: idAlpha(id) }, extra));

    const g = new T.PlaneGeometry(X1 - X0, Z1 - Z0, 46, 35);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (lr() - 0.5) * 0.7, z = p.getZ(i) + (lr() - 0.5) * 0.7;
      p.setX(i, x); p.setZ(i, z); p.setY(i, lowHeight(x, z));
    }
    const tg = flatGeo(g), tp = tg.attributes.position, colors = new Float32Array(tp.count * 3);
    const GR1 = col(0xa3d07f), GR2 = col(0x8fc46f), SANDL = col(0xf1dcae), BED = col(0x9fd3c7), DEEP = col(0x5f9fb0), HILL = col(0xd8e8a0);
    for (let f = 0; f < tp.count; f += 3) {
      const y = (tp.getY(f) + tp.getY(f + 1) + tp.getY(f + 2)) / 3;
      let c;
      if (y < -0.3) c = BED.clone().lerp(DEEP, clamp((-y - 0.45) / 2.2, 0, 1));
      else if (y < -0.02) c = SANDL.clone();
      else c = (lr() < 0.5 ? GR1 : GR2).clone().lerp(HILL, clamp(y / 2.5, 0, 0.5));
      c = lj(c, 0.05);
      for (let k = 0; k < 3; k++) { colors[(f + k) * 3] = c.r; colors[(f + k) * 3 + 1] = c.g; colors[(f + k) * 3 + 2] = c.b; }
    }
    tg.setAttribute('color', new T.BufferAttribute(colors, 3));
    const terrain = new T.Mesh(tg, lowMat(G.GRASS, { vertexColors: true }));
    terrain.receiveShadow = true; terrain.castShadow = true;
    lowWorld.add(terrain);

    function inst(geo, id, list, place) {
      const m = new T.InstancedMesh(geo, lowMat(id), list.length);
      list.forEach((it, i) => {
        dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
        const c = place(it, dummy);
        dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, c);
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      lowWorld.add(m);
      return m;
    }
    const trunkG = flatGeo(new T.CylinderGeometry(0.2, 0.32, 1.8, 5).translate(0, 0.9, 0));
    inst(trunkG, G.WOOD, trees, (t, d) => { d.position.set(t.x, lowHeight(t.x, t.z), t.z); d.rotation.y = lr() * 6; return lj(col(0x9a6f55), 0.06); });
    const cones = [], balls = [];
    trees.forEach(t => (lr() < 0.5 ? cones : balls).push(t));
    const crown = (t, d) => {
      d.position.set(t.x, lowHeight(t.x, t.z) + 1.5, t.z); d.rotation.y = lr() * 6;
      const s = 0.85 + lr() * 0.45; d.scale.set(s, s * (0.9 + lr() * 0.3), s);
      const pick = lr();
      return lj(col(pick < 0.15 ? 0xf2a7c3 : pick < 0.55 ? 0x7cc47f : pick < 0.8 ? 0x9bd38a : 0x5fb38a), 0.06);
    };
    inst(flatGeo(new T.ConeGeometry(1.5, 3.0, 6).translate(0, 1.4, 0)), G.LEAF, cones, crown);
    inst(flatGeo(new T.IcosahedronGeometry(1.45, 0).translate(0, 1.3, 0)), G.LEAF, balls, crown);
    inst(flatGeo(new T.DodecahedronGeometry(0.75, 0)), G.STONE, rocks, (r, d) => {
      d.position.set(r.x, r.wet ? WATER_Y + 0.05 : lowHeight(r.x, r.z) + 0.15, r.z);
      d.rotation.set(lr() * 3, lr() * 3, lr() * 3); d.scale.setScalar(r.s);
      return lj(col(0xb9b4c7), 0.08);
    });
    inst(flatGeo(new T.CylinderGeometry(1, 1, 0.08, 7)), G.LILY, pads, (pd, d) => {
      d.position.set(pd.x, WATER_Y + 0.06, pd.z); d.rotation.y = lr() * 6; d.scale.set(pd.r, 1, pd.r);
      return lj(col(0x7fbf6a), 0.06);
    });
    inst(flatGeo(new T.OctahedronGeometry(0.28, 0)), G.FLOWER, pads.filter(pd => pd.flower), (pd, d) => {
      d.position.set(pd.x + 0.15, WATER_Y + 0.28, pd.z - 0.1); return col(0xff9cc6);
    });
    const deck = new T.Mesh(new T.BoxGeometry(dock.len + 0.4, 0.16, 2.3), lowMat(G.WOOD, { color: 0xc49a6c }));
    deck.position.set((dockLand.x + dockEnd.x) / 2, 0.14, (dockLand.z + dockEnd.z) / 2);
    deck.rotation.y = dock.ry; deck.castShadow = deck.receiveShadow = true;
    lowWorld.add(deck);

    // peixe facetado
    const fm = (c, extra) => lowMat(G.FISH, Object.assign({ color: c }, extra));
    const body = new T.Mesh(flatGeo(new T.SphereGeometry(0.5, 7, 5)), fm(0xff7a33));
    body.scale.set(2.5, 0.95, 1.05); body.position.x = 0.15;
    const spot = new T.Mesh(flatGeo(new T.SphereGeometry(0.3, 5, 3)), fm(0xfff1dc));
    spot.scale.set(1.2, 0.35, 0.9); spot.position.set(0.35, 0.4, 0.08);
    const eyeG = new T.OctahedronGeometry(0.08, 0);
    const eyeL = new T.Mesh(eyeG, fm(0x161616)), eyeR = new T.Mesh(eyeG, fm(0x161616));
    eyeL.position.set(1.05, 0.12, 0.27); eyeR.position.set(1.05, 0.12, -0.27);
    const tailG = new T.Group();
    tailG.position.x = -1.0;
    const fan = new T.BufferGeometry();
    fan.setAttribute('position', new T.BufferAttribute(new Float32Array([
      0, 0, 0, -0.95, 0.04, 0.62, -0.7, 0, 0,
      0, 0, 0, -0.7, 0, 0, -0.95, 0.04, -0.62,
    ]), 3));
    fan.computeVertexNormals();
    tailG.add(new T.Mesh(fan, fm(0xffc08a, { side: T.DoubleSide })));
    fishLow.add(body, spot, eyeL, eyeR, tailG);
    fishLow.traverse(o => { if (o.isMesh) o.castShadow = true; });
    tailExtra.push(tailG);
  }

  // ---------- L-system: árvores que crescem por regras ----------
  const lsysGroup = new T.Group();
  lsysGroup.visible = false;
  scene.add(lsysGroup);
  const lsys = { built: false, grow: 1 };
  const qId = new T.Quaternion();
  function buildLsys() {
    if (lsys.built) return;
    lsys.built = true;
    const r = mulberry32(77), segs = [], tips = [];
    const rules = ['F[+X][-X]F[&X]^X', 'F[&+X]F[^-X][+X]X', 'FF[-X][+X][&X][^X]'];
    const ax = new T.Vector3(1, 0, 0), ay = new T.Vector3(0, 1, 0), az = new T.Vector3(0, 0, 1), tq = new T.Quaternion(), dir = new T.Vector3();
    for (const t of trees) {
      let s = 'X';
      for (let it = 0; it < 3; it++) {
        let o = '';
        for (const ch of s) o += ch === 'X' ? rules[Math.floor(r() * rules.length)] : ch === 'F' ? (r() < 0.45 ? 'FF' : 'F') : ch;
        s = o;
      }
      const st = [];
      let p = new T.Vector3(t.x, 0, t.z), qq = new T.Quaternion().setFromAxisAngle(ay, r() * 6.28);
      let len = 0.85 + r() * 0.25, w = 0.5, order = 0;
      const turn = (axis, a) => qq.multiply(tq.setFromAxisAngle(axis, a + (r() - 0.5) * 0.25));
      for (const ch of s) {
        if (ch === 'F') {
          dir.set(0, 1, 0).applyQuaternion(qq);
          segs.push({ a: p.clone(), q: qq.clone(), len, w, order });
          p.addScaledVector(dir, len);
          order++;
        } else if (ch === '+') turn(az, 0.42);
        else if (ch === '-') turn(az, -0.42);
        else if (ch === '&') turn(ax, 0.42);
        else if (ch === '^') turn(ax, -0.42);
        else if (ch === '[') {
          st.push([p.clone(), qq.clone(), len, w, order]);
          qq.multiply(tq.setFromAxisAngle(ay, r() * 6.28));
          len *= 0.8; w *= 0.66;
        } else if (ch === ']') {
          tips.push({ p: p.clone(), order, c: r(), q: new T.Quaternion().setFromEuler(new T.Euler(r() * 6, r() * 6, 0)) });
          [p, qq, len, w, order] = st.pop();
        }
      }
      tips.push({ p: p.clone(), order, c: r(), q: new T.Quaternion() });
    }
    lsys.segs = segs; lsys.tips = tips;
    lsys.maxOrder = segs.reduce((m, s) => Math.max(m, s.order), 1);
    lsys.branch = new T.InstancedMesh(stalkGeo, mat(G.WOOD), segs.length);
    segs.forEach((s, i) => lsys.branch.setColorAt(i, hsl(0.07 + r() * 0.02, 0.35, 0.24 + r() * 0.06)));
    lsys.leaf = new T.InstancedMesh(box, mat(G.LEAF), tips.length);
    tips.forEach((t, i) => lsys.leaf.setColorAt(i, t.c < 0.55 ? hsl(0.94, 0.75, 0.78 + r() * 0.08) : t.c < 0.8 ? hsl(0.95, 0.6, 0.92) : hsl(0.27, 0.5, 0.55)));
    for (const m of [lsys.branch, lsys.leaf]) {
      m.instanceColor.needsUpdate = true;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      lsysGroup.add(m);
    }
  }
  function growLsys(dt) {
    if (lsys.grow >= 1) return;
    lsys.grow = Math.min(1, lsys.grow + dt / 5);
    const g = lsys.grow * (lsys.maxOrder + 3);
    lsys.segs.forEach((s, i) => {
      const k = clamp(g - s.order, 0, 1);
      sv.set(s.w * (0.4 + 0.6 * k), s.len * k + 1e-4, s.w * (0.4 + 0.6 * k));
      m4.compose(s.a, s.q, sv);
      lsys.branch.setMatrixAt(i, m4);
    });
    lsys.tips.forEach((t, i) => {
      const k = clamp(g - t.order - 1, 0, 1), z = 0.9 * k + 1e-4;
      sv.set(z, z, z);
      m4.compose(t.p, t.q, sv);
      lsys.leaf.setMatrixAt(i, m4);
    });
    lsys.branch.instanceMatrix.needsUpdate = true;
    lsys.leaf.instanceMatrix.needsUpdate = true;
  }

  // ---------- raymarching: o lago inteiro desenhado por fórmulas (sem blocos) ----------
  const NP = Math.max(1, pads.length);
  const rayU = {
    uCamMat: { value: new T.Matrix4() }, uInvProj: { value: new T.Matrix4() }, uCamPos: { value: new T.Vector3() },
    uFish: { value: new T.Vector4() }, uFood: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4()] },
    uPads: { value: Array.from({ length: NP }, (_, i) => pads[i] ? new T.Vector3(pads[i].x, pads[i].z, pads[i].r) : new T.Vector3(999, 999, 0.1)) },
    uTime: U.uTime,
  };
  let rayMat = null, rtRay = null, rayScale = 0.5, rayAvg = 0.016;
  function rayInit() {
    if (rayMat) return true;
    rtRay = makeRT(rayScale);
    rayMat = new T.ShaderMaterial({
      uniforms: rayU, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        #define RX ${RX.toFixed(2)}
        #define RZ ${RZ.toFixed(2)}
        #define WATER ${WATER_Y.toFixed(2)}
        #define FISHY ${FISH_Y.toFixed(2)}
        #define FS ${FISH_SIZE.toFixed(2)}
        #define NP ${NP}
        uniform mat4 uCamMat;
        uniform mat4 uInvProj;
        uniform vec3 uCamPos;
        uniform vec4 uFish;
        uniform vec4 uFood[3];
        uniform vec3 uPads[NP];
        uniform float uTime;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float lakeR(float a) { return 1.0 + 0.10 * sin(3.0 * a + 0.7) + 0.06 * sin(5.0 * a + 2.1) + 0.035 * sin(7.0 * a + 4.0); }
        float lakeV(vec2 p) { vec2 d = p / vec2(RX, RZ); return length(d) / lakeR(atan(d.y, d.x)); }
        float ground(vec2 p) {
          float v = lakeV(p);
          float h = mix(-2.7, 0.0, smoothstep(0.5, 1.06, v));
          h += (noise(p * 0.08) * 1.6 - 0.45) * smoothstep(1.35, 2.3, v);
          return h + (noise(p * 0.9) - 0.5) * 0.06;
        }
        float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
        float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
        vec3 fishLocal(vec3 p) {
          vec3 q = p - vec3(uFish.x, FISHY, uFish.y);
          float c = cos(uFish.z), s = sin(uFish.z);
          vec3 f = vec3(c * q.x - s * q.z, q.y, s * q.x + c * q.z) / FS;
          f.z += sin(uFish.w - f.x * 2.2) * 0.2 * (1.0 - smoothstep(-1.6, 0.4, f.x));
          return f;
        }
        float sdFish(vec3 p) {
          vec3 f = fishLocal(p);
          float body = sdEll(f - vec3(0.2, 0.0, 0.0), vec3(1.2, 0.4, 0.4));
          float tail = sdEll(f - vec3(-1.3, 0.0, 0.0), vec3(0.38, 0.07, 0.55));
          float fin = sdEll(f - vec3(0.35, -0.12, 0.0), vec3(0.25, 0.05, 0.7));
          return smin(smin(body, tail, 0.25), fin, 0.12) * FS * 0.85;
        }
        // uma árvore orgânica por célula de 7 unidades, longe do lago
        vec2 tree(vec3 p) {
          vec2 cell = floor(p.xz / 7.0);
          vec2 cc = (cell + 0.5) * 7.0 + (vec2(hash(cell), hash(cell + 3.1)) - 0.5) * 2.0;
          if (lakeV(cc) < 1.45 || hash(cell + 9.0) < 0.3) return vec2(1e5, 0.0);
          vec3 tp = p - vec3(cc.x, ground(cc), cc.y);
          float trunk = max(length(tp.xz) - 0.22, max(-tp.y, tp.y - 2.6));
          float wob = 0.18 * sin(tp.x * 3.0 + uTime * 0.6) * sin(tp.y * 3.0) * sin(tp.z * 3.0);
          float crown = smin(length(tp - vec3(0.0, 3.0, 0.0)) - 1.45, length(tp - vec3(0.7, 2.5, 0.35)) - 1.0, 0.6) + wob;
          return crown < trunk ? vec2(crown * 0.8, 6.0) : vec2(trunk, 5.0);
        }
        vec2 map(vec3 p) {
          vec2 res = vec2((p.y - ground(p.xz)) * 0.6, 1.0);
          if (p.y < 1.5) {
            float df = sdFish(p);
            if (df < res.x) res = vec2(df, 2.0);
            for (int i = 0; i < NP; i++) {
              vec3 pd = uPads[i];
              float d = max(length(p.xz - pd.xy) - pd.z, abs(p.y - (WATER + 0.05)) - 0.04) - 0.02;
              if (d < res.x) res = vec2(d, 3.0);
            }
            for (int i = 0; i < 3; i++) {
              if (uFood[i].w > 0.5) { float d = length(p - uFood[i].xyz) - 0.2; if (d < res.x) res = vec2(d, 4.0); }
            }
          }
          if (p.y < 6.0) { vec2 t = tree(p); if (t.x < res.x) res = t; res.x = min(res.x, 1.2); }
          return res;
        }
        vec2 march(vec3 ro, vec3 rd) {
          float t = 1.0, m = -1.0;
          for (int i = 0; i < 120; i++) {
            vec2 h = map(ro + rd * t);
            if (h.x < 0.0015 * t) { m = h.y; break; }
            t += h.x;
            if (t > 180.0) break;
          }
          return vec2(t, m);
        }
        vec3 calcN(vec3 p) {
          vec2 e = vec2(0.003, -0.003);
          return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
        }
        float shadowRay(vec3 ro, vec3 rd) {
          float r = 1.0, t = 0.08;
          for (int i = 0; i < 20; i++) {
            float h = map(ro + rd * t).x;
            r = min(r, 8.0 * h / t);
            t += clamp(h, 0.08, 0.8);
            if (r < 0.02 || t > 14.0) break;
          }
          return clamp(r, 0.0, 1.0);
        }
        float ao(vec3 p, vec3 n) {
          float o = 0.0, s = 1.0;
          for (int i = 0; i < 4; i++) { float h = 0.06 + 0.16 * float(i); o += (h - map(p + n * h).x) * s; s *= 0.7; }
          return clamp(1.0 - 1.4 * o, 0.0, 1.0);
        }
        vec3 albedo(float m, vec3 p) {
          if (m < 1.5) {
            float v = lakeV(p.xz);
            vec3 grass = mix(vec3(0.33, 0.6, 0.26), vec3(0.52, 0.74, 0.33), noise(p.xz * 0.12));
            vec3 sandC = vec3(0.88, 0.8, 0.58);
            vec3 c = mix(vec3(0.42, 0.62, 0.55), sandC, smoothstep(0.55, 0.95, v));
            c = mix(c, sandC, smoothstep(0.93, 1.0, v));
            return mix(c, grass, smoothstep(1.08, 1.16, v));
          }
          if (m < 2.5) {
            vec3 f = fishLocal(p);
            vec3 c = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.95, 0.88), step(0.58, noise(f.xz * 2.5 + 3.0)) * step(0.05, f.y));
            return mix(c, vec3(1.0, 0.78, 0.55), 1.0 - smoothstep(-1.4, -1.0, f.x));
          }
          if (m < 3.5) return vec3(0.35, 0.62, 0.3);
          if (m < 4.5) return vec3(0.95, 0.62, 0.22);
          if (m < 5.5) return vec3(0.42, 0.29, 0.2);
          vec2 cell = floor(p.xz / 7.0);
          return hash(cell + 5.0) < 0.2 ? vec3(0.95, 0.62, 0.75) : mix(vec3(0.3, 0.58, 0.28), vec3(0.45, 0.7, 0.3), hash(cell + 1.0));
        }
        void main() {
          vec2 ndc = vUv * 2.0 - 1.0;
          vec4 vv = uInvProj * vec4(ndc, 1.0, 1.0);
          vec3 rd = normalize((uCamMat * vec4(normalize(vv.xyz / vv.w), 0.0)).xyz);
          vec3 ro = uCamPos;
          vec2 h = march(ro, rd);
          vec3 L = normalize(vec3(-30.0, 52.0, -14.0));
          vec3 sky = mix(vec3(0.85, 0.92, 0.98), vec3(0.55, 0.75, 0.95), clamp(rd.y, 0.0, 1.0));
          vec3 col = sky;
          if (h.y > 0.0) {
            vec3 p = ro + rd * h.x, n = calcN(p);
            float sh = shadowRay(p + n * 0.03, L);
            float dif = clamp(dot(n, L), 0.0, 1.0) * sh;
            col = albedo(h.y, p) * (dif * vec3(1.2, 1.08, 0.92) + (0.5 + 0.5 * n.y) * vec3(0.42, 0.5, 0.6) * ao(p, n) + 0.08);
            if (h.y > 1.5 && h.y < 2.5) col += pow(clamp(dot(reflect(rd, n), L), 0.0, 1.0), 24.0) * 0.6 * sh;
            if (p.y < WATER) {
              float cz = sin(p.x * 1.7 + uTime * 1.3) + sin(p.z * 1.9 - uTime * 1.1) + sin((p.x + p.z) * 1.2 + uTime * 0.8);
              col += pow(abs(cz) / 3.0, 3.0) * 0.5 * sh;
            }
          }
          if (rd.y < 0.0) {
            float tw = (WATER - ro.y) / rd.y;
            vec3 pw = ro + rd * tw;
            if (tw > 0.0 && (h.y < 0.0 || tw < h.x) && lakeV(pw.xz) < 1.06) {
              float under = (h.y > 0.0 ? h.x : tw + 4.0) - tw;
              col = mix(col, vec3(0.1, 0.45, 0.52), 1.0 - exp(-under * 0.3));
              vec3 nw = normalize(vec3(sin(pw.x * 1.3 + uTime * 1.2) * 0.06 + sin(pw.z * 2.1 - uTime) * 0.04, 1.0, cos(pw.z * 1.1 + uTime * 0.9) * 0.06));
              float fr = 0.04 + 0.8 * pow(1.0 - clamp(dot(-rd, nw), 0.0, 1.0), 4.0);
              col = mix(col, sky, fr);
              col += pow(clamp(dot(reflect(rd, nw), L), 0.0, 1.0), 120.0) * 1.2;
            }
          }
          gl_FragColor = vec4(pow(col, vec3(0.92)), 1.0);
        }`,
    });
    return true;
  }
  function rayRender(dt) {
    // se ficar pesado, desenha em resolução menor
    rayAvg += (dt - rayAvg) * 0.05;
    if (rayAvg > 0.028 && rayScale > 0.3) { rayScale = Math.max(0.3, rayScale - 0.1); rayAvg = 0.016; resizeOne(rtRay, rayScale); }
    camera.updateMatrixWorld();
    rayU.uCamMat.value.copy(camera.matrixWorld);
    rayU.uInvProj.value.copy(camera.projectionMatrixInverse);
    rayU.uCamPos.value.copy(camera.position);
    rayU.uFish.value.set(F.x, F.z, F.heading, F.phase);
    foods.forEach((f, i) => rayU.uFood.value[i].set(f.x, f.y, f.z, f.on ? 1 : 0));
    pass(rayMat, rtRay);
    finish(rtRay.texture, 0.8);
  }

  // ---------- pulso musical: música feita na hora, e o lago dança junto ----------
  const music = { ctx: null, on: false, timer: 0, next: 0, step: 0, beats: [], beat: 0, bass: 0, mid: 0, high: 0 };
  const BPM = 104, STEP = 60 / BPM / 4;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const specData = new Uint8Array(48 * 4);
  const specTex = new T.DataTexture(specData, 48, 1, T.RGBAFormat);
  specTex.minFilter = specTex.magFilter = T.NearestFilter; specTex.generateMipmaps = false; specTex.needsUpdate = true;
  function musicStart() {
    try {
      if (!music.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const ctx = music.ctx = new AC();
        music.master = ctx.createGain(); music.master.gain.value = 0;
        music.analyser = ctx.createAnalyser(); music.analyser.fftSize = 512;
        music.freq = new Uint8Array(music.analyser.frequencyBinCount);
        music.delay = ctx.createDelay(1); music.delay.delayTime.value = STEP * 3;
        const fb = ctx.createGain(); fb.gain.value = 0.35;
        music.delay.connect(fb); fb.connect(music.delay); music.delay.connect(music.master);
        music.master.connect(music.analyser); music.analyser.connect(ctx.destination);
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        music.noise = nb;
      }
      const ctx = music.ctx;
      if (ctx.state !== 'running') ctx.resume();
      music.master.gain.cancelScheduledValues(ctx.currentTime);
      music.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.1);
      music.on = true; music.next = ctx.currentTime + 0.08; music.beats.length = 0;
      clearInterval(music.timer);
      music.timer = setInterval(musicSchedule, 25);
      return true;
    } catch (e) { return false; }
  }
  function musicStop() {
    if (!music.ctx) return;
    music.on = false;
    clearInterval(music.timer);
    music.master.gain.setTargetAtTime(0, music.ctx.currentTime, 0.08);
  }
  function musicSchedule() {
    const ctx = music.ctx;
    while (music.next < ctx.currentTime + 0.12) { playStep(music.step, music.next); music.next += STEP; music.step = (music.step + 1) % 64; }
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function voice(type, freq, t, peak, dur, dest) {
    const ctx = music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(dest || music.master);
    o.start(t); o.stop(t + dur + 0.05);
    return { o, g };
  }
  function noiseHit(t, type, f, q, peak, dur) {
    const ctx = music.ctx, s = ctx.createBufferSource(), fl2 = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = music.noise; fl2.type = type; fl2.frequency.value = f; fl2.Q.value = q;
    env(g, t, 0.002, peak, dur);
    s.connect(fl2); fl2.connect(g); g.connect(music.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function playStep(s, t) {
    const ctx = music.ctx, i = s % 16, chord = CHORDS[Math.floor(s / 16)];
    if (i % 4 === 0) {
      const k = voice('sine', 150, t, 0.9, 0.32);
      k.o.frequency.setValueAtTime(150, t);
      k.o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      music.beats.push(t);
    }
    if (i === 4 || i === 12) noiseHit(t, 'bandpass', 1600, 0.8, 0.35, 0.18);
    if (i % 2 === 1) noiseHit(t, 'highpass', 7000, 0.7, i % 4 === 3 ? 0.09 : 0.05, 0.05);
    if (i % 2 === 0 && i !== 6 && i !== 14) {
      const b = voice('sawtooth', mtof(chord[0] - 24), t, 0.22, 0.26);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.25);
      b.o.disconnect(); b.o.connect(lp); lp.connect(b.g);
    }
    const note = chord[(i >> 1) % 3] + 12 * ((i >> 2) & 1) + 12;
    const p = voice('triangle', mtof(note), t, 0.11, 0.22);
    p.g.connect(music.delay);
  }
  function musicTick(dt) {
    if (music.on && music.ctx && music.ctx.state === 'running') {
      const now = music.ctx.currentTime;
      while (music.beats.length && music.beats[0] <= now) { music.beats.shift(); music.beat = 1; }
      music.analyser.getByteFrequencyData(music.freq);
      const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += music.freq[i]; return s / (b - a) / 255; };
      music.bass = avg(1, 6); music.mid = avg(8, 40); music.high = avg(60, 160);
      for (let i = 0; i < 48; i++) {
        const k = 1 + Math.floor(Math.pow(i / 48, 1.7) * 180);
        specData[i * 4] = music.freq[k];
      }
    } else {
      // sem som: um pulso calmo para o lago não ficar parado
      const ph = (time * BPM / 60) % 1;
      if (ph < music.lastPh) music.beat = 0.6;
      music.lastPh = ph;
      music.bass = 0.3 + 0.2 * Math.sin(time * 2); music.mid = 0.3; music.high = 0.15;
      for (let i = 0; i < 48; i++) specData[i * 4] = 90 + 60 * Math.sin(time * 3 + i * 0.5);
    }
    music.beat *= Math.exp(-dt * 7);
    specTex.needsUpdate = true;
  }
  music.lastPh = 0;
  const pulseMat = shader(`
    uniform sampler2D tSpec;
    uniform float uBeat;
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform vec2 uFishUv;
    void main() {
      float asp = uRes.x / uRes.y;
      vec2 uv = (vUv - 0.5) * (1.0 - uBeat * 0.03) + 0.5;
      vec2 d2 = (uv - uFishUv) * vec2(asp, 1.0);
      float d = length(d2);
      float ripple = sin(d * 70.0 - uTime * 9.0) * exp(-d * 5.0) * (0.002 + uBass * 0.006);
      uv += (d2 / max(d, 0.0001)) / vec2(asp, 1.0) * ripple;
      float ab = 0.0015 + uHigh * 0.006;
      vec3 c = vec3(texture2D(tScene, uv + vec2(ab, 0.0)).r, texture2D(tScene, uv).g, texture2D(tScene, uv - vec2(ab, 0.0)).b);
      if (abs(idAt(uv * uRes) - 3.0) < 0.5) {
        vec3 tint = 0.5 + 0.5 * cos(6.2831 * (uTime * 0.08 + vec3(0.0, 0.33, 0.67)));
        c = mix(c, c * (0.6 + tint * 0.8), 0.35 + uMid * 0.4);
      }
      float ang = atan(d2.y, d2.x) / 6.28318 + 0.5;
      float amp = texture2D(tSpec, vec2(abs(ang - 0.5) * 2.0, 0.5)).r;
      float bar = step(0.11, d) * step(d, 0.125 + amp * 0.14) * step(0.25, fract(ang * 48.0));
      vec3 neonC = 0.5 + 0.5 * cos(6.2831 * (ang + uTime * 0.1 + vec3(0.0, 0.33, 0.67)));
      c = mix(c, neonC * 1.3, bar * 0.85);
      gl_FragColor = vec4(c * (1.0 + uBeat * 0.22), 1.0);
    }`, { tSpec: { value: specTex }, uBeat: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 }, uFishUv: { value: new T.Vector2() } });
  function pulseRender(dt) {
    musicTick(dt);
    const u = pulseMat.uniforms;
    u.uBeat.value = music.beat; u.uBass.value = music.bass; u.uMid.value = music.mid; u.uHigh.value = music.high;
    u.uFishUv.value.set(fishScreen.x / buf.x, fishScreen.y / buf.y);
    renderWorld();
    pass(pulseMat, rtPost);
    finish(rtPost.texture, 0.8);
  }
