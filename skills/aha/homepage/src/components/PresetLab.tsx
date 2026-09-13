import { useState } from "react";
import { Reveal, SectionHead } from "./Reveal";

/* —— 与 skills/aha/assets/design-tokens.css v1.3.1 同步的六象限 —— */
type Preset = "warm" | "pop" | "ink";
type Theme = "dark" | "light";

interface Tokens {
  bg: string;
  surface: string;
  panel: string;
  line: string;
  line2: string;
  t1: string;
  t2: string;
  t3: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  warn: string;
}

const T: Record<Preset, Record<Theme, Tokens>> = {
  warm: {
    dark: {
      bg: "#161210", surface: "#1f1915", panel: "#27201a", line: "#423629", line2: "#5c4b39",
      t1: "#f7f1e7", t2: "#d9cdba", t3: "#a99b82", accent: "#ffab2e", accentInk: "#241a09",
      accentSoft: "rgba(255,171,46,.14)", warn: "#ff8577",
    },
    light: {
      bg: "#fbf6ec", surface: "#ffffff", panel: "#f5eddd", line: "#ded1b6", line2: "#c8b48f",
      t1: "#271f12", t2: "#5f5540", t3: "#72654b", accent: "#8f4e00", accentInk: "#fffaf0",
      accentSoft: "rgba(143,78,0,.11)", warn: "#c33423",
    },
  },
  pop: {
    dark: {
      bg: "#191324", surface: "#221b30", panel: "#2b2140", line: "#473868", line2: "#604b8a",
      t1: "#f7efff", t2: "#dccdf2", t3: "#ab99cd", accent: "#ff5d8f", accentInk: "#30060f",
      accentSoft: "rgba(255,93,143,.15)", warn: "#ff8a5c",
    },
    light: {
      bg: "#fdf8ff", surface: "#ffffff", panel: "#f7edfe", line: "#e5d5f3", line2: "#cbadf0",
      t1: "#291838", t2: "#614b78", t3: "#76638e", accent: "#b81b5e", accentInk: "#fff5fa",
      accentSoft: "rgba(184,27,94,.10)", warn: "#bf3606",
    },
  },
  ink: {
    dark: {
      bg: "#0e131a", surface: "#161c26", panel: "#1c2430", line: "#333e4f", line2: "#4a5768",
      t1: "#eff3f8", t2: "#c9d2de", t3: "#97a3b4", accent: "#5ea8ff", accentInk: "#08172b",
      accentSoft: "rgba(94,168,255,.13)", warn: "#ff7a6e",
    },
    light: {
      bg: "#f6f9fc", surface: "#ffffff", panel: "#ecf1f7", line: "#d3dde8", line2: "#b4c3d3",
      t1: "#17222e", t2: "#4a5a6b", t3: "#5c6e82", accent: "#1a5fc0", accentInk: "#f4f9ff",
      accentSoft: "rgba(26,95,192,.10)", warn: "#c63526",
    },
  },
};

const PRESETS: { id: Preset; label: string; sub: string }[] = [
  { id: "warm", label: "暖", sub: "暖编辑部 · 默认" },
  { id: "pop", label: "跳", sub: "活泼糖果" },
  { id: "ink", label: "静", sub: "冷静专业" },
];

/** 迷你图解页:真实复刻 aha 组件结构(徽章/类比框/记) */
function MiniPage({ preset, theme }: { preset: Preset; theme: Theme }) {
  const t = T[preset][theme];
  return (
    <div
      className="flex h-full flex-col rounded-2xl border p-6 transition-colors duration-500"
      style={{ background: t.bg, borderColor: t.line }}
    >
      <span
        className="w-fit rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider"
        style={{ color: t.accent, background: t.accentSoft, borderColor: t.line2 }}
      >
        起点 L1 · 从零开始讲
      </span>
      <h4
        className="mt-3 text-xl leading-snug font-bold transition-colors duration-500"
        style={{ color: t.t1 }}
      >
        傅里叶变换
      </h4>
      <p className="mt-1.5 text-xs leading-relaxed transition-colors duration-500" style={{ color: t.t2 }}>
        把任意信号拆成纯波的叠加 —— 换一双频域的眼睛看世界。
      </p>
      <div
        className="mt-4 rounded-xl border border-dashed p-3.5 transition-colors duration-500"
        style={{ borderColor: t.line2 }}
      >
        <p className="text-[11px] leading-relaxed" style={{ color: t.t2 }}>
          类比:转动的风扇 —— 快慢不同,你看到的"形状"就不同。
        </p>
        <p
          className="mt-2.5 border-t pt-2 text-[10px] leading-relaxed"
          style={{ borderTopColor: t.line2, color: t.warn }}
        >
          类比到此为止 —— 它没有说出"拆开"到底拆的是什么。
        </p>
      </div>
      <div
        className="mt-auto flex items-start gap-2 rounded-xl border p-3.5 pt-3 transition-colors duration-500"
        style={{ background: t.panel, borderColor: t.line2 }}
      >
        <span
          className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold"
          style={{ background: t.accent, color: t.accentInk }}
        >
          记
        </span>
        <p className="text-[11px] leading-relaxed" style={{ color: t.t1 }}>
          任何信号 = 无数正弦波的
          <span
            className="rounded px-1 py-px font-bold"
            style={{ background: t.accentSoft, color: t.accent }}
          >
            和声
          </span>
          。
        </p>
      </div>
      {/* 自测 + 数字账本(第 7 层的收尾结构) */}
      <div className="mt-2.5 flex gap-2">
        <span
          className="flex-1 truncate rounded-lg border px-2 py-1.5 font-mono text-[9px]"
          style={{ borderColor: t.line2, color: t.t2 }}
        >
          自测 ×2 · 答案折叠
        </span>
        <span
          className="flex-1 truncate rounded-lg border px-2 py-1.5 font-mono text-[9px]"
          style={{ borderColor: t.line2, color: t.t2 }}
        >
          账本 · 数字有来源
        </span>
      </div>
    </div>
  );
}

export function PresetLab() {
  const [preset, setPreset] = useState<Preset>("warm");
  const [theme, setTheme] = useState<Theme>("dark");

  return (
    <section id="presets" className="scroll-mt-24 border-t border-line/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <Reveal>
              <MiniPage preset={preset} theme={theme} />
            </Reveal>
          </div>

          <div className="order-1 lg:order-2">
            <SectionHead
              n="05"
              eyebrow="皮肤实验室 · design tokens"
              title={
                <>
                  一套 tokens,
                  <br />
                  六种<span className="text-gold">气质</span>。
                </>
              }
              lead="3 套预设 × 明暗双主题,只翻 <html> 两个属性就完成换肤 —— 组件代码零改动。颜色永远出自 design tokens,页面里不允许存在哪怕一个硬编码色值。"
            />

            <Reveal delay={0.2}>
              <div className="mt-9 space-y-5">
                <div>
                  <p className="mb-2.5 font-mono text-[11px] font-bold tracking-widest text-cream-4 uppercase">
                    data-preset
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPreset(p.id)}
                        className={`rounded-xl border px-4 py-2.5 text-left transition-all ${
                          preset === p.id
                            ? "border-gold/60 bg-gold/10"
                            : "border-line bg-ink-850 hover:border-line-2"
                        }`}
                      >
                        <span
                          className={`block text-base font-bold ${
                            preset === p.id ? "text-gold" : "text-cream-1"
                          }`}
                        >
                          {p.label}
                        </span>
                        <span className="block text-[10px] text-cream-4">{p.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2.5 font-mono text-[11px] font-bold tracking-widest text-cream-4 uppercase">
                    data-theme
                  </p>
                  <div className="inline-flex rounded-xl border border-line bg-ink-850 p-1">
                    {(["dark", "light"] as const).map((th) => (
                      <button
                        key={th}
                        onClick={() => setTheme(th)}
                        className={`rounded-lg px-5 py-2 font-mono text-xs font-bold transition-all ${
                          theme === th
                            ? "bg-gold text-gold-ink"
                            : "text-cream-3 hover:text-cream-1"
                        }`}
                      >
                        {th === "dark" ? "◐ dark" : "◑ light"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="border-l-2 border-gold/50 pl-4 text-sm leading-relaxed text-cream-3">
                  上面的迷你页是真实 token 值驱动的 —— 试着切一切,
                  感受同一篇图解在六种气质间的呼吸。
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
