import { useEffect, useRef, useState } from "react";
import { createMsgSphere, type MsgSphere } from "../msg-sphere/create-msg-sphere";
import {
  AHA_QUOTES,
  FIB,
  IDLE_QUOTES,
  ORBIT_CALIB,
  ORBIT_SPEED,
  ORBIT_TILT,
  WORDS,
  type Word,
} from "./orbit-words";

/** 命中检测几何(CSS 像素;由 getInstanceData 每渲染帧覆写,count 前缀有效) */
interface OrbitGeom {
  sx: Float64Array;
  sy: Float64Array;
  hw: Float64Array;
  idx: Int32Array;
  /** 是否可拾取:被球体遮挡到快看不见的词(背后穿过)不可 hover/点击 */
  pick: Uint8Array;
  count: number;
}

/** 桌面舞台:WebGPU msg-sphere(球+舞台+雾)+ 轨道词实例化绘制。
 *  经 DomeStage 壳按需 lazy 加载 —— 移动端不下载 vgpu/sphere 代码。 */
export function DomeStage3D({
  onWordClick,
  onFail,
}: {
  onWordClick?: (word: string) => void;
  onFail?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sphereMountRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<MsgSphere | null>(null);
  const hoverRef = useRef<number | null>(null);
  const onWordClickRef = useRef(onWordClick);
  onWordClickRef.current = onWordClick;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  // live = msg-sphere(WebGPU)运行中;不可用则舞台留空(无 CSS 降级)
  const [live, setLive] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [quote, setQuote] = useState(0);
  // 词轨道共享状态(供球体渲染的 getInstanceData 消费)
  const orbitAngle = useRef(Math.random() * Math.PI * 2);
  const orbitLag = useRef(new Float64Array(FIB.length));
  const orbitGeom = useRef<OrbitGeom>({
    sx: new Float64Array(WORDS.length),
    sy: new Float64Array(WORDS.length),
    hw: new Float64Array(WORDS.length),
    idx: new Int32Array(WORDS.length),
    pick: new Uint8Array(WORDS.length),
    count: 0,
  });
  /** 通知球体"词变了,下一帧重画"(球体自身 rAF 消费) */
  const markWords = () => {
    sphereRef.current?.requestWordRedraw();
  };

  // —— msg-sphere 挂载(含词轨道覆盖层,共用同一 canvas) ——
  useEffect(() => {
    const mount = sphereMountRef.current;
    if (!mount) return;

    // 词纹理图集(Canvas2D 离屏:上半常态灰+?,下半 hover 白+!)
    // 按 dpr 光栅化:retina(2×)上以 1× 纹理放大显示会发虚,必须按设备分辨率绘制。
    // 内容只随 768px 断点桶 / dpr 变化 —— 其余 resize 不重建
    const atlasDpr = () => Math.min(Math.max(devicePixelRatio || 1, 1), 2);
    const buildAtlas = () => {
      const vw = mount.clientWidth || 1200;
      const dpr = atlasDpr();
      const fontSize = vw < 768 ? 11.5 : 12.5;
      const pad = 8;
      const lineHeight = Math.ceil(fontSize * 1.7);
      const visible: { w: string }[] = [];
      const visibleIdx: number[] = [];
      WORDS.forEach((word, i) => {
        if (!word.compactHide || vw >= 768) { visible.push(word); visibleIdx.push(i); }
      });
      // 手机上轨道半径收窄(见 getInstanceData 的边缘钳制),环上词太密会叠成疙瘩 —— 隔一取一
      if (vw < 768) {
        for (let k = visible.length - 1; k >= 0; k--) {
          if (k % 2 === 1) { visible.splice(k, 1); visibleIdx.splice(k, 1); }
        }
      }
      const cv = document.createElement("canvas");
      const ctx = cv.getContext("2d")!;
      const font = `600 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.font = font;
      const widths = visible.map((w) => Math.max(ctx.measureText(w.w + "?").width, ctx.measureText(w.w + "!").width));
      const atlasW = Math.ceil(Math.max(...widths, 30) + pad * 2);
      const atlasH = lineHeight * visible.length * 2;
      // 背衬 ×dpr,绘制坐标系仍用 CSS 单位(normalized UV 与四边形几何都基于 CSS 度量)
      cv.width = Math.ceil(atlasW * dpr); cv.height = Math.ceil(atlasH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = font; ctx.textBaseline = "middle"; ctx.textAlign = "left";
      // 暗色描边光晕:词飘过亮球面时保住可读性(DOM 版的 text-shadow 等价物)。
      // shadowBlur/Offset 不随 transform 缩放,需手动 ×dpr
      ctx.shadowColor = "rgba(5,4,3,0.85)";
      ctx.shadowBlur = 4 * dpr;
      ctx.shadowOffsetY = 1 * dpr;
      const meta: { uvSizeX: number; w: number; h: number }[] = [];
      visible.forEach((w, vi) => {
        const yN = vi * lineHeight + lineHeight / 2;
        const yH = lineHeight * visible.length + vi * lineHeight + lineHeight / 2;
        ctx.fillStyle = "rgba(155,143,124,1)";
        ctx.fillText(w.w + "?", pad, yN);
        ctx.fillStyle = "#f7f1e7";
        ctx.fillText(w.w + "!", pad, yH);
        const tw = widths[vi]; // 复用未设 transform 时的测量(measureText 不受 CTM 影响,但避免歧义)
        meta.push({ uvSizeX: (tw + pad * 2) / atlasW, w: tw + pad * 2, h: lineHeight });
      });
      return { canvas: cv, meta, visibleIdx, lineHeight, atlasH, atlasW, maxHalf: Math.max(...meta.map((m) => m.w / 2)) };
    };

    let atlas = buildAtlas();
    let atlasRev = 0;
    atlas.canvas.dataset.rev = String(++atlasRev);
    let lastCompact = (mount.clientWidth || 1200) < 768;
    let lastDpr = atlasDpr();
    const ro = new ResizeObserver(() => {
      const compact = (mount.clientWidth || 1200) < 768;
      const dpr = atlasDpr();
      if (compact === lastCompact && dpr === lastDpr) {
        markWords(); // 同桶同 dpr:几何仍随高度变化,重画一帧即可
        return;
      }
      lastCompact = compact;
      lastDpr = dpr;
      atlas = buildAtlas();
      atlas.canvas.dataset.rev = String(++atlasRev);
      // 断点切换可能让悬停词消失:清掉悬停态,避免残留 AHA 台词/惊讶脸
      if (hoverRef.current !== null && WORDS[hoverRef.current]?.compactHide && compact) {
        setHovered(null);
        hoverRef.current = null;
      }
      markWords();
    });
    ro.observe(mount);
    // 纯 dpr 变化(跨屏拖动窗口)不触发 RO(CSS 盒不变)→ 监听分辨率媒体查询
    const dprQuery = matchMedia(`(resolution: ${atlasDpr()}dppx)`);
    const onDprChange = () => {
      lastDpr = atlasDpr();
      atlas = buildAtlas();
      atlas.canvas.dataset.rev = String(++atlasRev);
      markWords();
    };
    dprQuery.addEventListener?.("change", onDprChange);

    // 轨道位置计算(与球体标定一致)+ instance 数据
    const cosT = Math.cos(ORBIT_TILT), sinT = Math.sin(ORBIT_TILT);
    const scratch = new Float32Array(WORDS.length * 12);

    const getInstanceData = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w === 0) return null;
      // 与 vgpu surface 的 dpr:[1,2] 钳制保持一致(dpr<1 时浏览器缩放)
      const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
      const cx = w * ORBIT_CALIB.cxr, cy = h * ORBIT_CALIB.cyr;
      const ballR = h * ORBIT_CALIB.ballRr;
      // 窄屏:轨道收紧 + 按最长词半宽做边缘钳制,词(含透视放大)不出视口
      const compact = w < 768;
      const edgePad = compact ? atlas.maxHalf + 8 : 0;
      const R = Math.min(ballR * ORBIT_CALIB.shellRr, w * (compact ? 0.42 : ORBIT_CALIB.maxWr));
      const hov = hoverRef.current;
      const g = orbitGeom.current;
      // 词集锁定图集快照(atlas.visibleIdx):rAF 先于 ResizeObserver 触发,
      // 快速跨断点缩放时若按"当前宽度"重新筛词,会拿桌面词数索引移动图集 → 越界崩溃
      let vi = 0;
      for (const i of atlas.visibleIdx) {
        const p = FIB[i];
        const a = orbitAngle.current - orbitLag.current[i];
        const cosA = Math.cos(a), sinA = Math.sin(a);
        const x1 = p.x * cosA + p.z * sinA;
        const z1 = -p.x * sinA + p.z * cosA;
        const y2 = p.y * cosT - z1 * sinT;
        const z2 = p.y * sinT + z1 * cosT;
        const persp = 3 / (3 - z2);
        let sx = cx + x1 * R * persp;
        if (compact) sx = Math.min(Math.max(sx, edgePad), w - edgePad);
        const sy = cy + y2 * R * persp;
        const depth = (z2 + 1) / 2;
        const scale = (0.78 + 0.36 * depth) * (hov === i ? 1.16 : 1);
        let alpha = 0.3 + 0.62 * depth;
        if (z2 < 0) {
          const dB = Math.hypot(sx - cx, sy - cy);
          if (dB < ballR) { alpha *= 1 - Math.min(1, (ballR - dB) / 26) * 0.96; }
        }
        // 可拾取 = 肉眼可见(用未叠加 hover 高亮前的 alpha 判定);
        // 转到球背后被压暗到 0.25 以下的词不再响应 hover,避免"凭空出现"
        g.pick[vi] = alpha >= 0.25 ? 1 : 0;
        if (hov === i) alpha = 1;
        const meta = atlas.meta[vi];
        g.sx[vi] = sx; g.sy[vi] = sy; g.hw[vi] = (meta.w * scale) / 2; g.idx[vi] = i;
        const base = vi * 12;
        scratch[base] = sx * dpr; scratch[base + 1] = sy * dpr;
        scratch[base + 2] = meta.w * scale * dpr; scratch[base + 3] = meta.h * scale * dpr;
        scratch[base + 4] = alpha; scratch[base + 5] = hov === i ? 1 : 0;
        const rowY = hov === i ? atlas.atlasH / 2 + vi * atlas.lineHeight : vi * atlas.lineHeight;
        scratch[base + 6] = 0; scratch[base + 7] = rowY / atlas.atlasH;
        scratch[base + 8] = meta.uvSizeX; scratch[base + 9] = atlas.lineHeight / atlas.atlasH;
        vi++;
      }
      g.count = vi;
      return { data: scratch, count: vi };
    };

    const ms = createMsgSphere(mount, {
      expression: "skeptical",
      onReady: () => setLive(true),
      onError: (error) => {
        console.error("msg-sphere failed:", error);
        onFailRef.current?.();
      },
      wordOverlay: {
        get atlasCanvas() { return atlas.canvas; },
        getInstanceData,
      },
    });
    sphereRef.current = ms;
    return () => {
      ro.disconnect();
      dprQuery.removeEventListener?.("change", onDprChange);
      ms.dispose();
      sphereRef.current = null;
    };
  }, []);


  // —— 复制彩蛋:点复制命令,顿悟球 O 一下再变回去 ——
  const extHoverRef = useRef<string | null>(null);
  useEffect(() => {
    let timer = 0;
    const onReact = () => {
      sphereRef.current?.changeExpression("surprised");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (hoverRef.current === null && extHoverRef.current === null) {
          sphereRef.current?.changeExpression("skeptical");
        }
      }, 1300);
    };
    // 轮播名词 hover 联动表情(轨道词在球周围,轮播词在首屏下方)
    const onExtHover = (e: Event) => {
      const word = (e as CustomEvent).detail as string | null;
      extHoverRef.current = word;
      if (word) sphereRef.current?.changeExpression("surprised");
      else if (hoverRef.current === null) sphereRef.current?.changeExpression("skeptical");
    };
    window.addEventListener("aha:react", onReact);
    window.addEventListener("aha:word-hover", onExtHover);
    return () => {
      window.removeEventListener("aha:react", onReact);
      window.removeEventListener("aha:word-hover", onExtHover);
      window.clearTimeout(timer);
    };
  }, []);

  // —— 轨道词 rAF:只推进共享 refs 并通知球体重画(词已在球体 canvas 上)。
  //    30fps 公转 + 回归 60fps + 视口挂起 + 发呆暂停;渲染节流由球体侧消费 wordActive ——
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let lastTick = 0;
    let stageVisible = true;
    let catchingUp = false;
    let idlePaused = false;
    let lastInteractAt = performance.now();
    const IDLE_PAUSE_MS = 60_000;
    const startLoop = () => {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };
    const markInteract = () => {
      lastInteractAt = performance.now();
      // 发呆暂停只能被交互唤醒(条件不会自己变化),停摆期间零唤醒
      if (idlePaused && stageVisible && !document.hidden) { idlePaused = false; startLoop(); }
    };
    window.addEventListener("pointermove", markInteract, { passive: true });
    window.addEventListener("pointerdown", markInteract, { passive: true });
    window.addEventListener("keydown", markInteract, { passive: true });
    window.addEventListener("wheel", markInteract, { passive: true });
    const io = new IntersectionObserver(([entry]) => {
      stageVisible = entry.isIntersecting;
      if (stageVisible && !idlePaused) startLoop();
    }, { threshold: 0.05 });
    if (stageRef.current) io.observe(stageRef.current);
    const onVis = () => {
      if (!document.hidden && stageVisible && !idlePaused) {
        lastInteractAt = performance.now();
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const loop = (now: number) => {
      if (!stageVisible || document.hidden) { raf = 0; return; }
      // 悬停中(轨道词/轮播词)= 用户正在看,不算发呆:
      // 指针静止不产生 pointermove,若不刷新会误判空闲、悬停途中冻结轨道
      if (hoverRef.current !== null || extHoverRef.current !== null) {
        lastInteractAt = now;
      }
      if (now - lastInteractAt > IDLE_PAUSE_MS) {
        // 发呆:整链停摆(rAF 不再唤醒),画布冻结在最后一帧;交互即恢复
        idlePaused = true;
        raf = 0;
        return;
      }
      // 公转 30fps;悬停中/回归动画 60fps(14ms 门限:60Hz 每帧,120Hz 隔帧)。
      // 悬停必须满帧:hover 触发的表情过渡本身是 60fps 渲染,若过渡结束回落 30,
      // 用户会看到"先顺滑后骤降"的掉帧感
      const hovNow = hoverRef.current;
      if (now - lastTick < ((catchingUp || hovNow !== null) ? 14 : 33) && lastTick) { raf = requestAnimationFrame(loop); return; }
      lastTick = now;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const dAng = reduced ? 0 : ORBIT_SPEED * dt;
      orbitAngle.current += dAng;
      const hov = hovNow;
      const lag = orbitLag.current;
      catchingUp = false;
      for (let i = 0; i < lag.length; i++) {
        if (hov === i) {
          // 悬停的词冻结在原地:公转量累积进 lag,松手后指数衰减归还
          lag[i] += dAng;
          if (lag[i] > Math.PI) lag[i] -= Math.PI * 2;
          else if (lag[i] < -Math.PI) lag[i] += Math.PI * 2;
        } else if (lag[i] !== 0) {
          lag[i] *= Math.exp(-2.5 * dt);
          if (Math.abs(lag[i]) < 0.001) lag[i] = 0;
          if (Math.abs(lag[i]) > 0.01) catchingUp = true;
        }
      }
      if (dAng !== 0 || catchingUp) markWords();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", markInteract);
      window.removeEventListener("pointerdown", markInteract);
      window.removeEventListener("keydown", markInteract);
      window.removeEventListener("wheel", markInteract);
    };
  }, []);

  // —— idle 台词轮播 ——
  useEffect(() => {
    if (hovered !== null) return;
    const id = setInterval(() => setQuote((q) => (q + 1) % IDLE_QUOTES.length), 3200);
    return () => clearInterval(id);
  }, [hovered]);

  const enter = (i: number) => {
    hoverRef.current = i; // 直接写 ref:markWords 触发的重画立即用上新悬停态
    setHovered(i);
    sphereRef.current?.changeExpression("surprised");
    markWords();
  };
  const leave = () => {
    hoverRef.current = null;
    setHovered(null);
    sphereRef.current?.changeExpression("skeptical");
    markWords();
  };
  const click = (word: Word) => {
    onWordClickRef.current?.(word.w);
  };

  // —— 词命中检测(词画在球体 canvas 上,用几何命中而非 DOM) ——
  useEffect(() => {
    const canvas = sphereMountRef.current?.querySelector("canvas");
    if (!canvas) return;
    // 触屏没有 hover 精度,命中带放宽(指尖 vs 鼠标指针)
    const coarse = matchMedia("(pointer: coarse)").matches;
    const hitH = coarse ? 22 : 14;
    const hitTest = (mx: number, my: number): number | null => {
      const g = orbitGeom.current;
      let best: number | null = null, bestD = Infinity;
      for (let vi = 0; vi < g.count; vi++) {
        if (!g.pick[vi]) continue; // 球背后的词不可拾取
        const dx = mx - g.sx[vi], dy = my - g.sy[vi];
        const hw = g.hw[vi] + 6;
        if (Math.abs(dx) < hw && Math.abs(dy) < hitH) {
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = g.idx[vi]; }
        }
      }
      return best;
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit !== hoverRef.current) {
        canvas.style.cursor = hit === null ? "" : "pointer";
        hit === null ? leave() : enter(hit);
      }
    };
    const onLeave = () => {
      if (hoverRef.current !== null) { canvas.style.cursor = ""; leave(); }
    };
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit !== null) click(WORDS[hit]);
    };
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  // 演示模式:?aha=词 → 自动进入顿悟态
  useEffect(() => {
    const demo = new URLSearchParams(location.search).get("aha");
    if (!demo) return;
    const idx = WORDS.findIndex((x) => x.w.toLowerCase() === demo.toLowerCase());
    if (idx < 0) return;
    const id = setTimeout(() => enter(idx), 1600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hoveredWord = hovered !== null ? WORDS[hovered] : null;

  return (
    <div ref={stageRef} className="dome-stage absolute inset-0 overflow-hidden select-none">
      {/* ===== msg-sphere(WebGPU):整屏场景(球+舞台+雾+轨道词) ===== */}
      <div
        ref={sphereMountRef}
        className={`absolute inset-0 transition-opacity duration-700 ${
          live ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 暗角 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[8] bg-[linear-gradient(90deg,rgba(0,0,0,0.30),transparent_22%_78%,rgba(0,0,0,0.30)),linear-gradient(180deg,rgba(0,0,0,0.22),transparent_28%_72%,rgba(0,0,0,0.40))]"
      />

      {/* 台词:锚在穹顶上方 */}
      <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center" style={{ bottom: "6svh" }}>
        <p className="flex h-8 items-center rounded-full bg-ink-950/70 px-4 font-mono text-sm backdrop-blur-sm [box-shadow:0_2px_16px_rgba(4,3,2,0.5)]">
          {hoveredWord ? (
            <span key={"a" + hoveredWord.w} className="quote-swap text-gold">
              {AHA_QUOTES[(hovered ?? 0) % AHA_QUOTES.length]}
              <span className="text-cream-3"> · 点击看怎么打开它</span>
            </span>
          ) : (
            <span key={"q" + quote} className="quote-swap text-cream-3">{IDLE_QUOTES[quote]}</span>
          )}
        </p>
      </div>

      {/* 无障碍:轨道词已光栅化进 canvas,键盘/读屏走这份镜像清单(静态 DOM,零渲染开销) */}
      <details className="sr-only">
        <summary>概念词列表</summary>
        <ul>
          {WORDS.map((word) => (
            <li key={word.w}>
              <button type="button" onClick={() => click(word)}>{word.w}</button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
