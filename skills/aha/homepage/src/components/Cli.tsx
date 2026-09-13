import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { Download, Globe, ShieldCheck, TerminalSquare } from "lucide-react";
import { Reveal, SectionHead } from "./Reveal";

type Line =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string; tone?: "ok" | "link" | "dim" };

type Group = {
  id: string;
  icon: typeof Download;
  name: string;
  desc: string;
  tone: string;
  term: string;
  script: Line[];
};

const GROUPS: Group[] = [
  {
    id: "install",
    icon: Download,
    name: "安装 skill",
    tone: "text-gold",
    term: "zsh — 安装",
    desc: "一条免交互命令:全局安装、默认 agent、软链映射。装完直接在 agent 里 /aha。",
    script: [
      { kind: "cmd", text: "npx skills add dimples-wiki/agent-skills -s aha -y" },
      { kind: "out", text: "✓ aha 已全局安装 · 软链映射 · 零交互", tone: "ok" },
      { kind: "out", text: "# 装好了。下面这行,打在任意 agent 的对话框里:", tone: "dim" },
      { kind: "cmd", text: "/aha RAG" },
      { kind: "out", text: "✓ 生成 ~/.aha/rag.html · 13/13 质量门通过", tone: "ok" },
      { kind: "out", text: "概念书架 → http://127.0.0.1:7332 · 检索增强生成 已在架", tone: "link" },
    ],
  },
  {
    id: "check",
    icon: ShieldCheck,
    name: "aha check",
    tone: "text-mint",
    term: "zsh — aha check",
    desc: "13 道质量门扫描:单 h1、无颜色字面量、自测答案默认折叠、比例数字有账本……门不过,不交付。",
    script: [
      { kind: "cmd", text: "npx @dimples/aha check fourier-transform.html" },
      { kind: "out", text: "✓ 13/13 门通过 · tokens v1.3.1", tone: "ok" },
    ],
  },
  {
    id: "start",
    icon: TerminalSquare,
    name: "aha start / stop",
    tone: "text-gold",
    term: "zsh — aha start / stop",
    desc: "本地书架守护进程,跑在 127.0.0.1:7332。一般不用手动 start —— agent 执行 /aha 时会自动拉起(幂等);aha stop 一键停掉。「/」键即搜整架图解。",
    script: [
      { kind: "cmd", text: "npx @dimples/aha start" },
      { kind: "out", text: "✓ 幂等 · 守护已在运行", tone: "ok" },
      { kind: "out", text: "概念书架 → http://127.0.0.1:7332 · 「/」键即搜", tone: "link" },
      { kind: "cmd", text: "npx @dimples/aha stop" },
      { kind: "out", text: "✓ 守护已停止 · 端口 7332 已释放", tone: "dim" },
    ],
  },
  {
    id: "share",
    icon: Globe,
    name: "aha share",
    tone: "text-sky",
    term: "zsh — aha share",
    desc: "一键 Cloudflare 临时隧道 —— 把概念书架或单页晒到公网,链接即见解。",
    script: [
      { kind: "cmd", text: "npx @dimples/aha share" },
      { kind: "out", text: "隧道已就绪 · 免账号 · 关闭即失效", tone: "dim" },
      { kind: "out", text: "公网 → https://aha-moments.trycloudflare.com", tone: "link" },
    ],
  },
];

const toneCls = (t?: string) =>
  t === "ok" ? "text-mint" : t === "link" ? "text-sky" : t === "dim" ? "text-cream-4" : "text-cream-3";

function Terminal({ script, title }: { script: Line[]; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const [progress, setProgress] = useState<{ line: number; ch: number }>({ line: 0, ch: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let li = 0;
    let chi = 0;
    let cancelled = false;
    setProgress({ line: 0, ch: 0 });
    setDone(false);

    const tick = () => {
      if (cancelled) return;
      const line = script[li];
      if (!line) {
        setDone(true);
        return;
      }
      if (line.kind === "cmd") {
        chi += 1;
        if (chi >= line.text.length) {
          li += 1;
          chi = 0;
          setProgress({ line: li, ch: 0 });
          setTimeout(tick, 320);
          return;
        }
        setProgress({ line: li, ch: chi });
        setTimeout(tick, 26 + Math.random() * 40);
      } else {
        li += 1;
        setProgress({ line: li, ch: 0 });
        setTimeout(tick, 460);
      }
    };
    const start = setTimeout(tick, 350);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [inView, script]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-line bg-ink-950/90 shadow-frame"
    >
      <div className="flex items-center gap-3 border-b border-line bg-ink-800 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[11px] text-cream-4">{title}</span>
      </div>
      <div className="min-h-[248px] break-words p-5 font-mono text-[13px] leading-[1.9]">
        {script.slice(0, progress.line).map((l, i) => (
          <LineView key={i} line={l} />
        ))}
        {script[progress.line] && (
          <LineView
            line={script[progress.line]}
            partial={script[progress.line].kind === "cmd" ? script[progress.line].text.slice(0, progress.ch) : undefined}
            active
          />
        )}
        {done && (
          <p className="text-cream-4">
            <span className="text-gold">$</span>{" "}
            <span className="caret text-gold">▊</span>
          </p>
        )}
      </div>
    </div>
  );
}

function LineView({ line, partial, active }: { line: Line; partial?: string; active?: boolean }) {
  if (line.kind === "cmd") {
    const text = partial ?? line.text;
    return (
      <p className="text-cream-1">
        <span className="mr-2 text-gold">$</span>
        {text}
        {active && partial !== undefined && <span className="caret text-gold">▊</span>}
      </p>
    );
  }
  return <p className={toneCls(line.tone)}>{line.text}</p>;
}

export function Cli() {
  const [active, setActive] = useState(GROUPS[0].id);
  const group = GROUPS.find((g) => g.id === active) ?? GROUPS[0];

  return (
    <section id="cli" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[6fr_6fr]">
          {/* 移动端:标题/卡片在前,终端紧随其后 —— 点卡片能立刻看到重播 */}
          <div className="order-2 self-start lg:order-none lg:sticky lg:top-24">
            <Reveal>
              <Terminal script={group.script} title={group.term} />
            </Reveal>
          </div>
          <div>
            <SectionHead
              n="06"
              eyebrow="CLI · @dimples/aha"
              title={
                <>
                  一组命令,
                  <br />
                  一个<span className="text-gold">可分享</span>的理解库。
                </>
              }
              lead="生成交给 agent,安装、质量与分发交给 CLI:点一张卡片,左边终端就会演给你看。"
            />
            <div className="mt-9 space-y-4">
              {GROUPS.map((g, i) => {
                const on = g.id === active;
                return (
                  <Reveal key={g.id} delay={0.15 + i * 0.1}>
                    <button
                      type="button"
                      onClick={() => setActive(g.id)}
                      aria-pressed={on}
                      className={`flex w-full cursor-pointer gap-4 rounded-2xl border p-4.5 text-left transition-colors ${
                        on
                          ? "border-gold/50 bg-ink-850"
                          : "border-line/70 bg-ink-850/50 hover:border-gold/30"
                      }`}
                    >
                      <g.icon size={20} className={`mt-0.5 shrink-0 ${on ? g.tone : "text-cream-3"}`} />
                      <div>
                        <p className={`font-mono text-sm font-bold ${on ? "text-cream-1" : "text-cream-2"}`}>
                          {g.name}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-cream-3">{g.desc}</p>
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
