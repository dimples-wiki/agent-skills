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

/** 结构化遍历块级标签,输出 Markdown */
export function extractMarkdown(html) {
  const title =
    decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim()) || "aha 图解";

  // 去掉头尾,只走 body
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  // UI 噪音:注释、工具条/分享弹层、按钮、模拟器进度等交互件
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|aside|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<div class="toolbar"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div class="share-pop"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, "")
    .replace(/<div class="share-pop"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<span class="sim-progress"[^>]*>[^<]*<\/span>/gi, "")
    // 新版第 7 层自测块:hidden 的答案区会摊平导出,先给一处「参考答案」标头分隔
    .replace(/(<div\b[^>]*data-quiz-answers[^>]*>)/i, '$1<p><strong>参考答案</strong></p>');

  const out = [`# ${title}`, ""];
  let listStack = [];

  // 按开/闭块级标签切 token
  const tokens = cleaned.match(/<\/?[a-z][^>]*>|[^<]+/gi) ?? [];
  const closeList = () => {
    if (listStack.length) {
      listStack = [];
      out.push("");
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const m = t.match(/^<(\/?)([a-z0-9]+)/i);
    if (!m) {
      const text = inline(t);
      if (text) out.push(text, "");
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (tag === "ul" || tag === "ol") {
      if (closing) {
        listStack.pop();
        if (!listStack.length) out.push("");
      } else {
        listStack.push(tag);
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
      const n = (out.filter((l) => l && l.trimStart && /^\d+\./.test(l.trim())).length + 1) || 1;
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
        const lvl = "#".repeat(Number(tag[1]));
        const text = collectInline(tokens, i);
        i = skipToClose(tokens, i, tag);
        if (text) out.push(`${lvl} ${text}`, "");
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

