import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Reveal, SectionHead } from "./Reveal";

const LAYERS = [
  {
    n: "01",
    title: "一句话核心",
    desc: "首屏即答案:概念名 + 一句话说清 + 主视觉。看不懂后面再读,赶时间的到此为止。",
    always: true,
  },
  {
    n: "02",
    title: "为什么存在",
    desc: "before/after 对比:没有它时人们怎么办、痛在哪里。理解从动机开始。",
    always: false,
  },
  {
    n: "03",
    title: "直觉",
    desc: "一个生活化的类比 —— 且必须写明它在哪里失效。不标失效点的类比,不许上页。",
    always: false,
  },
  {
    n: "04",
    title: "真实机制",
    desc: "大白话先行、术语后置,至少一个带真实值的实例(4 点手算一次 DFT);过程类配步骤模拟器,可逐帧步进。",
    always: true,
  },
  {
    n: "05",
    title: "容易混淆",
    desc: "按「各自改变什么」对比 2-3 个邻居概念,而不是罗列特性表。",
    always: false,
  },
  {
    n: "06",
    title: "边界与失败",
    desc: "误区按「你可能以为 X → 其实 Y → 分界在 Z」点名纠正;失败模式配 1-2 字记忆标签:雪崩、脑裂 —— 一眼认出,一字记住。",
    always: false,
  },
  {
    n: "07",
    title: "记 · 自测",
    desc: "一句话公式式收尾;随后 2-3 道自测题(答案折叠,考理解不考背诵)与页尾数字账本 —— 学没学会,一试便知。",
    always: true,
  },
];

export function Layers() {
  const listRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.72", "end 0.55"],
  });
  const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });

  return (
    <section id="layers" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[5fr_7fr]">
          {/* 左:粘性标题 */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              n="04"
              eyebrow="七层骨架 · 渐进式理解"
              title={
                <>
                  不是写短一点,
                  <br />
                  是<span className="text-gold">一层层</span>讲下去。
                </>
              }
              lead="每篇图解共享同一副骨架:从一句话核心到公式式收尾,读者在任意一层都可以停,也可以一路走到机制深处。"
            />
            <Reveal delay={0.2}>
              <div className="mt-8 rounded-2xl border border-line bg-ink-850/60 p-5">
                <p className="font-mono text-[11px] font-bold tracking-widest text-cream-4 uppercase">
                  菜单,不是模板
                </p>
                <p className="mt-2 text-sm leading-relaxed text-cream-2">
                  对主题没价值的层可以不写,但第
                  <span className="mx-1 font-mono font-bold text-gold">1</span>、
                  <span className="mx-1 font-mono font-bold text-gold">4</span>、
                  <span className="mx-1 font-mono font-bold text-gold">7</span>
                  层永远在场 —— 核心答案、真实机制、带自测的收尾,一篇都不能少。
                </p>
              </div>
            </Reveal>
          </div>

          {/* 右:七层 + 进度线 */}
          <div ref={listRef} className="relative pl-10 md:pl-14">
            <div
              aria-hidden
              className="absolute top-2 bottom-2 left-2.5 w-px bg-line md:left-4"
            />
            <motion.div
              aria-hidden
              style={{ scaleY: lineScale }}
              className="absolute top-2 bottom-2 left-2.5 w-px origin-top bg-gradient-to-b from-gold via-gold to-ember md:left-4"
            />
            <div className="space-y-5">
              {LAYERS.map((l, i) => (
                <motion.div
                  key={l.n}
                  initial={{ opacity: 0, x: 22 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: i * 0.04 }}
                  className="relative rounded-2xl border border-line/70 bg-ink-850/50 p-5 backdrop-blur-sm transition-colors hover:border-gold/30 md:p-6"
                >
                  <span
                    aria-hidden
                    className={`absolute top-7 -left-10 size-[9px] rounded-full ring-4 ring-ink-900 md:-left-[2.85rem] ${
                      l.always ? "bg-gold" : "bg-line-2"
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`font-mono text-2xl font-bold tabular-nums ${
                        l.always ? "text-gold" : "text-cream-4"
                      }`}
                    >
                      {l.n}
                    </span>
                    <h3 className="text-lg font-bold">{l.title}</h3>
                    {l.always && (
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold text-gold">
                        永在场
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-cream-2">{l.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
