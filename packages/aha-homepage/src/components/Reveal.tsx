import { motion } from "motion/react";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}

/** 进视口一次的柔和上浮 */
export function Reveal({ children, delay = 0, className, y = 26 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** 区节眉:01 · 标题(mono 金色) */
export function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="mb-4 font-mono text-xs font-bold tracking-[0.22em] uppercase">
      <span className="text-cream-4">{n} · </span>
      <span className="text-gold">{children}</span>
    </p>
  );
}

interface SectionHeadProps {
  n: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
}

export function SectionHead({ n, eyebrow, title, lead, align = "left" }: SectionHeadProps) {
  return (
    <Reveal className={align === "center" ? "text-center" : ""}>
      <Eyebrow n={n}>{eyebrow}</Eyebrow>
      <h2 className="text-4xl leading-[1.15] font-bold tracking-tight text-balance md:text-5xl">
        {title}
      </h2>
      {lead && (
        <p
          className={`mt-5 max-w-2xl text-lg leading-relaxed text-cream-2 ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {lead}
        </p>
      )}
    </Reveal>
  );
}
