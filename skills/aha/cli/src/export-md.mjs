/** aha 图解页 → Markdown / 主图解 SVG 提取(零依赖,服务端纯文本处理) */

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "——",
  "&hellip;": "…",
  "&middot;": "·",
};

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function inline(s) {
  return decode(
    s
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      // 空行内标签(图例色块 <i class=..></i> 等):无内容的强调/斜体标记是装饰,
      // 转换会残留 **/* 残骸 —— 直接删除
      .replace(/<(strong|b|em|i)\b[^>]*>\s*<\/\1>/gi, "")
      // 上/下标:1.08<sup>30</sup> → 1.08^30(裸读不再像 1.0830)
      .replace(/<sup\b[^>]*>([^<]*)<\/sup>/gi, "^$1")
      .replace(/<sub\b[^>]*>([^<]*)<\/sub>/gi, "_$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${t.trim()}**`)
      .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${t.trim()}*`)
      .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => "`" + t + "`")
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
        const text = t.replace(/<[^>]+>/g, "").trim();
        return text ? `[${text}](${href})` : "";
      })
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** 组件预处理:把 aha 组件结构翻成导出器认识的标准 HTML(平衡 div 提取,不被嵌套截断) */
const stripTags = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** 从 openTagIdx(某个 <div ...> 的起点)提取平衡的 div 内容与结束位置 */
function extractBalancedDiv(s, openTagEnd) {
  const re = /<div\b[^>]*>|<\/div>/gi;
  re.lastIndex = openTagEnd;
  let depth = 1, m;
  while ((m = re.exec(s))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return [s.slice(openTagEnd, m.index), m.index + 6];
  }
  return null;
}

/** 扫描 body,对每个匹配开标签的组件做结构翻译 */
function mapComponents(s, openRe, translate) {
  let out = "", last = 0, m;
  const re = new RegExp(openRe.source, "gi");
  while ((m = re.exec(s))) {
    const bal = extractBalancedDiv(s, m.index + m[0].length);
    if (!bal) continue;
    const [inner, end] = bal;
    const replacement = translate(inner, m);
    out += s.slice(last, m.index) + replacement;
    last = end;
    re.lastIndex = end;
  }
  return out + s.slice(last);
}

function preprocess(body) {
  let s = body;

  // 1) 模拟器整块 → 单行说明(节点/按钮/进度是交互件,打平全是噪音)
  s = mapComponents(s, /<div\b[^>]*\bdata-sim\b[^>]*>/i, () =>
    "<p>\u{1F52C} \u4EA4\u4E92\u6A21\u62DF\u5668\uFF1A\u89C1\u539F\u9875\u9762</p>");

  // 2) 管线(.pipe)→ 紧凑单行「A(副标) → B(副标)」
  s = mapComponents(s, /<div\b[^>]*class="[^"]*\bpipe\b[^"]*"[^>]*>/i, (inner) => {
    const cards = [...inner.matchAll(/<div\b[^>]*class="[^"]*\bp\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
      .map((c) => {
        const b = stripTags(c[1].match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? "");
        const span = stripTags(c[1].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
        return span ? `${b}\uFF08${span}\uFF09` : b;
      })
      .filter(Boolean);
    return cards.length ? `<p>${cards.join(" \u2192 ")}</p>` : "";
  });

  // 3) div 表(.panel 内 .row + span 网格)→ 真 <table>;非表格 panel 原样保留
  s = mapComponents(s, /<div\b[^>]*class="[^"]*\bpanel\b[^"]*"[^>]*>/i, (inner, m) => {
    const rows = [...inner.matchAll(/<div\b[^>]*class="[^"]*\brow\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
      .map((r) => [...r[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((c) => stripTags(c[1])));
    if (rows.length >= 2 && rows.every((r) => r.length >= 2)) {
      const tr = (cells) => `<tr>${cells.map((c) => `<td>${c || " "}</td>`).join("")}</tr>`;
      return `<table>${rows.map(tr).join("")}</table>`;
    }
    return m[0] + inner + "</div>";
  });

  // 4) eyebrow → 并入紧随 h2(「## 01 · 直觉 — 耳朵早就会这件事」);品牌眉丢弃
  s = s.replace(
    /<p\b[^>]*class="[^"]*\beyebrow\b[^"]*"([^>]*)>([^<]*)<\/p>\s*<h2([^>]*)>\s*/gi,
    (_, attrs, label, h2attrs) => {
      const n = attrs.match(/data-n="([^"]*)"/)?.[1] ?? "";
      const text = stripTags(label);
      if (!n || !text || /^aha\s/.test(text)) return `<h2${h2attrs}>`;
      return `<h2${h2attrs} data-eb="${n} \u00B7 ${text} \u2014 ">`;
    });
  // 5) 对比卡 .out 补「输出:」(CSS ::before 导出不可见)
  s = s.replace(/(<(div|p)\b[^>]*class="[^"]*\bout\b[^"]*"[^>]*>)([^<]{0,6})/gi,
    (m0, open, _tag, head) =>
      /^\s*\u8F93\u51FA/.test(head) ? m0 : `${open}<em>\u8F93\u51FA\uFF1A</em>${head}`);
  // 5.5) 失败模式标签组(.fails 内 span.fail)→ 单行加粗并列
  s = mapComponents(s, /<div\b[^>]*class="[^"]*\bfails\b[^"]*"[^>]*>/i, (inner) => {
    // 卡片版:.fail div 内含 .tag 标签 + 整段描述 → 完整列表(标签+描述都导出)
    const cards = [...inner.matchAll(/<div\b[^>]*class="[^"]*\bfail\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)]
      .map((c) => ({
        tag: stripTags(c[1].match(/class="[^"]*\btag\b[^"]*"[^>]*>([^<]*)</i)?.[1] ?? ""),
        desc: stripTags(c[1].replace(/<span[^>]*>[\s\S]*?<\/span>/i, "")),
      }))
      .filter((c) => c.tag || c.desc);
    if (cards.length) {
      const items = cards.map((c) => (c.tag && c.desc ? `- **${c.tag}** \u2014 ${c.desc}` : c.tag || c.desc));
      return items.every((x) => x.startsWith("-"))
        ? `<ul>${items.map((x) => `<li>${x.slice(2)}</li>`).join("")}</ul>`
        : `<p>${items.join(" \u00B7 ")}</p>`;
    }
    // span 单字版:标签并列
    const tags = [...inner.matchAll(/<span\b[^>]*class="[^"]*\bfail\b[^"]*"[^>]*>([^<]*)<\/span>/gi)].map((m0) => stripTags(m0[1])).filter(Boolean);
    return tags.length ? `<p><strong>\u5931\u8d25\u6a21\u5f0f\u6807\u7b7e\uFF1A</strong>${tags.join(" \u00B7 ")}</p>` : "";
  });

  // 6) 账本条目 <b>标题</b>正文 → 加破折号分隔
  s = s.replace(/<li\b([^>]*)>\s*<b>([^<]*)<\/b>\s*/gi, (m0, attrs, b) =>
    `<li${attrs}><b>${b}</b> \u2014 `);

  // 品牌 eyebrow(无 data-n)是页面 chrome,不进导出
  s = s.replace(/<p\b[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>([^<]*)<\/p>/gi, (m0, text) =>
    /^aha\s|\u6982\u5ff5\u56fe\u89e3/.test(text.trim()) ? "" : m0);

return s;
}

/** 结构化遍历块级标签,输出 Markdown */
export function extractMarkdown(html) {
  // 去掉头尾,只走 body
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;

  // —— 组件预处理:把 aha 页的组件结构翻成导出器认识的标准 HTML ——
  const prepped = preprocess(body);

  // 模拟器 UI 提示句(在 .sim 容器外,随容器替换不掉):删除
  // UI 噪音:注释、工具条/分享弹层、按钮、模拟器进度等交互件;
  // 模拟器 UI 提示句在 .sim 容器外,随容器替换不掉,在此一并删除
  const cleaned = prepped
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<p[^>]*>[^<]*\u8fdb\u5165\u89c6\u91ce[^<]*\u81ea\u52a8\u64ad\u653e[^<]*<\/p>/gi, "")
    .replace(/<(style|script|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|aside|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<div class="toolbar"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div class="share-pop"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, "")
    .replace(/<div class="share-pop"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<span class="sim-progress"[^>]*>[^<]*<\/span>/gi, "")
    // 新版第 7 层自测块:hidden 的答案区会摊平导出,先给一处「参考答案」标头分隔
    .replace(/(<div\b[^>]*data-quiz-answers[^>]*>)/i, '$1<p><strong>参考答案</strong></p>');

  const out = [];
  let listStack = [];
  let listCounters = []; // 每层列表的有序编号 —— 只在当前列表内累计,跨列表重置

  // 按开/闭块级标签切 token,再把块级边界之间的行内碎片合并回整段 ——
  // 源 HTML 的缩进换行会把「例：<code>M</code> → <code>TQ==</code>」切成 5 个 token,
  // 逐 token 出段会碎成一串单行;合并后由 inline() 统一处理行内标记
  const rawTokens = cleaned.match(/<\/?[a-z][^>]*>|[^<]+/gi) ?? [];
  const BLOCK_TAG = new Set([
    "p", "div", "section", "article", "header", "footer", "nav", "aside", "main",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tr", "td", "th", "caption",
    "details", "summary", "figure", "figcaption", "blockquote", "hr", "pre",
  ]);
  const tokens = [];
  {
    let buf = "";
    for (const t of rawTokens) {
      const m = t.match(/^<\/?([a-z0-9]+)/i);
      if (m && BLOCK_TAG.has(m[1].toLowerCase())) {
        if (buf.trim()) tokens.push(buf);
        else if (buf) tokens.push(buf); // 保留纯空白 run,维持段落间隔语义
        buf = "";
        tokens.push(t);
      } else {
        buf += t;
      }
    }
    if (buf) tokens.push(buf);
  }
  const closeList = () => {
    if (listStack.length) {
      listStack = [];
      out.push("");
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const m = t.match(/^<(\/?)([a-z0-9]+)/i);
    // 合并 run 可能以行内标签开头(<b>…)——凡非块级标签一律按文本 run 处理
    if (!m || !BLOCK_TAG.has(m[2].toLowerCase())) {
      const text = inline(t);
      if (text) out.push(text, "");
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (tag === "ul" || tag === "ol") {
      if (closing) {
        listStack.pop();
        listCounters.pop();
        if (!listStack.length) out.push("");
      } else {
        listStack.push(tag);
        listCounters.push(0);
      }
      continue;
    }
    if (tag === "li") {
      if (closing) continue;
      // 收集到 </li> 的内联内容
      let buf = "";
      let depth = 1;
      let j = i + 1;
      while (j < tokens.length && depth > 0) {
        const tj = tokens[j];
        const mj = tj.match(/^<(\/?)([a-z0-9]+)/i);
        if (mj && mj[2].toLowerCase() === "li") depth += mj[1] === "/" ? -1 : 1;
        if (depth > 0) buf += tj;
        j++;
      }
      i = j - 1;
      const indent = "  ".repeat(Math.max(0, listStack.length - 1));
      const ordered = listStack[listStack.length - 1] === "ol";
      const n = ++listCounters[listCounters.length - 1];
      const text = inline(buf).replace(/\n+/g, " ");
      out.push(`${indent}${ordered ? `${n}. ` : "- "}${text}`);
      continue;
    }
    if (closing) continue;
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4": {
        closeList();
        // h1 是页内主标题(比 <title>「X · aha 图解」干净),降为文档标题 #
        const lvl = "#".repeat(tag === "h1" ? 1 : Number(tag[1]));
        const text = collectInline(tokens, i);
        const ebPrefix = t.match(/data-eb="([^"]*)"/)?.[1] ?? "";
        i = skipToClose(tokens, i, tag);
        if (text) out.push(`${lvl} ${ebPrefix}${text}`, "");
        break;
      }
      case "p": {
        closeList();
        const text = collectInline(tokens, i);
        i = skipToClose(tokens, i, "p");
        if (text) out.push(text, "");
        break;
      }
      case "blockquote": {
        closeList();
        const raw = collectRaw(tokens, i, "blockquote");
        i = skipToClose(tokens, i, "blockquote");
        const text = inline(raw);
        if (text) out.push(...text.split("\n").map((l) => `> ${l}`), "");
        break;
      }
      case "details": {
        closeList();
        const isLedger = /data-ledger/i.test(t); // 开标签上(数字账本:保留来源类型)
        const raw = collectRaw(tokens, i, "details");
        i = skipToClose(tokens, i, "details");
        const sum = inline(raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "");
        if (isLedger) {
          if (sum) out.push(`**${sum}**`, "");
          for (const li of raw.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
            const kind = li[0].match(/data-kind="([^"]*)"/i)?.[1] ?? "";
            const text = inline(li[1]);
            if (text) out.push(`- ${text}${kind ? `（${kind}）` : ""}`);
          }
          out.push("");
          break;
        }
        if (sum) out.push(`**${sum}**`, "");
        const rest = inline(raw.replace(/<summary[^>]*>[\s\S]*?<\/summary>/i, ""));
        if (rest) out.push(rest, "");
        break;
      }
      case "figure": {
        closeList();
        const raw = collectRaw(tokens, i, "figure");
        i = skipToClose(tokens, i, "figure");
        const cap = inline(raw.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? "");
        if (cap) out.push(`> 图:${cap}`, "");
        break;
      }
      case "svg": {
        closeList();
        const label = decode(t.match(/aria-label="([^"]*)"/i)?.[1] ?? "");
        if (label) out.push(`> 图解:${label}`, "");
        i = skipToClose(tokens, i, "svg", true);
        break;
      }
      case "hr":
        out.push("---", "");
        break;
      case "table": {
        closeList();
        const raw = collectRaw(tokens, i, "table");
        i = skipToClose(tokens, i, "table");
        const rows = [...raw.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
          [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
            inline(c[1]).replace(/\|/g, "\\|")
          )
        );
        if (rows.length) {
          rows.forEach((cells, idx) => {
            out.push(`| ${cells.join(" | ")} |`);
            if (idx === 0) out.push(`|${cells.map(() => " --- ").join("|")}|`);
          });
          out.push("");
        }
        break;
      }
      default:
        break;
    }
  }

  // 视觉网格残留聚拢:位切分图/流程步/坐标轴/字符块打平后 = 连续短行
  // (可能被单个空行隔断、以箭头行相连)。按形态识别而非 class 枚举:
  // 跨空行收集「≤30 字、无句末标点、非结构行」与箭头行,≥2 项即合并一行
  // (箭头转为连接符:「A ⇄ B」)。
  {
    const lines = out.join("\n").split("\n");
    const isStruct = (l) => { const t = l.trim(); return !t || /^[#>|*\-`]|---|^\||^\d+[.)\uFF09]/.test(t); };
    const isArrow = (l) => /^[\u2192\u279c\u2794\u21d2\u27a4\u27f6\u21c4]+$/.test(l.trim());
    // 含全角冒号的行是说明/标签(「副本 B:…」),不是网格单元,不参与聚拢也不可被吞
    const isShort = (l) => { const t = l.trim(); return !isStruct(l) && !isArrow(l) && t.length <= 30 && !/[\u3002\uff1b\uff1f\uff01\uff1a:]/.test(t); };
    const cell = (l) => isShort(l) || isArrow(l);
    const merged = [];
    let i2 = 0;
    while (i2 < lines.length) {
      if (cell(lines[i2])) {
        const items = [lines[i2].trim()];
        let j2 = i2 + 1;
        while (j2 < lines.length) {
          if (cell(lines[j2])) { items.push(lines[j2].trim()); j2++; continue; }
          // 跨单个空行续簇(双空行 = 真段落边界,停)
          if (lines[j2].trim() === "" && lines[j2 + 1] !== undefined && cell(lines[j2 + 1]) && lines[j2 - 1].trim() !== "") { j2++; continue; }
          break;
        }
        if (items.length >= 2) {
          let joined = items.join(" \u00B7 ")
            .replace(/ \u00B7 ([\u2192\u279c\u2794\u21d2\u27a4\u27f6\u21c4]) \u00B7 /g, " $1 ")
            .replace(/\s*\u00B7\s*\u2014\u2014/g, " \u2014\u2014")  // 「· ——」中缀图例残迹 → 破折号直连
            .replace(/ \u00B7 \u2014\u2014?\s*$/g, "")                 // 句尾悬挂「· ——」
            .replace(/\s+\u2014\u2014\s*$/g, "")                      // 句尾悬挂破折号
            .replace(/[\uff0c,]\s*\u00B7\s*/g, "\uff0c ")             // 「, · 」/「， · 」标点粘连
            .replace(/\s*\u00B7\s*([\uff0c,])/g, "$1");                // 「· ，」前置分隔
          merged.push(joined);
          i2 = j2;
          continue;
        }
      }
      merged.push(lines[i2]);
      i2++;
    }
    const text = merged.join("\n").replace(/\n{3,}/g, "\n\n");
    out.length = 0;
    out.push(...text.split("\n"));
  }
  // 孤箭头行(仅由箭头字符组成)删除
  const arrowOnly = /^\s*(?:→|➜|➔|⇒|➤|⟶)\s*$/;
  while (out.length && arrowOnly.test(out[out.length - 1])) out.pop();
  for (let i = out.length - 1; i >= 0; i--) {
    if (arrowOnly.test(out[i]) && (out[i - 1] === undefined || out[i - 1] === "")) { out.splice(i, 2); }
  }
  out.push("---", "", `> 由 aha 导出 · 交互模拟器与完整排版请查看原页面。`);
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

function collectInline(tokens, startIdx) {
  return inline(collectRaw(tokens, startIdx));
}

function collectRaw(tokens, startIdx, stopTag) {
  const first = tokens[startIdx].match(/^<([a-z0-9]+)/i);
  const tag = stopTag || first?.[1] || "p";
  let depth = 1;
  let buf = "";
  for (let j = startIdx + 1; j < tokens.length; j++) {
    const mj = tokens[j].match(/^<(\/?)([a-z0-9]+)/i);
    if (mj && mj[2].toLowerCase() === tag) {
      depth += mj[1] === "/" ? -1 : 1;
      if (depth === 0) break;
    }
    buf += tokens[j];
  }
  return buf;
}

function skipToClose(tokens, startIdx, tag, selfOnly = false) {
  let depth = 1;
  for (let j = startIdx + 1; j < tokens.length; j++) {
    const mj = tokens[j].match(/^<(\/?)([a-z0-9]+)/i);
    if (mj && mj[2].toLowerCase() === tag) {
      depth += mj[1] === "/" ? -1 : 1;
      if (depth === 0) return j;
    }
  }
  return selfOnly ? tokens.length - 1 : startIdx;
}

