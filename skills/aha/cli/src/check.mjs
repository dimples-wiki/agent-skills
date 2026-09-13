#!/usr/bin/env node
// @dimples/aha · check —— 12 道静态质量门 + 回执
//
// 设计依据 docs/plans/2026-09-07-aha-design.md「质量与验证」：
// 质量来自机器可检的门，不来自提示词（archify 教训）。
// 本文件零运行时依赖；HTML 用正则扫描（自包含页面结构可控，无需 DOM 库）。

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { CANONICAL_TOKENS } from "./canonical-tokens.mjs";

const CANONICAL_VERSION = CANONICAL_TOKENS.match(/aha-design-tokens v(\d[\d.]*)/)?.[1];
const norm = (s) => s.replace(/\s+/g, "");

// 类词表 —— 与 skills/aha/assets/design-tokens.css 保持同步。
// 同步守卫：test/check.test.mjs 的 "registry sync" 用例会读取真实 CSS 比对，
// tokens 增删类而忘了更新这里，测试即红。
export const REGISTRY = {
  classes: [
    // 文本级（.t-*，注意：没有 .t-1，正文默认即 t-1）
    "t-2", "t-3", "t-4",
    // 语义色
    "c-accent", "c-warn", "c-ok", "c-info",
    "c-cat-a", "c-cat-b", "c-cat-c", "c-cat-n",
    // 步骤模拟器（播放器状态类 is-* 不在本表：由引擎自己加）
    "sim", "sim-stage", "sim-node", "sim-narration", "sim-controls", "sim-progress",
  ],
};

// 模拟器标签白名单（zh 页允许保留原文的专有技术标识符）。
// 治理：与 REGISTRY 同法 —— 导出 + test 守卫；新增页面引入新标识符（如 SYN-ACK）时在此追加。
export const SIM_LABEL_WHITELIST = [
  "ClientHello", "ServerHello",   // TLS 协议消息名
  "Q·Kᵀ", "Softmax", "Tokens",   // 注意力公式记号
  "Retrieve", "Augment", "Generate", // RAG 三阶段术语
];

// 受检前缀：这些前缀的类必须出自词表（美学锁定的范围）；
// 其余（布局类、is-* 状态类）自由 —— 方案 A：锁美学，放布局。
const VALIDATED_PREFIX = /^(c-|t-|sim)/;

const HEX = /#[0-9a-fA-F]{3,8}\b/g; // 覆盖 #RGB/#RGBA/#RRGGBB/#RRGGBBAA
const FUNC_COLOR = /\brgba?\(|\bhsla?\(/i;

// HTML 注释不参与任何门扫描（防 <!-- <h1> --> 干扰计数）
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

const styleBlocks = (html) =>
  [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
// 属性值三种形态都要收：双引号 / 单引号 / 无引号（评审 B1：单引号曾整体绕过）
const attrValues = (html, attr) => {
  const out = [];
  const re = new RegExp(`\\b${attr}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "gi");
  for (const m of html.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
};

/** @returns {{ id: string, status: 'pass'|'fail', detail?: string }[]} */
function runGates(rawHtml) {
  const gates = [];
  const html = stripComments(rawHtml);

  // 1. single-h1 —— 全文恰好一个 <h1>
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  gates.push({
    id: "single-h1",
    status: h1s === 1 ? "pass" : "fail",
    detail: h1s === 1 ? undefined : `找到 ${h1s} 个 <h1>，应恰好 1 个`,
  });

  // 2. heading-monotonic —— 标题层级只允许逐级下降后回升，不许跳档
  const levels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  const skip = [];
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skip.push(`h${levels[i - 1]}→h${levels[i]}`);
  }
  gates.push({
    id: "heading-monotonic",
    status: skip.length ? "fail" : "pass",
    detail: skip.length ? `标题跳档：${skip.join(", ")}` : undefined,
  });

  // 3. head-meta —— title 非空 + html[lang] + viewport
  const metaProblems = [];
  if (!/<title>\s*\S[\s\S]*?<\/title>/i.test(html)) metaProblems.push("缺非空 <title>");
  if (!/<html[^>]*\blang=/i.test(html)) metaProblems.push("缺 html[lang]");
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) metaProblems.push("缺 viewport meta");
  gates.push({
    id: "head-meta",
    status: metaProblems.length ? "fail" : "pass",
    detail: metaProblems.length ? metaProblems.join("；") : undefined,
  });

  // 4. img-alt —— 每个 <img> 必有 alt
  const imgsNoAlt = [...html.matchAll(/<img\b[^>]*>/gi)]
    .filter((m) => m[0]).filter((m) => !/\balt=/.test(m[0]));
  gates.push({
    id: "img-alt",
    status: imgsNoAlt.length ? "fail" : "pass",
    detail: imgsNoAlt.length ? `${imgsNoAlt.length} 个 <img> 缺 alt` : undefined,
  });

  // 5. tokens-present —— 原样内联的 design tokens：版本标记 + 真实结构 +
  //    当前版本下与 canonical 逐内容一致（防伪造/篡改调色板；旧版本快照放行）
  const blocks = styleBlocks(html);
  const TOKENS_RE = /aha-design-tokens v\d/;
  const looksLikeTokens = (b) => TOKENS_RE.test(b) && /:root/.test(b) && /--accent:/.test(b);
  const tokensBlockIdx = blocks.findIndex(looksLikeTokens);
  let tokensDetail;
  let tokensOk = tokensBlockIdx >= 0;
  if (tokensOk) {
    const block = blocks[tokensBlockIdx];
    const ver = block.match(/aha-design-tokens v(\d[\d.]*)/)?.[1];
    if (ver === CANONICAL_VERSION && !norm(block).includes(norm(CANONICAL_TOKENS))) {
      tokensOk = false;
      tokensDetail = `tokens 块版本为当前版 v${CANONICAL_VERSION} 但内容与 canonical 不一致 —— 禁止改写 tokens`;
    }
  }
  gates.push({
    id: "tokens-present",
    status: tokensOk ? "pass" : "fail",
    detail: tokensOk ? undefined : (tokensDetail ?? "未找到带版本号且含 :root/--accent 的内联 design-tokens"),
  });

  // 6. no-inline-colors —— 只有【第一个】tokens 块是颜色的合法住所；
  //    后续任何 style 块/属性再出现 marker 也不豁免（防藏色）。
  //    SVG paint 引用 url(#id) 不是颜色，先剔除防误判。
  const stripPaintRefs = (v) => v.replace(/url\(#[^)]*\)/gi, "");
  // 引号字符串（字体名等）不参与命名色检测：font-family:'Red Hat Text' 不是颜色
  const stripStrings = (v) => v.replace(/(['"])[^'"]*\1/g, "");
  // 连字符也作词边界：white-space/line-height 之类属性名不是颜色
  const NAMED_COLOR = /(?<![\w-])(?:red|blue|green|yellow|orange|purple|pink|brown|gray|grey|black|white|cyan|magenta|violet|gold|silver|crimson|salmon|coral|teal|indigo|ivory|beige|khaki|maroon|navy|olive|orchid|plum|tan|thistle)(?![\w-])/i;
  const colorHits = [];
  blocks.forEach((b, i) => {
    if (i === tokensBlockIdx) return;
    const clean = stripPaintRefs(b);
    const cleanNS = stripStrings(clean);
    const hex = clean.match(HEX);
    if (hex) colorHits.push(`<style> 内 hex: ${[...new Set(hex)].join(", ")}`);
    if (FUNC_COLOR.test(clean)) colorHits.push("<style> 内 rgb()/hsl()");
    if (NAMED_COLOR.test(cleanNS)) colorHits.push("<style> 内命名颜色");
  });
  for (const v of attrValues(html, "style")) {
    const clean = stripPaintRefs(v);
    const cleanNS = stripStrings(clean);
    const hex = clean.match(HEX);
    if (hex) colorHits.push(`style 属性内 hex: ${[...new Set(hex)].join(", ")}`);
    if (FUNC_COLOR.test(clean)) colorHits.push("style 属性内 rgb()/hsl()");
    if (NAMED_COLOR.test(cleanNS)) colorHits.push("style 属性内命名颜色");
  }
  // SVG 表现属性（fill/stroke/color/stop-color）也不许颜色字面量
  for (const attr of ["fill", "stroke", "stop-color", "color"]) {
    for (const v of attrValues(html, attr)) {
      const clean = stripPaintRefs(v);
    const cleanNS = stripStrings(clean);
      const hex = clean.match(HEX);
      if (hex) colorHits.push(`${attr} 属性内 hex: ${[...new Set(hex)].join(", ")}`);
      if (FUNC_COLOR.test(clean)) colorHits.push(`${attr} 属性内 rgb()/hsl()`);
      if (NAMED_COLOR.test(cleanNS)) colorHits.push(`${attr} 属性内命名颜色`);
    }
  }
  gates.push({
    id: "no-inline-colors",
    status: colorHits.length ? "fail" : "pass",
    detail: colorHits.length ? colorHits.join("；") : undefined,
  });

  // 7. classes-known —— c-*/t-*/sim* 类必须出自词表
  const used = new Set(
    attrValues(html, "class").flatMap((v) => v.split(/\s+/).filter(Boolean))
  );
  const unknown = [...used].filter((c) => VALIDATED_PREFIX.test(c) && !REGISTRY.classes.includes(c));
  gates.push({
    id: "classes-known",
    status: unknown.length ? "fail" : "pass",
    detail: unknown.length ? `词表外的类：${unknown.join(", ")}` : undefined,
  });

  // 8. script-syntax —— 内联脚本必须可解析；外链脚本直接违反单文件契约（评审 B3）。
  //    从原始 HTML 提取脚本（stripComments 会误伤 JS 字符串里的 <!-- -->）
  //    importmap 是 JSON 不是 JS，跳过；module 允许顶层 await（包进 async 再做语法烟测）
  const scriptProblems = [];
  for (const m of rawHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    if (/\bsrc=/.test(attrs)) {
      scriptProblems.push("外链 <script src> 违反单文件自包含契约");
      continue;
    }
    if (/type=["']importmap["']/i.test(attrs)) continue; // JSON，语法门不适用
    let code = body;
    let wrap = (c) => c;
    if (/type=["']module["']/i.test(attrs)) {
      // 模块语法烟测：剥掉 import 语句（单行/多行，[^;] 不跨语句）与 export 前缀
      code = code
        .replace(/^import[^;]*;/gm, "")
        .replace(/^export\s+default\s+/gm, "")
        .replace(/^export\s+/gm, "");
      wrap = (c) => "(async()=>{" + c + "})"; // 顶层 await 合法
    }
    try {
      new vm.Script(wrap(code));
    } catch (e) {
      scriptProblems.push(`${e.message.slice(0, 80)}`);
    }
  }
  gates.push({
    id: "script-syntax",
    status: scriptProblems.length ? "fail" : "pass",
    detail: scriptProblems.length ? scriptProblems.join("；") : undefined,
  });

  // 9. no-questioner-ref —— 页面会被分享给未提问的读者，正文不得出现仅对
  //    原提问者成立的指代（内容评审两轮的实际漂移模式，grep 可拦）
  const REF_RE = /你问的|你的第.问|你问题的|回到你的问题|你带着.{0,4}问题|先回答你的问题/;
  const refHit = REF_RE.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, "")); // 脚本内容不参与（防 JS 字符串误伤）
  gates.push({
    id: "no-questioner-ref",
    status: refHit ? "fail" : "pass",
    detail: refHit ? "正文含提问者指代（页面会被分享给未提问的读者），改为自足表述" : undefined,
  });

  // 10. fail-tag-consistency —— 失败模式记忆标签 1-2 字且同页一致
  const tags = [...html.matchAll(/(?<![\w-])class=(?:"tag"|'tag'|tag(?=[\s>]))>\s*([^<]{1,12})</g)].map((m) => m[1].trim());
  const badTags = tags.filter((t) => t.length > 2);
  const lens = new Set(tags.map((t) => t.length));
  const tagInconsistent = tags.length > 0 && (badTags.length > 0 || lens.size > 1);
  gates.push({
    id: "fail-tag-consistency",
    status: tagInconsistent ? "fail" : "pass",
    detail: tagInconsistent ? `失败标签违规：${JSON.stringify(tags)}（应 1-2 字且同页一致）` : undefined,
  });

  // 11. sim-label-lang —— 中文页模拟器节点标签必须中文，专有技术标识符白名单除外
  const WHITELIST = new Set(SIM_LABEL_WHITELIST);
  const isZh = /<html[^>]*lang="zh/i.test(html);
  const kLabels = [...html.matchAll(/<span (?<![\w-])class=(?:"k"|'k'|k(?=[\s>]))>([^<]+)<\/span>/g)].map((m) => m[1].trim());
  const badLabels = isZh
    ? kLabels.filter((k) => !WHITELIST.has(k) && !/[一-鿿]/.test(k))
    : [];
  gates.push({
    id: "sim-label-lang",
    status: badLabels.length ? "fail" : "pass",
    detail: badLabels.length ? `中文页的模拟器标签须中文（专有标识符除外）：${badLabels.join(", ")}` : undefined,
  });

  // 12. self-test —— 有「记」层（class 含 takeaway）的完整图解页必须带自测块：
  //     ≥2 个问题 + 答案容器默认 hidden（读者先答后看）。
  //     依据 references/theory.md 第 7 层：测试效应（主动回忆 > 重读）与
  //     流畅度错觉（排版越顺滑越需要一处让读者"卡一下"）。
  //     只在 class 属性里找 takeaway：tokens CSS 里的 .takeaway 选择器不算（组件演示页免检）。
  const classTokens = attrValues(html, "class").flatMap((v) => v.split(/\s+/));
  const hasTakeaway = classTokens.includes("takeaway");
  const quizProblems = [];
  if (hasTakeaway) {
    const quiz = html.match(/<(section|div)\b[^>]*\bdata-quiz\b[^>]*>([\s\S]*?)<\/\1>/i);
    if (!quiz) {
      quizProblems.push("缺自测块（[data-quiz]）：「记」之后须有 ≥2 个自测问题，答案默认折叠");
    } else {
      const body = quiz[2];
      const qCount = (body.match(/<li[\s>]/gi) ?? []).length;
      if (qCount < 2) quizProblems.push(`自测问题只有 ${qCount} 个，至少 2 个（一问类比失效点，一问反例预测）`);
      const ansTag = body.match(/<[a-z]+\b[^>]*\bdata-quiz-answers\b[^>]*>/i)?.[0];
      if (!ansTag) quizProblems.push("缺答案容器（[data-quiz-answers]）");
      else if (!/\shidden(?=[\s>]|=)/i.test(ansTag)) quizProblems.push("答案容器须默认 hidden —— 读者先答后看");
    }
  }
  gates.push({
    id: "self-test",
    status: quizProblems.length ? "fail" : "pass",
    detail: quizProblems.length ? quizProblems.join("；") : undefined,
  });

  return gates;
}

/**
 * @param {string} html
 * @returns {{ ok: boolean, passed: number, total: number,
 *             gates: { id: string, status: 'pass'|'fail', detail?: string }[] }}
 */
export function checkHtml(html) {
  const gates = runGates(html);
  const passed = gates.filter((g) => g.status === "pass").length;
  return { ok: passed === gates.length, passed, total: gates.length, gates };
}

/** CLI 入口：读文件 → 检查 → 打印回执 → 退出码 */
export function checkFile(file) {
  let html;
  try {
    html = readFileSync(file, "utf8");
  } catch {
    console.error(`aha check: 读不到文件 ${file}`);
    process.exit(2);
  }
  const res = checkHtml(html);
  console.log(`aha check · ${file}`);
  for (const g of res.gates) {
    const mark = g.status === "pass" ? "✔" : "✖";
    console.log(`  ${mark} ${g.id}${g.detail ? ` —— ${g.detail}` : ""}`);
  }
  console.log(`check: ${res.passed}/${res.total} 门通过`);
  console.log(`视觉验证: skipped (静态检查 only —— 浏览器验证由生成方完成)`);
  process.exit(res.ok ? 0 : 1);
}
