import { ArrowUp, Package } from "lucide-react";
import { Reveal } from "./Reveal";
import { GithubMark } from "./icons";
import { CopyButton, INSTALL_CMD } from "./UsageModal";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line/30">
      {/* 波带收尾:静态暖光渐变 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_100%,rgba(255,171,46,0.10)_0%,rgba(255,133,119,0.05)_38%,transparent_70%)]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-28 pb-10 md:pt-36">
        <Reveal className="text-center">
          <p className="mb-5 font-mono text-xs font-bold tracking-[0.22em] text-gold uppercase">
            就差你了
          </p>
          <h2 className="text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.1] font-extrabold tracking-tight text-balance">
            轮到你,<span className="text-goldflow">图解</span>一个概念。
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-cream-2 md:text-lg">
            装好之后,在任意 agent 里输入「/aha 任何概念」—— 剩下的交给它。
            <br />
            五分钟后,你会听见自己那声「噢！」。
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2.5 rounded-xl border border-line-2 bg-ink-950/70 py-2 pl-3.5 pr-2 backdrop-blur-md [box-shadow:0_2px_16px_rgba(4,3,2,0.5)]">
            <span aria-hidden className="shrink-0 font-mono text-sm font-bold text-gold">
              $
            </span>
            <code className="min-w-0 flex-1 break-words font-mono text-[11px] leading-relaxed text-cream-1 sm:break-normal sm:whitespace-nowrap md:text-xs">
              {INSTALL_CMD}
            </code>
            <CopyButton text={INSTALL_CMD} />
          </div>
        </Reveal>
        <div className="mt-24 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 border-t border-line/40 pt-7 font-mono text-[11px]">
          <a
            className="flex items-center gap-1.5 text-cream-4 transition-colors hover:text-gold"
            href="https://github.com/dimples-wiki/agent-skills"
            target="_blank"
            rel="noreferrer"
          >
            <GithubMark size={12} /> GitHub
          </a>
          <a
            className="flex items-center gap-1.5 text-cream-4 transition-colors hover:text-gold"
            href="https://www.skills.sh/dimples-wiki/agent-skills/aha"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/skill-mark.webp" alt="" width={11} height={11} className="rounded-[2px]" /> skill
          </a>
          <a
            className="flex items-center gap-1.5 text-cream-4 transition-colors hover:text-gold"
            href="https://www.npmjs.com/package/@dimples/aha"
            target="_blank"
            rel="noreferrer"
          >
            <Package size={12} /> npm
          </a>
          <a className="flex items-center gap-1.5 text-cream-4 transition-colors hover:text-gold" href="#top">
            <ArrowUp size={12} /> 回到顶部
          </a>
        </div>
      </div>
  </footer>
  );
}
