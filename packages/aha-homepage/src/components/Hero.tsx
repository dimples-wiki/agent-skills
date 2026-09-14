import { motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { DomeStage } from "./DomeStage";
import { CopyButton, INSTALL_CMD } from "./UsageModal";

export function Hero({
  onStart,
  onWordClick,
}: {
  onStart: () => void;
  onWordClick: (word: string) => void;
}) {
  return (
    <section id="top" className="relative h-[100svh] overflow-hidden bg-[#0a0909]">
      {/* 整屏着色器画布:夜幕 + 星空 + 釉面穹顶(永远锚定底部)+ 卫星名词 */}
      <DomeStage onWordClick={onWordClick} />

      {/* 上部文案直接叠在画布上(天空区) */}
      <div id="hero-copy" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[52svh] flex-col items-center justify-center px-5 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.14] font-extrabold tracking-tight text-balance [text-shadow:0_2px_24px_rgba(8,6,5,0.9)]"
        >
          复杂概念,<span className="text-goldflow">直观图解</span>。
        </motion.h1>

        {/* 安装命令:一进首屏就能看到、能复制 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.36 }}
          className="pointer-events-auto mt-6 flex w-full max-w-xl items-center gap-2.5 rounded-xl border border-line-2 bg-ink-950/70 py-2 pl-3.5 pr-2 backdrop-blur-md [box-shadow:0_2px_16px_rgba(4,3,2,0.5)]"
        >
          <span aria-hidden className="shrink-0 font-mono text-sm font-bold text-gold">
            $
          </span>
          <code className="min-w-0 flex-1 break-words font-mono text-[11px] leading-relaxed text-cream-1 sm:break-normal sm:whitespace-nowrap md:text-xs">
            {INSTALL_CMD}
          </code>
          <CopyButton text={INSTALL_CMD} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.46 }}
          className="pointer-events-auto mt-5 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={onStart}
            className="group flex cursor-pointer items-center gap-2 rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-gold-ink shadow-glow-gold transition-transform hover:scale-[1.04] active:scale-95"
          >
            开始使用 · 只需 3 步
          </button>
          <a
            href="#shelf"
            className="flex items-center gap-2 rounded-full border border-line-2 bg-ink-900/50 px-6 py-2.5 text-sm font-semibold text-cream-1 backdrop-blur-md transition-colors hover:border-gold/60 hover:text-gold"
          >
            先逛逛书架 <ArrowDown size={15} />
          </a>
        </motion.div>

      </div>

    </section>
  );
}
