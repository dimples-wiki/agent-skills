#!/usr/bin/env node
// @dimples/aha · serve —— 本地静态服务 + 索引页（零依赖）
//
// 默认端口 7332（避开 dev-log 的 7331）。索引页列出目录下 *.html，
// 按修改时间倒序 —— 已生成的解释页一眼可见。

import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { realpathSync, readdirSync } from "node:fs";
import { extname, join, normalize, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractMarkdown } from "./export-md.mjs";
import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync, unlinkSync, openSync } from "node:fs";
import { pagesDir, ensurePagesDir } from "./home.mjs";

export const DEFAULT_PORT = 7332;

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(obj));
}

/** CLI 随包资产(导出菜单脚本 + vendor 库) */
const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const EXPORTS_DIR = join(pagesDir(), "exports");
const VENDOR_FILES = new Set([
  "export-menu.js",
  "vendor/html-to-image.js",
  "vendor/jspdf.umd.min.js",
]);

/** ?aha-export=1 时注入:模拟器推到最后一步、展开折叠、藏固定层,然后立就绪标志 */
const FINALIZE_SCRIPT = `<script>
(function(){
  function ready(){ window.__ahaExportReady = true; }
  var pending = 0, booted = false;
  function settle(){
    var t0 = Date.now();
    (function wait(){
      if (document.fonts && document.fonts.status !== "loaded" && Date.now() - t0 < 3000) {
        return document.fonts.ready.then(function(){ setTimeout(ready, 350); });
      }
      setTimeout(ready, 350);
    })();
  }
  function doneOne(){ if (--pending <= 0) settle(); }
  function boot(){
    if (booted) return; booted = true;
    document.querySelectorAll(".toolbar,.share-pop").forEach(function(el){ el.remove(); });
    document.querySelectorAll("details").forEach(function(d){ d.open = true; });
    // 寓言答案区(按钮式契约):展开并移除按钮,静态导出里不留悬空的「查看答案」
    document.querySelectorAll("[data-fable-toggle]").forEach(function(btn){
      if (btn.getAttribute("aria-expanded") === "false") btn.click();
      btn.style.display = "none";
    });
    document.querySelectorAll("[data-fable-answers][hidden]").forEach(function(el){
      el.removeAttribute("hidden");
    });
    // 自测块(第 7 层):展开答案、隐藏按钮 —— 与寓言答案区同款契约
    document.querySelectorAll("[data-quiz-answers][hidden]").forEach(function(el){
      el.removeAttribute("hidden");
    });
    document.querySelectorAll("[data-quiz-toggle]").forEach(function(btn){
      btn.style.display = "none";
    });
    var sims = document.querySelectorAll("[data-sim-next]");
    if (!sims.length) return settle();
    sims.forEach(function(btn){
      var box = btn.closest("[data-sim]") || document;
      var prog = box.querySelector("[data-sim-progress]");
      var guard = 0;
      pending++;
      (function tick(){
        var m = prog && prog.textContent.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
        if (m && Number(m[1]) >= Number(m[2])) return doneOne();
        if (guard++ > 80) return doneOne();
        btn.click();
        setTimeout(tick, 24);
      })();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
<` + `/script>`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function listPages(dir) {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".html"));
  const withMeta = await Promise.all(
    names.map(async (n) => {
      const p = join(dir, n);
      const mtime = (await stat(p)).mtimeMs;
      let title = "", dek = "", level = "";
      try {
        const raw = await readFile(p, "utf8");
        title = (raw.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "")
          .replace(/\s*[·-]\s*(?:aha|aha)\s*图解\s*$/i, "").trim();
        dek = (raw.match(/<p class="lead">([\s\S]*?)<\/p>/i)?.[1] ?? "")
          .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (dek.length > 72) {
          // 编辑部式截断：优先在标点处收束，其次词边界，不腰斩半句
          const cut = dek.slice(0, 72);
          const punct = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("，"), cut.lastIndexOf("；"), cut.lastIndexOf("、"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
          dek = punct > 36 ? cut.slice(0, punct + 1) : cut.replace(/\s*\S*$/, "") + "…";
        }
        level = raw.match(/class="badge">([^<]+)</)?.[1]?.trim() ?? "";
      } catch { /* 读不了的页退回文件名展示 */ }
      return { name: n, mtime, title, dek, level };
    })
  );
  return withMeta.sort((a, b) => b.mtime - a.mtime);
}

function indexHtml(pages, dir, token) {
  // —— 「概念书架」编辑部目录页：刊头 + 编号条目 + 元数据（标题/一句话核心/起点级别）
  const d = new Date();
  const rows = pages.map((p, i) => {
    const num = String(i + 1).padStart(2, "0");
    const title = esc(p.title || p.name.replace(/\\.html$/, ""));
    const dek = esc(p.dek);
    const lvl = esc((p.level.match(/L\\d/) || [""])[0]);
    const date = new Date(p.mtime).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
    const hero = i === 0 && pages.length > 1;
    return `<a class="entry${hero ? " hero" : ""}" data-aha-file="${esc(p.name)}" href="/${encodeURIComponent(p.name)}">
      <span class="num">${num}</span>
      <span class="mid">
        <span class="etitle">${title}</span>
        ${dek ? `<span class="dek">${dek}</span>` : ""}
      </span>
      <span class="side"><time>${lvl ? `<b class="lv">${lvl}</b> · ` : ""}${date}</time><b class="go">→</b></span>
    </a>`;
  }).join("\n");
  const count = pages.length;
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>aha · 概念书架</title>
<script>
/* 主题 bootstrap（防 FOUC）—— 与生成页共用 localStorage 键 */
(() => { try {
  const r = document.documentElement;
  r.dataset.theme = localStorage.getItem("aha-theme") ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const p = localStorage.getItem("aha-preset"); if (p) r.dataset.preset = p;
} catch (e) {} })();
</script>
<style>
/* —— 6 象限 tokens（与 design-tokens.css 同步，仅保留书架用到的变量） —— */
:root, :root[data-theme="dark"]{
  --bg:#161210;--surface:#1f1915;--panel:#27201a;--line:#423629;--line-2:#5c4b39;
  --t1:#f7f1e7;--t2:#d9cdba;--t3:#a99b82;--t4:#9b8f7c;
  --accent:#ffab2e;--accent-ink:#241a09;--accent-soft:rgba(255,171,46,.14);
}
:root[data-theme="light"]{
  --bg:#fbf6ec;--surface:#ffffff;--panel:#f5eddd;--line:#ded1b6;--line-2:#c8b48f;
  --t1:#271f12;--t2:#5f5540;--t3:#72654b;--t4:#766851;
  --accent:#8f4e00;--accent-ink:#fffaf0;--accent-soft:rgba(163,91,0,.11);
}
:root[data-preset="pop"]{
  --bg:#191324;--surface:#221b30;--panel:#2b2140;--line:#473868;--line-2:#604b8a;
  --t1:#f7efff;--t2:#dccdf2;--t3:#ab99cd;--t4:#9586be;
  --accent:#ff5d8f;--accent-ink:#30060f;--accent-soft:rgba(255,93,143,.15);
}
:root[data-preset="pop"][data-theme="light"]{
  --bg:#fdf8ff;--surface:#ffffff;--panel:#f7edfe;--line:#e5d5f3;--line-2:#cbadf0;
  --t1:#291838;--t2:#614b78;--t3:#76638e;--t4:#756689;
  --accent:#b81b5e;--accent-ink:#fff5fa;--accent-soft:rgba(214,33,107,.10);
}
:root[data-preset="ink"]{
  --bg:#0e131a;--surface:#161c26;--panel:#1c2430;--line:#333e4f;--line-2:#4a5768;
  --t1:#eff3f8;--t2:#c9d2de;--t3:#97a3b4;--t4:#838e9e;
  --accent:#5ea8ff;--accent-ink:#08172b;--accent-soft:rgba(94,168,255,.13);
}
:root[data-preset="ink"][data-theme="light"]{
  --bg:#f6f9fc;--surface:#ffffff;--panel:#ecf1f7;--line:#d3dde8;--line-2:#b4c3d3;
  --t1:#17222e;--t2:#4a5a6b;--t3:#5c6e82;--t4:#5d6e7d;
  --accent:#1a5fc0;--accent-ink:#f4f9ff;--accent-soft:rgba(31,111,224,.10);
}
*{box-sizing:border-box}
html{color-scheme:dark light}
body{margin:0;background:var(--bg);color:var(--t1);
  font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB",sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:52rem;margin:0 auto;padding:4.5rem 1.6rem 5rem}
/* —— 刊头 —— */
.mast{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.wordmark{font-size:clamp(3rem,9vw,4.6rem);font-weight:800;letter-spacing:-.03em;line-height:.95;margin:0}
.wordmark i{font-style:normal;color:var(--accent)}
.tagline{color:var(--t2);margin:.9rem 0 0;font-size:1.02rem}
.tagline b{color:var(--t1);font-weight:650}
.meta{color:var(--t4);font:500 .72rem/1.7 ui-monospace,Menlo,monospace;margin-top:.45rem;word-break:break-all}
.sharelink{background:none;border:none;padding:0;color:var(--t2);cursor:pointer;white-space:nowrap;
  font:600 .88rem/1 inherit;text-decoration:underline;text-decoration-color:var(--line-2);text-underline-offset:.35em;transition:color .18s}
.sharelink:hover{color:var(--accent);text-decoration-color:var(--accent)}
.sharest{font:500 .78rem/1 ui-monospace,Menlo,monospace;color:var(--t3);align-self:center}
.shareurl{margin-top:.6rem;font:500 .8rem/1.6 ui-monospace,Menlo,monospace;word-break:break-all}
.shareurl a{color:var(--accent)}
.shareurl button{background:var(--surface);color:var(--t2);border:1px solid var(--line-2);
  border-radius:999px;padding:.3em .8em;margin-left:.6em;font-size:.72rem;cursor:pointer}
/* —— 目录条目 —— */
.rule{height:3px;background:var(--accent);margin:1.5rem 0 0;border-radius:2px}
.entry{display:grid;grid-template-columns:3.2rem 1fr auto;gap:1.1rem;align-items:baseline;
  padding:1.05rem .4rem;border-bottom:1px solid var(--line);text-decoration:none;color:inherit;
  transition:background .18s}
.entry:hover{background:var(--surface)}
.num{font:600 .8rem/2 ui-monospace,Menlo,monospace;color:var(--t4);transition:color .18s}
.entry:hover .num{color:var(--accent)}
.mid{min-width:0}
.etitle{display:block;font-size:1.22rem;font-weight:650;line-height:1.35;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dek{display:block;color:var(--t3);font-size:.86rem;margin-top:.45rem;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.side{display:flex;gap:.7rem;align-items:baseline;white-space:nowrap}
time{font:500 .76rem/1 ui-monospace,Menlo,monospace;color:var(--t3);font-variant-numeric:tabular-nums}
.lv{color:var(--accent);font-weight:650}
.legend{color:var(--t4);font:500 .7rem/1.6 ui-monospace,Menlo,monospace;margin:.7rem 0 0;letter-spacing:.02em}
.go{color:var(--t4);font-weight:400;opacity:0;transform:translateX(-4px);transition:.18s}
.entry:hover .go{opacity:1;transform:none;color:var(--accent)}
/* 首篇 = 编辑部位级 */
.entry.hero{grid-template-columns:3.2rem 1fr auto;padding:1.5rem .4rem}
.entry.hero .etitle{font-size:clamp(1.55rem,4.5vw,2.05rem);font-weight:750;white-space:normal;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.entry.hero .dek{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:.92rem}
/* —— 主题/风格切换（编辑部式：纯文字，与分享链同排） —— */
.themerow{display:flex;gap:1.2rem;align-items:baseline;margin-top:.5rem;margin-bottom:.7rem}
.themerow button{background:none;border:none;padding:0;cursor:pointer;
  font:600 .78rem/1 inherit;color:var(--t4);transition:color .18s;letter-spacing:.02em}
.themerow button:hover,.themerow button:focus-visible{color:var(--accent);outline:none}
.themerow .sep{color:var(--line-2);font-size:.7rem;user-select:none}
/* —— 搜索 —— */
.searchbar{display:flex;align-items:baseline;gap:.8rem;padding:.7rem .4rem;border-bottom:1px solid var(--line)}
.searchbar input{flex:1;background:none;border:none;outline:none;color:var(--t1);
  font:400 1rem/1.4 inherit;padding:0;min-width:0;border-bottom:1px solid transparent;transition:border-color .18s}
.searchbar input::placeholder{color:var(--t4)}
.searchbar input:focus{color:var(--t1);border-bottom-color:var(--accent)}
.searchbar .hint{font:500 .68rem/1 ui-monospace,Menlo,monospace;color:var(--t4);white-space:nowrap;
  border:1px solid var(--line);border-radius:4px;padding:.2em .45em;cursor:pointer;user-select:none}
.searchbar .hint:hover{color:var(--t3);border-color:var(--line-2)}
.searchbar .cnt{font:500 .72rem/1 ui-monospace,Menlo,monospace;color:var(--t4);white-space:nowrap;font-variant-numeric:tabular-nums}
.searchbar .cnt.hit{color:var(--accent)}
.nosearch{display:none;padding:2.2rem .4rem;border-bottom:1px solid var(--line);color:var(--t3);font-size:.92rem}
.nosearch b{color:var(--t1)}
/* 空书架 */
.empty{padding:3.2rem .4rem;border-bottom:1px solid var(--line);color:var(--t3)}
.empty b{display:block;color:var(--t1);font-size:1.3rem;margin-bottom:.4rem}
.foot{margin-top:2.2rem;color:var(--t4);font:500 .72rem/1.8 ui-monospace,Menlo,monospace}
@media (max-width:34rem){
  .wrap{padding:3rem 1.1rem 3.5rem}
  .entry{grid-template-columns:2.2rem 1fr;gap:.7rem}
  .side{grid-column:2;justify-content:flex-start;margin-top:.2rem}
}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
</style></head><body>
<div class="wrap">
  <header class="mast">
    <div>
      <h1 class="wordmark">a<i>h</i>a</h1>
      <p class="tagline">概念书架 —— 复杂概念，直观图解。<b>已编译 ${count} 篇</b></p>
      <p class="legend">L1 零基础 · L2 相邻背景 · L3 已入门 —— 起点越高，讲得越深</p>
      <p class="meta">${esc(dir)}</p>
    </div>
    <div>
      <div class="themerow">
        <button type="button" data-tb-theme aria-label="切换深浅色">◐</button>
        <span class="sep">·</span>
        <button type="button" data-tb-preset aria-label="切换配色风格">◈ 暖</button>
        <span class="sep">·</span>
        <button type="button" class="sharelink" data-share>分享这面书架 ↗</button>
      </div>
      <span class="sharest" data-share-status></span>
      <div class="shareurl" data-share-url hidden></div>
    </div>
  </header>
  <div class="rule"></div>
  ${count > 3 ? `<div class="searchbar">
    <input type="search" data-search placeholder="搜索概念…" autocomplete="off" spellcheck="false" aria-label="搜索概念">
    <span class="hint" data-search-hint title="按 / 聚焦搜索">/</span>
    <span class="cnt" data-search-count>${count} 篇</span>
  </div>
  <div class="nosearch" data-nosearch hidden>没有匹配 <b></b> 的概念。换个词试试 —— 搜标题、摘要或级别（L1/L2/L3）。</div>` : ""}
  ${count ? rows : `<div class="empty"><b>书架还是空的</b>对一个概念说“aha 某某”，第一页图解会出现在这里。</div>`}
  <p class="foot">aha serve · 页面即链接 · npx @dimples/aha share 可直接开公网</p>
</div>
<script>
/* [SHELF-THEME] 主题/风格切换（与生成页共用 localStorage 键） */
(() => {
  const root = document.documentElement;
  const PRESETS = ["warm", "pop", "ink"];
  const LABEL = { warm: "暖", pop: "跳", ink: "静" };
  const themeBtn = document.querySelector("[data-tb-theme]");
  const presetBtn = document.querySelector("[data-tb-preset]");
  if (!themeBtn || !presetBtn) return;
  const paint = () => { presetBtn.textContent = "◈ " + LABEL[root.dataset.preset || "warm"]; };
  paint();
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem("aha-theme", root.dataset.theme);
  });
  presetBtn.addEventListener("click", () => {
    const cur = root.dataset.preset || "warm";
    root.dataset.preset = PRESETS[(PRESETS.indexOf(cur) + 1) % PRESETS.length];
    localStorage.setItem("aha-preset", root.dataset.preset);
    paint();
  });
})();
</script>
<script>
/* [SHELF-SEARCH] 概念搜索 —— 原样复制（canonical 在 serve.mjs indexHtml） */
(() => {
  const inp = document.querySelector("[data-search]");
  const hint = document.querySelector("[data-search-hint]");
  const cnt = document.querySelector("[data-search-count]");
  const empty = document.querySelector("[data-nosearch]");
  const entries = [...document.querySelectorAll(".entry")];
  if (!inp || entries.length === 0) return;
  const total = entries.length;

  const filter = () => {
    const q = inp.value.trim().toLowerCase();
    let vis = 0;
    for (const e of entries) {
      const hit = !q || e.textContent.toLowerCase().includes(q);
      e.style.display = hit ? "" : "none";
      if (hit) vis++;
    }
    // 重编号可见条目（01 起连续）
    let n = 0;
    for (const e of entries) {
      if (e.style.display === "none") continue;
      n++;
      e.querySelector(".num").textContent = String(n).padStart(2, "0");
      // hero 位跟随第一个可见条目
      e.classList.toggle("hero", n === 1 && total > 1 && !!q === false ? e.classList.contains("hero") : n === 1);
    }
    // 计数
    cnt.textContent = q ? vis + " / " + total + " 篇" : total + " 篇";
    cnt.classList.toggle("hit", vis < total && !!q);
    // 空结果
    if (empty) {
      empty.hidden = vis > 0;
      empty.querySelector("b").textContent = q;
    }
  };

  inp.addEventListener("input", filter);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { inp.value = ""; filter(); inp.blur(); }
  });
  // "/" 快捷键聚焦
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== inp) {
      e.preventDefault();
      inp.focus();
    }
  });
  if (hint) hint.addEventListener("click", () => inp.focus());
})();
</script>
<script>
(() => {
  const TOKEN = ${JSON.stringify(token)};
  const btn = document.querySelector("[data-share]");
  const st = document.querySelector("[data-share-status]");
  const box = document.querySelector("[data-share-url]");
  const H = { "x-aha-token": TOKEN };
  const LABEL = { idle: "", installing: "安装 cloudflared 中（首次约一分钟）…",
                  starting: "建立隧道…", running: "", error: "" };
  let fails = 0;
  const tick = async () => {
    try {
      if (++fails > 5) { clearInterval(poll); st.textContent = "已与本地服务失联,刷新页面重试"; return; }
      await doTick();
    } catch { /* serve 已死:退避计数兜住,不再无限空转 */ }
  };
  const doTick = async () => {
    const s = await (await fetch("/api/share", { headers: H })).json();
    st.textContent = s.message || LABEL[s.phase] || s.phase;
    fails = 0;
    if (s.phase === "running") {
      clearInterval(poll);
      box.hidden = false;
      box.innerHTML = "";
      const a = document.createElement("a");
      a.href = a.textContent = s.url;
      const cp = document.createElement("button");
      cp.textContent = "复制";
      cp.onclick = () => { navigator.clipboard.writeText(s.url); cp.textContent = "已复制"; };
      box.append(a, cp);
      btn.disabled = false;
    } else if (s.phase === "error") {
      clearInterval(poll);
      btn.disabled = false;
    }
  };
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    st.textContent = "启动中…";
    await fetch("/api/share", { method: "POST", headers: H });
    poll = setInterval(tick, 1000);
    tick();
  });
  let poll;
})();
</script>
<script src="/__aha/export-menu.js" defer></script></body></html>`;
}

/**
 * 解析服务目录：显式指定的目录必须存在（否则抛错）；
 * 未指定 → AHA_HOME 环境变量优先，默认 ~/.aha（自动创建），所有生成页都住在那里。
 * @param {string | undefined} dirArg
 * @param {string} [cwd]
 * @param {string} [home] 完整主目录(测试注入用;缺省走 AHA_HOME / ~/.aha)
 * @returns {string}
 */
export function resolveServeDir(dirArg, cwd = process.cwd(), home) {
  if (dirArg) {
    const dir = resolve(cwd, dirArg);
    if (!existsSync(dir)) throw new Error(`目录不存在: ${dir}`);
    if (!statSync(dir).isDirectory()) throw new Error(`不是目录（serve 只服务目录）: ${dir}`);
    return dir;
  }
  return ensurePagesDir(home);
}

/**
 * @param {{ dir?: string, port?: number, tunnel?: (port: number, onStatus?: Function) =>
 *            Promise<{ url: string, stop: () => void }> }} opts
 *        tunnel: 隧道工厂（测试注入用）；缺省用 share.mjs 的 webTunnelFactory
 * @returns {Promise<{ port: number, close: () => void, dir: string, shareToken: string }>}
 */
export function startServer(opts = {}) {
  const dir = resolve(opts.dir ?? ".");
  const port = opts.port ?? 7332;
  const shareToken = randomUUID();

  // —— 分享状态机：idle → installing/starting → running | error ——
  // 隧道工厂按需解析：显式注入（测试）或动态加载真实现（避免与 share.mjs 循环 import）
  let tunnelFactory = opts.tunnel ?? null;
  let current = null; // { url, stop }
  let pending = null;
  let shareState = { phase: "idle" };
  // 安装期子进程登记表：close() 时一并回收，杜绝孤儿（评审 B6）
  const killables = [];
  const api = (req, res) => {
    // 公网侧防护：经 Cloudflare 边缘来的请求带 cf-ray，API 一律拒绝
    if (req.headers["cf-ray"]) {
      res.writeHead(403).end(JSON.stringify({ error: "API 不经隧道开放" }));
      return true;
    }
    if (req.headers["x-aha-token"] !== shareToken) {
      res.writeHead(401).end(JSON.stringify({ error: "bad token" }));
      return true;
    }
    if (req.method === "POST") {
      if (!current && !pending) {
        pending = (async () => {
          try {
            if (!tunnelFactory) {
              const { webTunnelFactory } = await import("./share.mjs");
              tunnelFactory = webTunnelFactory;
            }
            shareState = { phase: "starting" };
            const t = await tunnelFactory(port, {
              onStatus: (phase, message) => { shareState = { phase, message }; },
              onDown: () => {
                // 隧道死亡：状态翻 error 并清 current，允许重试（评审 B5）
                current = null;
                shareState = { phase: "error", message: "隧道已断开，可重试分享" };
              },
              killables,
            });
            current = t;
            try { writeFileSync(join(dir, ".tunnel.pid"), String(t.pid ?? "")); } catch {}
            shareState = { phase: "running", url: t.url };
          } catch (e) {
            shareState = { phase: "error", message: e.message };
          } finally {
            pending = null;
          }
        })();
      }
      res.writeHead(200).end(JSON.stringify(shareState));
      return true;
    }
    res.writeHead(200).end(JSON.stringify(shareState));
    return true;
  };

  return new Promise((resolveP, rejectP) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (
          url.pathname === "/__aha/export-menu.js" ||
          url.pathname.startsWith("/__aha/vendor/")
        ) {
          const rel = url.pathname.slice("/__aha/".length);
          if (!VENDOR_FILES.has(rel)) {
            res.writeHead(404).end("not found");
            return;
          }
          const body = await readFile(join(ASSETS_DIR, rel));
          res.writeHead(200, {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-cache",
          });
          res.end(body);
          return;
        }
        if (url.pathname === "/__aha/export" && req.method === "GET") {
          const file = normalize(join(dir, url.searchParams.get("file") || ""));
          if (file !== dir && !file.startsWith(dir + sep)) {
            res.writeHead(404).end("not found");
            return;
          }
          if (!existsSync(file) || !file.toLowerCase().endsWith(".html")) {
            json(res, 404, { error: "找不到该页面" });
            return;
          }
          const html = await readFile(file, "utf8");
          const base = file.split(sep).pop().replace(/\.html$/i, "");
          mkdirSync(EXPORTS_DIR, { recursive: true });
          const format = url.searchParams.get("format");
          if (format === "md") {
            const md = extractMarkdown(html);
            const out = join(EXPORTS_DIR, base + ".md");
            writeFileSync(out, md);
            res.writeHead(200, {
              "content-type": "text/markdown; charset=utf-8",
              "content-disposition": 'attachment; filename="' + base + '.md"',
            });
            res.end(md);
            return;
          }
          json(res, 400, { error: "不支持的格式" });
          return;
        }
        if (url.pathname === "/__aha/archive" && req.method === "POST") {
          const name = (url.searchParams.get("name") || "export.bin").replace(/[^\w.\-]/g, "_");
          const chunks = [];
          for await (const c of req) chunks.push(c);
          mkdirSync(EXPORTS_DIR, { recursive: true });
          writeFileSync(join(EXPORTS_DIR, name), Buffer.concat(chunks));
          res.writeHead(200).end("{}");
          return;
        }
        if (url.pathname === "/api/share" && api(req, res)) return;
        let pathname;
        try {
          pathname = decodeURIComponent(url.pathname);
        } catch {
          res.writeHead(400).end("bad encoding"); // 评审 M6：坏百分号编码
          return;
        }
        // 目录穿越防护：解析 + 符号链接双重收紧（评审 M7：stat 会跟随 symlink）
        const target = normalize(join(dir, pathname));
        if (target !== dir && !target.startsWith(dir + sep)) {
          res.writeHead(404).end("not found");
          return;
        }
        if (target !== dir) {
          try {
            const [rp, rpDir] = [realpathSync(target), realpathSync(dir)];
            if (!rp.startsWith(rpDir + sep) && rp !== rpDir) {
              res.writeHead(404).end("not found");
              return;
            }
          } catch { /* realpath 失败说明文件不存在，走下面的 stat 分支 */ }
        }
        // 仅本机会话注入分享 token；经隧道（cf-ray）的公开访客不注入
        // —— 页内按钮对 trycloudflare 域名隐藏，公开侧不存在双重分享路径
        const injectToken = req.headers["cf-ray"]
          ? (html) => html
          : (html) => {
              const metaTag = '<meta name="aha-share-token"';
              const meta = `<meta name="aha-share-token" content="${shareToken}">`;
              // 去重判定必须认 meta 标签本身 —— 页面工具条 JS 会引用这个名字，裸字符串会误判已注入
              if (html.includes(metaTag)) return html;
              if (html.includes("</head>")) return html.replace("</head>", `${meta}</head>`);
              if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}${meta}`);
              return meta + html;
            };
        const st = await stat(target).catch(() => null);
        if (st?.isFile()) {
          if (target.toLowerCase().endsWith(".html")) {
            let html = await readFile(target, "utf8");
            const exportMode = url.searchParams.has("aha-export");
            // 本地会话注入导出菜单(公开隧道访客与终态 iframe 不注)
            if (!exportMode && !req.headers["cf-ray"] && !html.includes("/__aha/export-menu.js")) {
              html = html.replace("</body>", '<script src="/__aha/export-menu.js" defer></script></body>');
            }
            // 终态模式:模拟器推到最后一步再立就绪标志,供父页面捕获
            if (exportMode && !html.includes("__ahaExportReady")) {
              html = html.replace("</body>", FINALIZE_SCRIPT + "</body>");
            }
            // 导出态主题:按链接参数写入存储与根属性(先于页面自举,所见即所得)
            if (exportMode) {
              const tp = url.searchParams.get("theme");
              const pp = url.searchParams.get("preset");
              const okId = (x) => /^[a-z][a-z-]{0,20}$/i.test(x ?? "");
              const t = okId(tp) ? tp : null;
              const p = okId(pp) ? pp : null;
              if (t || p) {
                const sync = `<script>(function(){try{` +
                  (t ? `localStorage.setItem("aha-theme",${JSON.stringify(t)});` : "") +
                  (p ? `localStorage.setItem("aha-preset",${JSON.stringify(p)});` : "") +
                  `}catch(e){}var r=document.documentElement;` +
                  (t ? `r.dataset.theme=${JSON.stringify(t)};` : "") +
                  (p ? `r.dataset.preset=${JSON.stringify(p)};` : "") +
                  `})();<` + `/script>`;
                html = html.replace(/<head[^>]*>/i, (m) => m + sync);
              }
            }
            // 注入本会话分享 token：页面内工具条的分享按钮据此调用 /api/share。
            // file:// 直开不含此 meta，分享按钮会转而显示 CLI 指引。
            // HTML 一律 no-cache：新构建(引用新 hash 的 JS/CSS)立刻可见,
            // 否则旧缓存的 HTML 会去请求已被新构建删除的旧资源 → 白屏
            res.writeHead(200, {
              "content-type": "text/html; charset=utf-8",
              "cache-control": exportMode ? "no-store" : "no-cache",
            });
            res.end(injectToken(html));
            return;
          }
          const body = await readFile(target);
          // vite 等构建器的内容寻址资源(带 hash,不可变)可长期缓存;其余协商缓存
          const immutable = target.includes(`${sep}assets${sep}`);
          res.writeHead(200, {
            "content-type": MIME[extname(target).toLowerCase()] ?? "application/octet-stream",
            "cache-control": immutable
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          });
          res.end(body);
          return;
        }
        if (st?.isDirectory() || url.pathname === "/") {
          const idx = join(target, "index.html");
          if (existsSync(idx) && target !== dir) {
            res.writeHead(200, {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-cache",
            });
            res.end(injectToken(await readFile(idx, "utf8"))); // 子目录 index 同样注入（评审 M5）
            return;
          }
          const pages = await listPages(dir);
          res.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache",
          });
          res.end(indexHtml(pages, dir, shareToken));
          return;
        }
        res.writeHead(404).end("not found");
      } catch (e) {
        console.error(`aha serve: ${req.url} -> ${e.message}`);
        res.writeHead(500).end("error");
      }
    });
    server.on("error", rejectP);
    server.listen(port, "127.0.0.1", () =>
      resolveP({
        port: server.address().port,
        close: (opts = {}) => {
          // 换血模式(preserveTunnel)留下 cloudflared:它独立代理本端口,
          // 新守护接管后隧道无感续命;正常退出仍随服务关闭(链接即刻失效)
          if (current && !opts.preserveTunnel) current.stop();
          for (const c of killables) c.kill("SIGTERM"); // 安装子进程一并回收（评审 B6）
          server.close();
        },
        dir,
        shareToken,
      })
    );
  });
}

/** CLI 入口 */
export async function serveCommand(dirArg, opts = {}) {
  let dir;
  try {
    dir = resolveServeDir(dirArg);
  } catch (e) {
    console.error(`aha serve: ${e.message}`);
    process.exit(2);
  }
  let server;
  try {
    server = await startServer({ dir, port: Number(opts.port ?? DEFAULT_PORT) });
  } catch (e) {
    console.error(friendlyListenError(e, opts.port ?? DEFAULT_PORT)); // 评审 B4：不再裸栈
    process.exit(1);
  }
  console.log(`aha serve · ${dir}`);
  console.log(`  →  http://127.0.0.1:${server.port}   （主页：历史生成列表）`);
  console.log("  页面地址：http://127.0.0.1:" + server.port + "/<slug>.html");
  console.log("  Ctrl-C 停止；索引页或页面工具条的分享按钮可开公网链接");
  // Web 流程里由 /api/share 启动的隧道与安装子进程都挂在 server 上；
  // 进程退出（含 kill）必须一并回收，否则 cloudflared / brew 成为孤儿。
  // 例外:SIGUSR2 是「代码升级换血」——保留隧道进程,新守护接管同一端口。
  const cleanup = (preserveTunnel = false) => {
    server.close({ preserveTunnel });
    process.exit(0);
  };
  process.on("SIGINT", () => cleanup(false));
  process.on("SIGTERM", () => cleanup(false));
  process.on("SIGUSR2", () => cleanup(true));
}

/** listen 阶段错误 → 人话（评审 B4；share.mjs 复用） */
export function friendlyListenError(e, port) {
  if (e?.code === "EADDRINUSE") {
    return `aha: 端口 ${port} 已被占用（可能已有一个 serve/share 在跑）。试试 --port 其他值。`;
  }
  return `aha: 启动失败：${e?.message ?? e}`;
}

// —— 后台守护（dev-log 同构）：aha start / aha stop ——

const probe = async (port, ms = 600) => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(ms) });
    return res.status === 200;
  } catch { return false; }
};

const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };


/**
 * 幂等启动后台 serve 守护（未运行则拉起 detached 子进程，已运行则复用）。
 * pid/日志落在服务目录：.serve.pid / .serve.log
 * @param {{ dir?: string, port?: number }} opts
 * @returns {Promise<{ pid: number, port: number, dir: string, reused: boolean, count: number }>}
 */
export async function startDaemon(opts = {}) {
  const dir = resolveServeDir(opts.dir);
  const port = Number(opts.port ?? DEFAULT_PORT);
  const pidFile = join(dir, ".serve.pid");
  const logFile = join(dir, ".serve.log");
  const count = readdirSync(dir).filter((n) => n.endsWith(".html")).length;

  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    if (pidAlive(pid) && (await probe(port))) {
      // 在跑就换血:POSIX 用 SIGUSR2(只关 HTTP、保留隧道进程);
      // Windows 无此信号,直接终止旧守护(隧道进程一并退出)
      try { process.kill(pid, process.platform === "win32" ? "SIGTERM" : "SIGUSR2"); } catch {}
      for (let i = 0; i < 40 && (await probe(port, 250)); i++) {
        await new Promise((r) => setTimeout(r, 150));
      }
      unlinkSync(pidFile);
    } else {
      unlinkSync(pidFile); // 陈旧 pid（进程已死或端口未监听）
    }
  }
  if (await probe(port)) {
    // 端口被外部 serve 占用（如前台手跑的）—— 直接当作守护复用
    return { pid: -1, port, dir, reused: true, count };
  }

  // fileURLToPath 必须用:URL.pathname 在 Windows 是 "/C:/..." 非法路径(daemon 起不来)
  const self = fileURLToPath(new URL("./cli.mjs", import.meta.url)); // 入口必须是 cli.mjs（serve.mjs 只导出不执行）
  const logFd = openSync(logFile, "a");
  const child = spawn(process.execPath, [self, "serve", dir, "--port", String(port)], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 40 && !(await probe(port, 400)); i++) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!(await probe(port))) throw new Error(`守护启动失败，日志见 ${logFile}`);
  return { pid: child.pid, port, dir, reused: false, count };
}

/**
 * 停止守护：按 pid 文件 SIGTERM（serveCommand 自带清理链），清 pid 文件。
 * @param {{ dir?: string, port?: number }} opts
 */
export async function stopDaemon(opts = {}) {
  const dir = resolveServeDir(opts.dir);
  const port = Number(opts.port ?? DEFAULT_PORT);
  const pidFile = join(dir, ".serve.pid");
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    if (pidAlive(pid)) {
      process.kill(pid, "SIGTERM");
      for (let i = 0; i < 20 && pidAlive(pid) && i >= 0; i++) {
        await new Promise((r) => setTimeout(r, 150));
        if (!pidAlive(pid)) break;
      }
    }
    unlinkSync(pidFile);
  } else if (await probe(port)) {
    // 无 pidfile 的占用（前台手动跑的 / 旧版孤儿）：lsof 可用时按端口强停
    let pids = [];
    try {
      // 只取 LISTEN 状态（lsof -i tcp:PORT 会把客户端连接也列进来 ——
      // 曾把 stop 自己 probe 的连接杀掉，进程以 SIGTERM 143 自尽）
      const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
      pids = out.split("\n").map(Number).filter((n) => n && n !== process.pid);
    } catch { /* 无 lsof（如 Windows）→ 走提示分支 */ }
    if (pids.length) {
      for (const pid of pids) { try { process.kill(pid, "SIGTERM"); } catch {} }
      for (let i = 0; i < 20 && (await probe(port, 300)); i++) await new Promise((r) => setTimeout(r, 150));
      if (await probe(port)) throw new Error(`端口 ${port} 的进程未能停止（pids: ${pids.join(",")}）`);
    } else {
      console.error(`aha stop: ${dir}/.serve.pid 不存在，且找不到 lsof —— 端口 ${port} 的服务请手动停止。`);
      process.exit(2);
    }
  }
  // 回收「换血升级」留下的孤儿隧道(正常退出已随进程关闭,此处兜底)
  const tunnelPidFile = join(dir, ".tunnel.pid");
  if (existsSync(tunnelPidFile)) {
    const tpid = Number(readFileSync(tunnelPidFile, "utf8").trim());
    if (tpid && pidAlive(tpid)) {
      try { process.kill(tpid, "SIGTERM"); } catch {}
      for (let i = 0; i < 20 && pidAlive(tpid); i++) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    unlinkSync(tunnelPidFile);
  }
}
