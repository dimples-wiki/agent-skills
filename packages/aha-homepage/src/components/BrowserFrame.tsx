import { useEffect, useState } from "react";
import { Lock, Maximize2, X } from "lucide-react";
import type { ReactNode } from "react";

interface BrowserFrameProps {
  url: string;
  src: string;
  alt: string;
  className?: string;
  /** 顶部工具列右侧的附加内容 */
  right?: ReactNode;
}

/** 浏览器样机框:红绿灯 + 地址栏 + 截图;点截图全屏查看(移动端看小字靠它) */
export function BrowserFrame({ url, src, alt, className = "", right }: BrowserFrameProps) {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom]);

  return (
    <figure
      className={`group relative overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-frame ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-line bg-ink-800 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-line/70 bg-ink-900/70 px-3 py-1">
          <Lock size={10} className="shrink-0 text-mint" />
          <span className="truncate font-mono text-[11px] text-cream-3">{url}</span>
        </div>
        {right}
      </div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label={`全屏查看:${alt}`}
        className="block w-full cursor-zoom-in"
      >
        <img src={src} alt={alt} loading="lazy" className="block w-full" />
        <span className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full border border-line/60 bg-ink-950/80 px-2.5 py-1 font-mono text-[10px] font-semibold text-cream-3 backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <Maximize2 size={10} /> 放大
        </span>
      </button>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`全屏查看:${alt}`}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-ink-950/95 p-4 backdrop-blur-sm"
        >
          {/* 双指捏合缩放走浏览器原生视觉缩放,这里只负责铺满与滚动 */}
          <div className="max-h-full max-w-full overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={alt} className="block w-full min-w-[540px] max-w-full" />
          </div>
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="关闭全屏查看"
            className="absolute top-4 right-4 cursor-pointer rounded-lg bg-ink-900/80 p-2.5 text-cream-2 transition-colors hover:text-gold"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </figure>
  );
}
