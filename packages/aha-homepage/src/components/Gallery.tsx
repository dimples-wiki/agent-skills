import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { BrowserFrame } from "./BrowserFrame";
import { Reveal, SectionHead } from "./Reveal";

interface Page {
  id: string;
  tab: string;
  title: string;
  url: string;
  shot: string;
  mid?: string;
  midAlt?: string;
  dek: string;
  tags: string[];
  layers: { label: string; on: boolean }[];
}

const PAGES: Page[] = [
  {
    id: "fourier",
    tab: "傅里叶变换",
    title: "傅里叶变换",
    url: "127.0.0.1:7332/fourier-transform.html",
    shot: "/shots/fourier-transform.png",
    mid: "/shots/fourier-mid.png",
    midAlt: "两列波叠加成新波的图解与步骤导航",
    dek: "把任意信号拆成一堆正弦波的叠加 —— 给你频域的另一双眼睛。",
    tags: ["起点 L1", "波场图解", "vgpu 展示层"],
    layers: [
      { label: "一句话核心", on: true },
      { label: "直觉类比 + 失效边界", on: true },
      { label: "步骤模拟器", on: true },
      { label: "对比卡 · 邻居概念", on: true },
    ],
  },
  {
    id: "attention",
    tab: "注意力机制",
    title: "注意力机制是什么",
    url: "127.0.0.1:7332/transformer-attention.html",
    shot: "/shots/transformer-attention.png",
    dek: "让每个字重新分配注意力,决定上下文里谁更重要。",
    tags: ["起点 L1", "结构图解", "对比卡"],
    layers: [
      { label: "一句话核心", on: true },
      { label: "直觉类比 + 失效边界", on: true },
      { label: "结构图 · Q·Kᵀ", on: true },
      { label: "步骤模拟器", on: false },
    ],
  },
  {
    id: "tls",
    tab: "TLS 握手",
    title: "TLS 握手:地址栏的锁",
    url: "127.0.0.1:7332/tls-handshake.html",
    shot: "/shots/tls-handshake.png",
    mid: "/shots/tls-mid.png",
    midAlt: "TLS 握手步骤模拟器:当前步骤高亮,可逐步播放",
    dek: "地址栏的锁是怎么锁上的 —— 四步握手,一次看不见的密谈。",
    tags: ["起点 L1", "步骤模拟器", "失败模式卡"],
    layers: [
      { label: "一句话核心", on: true },
      { label: "直觉类比 + 失效边界", on: true },
      { label: "步骤模拟器", on: true },
      { label: "边界与失败 · 记忆标签", on: true },
    ],
  },
  {
    id: "bayes",
    tab: "贝叶斯定理",
    title: "贝叶斯定理是什么",
    url: "127.0.0.1:7332/bayes-theorem.html",
    shot: "/shots/bayes-theorem.png",
    dek: "新证据如何更新旧信念 —— 从「检测阳性」到「真患病」的距离。",
    tags: ["起点 L1", "对比卡", "数字纪律"],
    layers: [
      { label: "一句话核心", on: true },
      { label: "直觉类比 + 失效边界", on: true },
      { label: "对比卡 · 邻居概念", on: true },
      { label: "步骤模拟器", on: false },
    ],
  },
  {
    id: "gradient",
    tab: "梯度下降",
    title: "梯度下降是什么",
    url: "127.0.0.1:7332/gradient-descent.html",
    shot: "/shots/gradient-descent.png",
    dek: "蒙眼下山:沿着最陡的方向,一步一步滚向谷底。",
    tags: ["起点 L2 · 桥接类比", "损失面可视化"],
    layers: [
      { label: "一句话核心", on: true },
      { label: "桥接类比(相邻背景)", on: true },
      { label: "场 / 等高线图解", on: true },
      { label: "步骤模拟器", on: false },
    ],
  },
];

export function Gallery({ onMore }: { onMore: () => void }) {
  const [active, setActive] = useState(PAGES[0]);

  // 顿悟球名词 → 直达对应图解 tab
  useEffect(() => {
    const onGoto = (e: Event) => {
      const id = (e as CustomEvent).detail;
      const p = PAGES.find((p) => p.id === id);
      if (p) setActive(p);
    };
    window.addEventListener("aha:gallery", onGoto);
    return () => window.removeEventListener("aha:gallery", onGoto);
  }, []);

  return (
    <section id="gallery" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead
          n="02"
          eyebrow="图解详情 · 真实生成页"
          title={
            <>
              打开任何一篇,
              <br className="hidden md:block" />
              都是一场<span className="text-gold">渐进式</span>的理解。
            </>
          }
          lead="不是摘要,不是文档搬运 —— 每页从一句话核心出发,经过带失效边界的类比,抵达真实机制,最后在「记」处收束。以下全部是本机真实书架里的截图。"
        />

        {/* 标签 */}
        <Reveal delay={0.15}>
          <div className="mt-10 flex flex-wrap gap-2">
            {PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active.id === p.id
                    ? "text-gold-ink"
                    : "border border-line bg-ink-850 text-cream-2 hover:border-line-2 hover:text-cream-1"
                }`}
              >
                {active.id === p.id && (
                  <motion.span
                    layoutId="gallery-pill"
                    className="absolute inset-0 rounded-full bg-gold"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{p.tab}</span>
              </button>
            ))}
            <button
              onClick={onMore}
              className="rounded-full border border-dashed border-line-2 px-4 py-2 text-sm font-semibold text-cream-3 transition-colors hover:border-gold/60 hover:text-gold"
            >
              更多...
            </button>
          </div>
        </Reveal>

        {/* 内容 */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_5fr]"
            >
              <div className="order-2 lg:order-1">
                <BrowserFrame
                  url={active.url}
                  src={active.shot}
                  alt={`aha 图解页:${active.title} 首屏`}
                />
              </div>
              <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
                <div className="rounded-2xl border border-line bg-ink-850/60 p-5">
                  <h3 className="text-xl font-bold">{active.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream-2">{active.dek}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {active.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-gold"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {active.mid ? (
                  <BrowserFrame
                    url={`${active.url} #机制`}
                    src={active.mid}
                    alt={active.midAlt ?? ""}
                    className="rotate-[1.2deg] transition-transform hover:rotate-0"
                  />
                ) : (
                  <div className="rounded-2xl border border-line bg-ink-850/60 p-5">
                    <p className="mb-3 font-mono text-[11px] font-bold tracking-widest text-cream-4 uppercase">
                      本页的骨架取舍
                    </p>
                    <ul className="space-y-2.5">
                      {active.layers.map((l) => (
                        <li key={l.label} className="flex items-center gap-2.5 text-sm">
                          <span
                            className={`flex size-4.5 items-center justify-center rounded-full ${
                              l.on ? "bg-mint/15 text-mint" : "bg-line/40 text-cream-4"
                            }`}
                          >
                            {l.on ? <Check size={11} /> : <span className="text-[10px]">–</span>}
                          </span>
                          <span className={l.on ? "text-cream-1" : "text-cream-4 line-through"}>
                            {l.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[11px] text-cream-4">
                      骨架是菜单不是模板 —— 对主题没价值的层,不写。
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
