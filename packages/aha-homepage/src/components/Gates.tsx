import { Check } from "lucide-react";
import { Reveal, SectionHead } from "./Reveal";

const GATES = [
  "全文恰一个 h1",
  "标题层级不跳档",
  "head 元数据齐全",
  "img 必带 alt",
  "tokens 原样内联",
  "块外无颜色字面量",
  "语义类在词表内",
  "脚本零外链依赖",
  "无提问者指代",
  "失败标签 1-2 字一致",
  "模拟器标签中文化",
  "自测 ≥2 问·答案折叠",
  "数字账本·比例数字有来源",
];

export function Gates() {
  return (
    <section id="gates" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[4fr_8fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              n="07"
              eyebrow="质量门 · aha check"
              title={
                <>
                  为了不糊弄,
                  <br />
                  先给自己上了
                  <br />
                  <span className="text-gold">13 道门</span>。
                </>
              }
              lead="每篇图解交付前都要过机器扫描:结构、语义、颜色纪律、语气边界。门不过,不交付。"
            />
            <Reveal delay={0.2}>
              <div className="mt-8 flex items-end gap-3">
                <span className="font-mono text-6xl leading-none font-extrabold text-gold">
                  13/13
                </span>
                <span className="pb-1.5 font-mono text-xs text-cream-4">
                  gates · all green
                </span>
              </div>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GATES.map((g, i) => (
              <Reveal key={g} delay={i * 0.045}>
                <div className="group flex items-center gap-3 rounded-xl border border-line/70 bg-ink-850/50 px-4 py-3.5 transition-all hover:border-mint/40 hover:bg-ink-850">
                  <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-mint/12 text-mint transition-transform group-hover:scale-110">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm font-medium text-cream-2 transition-colors group-hover:text-cream-1">
                    {g}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-cream-4">
                    G{String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
