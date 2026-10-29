
  // ---------- simulações ----------
  const swap = (a) => { const t = a[0]; a[0] = a[1]; a[1] = t; };
  const tmpColor = new T.Color();
  let hfOK = null;
  // texturas de ponto flutuante: necessárias para tinta e reação-difusão
  function halfFloatOK() {
    if (hfOK !== null) return hfOK;
    try {
      const rt = new T.WebGLRenderTarget(4, 4, rtOpts(T.NearestFilter, { type: T.HalfFloatType }));
      renderer.setRenderTarget(rt);
      const gl = renderer.getContext();
      hfOK = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.setRenderTarget(null);
      rt.dispose();
    } catch (e) { hfOK = false; }
    return hfOK;
  }

  // ---- campos de fluxo: milhares de pinceladas seguindo um vento invisível ----
  const flow = {};
  function flowInit() {
    if (flow.acc) return true;
    flow.acc = makeRT(1);
    const n = matchMedia('(pointer: coarse)').matches ? 5000 : 10000;
    flow.n = n;
    flow.pos = new Float32Array(n * 2);
    flow.life = new Float32Array(n);
    flow.arr = new Float32Array(n * 3);
    const geo = new T.BufferGeometry();
    flow.attr = new T.BufferAttribute(flow.arr, 3);
    flow.attr.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('position', flow.attr);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const pm = new T.ShaderMaterial({
      uniforms: { tScene: U.tScene, uSize: { value: 3.2 * DPR } },
      vertexShader: `
        uniform sampler2D tScene;
        uniform float uSize;
        attribute float aSeed;
        varying vec3 vC;
        void main() {
          vC = texture2D(tScene, position.xy * 0.5 + 0.5).rgb * (0.82 + aSeed * 0.36);
          gl_Position = vec4(position.xy, 0.0, 1.0);
          gl_PointSize = uSize * (0.7 + aSeed * 0.6);
        }`,
      fragmentShader: `
        varying vec3 vC;
        void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(vC, 0.6); }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    flow.points = new T.Points(geo, pm);
    flow.points.frustumCulled = false;
    flow.scene = new T.Scene();
    flow.scene.add(flow.points);
    flow.fade = shader('void main() { gl_FragColor = vec4(S(vUv * uRes).rgb, 0.05); }', {}, { transparent: true });
    flow.copy = shader('void main() { gl_FragColor = vec4(S(vUv * uRes).rgb, 1.0); }');
    return true;
  }
  function flowSpawn(i) { flow.pos[2 * i] = Math.random() * buf.x; flow.pos[2 * i + 1] = Math.random() * buf.y; flow.life[i] = 0.5 + Math.random() * 3.5; }
  function flowEnter() { for (let i = 0; i < flow.n; i++) flowSpawn(i); flow.fresh = true; }
  function flowRender(dt) {
    renderWorld();
    const W = buf.x, H = buf.y, t = time, sp = 70 * DPR, inv = 1 / DPR;
    const fx = fishScreen.x, fy = fishScreen.y, R = 150 * DPR, R2 = R * R;
    const P = flow.pos, A = flow.arr;
    for (let i = 0; i < flow.n; i++) {
      let x = P[2 * i], y = P[2 * i + 1];
      const X = x * inv, Y = y * inv;
      const a = Math.sin(X * 0.004 + t * 0.15) * 2.1 + Math.cos(Y * 0.005 - t * 0.11) * 2.3 + Math.sin((X - Y) * 0.0023 + t * 0.07) * 1.6;
      let vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      const dx = x - fx, dy = y - fy, d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        // redemoinho em volta do peixe
        const k = (1 - d2 / R2) * 3;
        vx += (-dy / R * sp + fishScreen.vx * 0.3) * k;
        vy += (dx / R * sp + fishScreen.vy * 0.3) * k;
      }
      x += vx * dt; y += vy * dt;
      flow.life[i] -= dt;
      if (flow.life[i] < 0 || x < 0 || y < 0 || x > W || y > H) { flowSpawn(i); x = P[2 * i]; y = P[2 * i + 1]; }
      P[2 * i] = x; P[2 * i + 1] = y;
      A[3 * i] = x / W * 2 - 1; A[3 * i + 1] = y / H * 2 - 1;
    }
    flow.attr.needsUpdate = true;
    renderer.autoClear = false;
    if (flow.fresh) { pass(flow.copy, flow.acc); flow.fresh = false; }
    else pass(flow.fade, flow.acc);
    renderer.setRenderTarget(flow.acc);
    renderer.render(flow.scene, postCam);
    renderer.autoClear = true;
    finish(flow.acc.texture, 0.6);
  }

  // ---- reação-difusão: padrões de coral (Gray-Scott) guiados pela luz da cena ----
  const rd = {};
  function rdInit() {
    if (!halfFloatOK()) return false;
    if (rd.a) { rd.a.dispose(); rd.b.dispose(); }
    const filter = renderer.capabilities.isWebGL2 ? T.LinearFilter : T.NearestFilter;
    rd.w = Math.max(32, Math.ceil(buf.x / DPR / 3));
    rd.h = Math.max(32, Math.ceil(buf.y / DPR / 3));
    rd.a = new T.WebGLRenderTarget(rd.w, rd.h, rtOpts(filter, { type: T.HalfFloatType }));
    rd.b = new T.WebGLRenderTarget(rd.w, rd.h, rtOpts(filter, { type: T.HalfFloatType }));
    if (!rd.step) {
      rd.step = new T.ShaderMaterial({
        uniforms: { tState: { value: null }, tScene: U.tScene, uSim: { value: new T.Vector2() }, uFish: { value: new T.Vector2() }, uInit: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: `
          uniform sampler2D tState;
          uniform sampler2D tScene;
          uniform vec2 uSim;
          uniform vec2 uFish;
          uniform float uInit;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          vec2 at(vec2 o) { return texture2D(tState, vUv + o / uSim).xy; }
          void main() {
            vec2 px = vUv * uSim;
            if (uInit > 0.5) { gl_FragColor = vec4(1.0, step(0.975, hash(floor(px / 3.0))), 0.0, 1.0); return; }
            vec2 s = at(vec2(0.0));
            vec2 lap = -s + 0.2 * (at(vec2(1.0, 0.0)) + at(vec2(-1.0, 0.0)) + at(vec2(0.0, 1.0)) + at(vec2(0.0, -1.0)))
                     + 0.05 * (at(vec2(1.0, 1.0)) + at(vec2(-1.0, -1.0)) + at(vec2(1.0, -1.0)) + at(vec2(-1.0, 1.0)));
            float l = dot(texture2D(tScene, vUv).rgb, vec3(0.299, 0.587, 0.114));
            float f = mix(0.022, 0.058, l), k = mix(0.051, 0.0625, l);
            float A = s.x, B = s.y, r = A * B * B;
            A += lap.x - r + f * (1.0 - A);
            B += 0.5 * lap.y + r - (k + f) * B;
            if (distance(px, uFish) < 5.0) B = 0.9;
            gl_FragColor = vec4(clamp(A, 0.0, 1.0), clamp(B, 0.0, 1.0), 0.0, 1.0);
          }`,
        depthTest: false, depthWrite: false,
      });
      rd.show = shader(`
        uniform sampler2D tState;
        uniform vec2 uSim;
        void main() {
          vec2 px = vUv * uRes, e = 1.0 / uSim;
          vec3 col = S(px).rgb;
          float B = texture2D(tState, vUv).y;
          float bx = texture2D(tState, vUv + vec2(e.x, 0.0)).y - texture2D(tState, vUv - vec2(e.x, 0.0)).y;
          float by = texture2D(tState, vUv + vec2(0.0, e.y)).y - texture2D(tState, vUv - vec2(0.0, e.y)).y;
          float sh = dot(normalize(vec3(-bx * 4.0, -by * 4.0, 1.0)), normalize(vec3(-0.5, 0.6, 0.7)));
          vec3 c = mix(col * 0.38 + vec3(0.02, 0.03, 0.05), col * 1.2 + 0.05, smoothstep(0.12, 0.32, B));
          gl_FragColor = vec4(c * (0.8 + 0.35 * sh), 1.0);
        }`, { tState: { value: null }, uSim: { value: new T.Vector2() } });
    }
    rd.step.uniforms.uSim.value.set(rd.w, rd.h);
    rd.show.uniforms.uSim.value.set(rd.w, rd.h);
    rd.step.uniforms.uInit.value = 1;
    pass(rd.step, rd.a);
    rd.step.uniforms.uInit.value = 0;
    return true;
  }
  function rdRender() {
    renderWorld();
    rd.step.uniforms.uFish.value.set(fishScreen.x / buf.x * rd.w, fishScreen.y / buf.y * rd.h);
    for (let i = 0; i < 14; i++) {
      rd.step.uniforms.tState.value = rd.a.texture;
      pass(rd.step, rd.b);
      const t = rd.a; rd.a = rd.b; rd.b = t;
    }
    rd.show.uniforms.tState.value = rd.a.texture;
    pass(rd.show, rtPost);
    finish(rtPost.texture, 0.8);
  }

  // ---- tinta na água: fluido de verdade (stable fluids) mexido pelo peixe ----
  const fl = {};
  const FL_HEAD = `
    varying vec2 vUv;
    uniform vec2 uTexel;
    vec4 bilerp(sampler2D t, vec2 uv, vec2 texel) {
      vec2 st = uv / texel - 0.5, i = floor(st), f = fract(st);
      vec4 a = texture2D(t, (i + vec2(0.5, 0.5)) * texel), b = texture2D(t, (i + vec2(1.5, 0.5)) * texel);
      vec4 c = texture2D(t, (i + vec2(0.5, 1.5)) * texel), d = texture2D(t, (i + vec2(1.5, 1.5)) * texel);
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    vec4 Lt(sampler2D t) { return texture2D(t, vUv - vec2(uTexel.x, 0.0)); }
    vec4 Rt(sampler2D t) { return texture2D(t, vUv + vec2(uTexel.x, 0.0)); }
    vec4 Bt(sampler2D t) { return texture2D(t, vUv - vec2(0.0, uTexel.y)); }
    vec4 Tt(sampler2D t) { return texture2D(t, vUv + vec2(0.0, uTexel.y)); }
  `;
  function flMat(frag, uniforms) {
    return new T.ShaderMaterial({
      uniforms: Object.assign({ uTexel: { value: new T.Vector2() } }, uniforms),
      vertexShader: VERT, fragmentShader: FL_HEAD + frag, depthTest: false, depthWrite: false,
    });
  }
  function flInit() {
    if (!halfFloatOK()) return false;
    if (fl.vel) [...fl.vel, ...fl.prs, ...fl.dye, fl.div, fl.curl].forEach(rt => rt.dispose());
    const asp = buf.x / buf.y;
    fl.w = Math.round(asp >= 1 ? 128 * asp : 128); fl.h = Math.round(asp >= 1 ? 128 : 128 / asp);
    const mk = (w, h) => new T.WebGLRenderTarget(w, h, rtOpts(T.NearestFilter, { type: T.HalfFloatType }));
    fl.vel = [mk(fl.w, fl.h), mk(fl.w, fl.h)];
    fl.prs = [mk(fl.w, fl.h), mk(fl.w, fl.h)];
    fl.div = mk(fl.w, fl.h); fl.curl = mk(fl.w, fl.h);
    fl.dye = [mk(fl.w * 2, fl.h * 2), mk(fl.w * 2, fl.h * 2)];
    if (!fl.adv) {
      fl.adv = flMat(`
        uniform sampler2D tVel; uniform sampler2D tSrc; uniform vec2 uSrcTexel; uniform float uDt; uniform float uDiss;
        void main() { vec2 c = vUv - uDt * bilerp(tVel, vUv, uTexel).xy * uTexel; gl_FragColor = vec4(uDiss * bilerp(tSrc, c, uSrcTexel).xyz, 1.0); }`,
        { tVel: { value: null }, tSrc: { value: null }, uSrcTexel: { value: new T.Vector2() }, uDt: { value: 0.016 }, uDiss: { value: 1 } });
      fl.splat = flMat(`
        uniform sampler2D tTarget; uniform vec2 uPoint; uniform vec3 uColor; uniform float uRadius; uniform float uAspect;
        void main() { vec2 p = vUv - uPoint; p.x *= uAspect; gl_FragColor = vec4(texture2D(tTarget, vUv).xyz + exp(-dot(p, p) / uRadius) * uColor, 1.0); }`,
        { tTarget: { value: null }, uPoint: { value: new T.Vector2() }, uColor: { value: new T.Vector3() }, uRadius: { value: 0.001 }, uAspect: { value: 1 } });
      fl.divM = flMat(`
        uniform sampler2D tVel;
        void main() { gl_FragColor = vec4(0.5 * (Rt(tVel).x - Lt(tVel).x + Tt(tVel).y - Bt(tVel).y), 0.0, 0.0, 1.0); }`, { tVel: { value: null } });
      fl.curlM = flMat(`
        uniform sampler2D tVel;
        void main() { gl_FragColor = vec4(0.5 * (Rt(tVel).y - Lt(tVel).y - Tt(tVel).x + Bt(tVel).x), 0.0, 0.0, 1.0); }`, { tVel: { value: null } });
      fl.vort = flMat(`
        uniform sampler2D tVel; uniform sampler2D tCurl; uniform float uCurl; uniform float uDt;
        void main() {
          float l = Lt(tCurl).x, r = Rt(tCurl).x, b = Bt(tCurl).x, t = Tt(tCurl).x, c = texture2D(tCurl, vUv).x;
          vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
          force /= length(force) + 0.0001;
          force *= uCurl * c; force.y *= -1.0;
          gl_FragColor = vec4(texture2D(tVel, vUv).xy + force * uDt, 0.0, 1.0);
        }`, { tVel: { value: null }, tCurl: { value: null }, uCurl: { value: 22 }, uDt: { value: 0.016 } });
      fl.prsM = flMat(`
        uniform sampler2D tPrs; uniform sampler2D tDiv;
        void main() { gl_FragColor = vec4((Lt(tPrs).x + Rt(tPrs).x + Bt(tPrs).x + Tt(tPrs).x - texture2D(tDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
        { tPrs: { value: null }, tDiv: { value: null } });
      fl.grad = flMat(`
        uniform sampler2D tPrs; uniform sampler2D tVel;
        void main() { gl_FragColor = vec4(texture2D(tVel, vUv).xy - 0.5 * vec2(Rt(tPrs).x - Lt(tPrs).x, Tt(tPrs).x - Bt(tPrs).x), 0.0, 1.0); }`,
        { tPrs: { value: null }, tVel: { value: null } });
      fl.scale = flMat(`
        uniform sampler2D tSrc; uniform float uScale;
        void main() { gl_FragColor = vec4(uScale * texture2D(tSrc, vUv).xyz, 1.0); }`, { tSrc: { value: null }, uScale: { value: 0 } });
      fl.show = shader(`
        uniform sampler2D tDye;
        uniform sampler2D tVelS;
        uniform vec2 uDyeTexel;
        uniform vec2 uVelTexel;
        vec4 bil(sampler2D t, vec2 uv, vec2 texel) {
          vec2 st = uv / texel - 0.5, i = floor(st), f = fract(st);
          vec4 a = texture2D(t, (i + vec2(0.5, 0.5)) * texel), b = texture2D(t, (i + vec2(1.5, 0.5)) * texel);
          vec4 c = texture2D(t, (i + vec2(0.5, 1.5)) * texel), d = texture2D(t, (i + vec2(1.5, 1.5)) * texel);
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        void main() {
          vec2 px = vUv * uRes;
          float id = idAt(px);
          float wet = (abs(id - 3.0) < 0.5 || abs(id - 7.0) < 0.5 || abs(id - 8.0) < 0.5 || abs(id - 10.0) < 0.5) ? 1.0 : 0.0;
          vec2 v = bil(tVelS, vUv, uVelTexel).xy;
          vec3 col = texture2D(tScene, vUv - v * uVelTexel * 0.03 * wet).rgb;
          vec3 dye = bil(tDye, vUv, uDyeTexel).rgb;
          float mx = max(dye.r, max(dye.g, dye.b));
          float amt = clamp(mx * 1.4, 0.0, 1.0) * wet;
          vec3 ink = dye / max(mx, 0.001);
          col = mix(col, col * ink * 0.9 + ink * 0.22, amt * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }`, { tDye: { value: null }, tVelS: { value: null }, uDyeTexel: { value: new T.Vector2() }, uVelTexel: { value: new T.Vector2() } });
    }
    const vt = new T.Vector2(1 / fl.w, 1 / fl.h), dtx = new T.Vector2(1 / (fl.w * 2), 1 / (fl.h * 2));
    for (const m of [fl.adv, fl.divM, fl.curlM, fl.vort, fl.prsM, fl.grad]) m.uniforms.uTexel.value.copy(vt);
    fl.velTexel = vt; fl.dyeTexel = dtx;
    fl.show.uniforms.uVelTexel.value.copy(vt);
    fl.show.uniforms.uDyeTexel.value.copy(dtx);
    fl.splat.uniforms.uAspect.value = asp;
    // zera tudo
    fl.scale.uniforms.uScale.value = 0;
    for (const pair of [fl.vel, fl.prs, fl.dye]) for (let i = 0; i < 2; i++) { fl.scale.uniforms.tSrc.value = pair[1 - i].texture; pass(fl.scale, pair[i]); }
    return true;
  }
  function flSplat(target, x, y, r, g, b, radius) {
    fl.splat.uniforms.tTarget.value = target[0].texture;
    fl.splat.uniforms.uPoint.value.set(x, y);
    fl.splat.uniforms.uColor.value.set(r, g, b);
    fl.splat.uniforms.uRadius.value = radius;
    pass(fl.splat, target[1]);
    swap(target);
  }
  function flStep(dt) {
    const v = fl.vel, p = fl.prs;
    fl.curlM.uniforms.tVel.value = v[0].texture; pass(fl.curlM, fl.curl);
    fl.vort.uniforms.tVel.value = v[0].texture; fl.vort.uniforms.tCurl.value = fl.curl.texture; fl.vort.uniforms.uDt.value = dt;
    pass(fl.vort, v[1]); swap(v);
    fl.divM.uniforms.tVel.value = v[0].texture; pass(fl.divM, fl.div);
    fl.scale.uniforms.tSrc.value = p[0].texture; fl.scale.uniforms.uScale.value = 0.8; pass(fl.scale, p[1]); swap(p);
    fl.prsM.uniforms.tDiv.value = fl.div.texture;
    for (let i = 0; i < 20; i++) { fl.prsM.uniforms.tPrs.value = p[0].texture; pass(fl.prsM, p[1]); swap(p); }
    fl.grad.uniforms.tPrs.value = p[0].texture; fl.grad.uniforms.tVel.value = v[0].texture; pass(fl.grad, v[1]); swap(v);
    const a = fl.adv.uniforms;
    a.uDt.value = dt;
    a.tVel.value = v[0].texture; a.tSrc.value = v[0].texture; a.uSrcTexel.value.copy(fl.velTexel); a.uDiss.value = 0.985;
    pass(fl.adv, v[1]); swap(v);
    a.tVel.value = v[0].texture; a.tSrc.value = fl.dye[0].texture; a.uSrcTexel.value.copy(fl.dyeTexel); a.uDiss.value = 0.993;
    pass(fl.adv, fl.dye[1]); swap(fl.dye);
  }
  function flRender(dt) {
    renderWorld();
    const sp = Math.hypot(fishScreen.vx, fishScreen.vy);
    if (sp > 5) {
      const k = fl.w / buf.x, x = fishScreen.tx / buf.x, y = fishScreen.ty / buf.y;
      flSplat(fl.vel, x, y, fishScreen.vx * k, fishScreen.vy * k, 0, 0.0012);
      tmpColor.setHSL((time * 0.05) % 1, 0.85, 0.5);
      const a = Math.min(1, sp / (260 * DPR)) * 0.45;
      flSplat(fl.dye, x, y, tmpColor.r * a, tmpColor.g * a, tmpColor.b * a, 0.0009);
    }
    if (fl.burst) {
      const b = fl.burst; fl.burst = null;
      for (let i = 0; i < 6; i++) {
        const ang = i / 6 * Math.PI * 2;
        flSplat(fl.vel, b.x, b.y, Math.cos(ang) * 60, Math.sin(ang) * 60, 0, 0.0006);
      }
      flSplat(fl.dye, b.x, b.y, 0.5, 0.45, 0.4, 0.002);
    }
    flStep(Math.min(dt, 1 / 30));
    fl.show.uniforms.tDye.value = fl.dye[0].texture;
    fl.show.uniforms.tVelS.value = fl.vel[0].texture;
    pass(fl.show, rtPost);
    finish(rtPost.texture, 0.8);
  }

  // ---- gelatina: a imagem inteira presa numa malha de molas ----
  const jelly = { scene: new T.Scene() };
  jelly.mat = new T.ShaderMaterial({
    uniforms: { tScene: U.tScene },
    vertexShader: `
      attribute vec2 aRest;
      varying vec2 vUv;
      varying vec2 vD;
      void main() { vUv = uv; vD = position.xy - aRest; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tScene;
      varying vec2 vUv;
      varying vec2 vD;
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 1.25);
        vec3 n = normalize(vec3(-vD * 9.0, 1.0));
        float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0), 24.0);
        float rim = smoothstep(0.004, 0.05, length(vD));
        c = c * (1.0 + rim * 0.15) + spec * 0.35 + vec3(1.0, 0.75, 0.9) * rim * 0.06;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  function jellyInit() {
    if (jelly.mesh) { jelly.scene.remove(jelly.mesh); jelly.mesh.geometry.dispose(); }
    const asp = buf.x / buf.y;
    const cols = asp >= 1 ? 40 : Math.max(14, Math.round(28 * asp)), rows = asp >= 1 ? Math.max(14, Math.round(40 / asp)) : 28;
    const geo = new T.PlaneGeometry(2, 2, cols - 1, rows - 1);
    const n = cols * rows, pos = geo.attributes.position, rest = new Float32Array(n * 2);
    const J = Object.assign(jelly, {
      cols, rows, n, x: new Float32Array(n), y: new Float32Array(n), px: new Float32Array(n), py: new Float32Array(n),
      rx: new Float32Array(n), ry: new Float32Array(n), pin: new Uint8Array(n), lr: new Float32Array(n), ld: new Float32Array(n),
    });
    for (let i = 0; i < n; i++) {
      const ix = i % cols, iy = (i / cols) | 0;
      J.rx[i] = J.x[i] = J.px[i] = rest[2 * i] = pos.getX(i);
      J.ry[i] = J.y[i] = J.py[i] = rest[2 * i + 1] = pos.getY(i);
      J.pin[i] = (ix === 0 || iy === 0 || ix === cols - 1 || iy === rows - 1) ? 1 : 0;
    }
    for (let i = 0; i < n; i++) {
      const ix = i % cols, iy = (i / cols) | 0;
      if (ix < cols - 1) J.lr[i] = Math.hypot(J.rx[i + 1] - J.rx[i], J.ry[i + 1] - J.ry[i]);
      if (iy < rows - 1) J.ld[i] = Math.hypot(J.rx[i + cols] - J.rx[i], J.ry[i + cols] - J.ry[i]);
    }
    geo.setAttribute('aRest', new T.BufferAttribute(rest, 2));
    jelly.mesh = new T.Mesh(geo, jelly.mat);
    jelly.mesh.frustumCulled = false;
    jelly.scene.add(jelly.mesh);
    jelly.kicks = [];
    return true;
  }
  function jellyLink(i, j, L0) {
    const J = jelly, dx = J.x[j] - J.x[i], dy = J.y[j] - J.y[i], d = Math.hypot(dx, dy) || 1e-6;
    const wi = J.pin[i] ? 0 : 1, wj = J.pin[j] ? 0 : 1, ws = wi + wj;
    if (!ws) return;
    const k = (d - L0) / d * 0.5 / ws;
    J.x[i] += dx * k * wi; J.y[i] += dy * k * wi;
    J.x[j] -= dx * k * wj; J.y[j] -= dy * k * wj;
  }
  function jellyStep(h) {
    const J = jelly, asp = buf.x / buf.y;
    const fx = fishScreen.x / buf.x * 2 - 1, fy = fishScreen.y / buf.y * 2 - 1;
    const fvx = fishScreen.vx / buf.x * 2, fvy = fishScreen.vy / buf.y * 2, R = 0.3;
    for (let i = 0; i < J.n; i++) {
      if (J.pin[i]) continue;
      const x = J.x[i], y = J.y[i];
      const vx = (x - J.px[i]) * 0.985, vy = (y - J.py[i]) * 0.985;
      let ax = (J.rx[i] - x) * 30 + Math.sin(time * 2.3 + J.ry[i] * 5) * 0.7;
      let ay = (J.ry[i] - y) * 30 + Math.cos(time * 1.9 + J.rx[i] * 4) * 0.7;
      const dx = (x - fx) * asp, dy = y - fy, d = Math.hypot(dx, dy);
      if (d < R) {
        const f = 1 - d / R;
        ax += fvx * f * 14 + dx / (d + 1e-4) * f * 3;
        ay += fvy * f * 14 + dy / (d + 1e-4) * f * 3;
      }
      J.px[i] = x; J.py[i] = y;
      J.x[i] = x + vx + ax * h * h;
      J.y[i] = y + vy + ay * h * h;
    }
    for (const k of J.kicks) {
      for (let i = 0; i < J.n; i++) {
        if (J.pin[i]) continue;
        const dx = (J.x[i] - k.x) * asp, dy = J.y[i] - k.y, d = Math.hypot(dx, dy);
        if (d < 0.35) { const f = (1 - d / 0.35) * 0.012; J.px[i] -= dx / (d + 1e-4) * f; J.py[i] -= dy / (d + 1e-4) * f; }
      }
    }
    J.kicks.length = 0;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < J.n; i++) {
        const ix = i % J.cols, iy = (i / J.cols) | 0;
        if (ix < J.cols - 1) jellyLink(i, i + 1, J.lr[i]);
        if (iy < J.rows - 1) jellyLink(i, i + J.cols, J.ld[i]);
      }
    }
  }
  function jellyRender(dt) {
    renderWorld();
    const steps = Math.min(4, Math.max(1, Math.round(dt * 60)));
    for (let s = 0; s < steps; s++) jellyStep(1 / 60);
    const pos = jelly.mesh.geometry.attributes.position;
    for (let i = 0; i < jelly.n; i++) { pos.setX(i, jelly.x[i]); pos.setY(i, jelly.y[i]); }
    pos.needsUpdate = true;
    renderer.setRenderTarget(rtPost);
    renderer.render(jelly.scene, postCam);
    finish(rtPost.texture, 0.8);
  }

  // ---- areia: onde o peixe passa, a imagem se desfaz em grãos que caem ----
  const sand = {};
  function sandInit() {
    sand.cell = Math.max(2, Math.round(4 * DPR));
    sand.w = Math.ceil(buf.x / sand.cell); sand.h = Math.ceil(buf.y / sand.cell);
    const n = sand.w * sand.h;
    sand.n = n;
    sand.grain = new Uint8Array(n); sand.life = new Float32Array(n); sand.hole = new Float32Array(n);
    sand.rgb = new Uint8Array(n * 3); sand.data = new Uint8Array(n * 4);
    if (sand.tex) sand.tex.dispose();
    sand.tex = new T.DataTexture(sand.data, sand.w, sand.h, T.RGBAFormat);
    sand.tex.minFilter = sand.tex.magFilter = T.NearestFilter; sand.tex.generateMipmaps = false; sand.tex.needsUpdate = true;
    if (!sand.show) sand.show = shader(`
      uniform sampler2D tSand;
      uniform vec2 uGrid;
      uniform float uGrain;
      void main() {
        vec2 px = vUv * uRes;
        vec2 g = floor(px / uGrain), f = (px - g * uGrain) / uGrain;
        vec3 base = S(g * uGrain + 0.5 * uGrain).rgb;
        float n = hash(g);
        float r = length(f - 0.5 - (vec2(hash(g + 1.3), hash(g + 2.7)) - 0.5) * 0.2);
        float shape = 1.0 - smoothstep(0.38, 0.52, r);
        vec3 c = mix(base * 0.55, base * (0.85 + n * 0.3) * (1.0 + (0.5 - r) * 0.4), shape);
        vec4 sd = texture2D(tSand, (g + 0.5) / uGrid);
        float A = sd.a * 255.0;
        if (A > 127.5) {
          vec3 sc = sd.rgb * (0.85 + n * 0.3) * (1.0 + (0.5 - r) * 0.5);
          c = mix(c, mix(base * 0.5, sc, shape), (A - 128.0) / 127.0);
        } else c *= 1.0 - (A / 127.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`, { tSand: { value: null }, uGrid: { value: new T.Vector2() }, uGrain: { value: 1 } });
    sand.show.uniforms.tSand.value = sand.tex;
    sand.show.uniforms.uGrid.value.set(sand.w, sand.h);
    sand.show.uniforms.uGrain.value = sand.cell;
    sand.frame = 0; sand.queue = [];
    return true;
  }
  function sandKnock(gx, gy, r, prob) {
    const S = sand, c = S.cell;
    const x0 = clamp(gx - r, 0, S.w - 1), x1 = clamp(gx + r, 0, S.w - 1), y0 = clamp(gy - r, 0, S.h - 1), y1 = clamp(gy + r, 0, S.h - 1);
    if (x1 < x0 || y1 < y0) return;
    const px0 = x0 * c, py0 = y0 * c;
    const rw = Math.min((x1 - x0 + 1) * c, buf.x - px0), rh = Math.min((y1 - y0 + 1) * c, buf.y - py0);
    if (rw <= 0 || rh <= 0) return;
    if (!S.read || S.read.length < rw * rh * 4) S.read = new Uint8Array(rw * rh * 4);
    renderer.readRenderTargetPixels(rtScene, px0, py0, rw, rh, S.read);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - gx) * (x - gx) + (y - gy) * (y - gy) > r * r || Math.random() > prob) continue;
      const k = y * S.w + x;
      if (S.grain[k] || S.hole[k] > 0.3) continue;
      const lx = Math.min(rw - 1, (x - x0) * c + (c >> 1)), ly = Math.min(rh - 1, (y - y0) * c + (c >> 1)), o = (ly * rw + lx) * 4;
      S.grain[k] = 1; S.life[k] = 3 + Math.random() * 4; S.hole[k] = 1;
      S.rgb[k * 3] = S.read[o]; S.rgb[k * 3 + 1] = S.read[o + 1]; S.rgb[k * 3 + 2] = S.read[o + 2];
    }
  }
  function sandMove(k, j) {
    const S = sand;
    S.grain[j] = 1; S.grain[k] = 0; S.life[j] = S.life[k];
    S.rgb[j * 3] = S.rgb[k * 3]; S.rgb[j * 3 + 1] = S.rgb[k * 3 + 1]; S.rgb[j * 3 + 2] = S.rgb[k * 3 + 2];
  }
  function sandStep(dt) {
    const S = sand, w = S.w, h = S.h;
    S.frame++;
    for (let y = 1; y < h; y++) {
      const ltr = (S.frame + y) & 1;
      for (let i = 0; i < w; i++) {
        const x = ltr ? i : w - 1 - i, k = y * w + x;
        if (!S.grain[k]) continue;
        const b = k - w;
        if (!S.grain[b]) { sandMove(k, b); continue; }
        const s = Math.random() < 0.5 ? -1 : 1;
        if (x + s >= 0 && x + s < w && !S.grain[b + s]) sandMove(k, b + s);
        else if (x - s >= 0 && x - s < w && !S.grain[b - s]) sandMove(k, b - s);
      }
    }
    const D = S.data;
    for (let k = 0; k < S.n; k++) {
      const o = k * 4;
      if (S.grain[k]) {
        S.life[k] -= dt;
        if (S.life[k] <= 0) S.grain[k] = 0;
      }
      if (S.hole[k] > 0) S.hole[k] = Math.max(0, S.hole[k] - dt * 0.3);
      if (S.grain[k]) {
        D[o] = S.rgb[k * 3]; D[o + 1] = S.rgb[k * 3 + 1]; D[o + 2] = S.rgb[k * 3 + 2];
        D[o + 3] = 128 + Math.round(Math.min(1, S.life[k]) * 127);
      } else D[o + 3] = Math.round(S.hole[k] * 127);
    }
    S.tex.needsUpdate = true;
  }
  function sandRender(dt) {
    renderWorld();
    const spd = Math.hypot(fishScreen.vx, fishScreen.vy) / DPR;
    const r = Math.round(28 * DPR / sand.cell);
    if (spd > 15) sandKnock(Math.floor(fishScreen.x / sand.cell), Math.floor(fishScreen.y / sand.cell), r, Math.min(0.35, spd / 700));
    for (const p of sand.queue) sandKnock(Math.floor(p.x / sand.cell), Math.floor(p.y / sand.cell), Math.round(r * 1.5), 0.6);
    sand.queue.length = 0;
    sandStep(dt);
    pass(sand.show, rtPost);
    finish(rtPost.texture, 0.7);
  }
