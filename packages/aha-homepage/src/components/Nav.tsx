import { useEffect, useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";
import { GithubMark } from "./icons";

const LINKS = [
  { href: "#shelf", label: "书架" },
  { href: "#gallery", label: "图解" },
  { href: "#layers", label: "七层骨架" },
  { href: "#presets", label: "皮肤" },
  { href: "#cli", label: "CLI" },
];

export function Wordmark({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <a
      href="#top"
      aria-label="aha — 回到顶部"
      className={`wordmark group relative flex items-baseline gap-1 -translate-y-px ${className}`}
    >
      <span className="font-display text-[1.7rem] leading-none font-extrabold tracking-tight">
        a<span className="text-gold">h</span>a
      </span>
      <span
        aria-hidden
        className="relative inline-flex h-[1.3rem] w-[0.66rem] items-center justify-center self-center font-display text-[1.35rem] leading-none font-extrabold text-gold"
      >
        <span className="aha-mark aha-mark-q absolute">?</span>
        <span className="aha-mark aha-mark-e absolute">!</span>
      </span>
      <span className={`pointer-events-none absolute left-0 z-50 w-max max-w-[72vw] rounded-xl border border-line-2 bg-ink-950/95 px-3.5 py-2.5 text-left opacity-0 shadow-frame backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 ${
        flip
          ? "bottom-full mb-2.5 -translate-y-1"
          : "top-full mt-2.5 translate-y-1"
      }`}>
        <span className="block font-mono text-[11px] leading-relaxed text-cream-3">
          <span className="font-bold text-gold">aha</span> · 直译是「啊哈!」
          <br />
          中文更地道的说法:「噢!<span className="inline-block origin-bottom transition-transform duration-300 group-hover:scale-125">😯</span>」
        </span>
      </span>
    </a>
  );
}

export function Nav({ onStart }: { onStart: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line/60 bg-ink-900/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-3.5">
          <Wordmark />
          <a
            href="https://www.skills.sh/dimples-wiki/agent-skills/aha"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-transparent px-3 py-1 font-mono text-[11px] font-semibold text-cream-3 transition-colors hover:border-gold/60 hover:bg-gold/50 hover:text-gold sm:flex"
          >
            <img src="/skill-mark.webp" alt="" width={11} height={11} className="rounded-[2px] opacity-80 transition-opacity hover:opacity-100" />
            skill
          </a>
        </div>
        {/* 绝对居中:不受左右两组宽度差影响 */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-cream-2 transition-colors hover:text-gold"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/dimples-wiki/agent-skills"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full border border-line bg-ink-850 px-3.5 py-1.5 text-xs font-semibold text-cream-2 transition-colors hover:border-line-2 hover:text-cream-1 sm:flex"
          >
            <GithubMark size={13} />
            <span className="flex items-center gap-1">
              <Star size={11} className="text-gold" /> star
            </span>
          </a>
          <button
            type="button"
            onClick={onStart}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-gold-ink transition-transform hover:scale-[1.04] active:scale-95"
          >
            开始使用 <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}
