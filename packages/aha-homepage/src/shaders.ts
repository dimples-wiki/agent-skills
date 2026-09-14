/* —— aha 主页的 WGSL 着色器 ——
 * 约定遵循 vgpu effect():fragment 入口 fs + @group(0) @binding(0) uniform。
 * 颜色纪律与 aha 图解页一致:tint 从外部传入,不在着色器里硬编码品牌色。
 */

export type FieldName = "insight" | "wave" | "dome";

/** 「顿悟场」:混沌的域扭曲噪声(雾里看花),光标附近组织成清晰的等高线环(噢!时刻) */
const INSIGHT = /* wgsl */ `
struct U {
  time: f32,
  speed: f32,
  res: vec2f,
  mouse: vec2f,
  tint: vec3f,
  tint2: vec3f,
};
@group(0) @binding(0) var<uniform> u: U;

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var q = p;
  for (var i = 0; i < 5; i = i + 1) {
    v = v + amp * vnoise(q);
    q = q * 2.03 + vec2f(1.7, 9.2);
    amp = amp * 0.5;
  }
  return v;
}

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = u.time * u.speed;
  let asp = u.res.x / max(u.res.y, 1.0);
  let p0 = (uv - vec2f(0.5, 0.5)) * vec2f(asp, 1.0) * 2.4;

  let q = vec2f(
    fbm(p0 + vec2f(0.0, t * 0.10)),
    fbm(p0 + vec2f(5.2, 1.3) - vec2f(t * 0.07, 0.0)),
  );
  let r = vec2f(
    fbm(p0 + 2.2 * q + vec2f(1.7, 9.2) + vec2f(t * 0.06, t * 0.09)),
    fbm(p0 + 2.2 * q + vec2f(8.3, 2.8) - vec2f(t * 0.05, t * 0.08)),
  );
  let f = fbm(p0 + 2.0 * r);

  let clarity = exp(-dot(p0, p0) * 0.35);
  let ring = smoothstep(0.84, 1.0, fract(f * 5.0 - t * 0.12));
  let field = mix(f, max(f * 0.30, ring * 0.85 + 0.08), clarity);

  let base = vec3f(0.075, 0.061, 0.053);
  let deep = vec3f(0.16, 0.11, 0.085);
  var col = mix(base, deep, clamp(q.x * 0.9, 0.0, 1.0));
  col = col + u.tint * pow(clamp(field, 0.0, 1.0), 2.2) * 0.95;
  col = col + u.tint2 * pow(clamp(r.y, 0.0, 1.0), 3.5) * 0.30;
  col = col + u.tint * clarity * 0.16;

  let vig = smoothstep(1.5, 0.45, length((uv - vec2f(0.5, 0.5)) * vec2f(asp, 1.0) * 1.7));
  col = col * mix(0.5, 1.0, vig);
  col = col + vec3f((hash21(uv * u.res + vec2f(t)) - 0.5) * 0.006);

  return vec4f(col, 1.0);
}
`;

/** 「波带」:页脚前的两条正弦波干涉,上下淡出融入背景 */
const WAVE = /* wgsl */ `
struct U {
  time: f32,
  speed: f32,
  res: vec2f,
  mouse: vec2f,
  tint: vec3f,
  tint2: vec3f,
};
@group(0) @binding(0) var<uniform> u: U;

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = (uv - vec2f(0.5, 0.5)) * vec2f(10.0, 3.0);
  let t = u.time * u.speed;
  let w1 = sin(p.x * 1.2 + t) * cos(p.y * 1.6 + t * 0.6);
  let w2 = sin(p.x * 1.2 - t * 0.8 + 2.0) * cos(p.y * 1.6 + 1.0);
  let v = (w1 + w2) * 0.5;

  let base = vec3f(0.075, 0.061, 0.053);
  let c = mix(u.tint2 * 0.22, u.tint, smoothstep(0.0, 0.9, abs(v)));
  var col = base + c * (0.10 + abs(v) * 0.30);

  let fade = smoothstep(0.0, 0.35, uv.y) * smoothstep(1.0, 0.65, uv.y);
  col = mix(base, col, fade);
  return vec4f(col, 1.0);
}
`;

/* ============================================================
   「顿悟穹顶」:整屏画布底部锚定的釉面半球
   几何:圆弧过 (±W/2, H) 与 (0, H-capH),任何宽高比都精确贴底满宽
   材质:釉面高光 + 菲涅尔轮廓 + 细密 LED 磨砂 + 低对比极光
   灵魂:大眼睛(眼睑/眨眼/视线跟随),hover 时瞳孔化作金色四芒星
   ============================================================ */
/* ============================================================
   「顿悟穹顶」· 参照社区标杆 theSphere(Alexandre Devaux)配方重写:
   透视 ray-sphere(立体感)· 表情画在球面经纬 UV · 内容量化到 LED
   格点(光从 LED 里发出)· 鼠标视差 · theSphere 式表情整体朝视线滑移
   ============================================================ */
const DOME = /* wgsl */ `
struct U {
  time: f32,
  speed: f32,
  mood: f32,
  pulse: f32,
  boot: f32,
  res: vec2f,
  mouse: vec2f,
  look: vec2f,
  tint: vec3f,
  tint2: vec3f,
};
@group(0) @binding(0) var<uniform> u: U;

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var q = p;
  for (var i = 0; i < 3; i = i + 1) {
    v = v + amp * vnoise(q);
    q = q * 2.13 + vec2f(1.7, 9.2);
    amp = amp * 0.5;
  }
  return v;
}
fn sdSeg(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// —— LED 面板坐标系(经纬 → equirect 格点) ——
const LX = 30.0;   // 经向 LED 数(整圈)
const LY = 22.0;   // 纬向 LED 数(半圈)

/** 穹顶「内容」的连续亮度:极光底 + 表情。坐标 e = 经纬 LED 单位(格心采样后即 LED 画面) */
fn ledFace(e: vec2f, lk: vec2f, m: f32, blink: f32, t: f32) -> f32 {
  // 早退:远离脸部区域的 LED 直接 0(可见穹顶大部分像素跳过全部表情 SDF)
  if (abs(e.x) > 11.5 || e.y < -9.5 || e.y > 9.5) { return 0.0; }
  // theSphere 技巧:表情整体朝视线滑移,中心动得多、边缘少
  let fall = clamp(1.0 - length(e) / 11.0, 0.0, 1.0);
  let p = e - lk * (0.45 + 0.55 * fall);

  // 眼睛(半径 eyeRad;亮度另行命名,避免 WGSL 同作用域重声明)
  let eyeRad = 2.1;
  let eyeH = eyeRad * (1.24 - blink * 0.92);
  let eL = vec2f(-4.9, 1.9);
  let eR = vec2f(4.9, 1.9);
  let dEL = length((p - eL) / vec2f(eyeRad, eyeH)) - 1.0;
  let dER = length((p - eR) / vec2f(eyeRad, eyeH)) - 1.0;
  // 眼睑裁切(上缘)
  let lidL = smoothstep(0.0, 0.35, (eL.y + eyeH * (1.0 - blink * 1.85)) - p.y);
  let lidR = smoothstep(0.0, 0.35, (eR.y + eyeH * (1.0 - blink * 1.85)) - p.y);
  let eyeL = smoothstep(0.06, -0.06, dEL) * lidL;
  let eyeR = smoothstep(0.06, -0.06, dER) * lidR;
  let eye = max(eyeL, eyeR) * 1.0;                     // 眼白亮度 1.0

  // 瞳孔(琥珀)/ 四芒星(顿悟):额外跟随视线
  let pL = p - (eL + lk * vec2f(0.85, 0.5));
  let pR = p - (eR + lk * vec2f(0.85, 0.5));
  let pupilR0 = 0.82 * (1.0 + 0.30 * m);
  let pupilL = smoothstep(0.06, -0.06, length(pL) - pupilR0);
  let pupilR = smoothstep(0.06, -0.06, length(pR) - pupilR0);
  var starM = 0.0;
  if (m > 0.01) {                   // 星星眼仅顿悟时计算(uniform 分支,整块跳过)
    let sR0 = 1.18 * m;
    let aL = atan2(pL.y, pL.x);
    let aR = atan2(pR.y, pR.x);
    starM = max(
      smoothstep(0.07, -0.07, length(pL) - sR0 * (0.40 + 0.60 * abs(cos(2.0 * aL)))),
      smoothstep(0.07, -0.07, length(pR) - sR0 * (0.40 + 0.60 * abs(cos(2.0 * aR)))),
    );
  }

  // 高光点(水晶感)
  let hl = max(
    smoothstep(0.16, -0.10, length(pL - vec2f(0.34, 0.40)) - 0.27),
    smoothstep(0.16, -0.10, length(pR - vec2f(0.34, 0.40)) - 0.27),
  );

  // 微笑弧
  let mc = vec2f(0.0, mix(-3.1, -3.25, m));
  let mRad = mix(2.6, 3.0, m);
  let dArc = abs(length(p - mc) - mRad);
  let lower = smoothstep(0.0, 0.3, mc.y - p.y);
  let smile = smoothstep(mix(0.30, 0.44, m), -0.06, dArc) * lower * 0.98;

  // 合成亮度:眼底 1.0 → 瞳孔 0.30 → 星 2.1 → 高光 2.6 → 嘴 0.62
  var v = eye;
  v = mix(v, 0.30, max(pupilL, pupilR) * (1.0 - m) * max(eyeL, eyeR));
  v = mix(v, 2.05, starM * max(eyeL, eyeR));
  v = max(v, smile);
  v = mix(v, 2.6, min(hl, 1.0) * max(eyeL, eyeR) * (1.0 - m * 0.4));
  return v;
}

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = u.time * u.speed;
  let m = u.mood;
  let ASP = u.res.x / max(u.res.y, 1.0);

  // —— 透视相机(z=0 平面铺满视口,鼠标微视差) ——
  let TH = 0.44;                     // tan(半 fov)
  let D = 6.0;                       // 相机距离
  let ph = (uv - vec2f(0.5, 0.5)) * 2.0;
  let par = (u.mouse - vec2f(0.5, 0.5)) * vec2f(0.15, 0.09);
  let ro = vec3f(par.x, par.y, D);
  let rd = normalize(vec3f(ph.x * TH * ASP, ph.y * TH, -D));

  // —— 天幕 ——
  let base = vec3f(0.078, 0.064, 0.055);
  var col = mix(vec3f(0.100, 0.078, 0.060), base, smoothstep(0.0, 0.85, uv.y));
  let cellId = floor(uv * u.res / 3.0);
  let sh = hash21(cellId);
  if (sh > 0.9977) {
    let tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (1.2 + sh * 30.0) + sh * 99.0));
    col = col + vec3f(0.95, 0.9, 0.82) * tw * 0.35 * u.boot * uv.y;
  }

  // —— 透视 ray-sphere:球心屏下,顶点约在屏高 30% 处 ——
  let SC = vec3f(0.0, -4.35, 0.0);
  let SR = 3.3;
  let oc = ro - SC;
  let b = dot(oc, rd);
  let c = dot(oc, oc) - SR * SR;
  let disc = b * b - c;

  if (disc > 0.0) {
    let th = -b - sqrt(disc);
    let hit = ro + rd * th;
    let n = (hit - SC) / SR;
    let h = hash21(floor(vec2(atan2(n.z, n.x), n.y) * 90.0));

    // 经纬 → LED 格
    let lon = atan2(n.z, n.x);
    let lat = asin(clamp(n.y, -1.0, 1.0));
    let ec = vec2f((lon / 6.28318 + 0.5) * LX, (lat / 3.14159 + 0.5) * LY * 2.0);
    let cell = floor(ec);
    let fr = ec - cell - vec2f(0.5);
    let dotMask = smoothstep(0.52, 0.18, length(fr));   // LED 圆点
    let jitter = 0.72 + 0.28 * hash21(cell);            // 每颗 LED 微差

    // 视线(经纬方向)与眨眼
    let look = clamp(u.look, vec2f(-1.0), vec2f(1.0)) * vec2f(2.6, 1.9);
    let lidOpen = smoothstep(0.70, 0.92, u.boot);
    let cyc = fract(t / 4.3);
    let blink = smoothstep(0.05, 0.0, abs(cyc - 0.88)) * 0.94 * lidOpen + m * 0.14;

    // LED 画面 = 格心采样的连续内容(真正"显示在 LED 上")
    // 脸部坐标:以可见带中心(LX/2, ~33.8)为原点
    let center = cell + vec2f(0.5) - vec2f(LX * 0.5, 33.8);
    let aurC = fbm((cell + vec2f(0.5)) * 0.10 + vec2f(t * 0.10 * (1.0 + 0.9 * m), -t * 0.05));
    let faceC = ledFace(center, look, m, blink, t);
    var led = (aurC * (0.16 + 0.34 * m) + faceC * (1.15 + 0.45 * m)) * jitter;
    // 每颗 LED 的光晕(光渗到 LED 之间 → bloom 感,零额外求值)
    let halo = smoothstep(0.95, 0.10, length(fr)) * 0.22;

    // 开机:从地平线向上逐排点亮
    let power = smoothstep(0.0, 0.10, u.boot * 1.25 - (1.0 - n.y) + h * 0.08);

    // 光照:太阳高光 + 菲涅尔轮廓
    let L = normalize(vec3f(0.40, 0.55, 0.73));
    let diff = max(dot(n, L), 0.0);
    let spec = pow(diff, 70.0) * 0.9;
    let rim = pow(1.0 - max(n.z, 0.0), 4.0);

    // 顿悟光浪(地平线起)
    let dWave = (n.y - (1.0 - u.pulse) * 1.05) * 6.0;
    let wave = exp(-dWave * dWave) * u.pulse;

    var body = u.tint * led * (0.34 * dotMask + halo);
    body = body + mix(u.tint, vec3f(1.0, 0.95, 0.85), 0.55) * spec;
    body = body + u.tint * rim * (0.24 + 0.34 * m);
    body = body + u.tint * wave * 0.5;
    // 白色溢出(高光/星星 >1.6 的 LED 泛白)
    let over = max(max(led, 0.0) - 1.6, 0.0);
    body = body + vec3f(1.0, 0.98, 0.92) * over * dotMask * 0.8;

    col = mix(base * 0.5, body, power);
  } else {
    // 轮廓外辉光(射线到球面的最近距离)
    let dmin = sqrt(max(dot(oc, oc) - b * b, 0.0));
    let distN = max(dmin - SR, 0.0) / 4.5;
    let glow = exp(-distN * 5.0);
    col = col + u.tint * glow * (0.10 + 0.26 * m + 0.45 * u.pulse) * u.boot;
  }

  col = col + vec3f((hash21(uv * u.res + vec2f(t)) - 0.5) * 0.005);
  return vec4f(col, 1.0);
}
`;

export const SHADERS: Record<FieldName, string> = {
  insight: INSIGHT,
  wave: WAVE,
  dome: DOME,
};

/** 主页品牌 tint(与 aha warm/dark tokens 同源,以 0-1 线性值传入 uniform) */
export const TINTS = {
  gold: [1.0, 0.671, 0.18] as const, // --accent  #ffab2e
  ember: [1.0, 0.522, 0.467] as const, // --warn   #ff8577
  sky: [0.498, 0.831, 0.918] as const, // --info   #7fd4ea
};
