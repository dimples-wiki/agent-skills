import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { FileDown, LibraryBig, Sparkles, Wand2 } from "lucide-react";
import { BrowserFrame } from "./BrowserFrame";
import { Reveal, SectionHead } from "./Reveal";

/** 鼠标 3D 倾斜容器 */
function Tilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), {
    stiffness: 130,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), {
    stiffness: 130,
    damping: 18,
  });
  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformPerspective: 1600 }}
      className="relative"
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

const CALLOUTS = [
  {
    icon: LibraryBig,
    title: "编辑部式目录",
    desc: "标题 · 一句话核心 · 起点级别,新篇置顶",
    pos: "-left-2 top-14 lg:-left-14",
    delay: 0.5,
  },
  {
    icon: Sparkles,
    title: "起点校准 L1–L3",
    desc: "零基础 / 相邻背景 / 已入门,起点不同讲法不同",
    pos: "-right-2 top-1/3 lg:-right-12",
    delay: 0.65,
  },
  {
    icon: Wand2,
    title: "一键公网分享",
    desc: "npx aha share → trycloudflare.com 临时链接",
    pos: "-right-1 -bottom-5 lg:-right-8",
    delay: 0.8,
  },
  {
    icon: FileDown,
    title: "一键导出带走",
    desc: "WebP · PNG · SVG · PDF · Markdown,交互自动定格终态,导出即所见",
    pos: "-left-2 bottom-6 lg:-left-12",
    delay: 0.95,
  },
] as const;

export function Shelf() {
  return (
    <section id="shelf" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead
          align="center"
          n="01"
          eyebrow="概念书架 · aha serve"
          title={
            <>
              所有你懂过的,
              <br />
              都站在<span className="text-gold">书架</span>上。
            </>
          }
          lead="每篇图解自动归档到 ~/.aha,本地 7332 端口一张目录页尽收眼底。搜一个词,回到任何一个你曾经「噢！」过的下午。"
        />

        <Reveal delay={0.15} className="relative mt-16">
          <Tilt>
            <BrowserFrame
              url="127.0.0.1:7332 — aha · 概念书架"
              src="/shots/bookshelf.png"
              alt="aha 概念书架索引页:编辑部式目录列出全部已生成的图解"
            />
          </Tilt>
          {CALLOUTS.map((c) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: c.delay }}
              className={`absolute ${c.pos} hidden w-52 rounded-xl border border-line/80 bg-ink-850/90 p-3.5 shadow-frame backdrop-blur-md md:block`}
            >
              <div className="flex items-center gap-2">
                <c.icon size={14} className="text-gold" />
                <span className="text-xs font-bold">{c.title}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-cream-3">{c.desc}</p>
            </motion.div>
          ))}
        </Reveal>

        <Reveal delay={0.3}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5 font-mono text-xs">
            {["/ 聚焦搜索", "◐ 深浅双主题", "◈ 三套风格", "⬇ 一键导出", "页面即链接"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-line bg-ink-850 px-3 py-1.5 text-cream-3"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed text-cream-3">
            书架是本地起点:所有页面自包含、零远程渲染依赖 ——
            拷走一个 .html,它依然完整成立。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
