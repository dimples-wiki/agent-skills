import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WORDS, type Word } from "./orbit-words";

/** 窗口卡数:offset -3..+3(±22°/±44°/±66°,最外档探出屏幕并压暗虚化) */
const WINDOW = 7;
const CENTER = 3;
/** 相邻卡角度(°)与枢轴距(px) —— 与原版一致(200×300 卡 / origin 750 / 22°) */
const STEP = 22;
const ORIGIN_Y = 750;
/** 卡片原始尺寸(2:3 竖卡),按舞台高度自适应缩放 */
const CARD_W = 200;
const CARD_H = 300;
/** 轮播间隔(ms) */
const TICK = 2600;

/** 卡片渐变背景色板:低饱和深色系,与站点暗金基调和谐;
 *  词名哈希 → 色板 + 角度档 —— 「随机但合理」:同词永远同色,分布均匀 */
const GRADS: [string, string][] = [
  ["#20304f", "#3a2a6b"], // 深蓝 → 深紫
  ["#123636", "#0f3050"], // 深青 → 深蓝
  ["#3a2049", "#55283e"], // 深紫 → 深酒红
  ["#43301a", "#68401d"], // 深琥珀
  ["#1e3526", "#2c4a3e"], // 深绿 → 墨绿
  ["#3f2030", "#47243f"], // 深玫
  ["#2b2b45", "#453055"], // 墨蓝 → 灰紫
  ["#42221f", "#573324"], // 赭红
];
const ANGLES = [110, 135, 160, 200];
const hashOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0x7fffffff, 7);
const gradStyleFor = (word: string) => {
  const h = hashOf(word);
  const [c1, c2] = GRADS[h % GRADS.length];
  const ang = ANGLES[(h >> 3) % ANGLES.length];
  return { background: `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)` };
};

/** 类别标签池:按词的全局索引轮转分配 —— 前 10 个词各占一个不同标签,
 *  下一轮 10 个再来一遍不同组合,窗口内永不重样 */
const TAGS = ["AI", "系统", "算法", "数学", "分布式", "数据库", "网络", "安全", "存储", "编译"];
const tagFor = (index: number) => TAGS[index % TAGS.length];

/** 单张概念卡:编号+轮转类别 / 层级徽章 / 中英双标 + 一句话核心 / 底部 /aha 命令条 */
function ConceptCard({
  word,
  index,
  front,
  onOpen,
}: {
  word: Word;
  index: number;
  front: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`了解「${word.w}」`}
      className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[26px] border text-left transition-colors duration-500 active:scale-95"
      style={{
        ...gradStyleFor(word.w),
        borderColor: front ? "rgba(255,171,46,0.55)" : "rgba(255,255,255,0.10)",
        boxShadow: front
          ? "0 0 38px rgba(255,171,46,0.22), inset 0 1px 0 rgba(255,255,255,0.10)"
          : "inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      {/* 顶部行:编号 · 轮转类别 + 起点层级徽章 */}
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="font-mono text-[10px] font-semibold tracking-widest text-white/35">
          #{String(index + 1).padStart(2, "0")} · {tagFor(index)}
        </span>
        {word.lv && (
          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[9px] font-bold text-gold/90">
            起点 L{word.lv}
          </span>
        )}
      </div>

      {/* 主体:中英双标(转正时词尾 ?→!)+ 一句话核心 */}
      <div className="flex flex-1 flex-col px-4">
        <div className="mt-4 flex items-baseline gap-1.5">
          <h3
            className={`font-display leading-tight font-extrabold tracking-tight transition-colors duration-500 ${
              front ? "text-[26px] text-cream-1" : "text-[24px] text-cream-2/80"
            }`}
          >
            {word.w}
          </h3>
          <span
            className={`mark font-mono text-[15px] font-bold transition-colors duration-500 ${
              front ? "on" : "text-cream-4/50"
            }`}
          >
            {front ? "!" : "?"}
          </span>
        </div>
        {word.zh && (
          <p className="mt-1 truncate font-mono text-[11px] tracking-wide text-cream-3/70">
            {word.zh}
          </p>
        )}
        <div aria-hidden className="mt-3.5 h-px w-8 bg-gold/40" />
        {word.core && (
          <p className="mt-3.5 text-[12px] leading-[1.7] font-medium text-cream-2/85">
            {word.core}
          </p>
        )}
      </div>

      {/* 底部:/aha 命令条 —— 「怎么打开它」直接写在卡上 */}
      <div className="px-4 pb-3.5">
        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-500 ${
            front
              ? "border-gold/40 bg-black/40"
              : "border-white/10 bg-black/25"
          }`}
        >
          <span className={front ? "font-bold text-gold" : "font-bold text-gold/70"}>/aha</span>
          <span className="truncate text-cream-2/90">{word.w}</span>
        </div>
      </div>
    </button>
  );
}

/** 移动端舞台:环形卡片画廊(复刻 tongzhewang 的 2D 扇形轮播核心,
 *  卡片换成本站的概念名词卡 —— 原版 200×300 竖卡比例 + 渐变底 + 信息排版)。
 *  正面卡提亮放大,两侧统一压暗虚化,最外档探出屏幕;自动顺时针轮播。 */
export function DomeStage2D({ onWordClick }: { onWordClick?: (word: string) => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  /** 卡片显示尺寸与卡行中心(原始 200×300,优先原版大卡;矮屏按可用区收紧) */
  const [card, setCard] = useState({ w: CARD_W, h: CARD_H });
  const [topPx, setTopPx] = useState(0);
  /** 环形位置指针:窗口 = [pos-3 .. pos+3] 的连续 7 个位置,词 = WORDS[pos mod 74]。
   *  前进/后退只是 pos±1 —— 天然无限循环(往回切到第 1 张后继续是第 74 张),无重复。 */
  const [pos, setPos] = useState(() => {
    const demo = new URLSearchParams(location.search).get("aha");
    const di = demo ? WORDS.findIndex((x) => x.w.toLowerCase() === demo.toLowerCase()) : -1;
    return di >= 0 ? di : 0;
  });
  const visibleRef = useRef(true);
  /** 作废旧 timer、按给定间隔重开自动轮播(手动切换后调用,保证节奏从点击时刻重新起算) */
  const pauseAutoRef = useRef<(ms: number) => void>(() => {});
  /** CTA 行底的历史最坏值(单调收紧):字体加载/入场动画会让它漂移,
   *  多次采样取 max 保证任何时刻卡与它都有间隙;舞台高度大变(转屏)时重置 */
  const ctaBottomRef = useRef(0);
  const ctaBottomHRef = useRef(0);
  /** 手动切换的动画截止时刻:动画未完时主卡不响应点击 —— 连点侧卡时,
   *  刚转正的卡视觉还在移动,此时点它大概率是误触,不该弹窗 */
  const animUntilRef = useRef(0);
  /** 滑动切换后抑制一次合成 click(触摸滑动结束时浏览器会补发 click,别让它开弹窗) */
  const suppressClickRef = useRef(false);
  const onWordClickRef = useRef(onWordClick);
  onWordClickRef.current = onWordClick;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const h = stage.clientHeight;
      if (h === 0) return;
      // 实测锚定:文案区 CTA 行的真实底 —— 字体加载/动画会挪它,单调取最坏值
      const ctaRow = document.querySelector("#hero-copy > div:last-child");
      if (Math.abs(ctaBottomHRef.current - h) > 40) ctaBottomRef.current = 0; // 转屏重置
      ctaBottomHRef.current = h;
      ctaBottomRef.current = Math.max(
        ctaBottomRef.current,
        ctaRow ? ctaRow.getBoundingClientRect().bottom : h * 0.52,
      );
      const copyBottom = ctaBottomRef.current;
      // 到 pill 实际顶(94svh - 32px)的可用带:卡高优先原版 300,放不下才收紧,
      // 上下各留 12px 呼吸,卡行中心锚在可用带正中
      const pillTop = h * 0.94 - 32;
      const avail = pillTop - copyBottom - 24;
      const ch = Math.min(CARD_H, Math.round(avail / 1.1));
      setCard({ w: Math.round((ch * 2) / 3), h: ch });
      // wrapper 绕枢轴(ORIGIN_Y)scale 1.1 会把卡心额外抬高 (ORIGIN_Y - ch/2)×0.1,
      // lane 的 top 补回该偏移,让卡的「视觉中心」恰好落在可用带正中
      const scaleLift = (ORIGIN_Y - ch / 2) * 0.1;
      setTopPx(Math.round((copyBottom + pillTop) / 2 + scaleLift));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    // 锚点(CTA 行)在 mount 后仍会动:入场动画(~1.3s)、字体加载与重排都会挪它,
    // 且 transform 动画不触发 RO —— 多拍补量盖住震荡窗,采样单调取最坏值
    const late = [1600, 2400, 3200].map((ms) => window.setTimeout(measure, ms));
    document.fonts?.ready.then(measure).catch(() => {});
    // 不在视口 / 切后台:彻底停掉自动轮播(不只是跳过一拍,连调度都停);恢复可见再重开。
    // 恢复前确认弹窗没开着(弹窗自己管理暂停)
    const drive = (on: boolean) => {
      if (!on) {
        pauseAutoRef.current(0);
      } else if (
        !document.hidden &&
        !document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        pauseAutoRef.current(TICK);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visibleRef.current = e.isIntersecting;
      drive(e.isIntersecting);
    }, { threshold: 0.05 });
    io.observe(stage);
    const onVis = () => drive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      late.forEach((t) => window.clearTimeout(t));
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // —— 顺时针自动轮播:setTimeout 链。手动切换 = 清掉旧 timer、重开一个(间隔照常 TICK);
  //     世代计数丢弃已入队的陈旧回调(定时器到期后 clearTimeout 清不掉,旧 tick 仍会执行);
  //     使用弹窗打开 = 完全停止,关闭 = 重开 —— 看弹窗期间词不转走 ——
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let gen = 0;
    const schedule = (delay: number) => {
      gen += 1;
      const myGen = gen;
      timer = window.setTimeout(() => {
        if (myGen !== gen) return; // 已被更新的调度取代,丢弃
        tick();
      }, delay);
    };
    const tick = () => {
      if (!document.hidden && visibleRef.current) setPos((p) => p + 1);
      schedule(TICK);
    };
    schedule(TICK);
    /** ms > 0:作废旧 timer、按 ms 重开;ms <= 0:停止(只作废,不再调度) */
    pauseAutoRef.current = (ms: number) => {
      if (ms > 0) schedule(ms);
      else {
        gen += 1;
        window.clearTimeout(timer);
      }
    };
    return () => {
      gen += 1; // 卸载后丢弃在途回调
      window.clearTimeout(timer);
    };
  }, []);

  // —— 使用弹窗开/关:暂停与恢复自动轮播 ——
  useEffect(() => {
    const stop = () => pauseAutoRef.current(0);
    const start = () => pauseAutoRef.current(TICK);
    window.addEventListener("aha:usage-open", stop);
    window.addEventListener("aha:usage-close", start);
    return () => {
      window.removeEventListener("aha:usage-open", stop);
      window.removeEventListener("aha:usage-close", start);
    };
  }, []);

  const wrap = (p: number) => ((p % WORDS.length) + WORDS.length) % WORDS.length;
  const centerWord = WORDS[wrap(pos)];

  /** 手动切换(侧卡/箭头/拖拽松手共用):动画锁防误触弹窗 + timer 重开 + 步进 */
  const jump = (delta: number) => {
    animUntilRef.current = performance.now() + 850;
    pauseAutoRef.current(TICK);
    setPos((p) => p + delta);
  };

  // —— 触摸拖拽:按住左右拖 → 卡片实时跟手转动;松手按「末速度优先、位移过半兜底」
  //     判定切向哪边(带 0.8s 缓动 snap/回弹 = 惯性感)。React 合成 touchmove 是
  //     passive 的,无法 preventDefault 拦页面滚动 —— 必须原生绑定。
  const laneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    const TRANSITION =
      "transform 0.8s cubic-bezier(0.2,0.8,0.2,1), filter 0.8s cubic-bezier(0.2,0.8,0.2,1)";
    /** 灵敏度:约 100px 横拖 = 转过一格(22°) */
    const DEG_PER_PX = STEP / 100;
    const drag = { on: false, horizontal: false, x0: 0, y0: 0, deg: 0, lastX: 0, lastT: 0, vx: 0 };
    const wrappers = () => [...lane.children] as HTMLElement[];
    /** 把拖拽角实时叠加到每张卡的基准角上(基准在拖拽开始时快照进 dataset) */
    const applyDeg = (deg: number) => {
      for (const el of wrappers()) {
        const base = Number(el.dataset.base ?? el.style.transform.match(/rotate\((-?[\d.]+)deg\)/)?.[1] ?? 0);
        el.dataset.base = String(base);
        el.style.transform = el.style.transform.replace(
          /rotate\(-?[\d.]+deg\)/,
          `rotate(${(base + deg).toFixed(2)}deg)`,
        );
      }
    };
    const begin = (x: number, y: number) => {
      drag.on = true;
      drag.horizontal = false;
      drag.x0 = x; drag.y0 = y; drag.deg = 0;
      drag.lastX = x; drag.lastT = performance.now(); drag.vx = 0;
      for (const el of wrappers()) delete el.dataset.base;
      pauseAutoRef.current(60_000); // 拖拽期间暂停自动轮播,松手再重开
    };
    const move = (x: number, y: number) => {
      if (!drag.on) return;
      const dx = x - drag.x0, dy = y - drag.y0;
      if (!drag.horizontal) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag.on = false; return; } // 纵向 → 让页面滚
        if (Math.abs(dx) <= 8) return;
        drag.horizontal = true;
        for (const el of wrappers()) el.style.transition = "none"; // 跟手必须无过渡
      }
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt > 0) drag.vx = (x - drag.lastX) / dt; // px/ms,松手判定用
      drag.lastX = x; drag.lastT = now;
      drag.deg = Math.max(-STEP * 1.6, Math.min(STEP * 1.6, dx * DEG_PER_PX));
      applyDeg(drag.deg);
    };
    const end = () => {
      if (!drag.on) return;
      drag.on = false;
      if (!drag.horizontal) return; // 轻点/tap:交给原有 click 逻辑
      suppressClickRef.current = true; // 吞掉合成 click(拖拽不是点击)
      window.setTimeout(() => { suppressClickRef.current = false; }, 50);
      for (const el of wrappers()) el.style.transition = TRANSITION; // 恢复缓动 → snap/回弹有惯性感
      // 末速度优先(fling),位移过半兜底
      let target = 0;
      if (drag.vx < -0.55 || drag.deg < -STEP / 2) target = 1;      // 向左 → 下一张
      else if (drag.vx > 0.55 || drag.deg > STEP / 2) target = -1;  // 向右 → 上一张
      if (target !== 0) {
        jump(target); // setPos 重渲,transform 落到新档位
      } else {
        applyDeg(0);  // 不过阈值:带回弹地转回原位
        pauseAutoRef.current(TICK);
      }
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { end(); return; } // 多指不拖
      begin(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (!drag.on) return;
      move(e.touches[0].clientX, e.touches[0].clientY);
      if (drag.horizontal) e.preventDefault(); // 横拖期间拦住页面滚动
    };
    lane.addEventListener("touchstart", onStart, { passive: true });
    lane.addEventListener("touchmove", onMove, { passive: false });
    lane.addEventListener("touchend", end);
    lane.addEventListener("touchcancel", end);
    return () => {
      lane.removeEventListener("touchstart", onStart);
      lane.removeEventListener("touchmove", onMove);
      lane.removeEventListener("touchend", end);
      lane.removeEventListener("touchcancel", end);
    };
  }, []);

  return (
    <div ref={stageRef} className="dome-stage absolute inset-0 overflow-hidden select-none">
      {/* 星空(夜幕背景) */}
      {STARS.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="compass-star"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }}
        />
      ))}

      {/* 舞台径向暖光(参考实现的 midnight-moss 变体) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 64%, rgba(173,117,60,0.10) 0%, rgba(26,29,26,0.0) 55%, transparent 80%)",
        }}
      />

      {/* 扇形卡堆:卡片绕下方枢轴 2D 旋转排开(原版参数:origin 750 / 22° 档距);
          正面卡 brightness 1 + scale 1.1,其余统一 brightness 0.45 + blur + scale 0.8。
          触摸:touch-action 只留垂直滚动;横拖跟手、松手判定切换(拖拽逻辑原生绑定在 laneRef) */}
      <div
        ref={laneRef}
        className="absolute inset-x-0"
        style={{
          ...(topPx ? { top: `${topPx}px` } : { top: "70%" }),
          touchAction: "pan-y",
        }}
      >
        {Array.from({ length: WINDOW }, (_, k) => {
          const offset = k - CENTER;
          const p = pos + offset;
          const wi = wrap(p);
          const isFront = offset === 0;
          return (
            <div
              key={p}
              className="absolute left-1/2 top-0"
              style={{
                width: card.w,
                height: card.h,
                transformOrigin: `50% ${ORIGIN_Y}px`,
                transform: `translate(-50%,-50%) rotate(${offset * STEP}deg) scale(${isFront ? 1.1 : 0.8})`,
                filter: isFront ? "none" : "brightness(0.45) blur(1.5px)",
                zIndex: isFront ? 10 : 5 - Math.min(Math.abs(offset), 3),
                transition:
                  "transform 0.8s cubic-bezier(0.2,0.8,0.2,1), filter 0.8s cubic-bezier(0.2,0.8,0.2,1)",
              }}
            >
              <ConceptCard
                word={WORDS[wi]}
                index={wi}
                front={isFront}
                onOpen={() => {
                  if (suppressClickRef.current) return; // 滑动切换后的合成 click,吞掉
                  // 正面卡 = 打开使用弹窗(切换动画未完时忽略,防连点误触);
                  // 两侧虚化卡 = 轮播跳转过去(把它转到正面)
                  if (isFront) {
                    if (performance.now() < animUntilRef.current) return;
                    onWordClickRef.current?.(WORDS[wi].w);
                  } else {
                    jump(offset);
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 左右切换箭头:卡行上部两角(略高于卡区,与倾斜侧卡的上端拉开层次)
          —— 补上扇形上缘的空,也是「侧卡可点切换」的显性暗示 */}
      {topPx > 0 && (
        <>
          <button
            type="button"
            aria-label="上一张概念卡"
            onClick={() => jump(-1)}
            className="absolute left-3 z-[11] flex size-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-950/60 text-cream-3 backdrop-blur-sm transition-all active:scale-90"
            style={{ top: topPx - 165 }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="下一张概念卡"
            onClick={() => jump(1)}
            className="absolute right-3 z-[11] flex size-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-ink-950/60 text-cream-3 backdrop-blur-sm transition-all active:scale-90"
            style={{ top: topPx - 165 }}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* 暗角 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[8] bg-[linear-gradient(90deg,rgba(0,0,0,0.30),transparent_22%_78%,rgba(0,0,0,0.30)),linear-gradient(180deg,rgba(0,0,0,0.22),transparent_28%_72%,rgba(0,0,0,0.40))]"
      />

      {/* 台词:正面卡引导 */}
      <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4" style={{ bottom: "6svh" }}>
        <p className="flex h-8 max-w-full items-center rounded-full bg-ink-950/70 px-4 font-mono text-sm backdrop-blur-sm [box-shadow:0_2px_16px_rgba(4,3,2,0.5)]">
          <span key={"a" + centerWord.w} className="quote-swap truncate text-gold">
            「{centerWord.w}」<span className="text-cream-3"> · 点它,看看怎么打开</span>
          </span>
        </p>
      </div>
    </div>
  );
}

/** 星空:一次生成,纯 CSS twinkle */
const STARS = Array.from({ length: 14 }, () => ({
  x: 4 + Math.random() * 92,
  y: 6 + Math.random() * 88,
  s: 1 + Math.random() * 1.7,
  d: Math.random() * 4,
}));
