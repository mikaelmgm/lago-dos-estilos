
  // ---------- pós-processamento: base comum ----------
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const postScene = new T.Scene(), postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2));
  quad.frustumCulled = false; postScene.add(quad);
  const U = {
    tScene: { value: null }, tDepth: { value: null }, uRes: { value: buf }, uTime: { value: 0 },
    uCell: { value: 8 }, uDpr: { value: DPR }, uNear: { value: 1 }, uFar: { value: 400 }, uOrtho: { value: 0 },
  };
  const COMMON = `
    uniform sampler2D tScene;
    uniform sampler2D tDepth;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uCell;
    uniform float uDpr;
    uniform float uNear;
    uniform float uFar;
    uniform float uOrtho;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec4 S(vec2 px) { return texture2D(tScene, px / uRes); }
    float idAt(vec2 px) { return floor(texture2D(tScene, px / uRes).a * 255.0 / 16.0 + 0.01); }
    float depthAt(vec2 px) {
      float d = texture2D(tDepth, px / uRes).x;
      if (uOrtho > 0.5) return uNear + d * (uFar - uNear);
      float z = d * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    // contorno: onde muda o tipo de material, a profundidade ou a luz de uma face
    float edgeLum = 1.0;
    float edgeN(vec2 q, float id0, float d0, float l0) {
      float e = abs(idAt(q) - id0) > 0.5 ? 1.0 : 0.0;
      e = max(e, smoothstep(0.03, 0.08, abs(depthAt(q) - d0) / max(d0, 0.001)));
      return max(e, edgeLum * smoothstep(0.10, 0.22, abs(luma(S(q).rgb) - l0)));
    }
    float edgeAt(vec2 px, float w) {
      float id0 = idAt(px), d0 = depthAt(px), l0 = luma(S(px).rgb);
      float e = edgeN(px + vec2(w, 0.0), id0, d0, l0);
      e = max(e, edgeN(px - vec2(w, 0.0), id0, d0, l0));
      e = max(e, edgeN(px + vec2(0.0, w), id0, d0, l0));
      return max(e, edgeN(px - vec2(0.0, w), id0, d0, l0));
    }
  `;
  function shader(frag, extra = {}, opts = {}) {
    return new T.ShaderMaterial(Object.assign({
      uniforms: Object.assign({}, U, extra), vertexShader: VERT, fragmentShader: COMMON + frag, depthTest: false, depthWrite: false,
    }, opts));
  }

  const rtOpts = (filter, extra) => Object.assign({ minFilter: filter, magFilter: filter, format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false }, extra);
  const sized = [];
  function makeRT(scale, filter = T.LinearFilter, extra) {
    const rt = new T.WebGLRenderTarget(Math.max(1, Math.round(buf.x * scale)), Math.max(1, Math.round(buf.y * scale)), rtOpts(filter, extra));
    sized.push([rt, scale]);
    return rt;
  }
  const rtScene = makeRT(1, T.NearestFilter, { depthBuffer: true });
  rtScene.depthTexture = new T.DepthTexture(1, 1);
  rtScene.depthTexture.type = T.UnsignedIntType;
  U.tScene.value = rtScene.texture;
  U.tDepth.value = rtScene.depthTexture;
  const rtPost = makeRT(1);

  function pass(material, target) { quad.material = material; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
  function renderWorld() {
    U.uNear.value = activeCam.near; U.uFar.value = activeCam.far; U.uOrtho.value = activeCam.isOrthographicCamera ? 1 : 0;
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, activeCam);
  }

  // miniatura: desfoca em cima e embaixo, ajusta a cor e escurece as bordas
  const tiltMat = new T.ShaderMaterial({
    uniforms: { tIn: { value: null }, uRes: { value: buf }, uBlur: { value: 7 }, uFocus: { value: 0.5 }, uGrade: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tIn;
      uniform vec2 uRes;
      uniform float uBlur;
      uniform float uFocus;
      uniform float uGrade;
      varying vec2 vUv;
      void main() {
        float r = smoothstep(0.14, 0.5, abs(vUv.y - uFocus)) * uBlur;
        vec3 c = texture2D(tIn, vUv).rgb;
        if (r > 0.6) {
          vec3 acc = c;
          for (int i = 0; i < 16; i++) {
            float fi = float(i);
            float a = fi * 2.39996323;
            acc += texture2D(tIn, vUv + vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 16.0) * r / uRes).rgb;
          }
          c = acc / 17.0;
        }
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 g = mix(vec3(l), c, 1.1) * vec3(1.03, 1.0, 0.95);
        vec2 q = vUv - 0.5;
        g *= 1.0 - dot(q, q) * 0.6;
        gl_FragColor = vec4(mix(c, g, uGrade), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  function finish(tex, blur = 1, grade = 1) {
    tiltMat.uniforms.tIn.value = tex;
    tiltMat.uniforms.uBlur.value = 7 * DPR * blur;
    tiltMat.uniforms.uGrade.value = grade;
    tiltMat.uniforms.uFocus.value = clamp(focus, 0.3, 0.7);
    pass(tiltMat, null);
  }
  // estilo simples: cena -> filtro -> (miniatura) -> tela
  function filtered(material, blur = 1, grade = 1) {
    return () => {
      renderWorld();
      if (blur > 0) { pass(material, rtPost); finish(rtPost.texture, blur, grade); }
      else pass(material, null);
    };
  }

  // ---------- atlas de letras (ASCII e tipografia) ----------
  const GLYPHS = [
    '  ..--==++', // vazio
    ' .,`\':;!il', // grama
    ' .:+o*0%@@', // folhas
    ' .-~~~~~==', // água
    ' .,:;oO08%', // areia, terra, ração
    ' .:-=+*%##', // pedra
    ' .:!|/(I#H', // madeira
    ' .<>=*%#@@', // peixe
    ' .ooOO00@@', // bolhas
    ' .:;=+*o@@', // vitória-régia
    ' .,|!|Il|I', // junco e alga
    ' .*+x*X%@&', // flores
  ];
  const WORDS = ['céu', 'grama', 'folha', 'água', 'areia', 'pedra', 'madeira', 'peixe', 'bolha', 'lírio', 'junco', 'flor'];
  const WEIGHTS = [300, 500, 700, 800];
  function canvasTex(cv) {
    const t = new T.CanvasTexture(cv);
    t.flipY = false; t.generateMipmaps = false;
    t.minFilter = t.magFilter = T.NearestFilter;
    return t;
  }
  const asciiU = { tGlyph: { value: null }, uAtlas: { value: new T.Vector2(1, 1) } };
  function rebuildAscii() {
    const cell = U.uCell.value;
    const cv = document.createElement('canvas');
    cv.width = cell * 10; cv.height = cell * GLYPHS.length;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(cell * 0.98)}px "JetBrains Mono", ui-monospace, Consolas, "Courier New", monospace`;
    GLYPHS.forEach((row, r) => { for (let i = 0; i < 10; i++) ctx.fillText(row[i], i * cell + cell / 2, r * cell + cell / 2 + cell * 0.04); });
    if (asciiU.tGlyph.value) asciiU.tGlyph.value.dispose();
    asciiU.tGlyph.value = canvasTex(cv);
    asciiU.uAtlas.value.set(cv.width, cv.height);
  }
  const typeU = { tWords: { value: null }, uWords: { value: new T.Vector2(1, 1) }, uCellW: { value: 40 } };
  function rebuildType() {
    const h = U.uCell.value, w = Math.round(h * 3.4);
    const cv = document.createElement('canvas');
    cv.width = w * WEIGHTS.length; cv.height = h * WORDS.length;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    WORDS.forEach((word, r) => WEIGHTS.forEach((wt, c) => {
      ctx.font = `${wt} ${Math.round(h * 0.86)}px "Bricolage Grotesque", "Figtree", ui-sans-serif, sans-serif`;
      const mw = ctx.measureText(word).width, sx = Math.min(1, (w * 0.92) / mw);
      ctx.save();
      ctx.translate(c * w + w / 2, r * h + h / 2 + h * 0.05);
      ctx.scale(sx, 1);
      ctx.fillText(word, 0, 0);
      ctx.restore();
    }));
    if (typeU.tWords.value) typeU.tWords.value.dispose();
    const t = canvasTex(cv); t.minFilter = t.magFilter = T.LinearFilter;
    typeU.tWords.value = t;
    typeU.uWords.value.set(cv.width, cv.height);
    typeU.uCellW.value = w;
  }

  // ---------- filtros ----------
  const asciiMat = shader(`
    uniform sampler2D tGlyph;
    uniform vec2 uAtlas;
    void main() {
      vec2 px = vUv * uRes;
      vec2 cell = floor(px / uCell), o = cell * uCell, lp = floor(px - o);
      vec3 c = (S(o + uCell * vec2(0.25, 0.25)).rgb + S(o + uCell * vec2(0.75, 0.25)).rgb
              + S(o + uCell * vec2(0.25, 0.75)).rgb + S(o + uCell * vec2(0.75, 0.75)).rgb) * 0.25;
      float id = clamp(idAt(o + uCell * 0.5), 0.0, 11.0);
      float t = (luma(c) - 0.16) / 0.68 + (hash(cell) - 0.5) * 0.22 - (abs(id - 3.0) < 0.5 ? 0.12 : 0.0);
      if (abs(id - 3.0) < 0.5) t += 0.17 * sin(uTime * 1.6 + cell.x * 0.45 + cell.y * 0.8) + 0.08 * sin(uTime * 2.7 - cell.x * 0.9 + cell.y * 0.3);
      float lvl = clamp(floor(t * 10.0), 1.0, 9.0);
      vec2 g = vec2(lvl * uCell + lp.x + 0.5, id * uCell + (uCell - 1.0 - lp.y) + 0.5) / uAtlas;
      float m = texture2D(tGlyph, g).r;
      gl_FragColor = vec4(mix(c * 0.72, min(c * 1.34 + 0.05, vec3(1.0)), m), 1.0);
    }`, asciiU);

  const ditherMat = shader(`
    float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
    void main() {
      vec2 px = vUv * uRes;
      vec2 cell = floor(px / uCell), ctr = cell * uCell + 0.5 * uCell;
      float l = pow(clamp((luma(S(ctr).rgb) - 0.04) / 0.72, 0.0, 1.0), 0.85);
      float on = step(bayer8(cell), l);
      edgeLum = 0.0;
      float e = step(0.5, edgeAt(ctr, uCell));
      vec3 ink = vec3(0.13, 0.12, 0.2), paper = vec3(0.93, 0.9, 0.79);
      gl_FragColor = vec4(mix(ink, paper, on * (1.0 - e)), 1.0);
    }`);

  const hatchMat = shader(`
    float hatch(vec2 p, float ang, float sp) {
      vec2 d = vec2(cos(ang), sin(ang));
      float f = abs(fract(dot(p, vec2(-d.y, d.x)) / sp) - 0.5) * sp;
      return 1.0 - smoothstep(0.45 * uDpr, 1.35 * uDpr, f);
    }
    void main() {
      vec2 px = vUv * uRes;
      float boil = floor(uTime * 4.0);
      vec2 q = px + (vec2(noise(px * 0.02 / uDpr + boil * 7.1), noise(px * 0.02 / uDpr + boil * 3.7 + 11.0)) - 0.5) * uCell * 0.7;
      vec3 col = S(px).rgb;
      float l = luma(col);
      float sp = uCell, ink = 0.0;
      if (l < 0.74) ink = max(ink, hatch(q, 0.785, sp));
      if (l < 0.55) ink = max(ink, hatch(q, -0.785, sp));
      if (l < 0.40) ink = max(ink, hatch(q, 0.0, sp * 0.8));
      if (l < 0.27) ink = max(ink, hatch(q, 1.5708, sp * 0.7));
      ink *= 0.5 + 0.5 * noise(q * vec2(0.9, 0.08) / uDpr + boil);
      float e = edgeAt(q, 1.2 * uDpr);
      vec3 paper = vec3(0.96, 0.94, 0.88) - fbm(px * 0.35 / uDpr) * 0.07;
      vec3 tint = mix(paper, col * 1.08, 0.3);
      float id = idAt(px);
      vec3 pencil = vec3(0.17, 0.17, 0.22);
      if (abs(id - 7.0) < 0.5) pencil = vec3(0.86, 0.26, 0.12);
      if (abs(id - 3.0) < 0.5) pencil = vec3(0.16, 0.3, 0.45);
      gl_FragColor = vec4(mix(tint, pencil, clamp(ink * 0.75 + e * 0.9, 0.0, 1.0)), 1.0);
    }`);

  const risoMat = shader(`
    float dots(vec2 p, float ang, float sp, float amount) {
      float s = sin(ang), c = cos(ang);
      vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / sp;
      float rad = sqrt(clamp(amount, 0.0, 1.0)) * 0.66;
      return 1.0 - smoothstep(rad - 0.09, rad + 0.09, length(fract(r) - 0.5));
    }
    void main() {
      vec2 px = vUv * uRes;
      float sp = uCell;
      vec3 cB = S(px + vec2(1.6, -1.1) * uDpr).rgb, cP = S(px + vec2(-1.3, 0.9) * uDpr).rgb, cY = S(px).rgb;
      float blue = clamp((1.0 - cB.r) * 0.78 - 0.1, 0.0, 1.0);
      float pink = clamp((1.0 - cP.g) * 0.75 - 0.08, 0.0, 1.0);
      float yell = clamp((1.0 - cY.b) * 0.8 - 0.06, 0.0, 1.0);
      vec3 paper = vec3(0.96, 0.94, 0.89) * (0.97 + 0.03 * hash(floor(px / uDpr)));
      vec3 o = paper;
      o *= mix(vec3(1.0), vec3(1.0, 0.91, 0.0), dots(px, 0.0, sp, yell) * 0.88);
      o *= mix(vec3(1.0), vec3(1.0, 0.28, 0.69), dots(px + 3.0, 1.309, sp, pink) * 0.9);
      o *= mix(vec3(1.0), vec3(0.0, 0.47, 0.75), dots(px + 7.0, 0.2618, sp, blue) * 0.92);
      o *= 1.0 - step(0.996, hash(floor(px / (2.0 * uDpr)) + floor(uTime * 0.5))) * 0.3;
      gl_FragColor = vec4(o, 1.0);
    }`);

  const crtMat = shader(`
    vec2 curve(vec2 uv) { uv = uv * 2.0 - 1.0; vec2 off = abs(uv.yx) / vec2(5.5, 4.5); uv = uv + uv * off * off; return uv * 0.5 + 0.5; }
    void main() {
      vec2 uv = curve(vUv);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.02, 0.02, 0.02, 1.0); return; }
      float lines = 240.0, row = floor(uv.y * lines);
      float band = fract(uTime * 0.07);
      float inBand = 1.0 - smoothstep(0.0, 0.035, abs(uv.y - (1.0 - band)));
      float jit = (hash(vec2(row, floor(uTime * 24.0))) - 0.5) * 0.002 + inBand * (hash(vec2(row, uTime)) - 0.5) * 0.03;
      vec2 u = vec2((floor((uv.x + jit) * 420.0) + 0.5) / 420.0, (row + 0.5) / lines);
      float ab = 0.0025 + inBand * 0.006;
      vec3 c = vec3(texture2D(tScene, u + vec2(ab, 0.0)).r, texture2D(tScene, u).g, texture2D(tScene, u - vec2(ab, 0.0)).b);
      vec3 glow = (texture2D(tScene, u + vec2(0.004, 0.0)).rgb + texture2D(tScene, u - vec2(0.004, 0.0)).rgb
                 + texture2D(tScene, u + vec2(0.0, 0.006)).rgb + texture2D(tScene, u - vec2(0.0, 0.006)).rgb) * 0.25;
      c = c * 1.05 + glow * 0.3;
      c *= 0.62 + 0.38 * sin(uv.y * lines * 6.2831853);
      float m = mod(gl_FragCoord.x / uDpr, 3.0);
      c *= vec3(m < 1.0 ? 1.0 : 0.72, (m >= 1.0 && m < 2.0) ? 1.0 : 0.72, m >= 2.0 ? 1.0 : 0.72);
      c += (hash(gl_FragCoord.xy + floor(uTime * 60.0)) - 0.5) * 0.08 + inBand * hash(vec2(row * 3.1, uTime)) * 0.25;
      c = mix(vec3(luma(c)), c, 0.85);
      vec2 v = uv * (1.0 - uv.yx);
      c *= pow(clamp(v.x * v.y * 15.0, 0.0, 1.0), 0.25) * 1.25;
      gl_FragColor = vec4(c, 1.0);
    }`);

  const waterColorMat = shader(`
    void main() {
      vec2 px = vUv * uRes;
      vec2 w = vec2(fbm(px * 0.004 / uDpr + 3.0), fbm(px * 0.004 / uDpr + 9.0)) - 0.5;
      vec2 q = px + w * 28.0 * uDpr;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float fi = float(i), a = fi * 2.39996;
        acc += S(q + vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 12.0) * 7.0 * uDpr).rgb;
      }
      vec3 c = acc / 12.0;
      float l = luma(c), lq = floor(l * 5.0 + 0.5) / 5.0;
      c *= (lq + 0.08) / (l + 0.08);
      float edge = length(S(q + vec2(4.0, 0.0) * uDpr).rgb - S(q - vec2(4.0, 0.0) * uDpr).rgb)
                 + length(S(q + vec2(0.0, 4.0) * uDpr).rgb - S(q - vec2(0.0, 4.0) * uDpr).rgb);
      vec3 paper = vec3(0.97, 0.95, 0.9) - fbm(px * 0.5 / uDpr) * 0.06;
      float gran = noise(px * 0.35 / uDpr) * 0.5 + noise(px * 1.3 / uDpr) * 0.5;
      vec3 o = paper * mix(vec3(1.0), min(c * 1.12 + 0.04, vec3(1.0)), 0.86 + 0.14 * gran);
      o *= 1.0 - smoothstep(0.12, 0.55, edge) * 0.3;
      o = mix(o, paper, smoothstep(0.62, 0.78, fbm(px * 0.006 / uDpr + 20.0)) * 0.35);
      gl_FragColor = vec4(o, 1.0);
    }`);

  const mosaicMat = shader(`
    void main() {
      vec2 px = vUv * uRes;
      vec2 cell = floor(px / uCell), f = (px - cell * uCell) / uCell;
      vec3 col = S(cell * uCell + 0.5 * uCell).rgb;
      float h = hash(cell);
      float o = step(0.5, hash(cell + floor(uTime * 0.35 + h * 3.0) * 13.1));
      vec2 g = f; if (o > 0.5) g.x = 1.0 - g.x;
      float d = min(abs(length(g) - 0.5), abs(length(g - 1.0) - 0.5));
      float th = mix(0.07, 0.24, luma(col));
      float aa = 1.5 / uCell;
      float arc = 1.0 - smoothstep(th - aa, th + aa, d);
      vec3 c = mix(col * 0.32 + 0.02, min(col * 1.25 + 0.06, vec3(1.0)), arc);
      float core = 1.0 - smoothstep(0.015, 0.015 + aa, d);
      c = mix(c, col * 0.55, core * 0.75);
      gl_FragColor = vec4(c, 1.0);
    }`);

  const typeMat = shader(`
    uniform sampler2D tWords;
    uniform vec2 uWords;
    uniform float uCellW;
    void main() {
      vec2 px = vUv * uRes;
      float h = uCell, w = uCellW;
      float row = floor(px.y / h);
      float dir = mod(row, 2.0) < 0.5 ? 1.0 : -1.0;
      float shift = dir * uTime * w * 0.35 + sin(uTime * 0.8 + row * 0.45) * w * 0.4;
      vec2 sp = vec2(px.x + shift, px.y);
      vec2 cell = floor(sp / vec2(w, h));
      vec2 f = (sp - cell * vec2(w, h)) / vec2(w, h);
      vec2 ctr = (cell + 0.5) * vec2(w, h) - vec2(shift, 0.0);
      vec3 c = S(ctr).rgb;
      float id = clamp(idAt(ctr), 0.0, 11.0);
      float wt = clamp(floor((luma(c) - 0.2) / 0.6 * 4.0), 0.0, 3.0);
      float pulse = 0.88 + 0.16 * sin(uTime * 3.0 + hash(cell) * 6.28);
      vec2 g = (f - 0.5) / pulse + 0.5;
      float m = 0.0;
      if (g.x > 0.0 && g.x < 1.0 && g.y > 0.0 && g.y < 1.0)
        m = texture2D(tWords, vec2((wt + g.x) * w, (id + 1.0 - g.y) * h) / uWords).r;
      gl_FragColor = vec4(mix(c * 0.45 + 0.03, min(c * 1.35 + 0.1, vec3(1.0)), m), 1.0);
    }`, typeU);

  // fliperama vetorial: só as linhas de contorno, em neon, com rastro do fósforo
  const vecA = makeRT(1), vecB = makeRT(1);
  let vecFlip = false;
  const vecMat = shader(`
    uniform sampler2D tPrev;
    vec3 neon(float id) {
      if (id < 0.5) return vec3(0.2, 1.0, 0.5);
      if (id < 1.5) return vec3(0.25, 1.0, 0.35);
      if (id < 2.5) return vec3(0.45, 1.0, 0.3);
      if (id < 3.5) return vec3(0.2, 0.8, 1.0);
      if (id < 4.5) return vec3(1.0, 0.85, 0.3);
      if (id < 5.5) return vec3(0.75, 0.75, 1.0);
      if (id < 6.5) return vec3(1.0, 0.55, 0.25);
      if (id < 7.5) return vec3(1.0, 0.35, 0.2);
      if (id < 8.5) return vec3(0.9, 1.0, 1.0);
      if (id < 9.5) return vec3(0.3, 1.0, 0.6);
      if (id < 10.5) return vec3(0.5, 1.0, 0.4);
      return vec3(1.0, 0.5, 0.9);
    }
    void main() {
      vec2 px = vUv * uRes;
      vec3 cur = neon(idAt(px)) * edgeAt(px, uDpr);
      gl_FragColor = vec4(max(cur, texture2D(tPrev, vUv).rgb * 0.84), 1.0);
    }`, { tPrev: { value: null } });
  const vecShow = new T.ShaderMaterial({
    uniforms: { tIn: { value: null }, uRes: { value: buf }, uTime: U.uTime, uDpr: U.uDpr },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tIn;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uDpr;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tIn, vUv).rgb, b = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          float fi = float(i), a = fi * 2.39996;
          b += texture2D(tIn, vUv + vec2(cos(a), sin(a)) * (2.0 + fi * 0.7) * uDpr / uRes).rgb;
        }
        vec3 o = c * 1.1 + b / 12.0 * 0.9 + vec3(0.0, 0.015, 0.01);
        o *= 0.96 + 0.04 * sin(uTime * 55.0);
        gl_FragColor = vec4(o, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  function renderVector() {
    renderWorld();
    const src = vecFlip ? vecA : vecB, dst = vecFlip ? vecB : vecA;
    vecMat.uniforms.tPrev.value = src.texture;
    pass(vecMat, dst);
    vecShow.uniforms.tIn.value = dst.texture;
    pass(vecShow, null);
    vecFlip = !vecFlip;
  }

  // três tons de luz para os materiais de desenho animado (cel shading)
  const toonGrad = new T.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
  toonGrad.minFilter = toonGrad.magFilter = T.NearestFilter; toonGrad.generateMipmaps = false; toonGrad.needsUpdate = true;
