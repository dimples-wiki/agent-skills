import { useEffect, useRef } from "react";
/** 真实书架里的 16 个概念,上下两行交错跑马灯;名词可点 → 三步弹窗 */
const CONCEPTS = [
  "傅里叶变换",
  "注意力机制",
  "TLS 握手",
  "贝叶斯定理",
  "梯度下降",
  "拜占庭将军",
  "Paxos",
  "Raft 共识",
  "CRDT",
  "量子纠缠",
  "mRNA 疫苗",
  "GPS 定位",
  "垃圾回收",
  "Docker 容器",
  "RAG",
  "复利",
];

function Track({
  items,
  onConcept,
  reverse = false,
  dim = false,
}: {
  items: string[];
  onConcept: (c: string) => void;
  reverse?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`marquee-track flex w-max items-center gap-8${reverse ? " rev" : ""}`}
      style={reverse ? { animationDuration: "58s" } : undefined}
    >
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-8 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onConcept(c)}
            onMouseEnter={() => window.dispatchEvent(new CustomEvent("aha:word-hover", { detail: c }))}
            onMouseLeave={() => window.dispatchEvent(new CustomEvent("aha:word-hover", { detail: null }))}
            className={`cursor-pointer font-mono text-sm transition-colors ${
              dim ? "text-cream-4 hover:text-gold" : "text-cream-3 hover:text-gold"
            }`}
          >
            {c}
          </button>
          <span className={`text-[10px] ${dim ? "text-gold/50" : "text-gold"}`} aria-hidden>
            ✦
          </span>
        </span>
      ))}
    </div>
  );
}

/** 视口外挂起跑马灯:transform 动画是纯合成器,但 60fps 常驻合成提交;
 *  首屏(100svh)时跑马灯在折叠线下方,挂起即省。 */
function usePauseOffscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        el.querySelectorAll<HTMLElement>(".marquee-track").forEach((t) => {
          t.style.animationPlayState = e.isIntersecting ? "" : "paused"; // 空串释放内联,保住 :hover 暂停
        });
      },
      { threshold: 0.02 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export function Marquee({ onConcept }: { onConcept: (c: string) => void }) {
  const pauseRef = usePauseOffscreen<HTMLDivElement>();
  // 两行各领一半词(奇偶分),互不重复;×4 保证无缝循环宽度
  const evens = CONCEPTS.filter((_, i) => i % 2 === 0);
  const odds = CONCEPTS.filter((_, i) => i % 2 === 1);
  const rowA = [...evens, ...evens, ...evens, ...evens];
  const rowB = [...odds, ...odds, ...odds, ...odds];

  return (
    <div ref={pauseRef} className="relative overflow-hidden border-y border-line/40 bg-ink-950/40 py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-900 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-900 to-transparent"
      />
      <div className="flex flex-col gap-3">
        <Track items={rowA} onConcept={onConcept} />
        <Track items={rowB} onConcept={onConcept} reverse dim />
      </div>
    </div>
  );
}
