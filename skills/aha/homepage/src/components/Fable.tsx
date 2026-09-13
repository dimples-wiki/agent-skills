import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { BookOpen, TerminalSquare } from "lucide-react";
import { Reveal, SectionHead } from "./Reveal";

/** 寓言全文:~/.aha/garbage-collection.html 的「查房」(aha 生成,一字未改) */
const STORY = [
  "夜班护士的规矩只有一条：一张床还占不占，不看床头柜里有没有腕带，只看从值班台的白板出发，还能不能顺藤摸到这张床。白板上写着今晚在岗的每一位医生，和每位医生名下的医嘱。摸得到的床，就留着；摸不到的，哪怕腕带还压在枕头底下，天亮前也腾出来，换上新床单。",
  "这法子用了很多年，没出过岔子。麻烦出在两个长住病人身上。307 和 308 病情相近，走得近了，各自把对方写进了自己的紧急联系人。后来两人先后出院，医嘱撤了，白板上再没有他们的名字 —— 可在外人看来，床头柜里还压着腕带，这两张床就该一直留着。",
  "护士没有去收那两只腕带。她只是在床位满了、新名单排到门口的时候 —— 查房的那一刻，前台暂停办入院，等着的家属在长椅上坐一会儿 —— 从白板出发，一个名字一个名字顺下去：医嘱落在哪个病人身上，病人的名下又挂着哪位照护人，照护人名下还有谁。这一轮走完，307 和 308 无论如何也摸不到了：白板上没有他们，他们的下落，只剩那两行互相指着的紧急联系人知道。天亮前，两张床腾了出来。",
  "对面街的私人诊所是另一套规矩：一位医生同一时间只接一位病人，看完当面结清，病历从头到尾只归一人。那边不查房，也没有人在夜里等 —— 只是想把病历留给下一位医生看看，得先跑一趟正式的转诊手续。",
];

const QUESTIONS = [
  "腕带明明还压在床头柜里，为什么床还是腾了出来？",
  "你身边还有什么地方，靠“隔一阵从源头追一遍”维持秩序，而不是靠“每样东西只有一个主人”？两边各付什么代价？",
];

const ANSWERS = [
  "判床的规矩自始至终只有一条：从值班白板（根集合）出发还摸不摸得到。两只腕带互压只是“引用还在”—— 两人互写的紧急联系人构成闭环，环里没有任何一条路通回白板，追踪判定照样把床腾出来（这正是垃圾回收里 D↔E 环不是死角的原因）。只有按“有腕带就占床”的引用计数直觉，这两张床才永远腾不出。",
  "这类“从源头定期追一遍”的秩序到处都是：浏览器定期从 document 出发标记可达的 DOM 节点再做清扫；一些缓存不用逐条计数，而是从源全量重建；Git 只保留从 HEAD 出发可达的提交。它们共同的代价是要“停下来查一轮”（停顿），换来的是引用可以随便连；而“每样东西只有一个主人”的那套（Rust / C++ 所有权）零巡视零等待，代价是共享要走显式手续、结构受到限制。",
];

const MAPPING = [
  { story: "值班台的白板", mech: "根集合 GC Roots" },
  { story: "从白板顺藤摸床", mech: "可达性追踪" },
  { story: "307 / 308 互留联系人", mech: "引用环 · 闭环不可达" },
  { story: "查房时前台暂停入院", mech: "Stop-the-World 停顿" },
  { story: "对街诊所 · 病历只归一人", mech: "引用计数那套规矩" },
];


type FableLine =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string; tone?: "ok" | "link" | "dim" };

const FABLE_SCRIPT: FableLine[] = [
  { kind: "cmd", text: "/aha 垃圾回收" },
  { kind: "out", text: "✓ 已生成 ~/.aha/garbage-collection.html · 13/13 质量门通过", tone: "ok" },
  { kind: "out", text: "图解 → http://127.0.0.1:7332/garbage-collection.html", tone: "link" },
  { kind: "out", text: "书架 → http://127.0.0.1:7332", tone: "link" },
  { kind: "out", text: "记不住?对我说「补充寓言故事」(≤1000 字 · 防套路清单把关)", tone: "dim" },
  { kind: "cmd", text: "补充寓言故事" },
  { kind: "out", text: "✓ 寓言已写入页面 —— 刷新查看「帮你记住」", tone: "ok" },
];

const fableTone = (t?: string) =>
  t === "ok" ? "text-mint" : t === "link" ? "text-sky" : t === "dim" ? "text-cream-4" : "text-cream-3";

/** 紧凑打字机:寓言触发全流程(进入视口自动播放) */
function FableTerm() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [progress, setProgress] = useState({ line: 0, ch: 0 });

  useEffect(() => {
    if (!inView) return;
    let li = 0;
    let chi = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const line = FABLE_SCRIPT[li];
      if (!line) return;
      if (line.kind === "cmd") {
        chi += 1;
        if (chi >= line.text.length) {
          li += 1;
          chi = 0;
          setProgress({ line: li, ch: 0 });
          setTimeout(tick, 380);
          return;
        }
        setProgress({ line: li, ch: chi });
        setTimeout(tick, 34 + Math.random() * 44);
      } else {
        li += 1;
        setProgress({ line: li, ch: 0 });
        setTimeout(tick, 420);
      }
    };
    const start = setTimeout(tick, 300);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [inView]);

  const toneCls2 = (l: FableLine) => (l.kind === "out" ? fableTone(l.tone) : "text-cream-1");

  return (
    <div ref={ref} className="flex h-full min-h-[192px] flex-col overflow-hidden rounded-2xl border border-line bg-ink-950/90 shadow-frame">
      <div className="flex items-center gap-2.5 border-b border-line bg-ink-800 px-4 py-2">
        <TerminalSquare size={12} className="text-gold" />
        <span className="font-mono text-[10px] text-cream-4">agent 会话 · 寓言这样触发</span>
      </div>
      <div className="flex-1 break-words p-4 font-mono text-[12px] leading-[1.85]">
        {FABLE_SCRIPT.slice(0, progress.line).map((l, i) => (
          <p key={i} className={toneCls2(l)}>
            {l.kind === "cmd" && <span className="mr-2 text-gold">❯</span>}
            {l.text}
          </p>
        ))}
        {FABLE_SCRIPT[progress.line] && (
          <p className={toneCls2(FABLE_SCRIPT[progress.line])}>
            {FABLE_SCRIPT[progress.line].kind === "cmd" && <span className="mr-2 text-gold">❯</span>}
            {FABLE_SCRIPT[progress.line].kind === "cmd"
              ? FABLE_SCRIPT[progress.line].text.slice(0, progress.ch)
              : ""}
            {FABLE_SCRIPT[progress.line].kind === "cmd" && <span className="caret text-gold">▊</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export function Fable() {
  return (
    <section id="fable" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead
          n="03"
          eyebrow="寓言模式 · 选配"
          title={
            <>
              记不清枯燥概念?
              <br className="hidden md:block" />
              记住一个<span className="text-gold">故事</span>。
            </>
          }
          lead="每则寓言都与页面讲的真实机制同构 —— 情节的每次转折,映射机制的真实因果,不为故事好看扭曲机制。左边这则《查房》,就是它给「垃圾回收」写的,可以滚动读完。"
        />

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[7fr_5fr]">
          {/* 寓言书页:全文可滚动,答案区折叠 —— 与真实图解页同款交互 */}
          <Reveal className="h-full">
            <figure className="relative flex h-full flex-col rotate-[-0.8deg] rounded-2xl bg-gradient-to-b from-[#e7dcc4] to-[#d9cba9] text-ink-900 shadow-frame transition-transform hover:rotate-0">
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/10 px-7 pb-4 pt-6 font-mono text-[11px] font-bold tracking-widest text-ink-900/70 md:px-9">
                <span className="flex items-center gap-1.5">
                  <BookOpen size={12} />
                  垃圾回收 · 的寓言
                </span>
                <span>《查房》</span>
              </figcaption>
              <div className="min-h-[300px] max-h-[452px] flex-1 space-y-4 overflow-y-auto px-7 py-6 font-serif text-[15px] leading-[1.95] text-ink-800 md:px-9 [scrollbar-width:thin] [scrollbar-color:rgba(36,26,9,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-ink-900/25">
                {STORY.map((p, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? "first-letter:float-left first-letter:mr-1.5 first-letter:font-serif first-letter:text-4xl first-letter:font-bold first-letter:leading-[1.1] first-letter:text-gold"
                        : ""
                    }
                  >
                    {p}
                  </p>
                ))}
                <div className="rounded-xl bg-ink-900/5 px-4 py-3.5">
                  <p className="font-sans text-[13px] font-bold text-ink-900/80">
                    合上页面前,问自己两个问题:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 font-sans text-[13px] leading-relaxed text-ink-900/75">
                    {QUESTIONS.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none font-sans text-[13px] font-bold text-ink-900/60 transition-colors hover:text-ink-900 [&::-webkit-details-marker]:hidden">
                      <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
                      查看答案
                    </summary>
                    <ol className="mt-2.5 list-decimal space-y-2.5 pl-5 font-sans text-[13px] leading-relaxed text-ink-900/75">
                      {ANSWERS.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ol>
                  </details>
                </div>
              </div>
              <p className="border-t border-ink-900/10 px-7 py-4 font-mono text-[11px] text-ink-900/60 md:px-9">
                ↓ 卡片内滚动读完 —— 全文 486 字 · aha 生成
              </p>
            </figure>
          </Reveal>

          {/* 故事 ↔ 机制:同构映射 */}
          <div className="flex h-full flex-col">
            <Reveal delay={0.1}>
              <p className="mb-4 font-mono text-[11px] font-bold tracking-widest text-cream-4 uppercase">
                《查房》↔ 垃圾回收 · 每一处都对得上
              </p>
              <div className="space-y-2.5">
                {MAPPING.map((m) => (
                  <div
                    key={m.story}
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-ink-850/50 px-4 py-3 transition-colors hover:border-gold/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-cream-2" title={m.story}>
                      {m.story}
                    </span>
                    <span aria-hidden className="shrink-0 text-gold/70">→</span>
                    <span className="shrink-0 font-mono text-xs font-bold text-gold">{m.mech}</span>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.2} className="mt-5">
              <FableTerm />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
