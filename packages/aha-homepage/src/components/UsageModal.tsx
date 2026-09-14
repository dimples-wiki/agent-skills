import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";

export const INSTALL_CMD = "npx skills add dimples-wiki/agent-skills -s aha -y";
export const EXAMPLE_WORD = "贝叶斯定理";

/** 菜单入口打开时的轮换词(点击词打开则定格) */
const CYCLE_WORDS = [
  "贝叶斯定理",
  "梯度下降",
  "RAG",
  "注意力机制",
  "TLS 握手",
  "拜占庭将军",
  "量子纠缠",
  "复利",
];

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* 剪贴板被浏览器策略挡住时静默失败,按钮仍给出反馈 */
    }
    ta.remove();
  }
}

export function CopyButton({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="复制命令"
      title="复制命令"
      onClick={() => {
        // 彩蛋先行:让顿悟球 O 一下,不等待剪贴板
        window.dispatchEvent(new Event("aha:react"));
        setDone(true);
        setTimeout(() => setDone(false), 1400);
        void copyText(text);
      }}
      className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-md border font-mono text-[10px] transition-colors ${
        compact ? "px-1.5 py-1" : "px-2 py-1"
      } ${
        done
          ? "border-gold/60 text-gold"
          : "border-line text-cream-3 hover:border-gold/50 hover:text-gold"
      }`}
    >
      {done ? <Check size={11} /> : <Copy size={11} />}
      {!compact && (done ? "已复制" : "复制")}
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/40 font-mono text-[11px] font-bold text-gold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-cream-1">{title}</p>
        {children}
      </div>
    </li>
  );
}

function CmdLine({ text, swapKey, dir = 1 }: { text: string; swapKey?: string; dir?: number }) {
  const codeCls =
    "min-w-0 flex-1 break-words font-mono text-[10.5px] leading-relaxed text-cream-2 sm:break-normal sm:whitespace-nowrap sm:text-xs";
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-ink-950 py-2 pl-3 pr-2">
      <span aria-hidden className="shrink-0 font-mono text-xs text-gold">
        $
      </span>
      {swapKey === undefined ? (
        <code className={codeCls}>{text}</code>
      ) : (
        <AnimatePresence initial={false} mode="wait">
          <motion.code
            key={swapKey}
            initial={{ opacity: 0, x: 16 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 * dir }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={codeCls}
          >
            {text}
          </motion.code>
        </AnimatePresence>
      )}
      <CopyButton text={text} />
    </div>
  );
}

/** 概念卡(card-stack):三层景深 + hover 洗牌散开 + 顶层揭牌,点击换卡 */
export function UsageModal({
  usage,
  onClose,
}: {
  usage: { word: string; source: "fall" | "marquee" | "menu" } | null;
  onClose: () => void;
}) {
  // 广播开/关:移动端卡片舞台监听后暂停/恢复自动轮播(布尔依赖,只随开关变化触发)
  const open = usage !== null;
  useEffect(() => {
    window.dispatchEvent(new Event(open ? "aha:usage-open" : "aha:usage-close"));
  }, [open]);

  useEffect(() => {
    if (usage === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [usage, onClose]);

  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [pinned, setPinned] = useState(false);
  const cycling = usage?.source === "menu";

  // 点击词打开 = 定格该词(不自动转);点击卡片 = 手动转一格
  useEffect(() => {
    setPinned(!cycling);
    setPos(!cycling ? 2 : 0);
  }, [usage, cycling]);

  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      setDir(1);
      setPos((p) => p + 1);
    }, 3200);
    return () => clearInterval(id);
  }, [cycling]);

  // 转盘牌组:点开的词插到 2 号位(中心)
  const pinnedWord = usage?.word ?? EXAMPLE_WORD;
  const rest = CYCLE_WORDS.filter((w) => w !== pinnedWord);
  const deck = pinned
    ? [rest[4], rest[5], pinnedWord, ...rest.slice(0, 4)]
    : CYCLE_WORDS;
  const L = deck.length;
  const at = (k: number) => deck[((k % L) + L) % L];
  const center = pos;
  const word = at(center);

  const next = () => {
    setDir(1);
    setPos((p) => p + 1);
  };
  const prev = () => {
    setDir(-1);
    setPos((p) => p - 1);
  };

  return (
    <AnimatePresence>
      {usage !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="aha 使用步骤"
            className="relative w-full max-w-xl rounded-2xl border border-line-2 bg-ink-900 shadow-2xl"
          >
            <div className="max-h-[90svh] overflow-x-hidden overflow-y-auto rounded-2xl p-6 md:p-8">
            <div className="pr-8">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={prev}
                  aria-label="上一个概念"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream-4/70 opacity-60 transition-all hover:bg-ink-850 hover:text-gold hover:opacity-100 active:scale-90 sm:size-7"
                >
                  <ChevronLeft size={15} />
                </button>
                <h3 className="min-w-0 text-center text-[clamp(1.5rem,4vw,1.9rem)] leading-tight font-extrabold tracking-tight text-cream-1">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.span
                      key={word}
                      initial={{ opacity: 0, x: 26 * dir }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -26 * dir }}
                      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                      className="inline-block"
                    >
                      {word}<span className="text-gold">?</span>
                    </motion.span>
                  </AnimatePresence>
                </h3>
                <button
                  type="button"
                  onClick={next}
                  aria-label="下一个概念"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream-4/70 opacity-60 transition-all hover:bg-ink-850 hover:text-gold hover:opacity-100 active:scale-90 sm:size-7"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <p className="mt-1.5 text-center text-sm text-cream-3">三个步骤,了解它</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="absolute top-3 right-3 z-20 cursor-pointer rounded-lg p-3 text-cream-3 transition-colors hover:bg-ink-850 hover:text-cream-1"
            >
              <X size={16} />
            </button>

            <div className="mt-6">
              <ol className="space-y-4.5">
                <Step n={1} title="安装 skill">
                  <p className="mt-0.5 text-xs leading-relaxed text-cream-3">
                    在终端中输入如下命令 —— 默认 agent、软链映射,不弹任何确认,回车即装。
                  </p>
                  <CmdLine text={INSTALL_CMD} />
                </Step>
                <Step n={2} title="在任意 agent 里输入">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.p
                      key={word}
                      initial={{ opacity: 0, x: 20 * dir }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 * dir }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1], delay: 0.03 }}
                      className="mt-0.5 text-xs leading-relaxed text-cream-3"
                    >
                      {usage.source === "fall"
                        ? `就是刚才飘过去的那个「${word}」—— 命令里的名词,换成任意你想了解的都行。`
                        : usage.source === "marquee"
                          ? `就是轮播里的「${word}」—— 命令里的名词,换成任意你想了解的都行。`
                          : `「${word}」只是个示例 —— 换成任意你想了解的名词都行。`}
                    </motion.p>
                  </AnimatePresence>
                  <CmdLine text={`/aha ${word}`} swapKey={word} dir={dir} />
                </Step>
                <Step n={3} title="等待输出">
                  <p className="mt-0.5 text-xs leading-relaxed text-cream-3">
                    agent 会生成渐进分层的图解页,自动在浏览器打开,并收进本地书架服务(HTTP · 端口 7332):
                    <code className="mx-1 rounded bg-ink-950 px-1.5 py-0.5 font-mono text-[11px] text-gold">
                      http://127.0.0.1:7332
                    </code>
                    ,整架图解随时回看。
                  </p>
                </Step>
              </ol>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
              <a
                href="#gallery"
                onClick={onClose}
                className="text-xs font-semibold text-gold transition-colors hover:text-gold-2"
              >
                看它生成的图解长什么样 →
              </a>
              <span className="hidden font-mono text-[10px] text-cream-4 sm:inline">Esc 关闭</span>
            </div>

            </div>


          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
