import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHtml, REGISTRY } from "../src/check.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// —— 测试基线：一页全部合规的最小页面，每个坏样本只改一处 ——
const goodPage = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>测试页</title>
<style>
/* aha-design-tokens v1 */
:root { --bg: #171310; --accent: #ffb454; --t-1: #f5efe5; }
.t-2 { color: var(--t-1); }
</style>
<style>
.hero { border-color: var(--accent); }
</style>
</head>
<body>
<h1 class="t-2">标题</h1>
<h2>节</h2>
<h3>小节</h3>
<img src="a.png" alt="示意图">
<div class="sim-node is-active" data-node="x">x</div>
<script>const SIM_STEPS = []; const ok = 1;</script>
</body>
</html>`;

const gate = (res, id) => res.gates.find((g) => g.id === id);
const run = (html) => checkHtml(html);

test("good page: 13/13 gates pass", () => {
  const res = run(goodPage);
  assert.equal(res.ok, true);
  assert.equal(res.passed, 13);
  assert.equal(res.total, 13);
});

test("single-h1: two h1 fails", () => {
  const res = run(goodPage.replace("<h2>节</h2>", "<h1>第二个</h1>"));
  assert.equal(gate(res, "single-h1").status, "fail");
});

test("heading-monotonic: h2 followed by h4 fails", () => {
  const res = run(goodPage.replace("<h3>小节</h3>", "<h4>跳档</h4>"));
  assert.equal(gate(res, "heading-monotonic").status, "fail");
});

test("head-meta: missing title / lang / viewport each fail", () => {
  assert.equal(gate(run(goodPage.replace("<title>测试页</title>", "")), "head-meta").status, "fail");
  assert.equal(gate(run(goodPage.replace('lang="zh-CN"', "")), "head-meta").status, "fail");
  assert.equal(gate(run(goodPage.replace(/<meta name="viewport"[^>]*>/, "")), "head-meta").status, "fail");
});

test("img-alt: img without alt fails", () => {
  const res = run(goodPage.replace('alt="示意图"', ""));
  assert.equal(gate(res, "img-alt").status, "fail");
});

test("tokens-present: missing marker fails", () => {
  const res = run(goodPage.replace("aha-design-tokens v1", "some other css"));
  assert.equal(gate(res, "tokens-present").status, "fail");
});

test("no-inline-colors: hex outside tokens block fails", () => {
  const res = run(goodPage.replace("border-color: var(--accent);", "border-color: #ff0000;"));
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

test("no-inline-colors: hex in style attribute fails", () => {
  const res = run(goodPage.replace("<h1 class=\"t-2\">标题</h1>", '<h1 class="t-2" style="color:#f00">标题</h1>'));
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

test("no-inline-colors: hex inside tokens block passes (that is where colors live)", () => {
  const res = run(goodPage); // tokens 块内有 #171310 等
  assert.equal(gate(res, "no-inline-colors").status, "pass");
});

test("no-inline-colors: href fragment '#top' is not a color (no false positive)", () => {
  const res = run(goodPage.replace("<h1", '<a id="top"></a><a href="#top">up</a>\n<h1'));
  assert.equal(gate(res, "no-inline-colors").status, "pass");
});

test("no-inline-colors: rgb()/hsl() outside tokens block fails", () => {
  const res = run(goodPage.replace("border-color: var(--accent);", "border-color: rgb(1,2,3);"));
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

test("classes-known: unknown c- class fails, known passes", () => {
  const res = run(goodPage.replace('class="t-2"', 'class="c-accent"'));
  assert.equal(gate(res, "classes-known").status, "pass");
  const bad = run(goodPage.replace('class="t-2"', 'class="c-not-a-color"'));
  assert.equal(gate(bad, "classes-known").status, "fail");
});

test("classes-known: sim classes validated against registry", () => {
  const bad = run(goodPage.replace('class="sim-node is-active"', 'class="sim-nodes is-active"'));
  assert.equal(gate(bad, "classes-known").status, "fail");
});

test("script-syntax: broken script fails", () => {
  const res = run(goodPage.replace("const ok = 1;", 'const say = "unterminated;'));
  assert.equal(gate(res, "script-syntax").status, "fail");
});

test("script-syntax: valid module import does not false-fail", () => {
  const res = run(
    goodPage.replace(
      "<script>const SIM_STEPS = []; const ok = 1;</script>",
      '<script type="module">import x from "x"; const ok = 1;</script>'
    )
  );
  assert.equal(gate(res, "script-syntax").status, "pass");
});

test("receipt shape: has gate list, counts, exit-ok flag", () => {
  const res = run(goodPage);
  assert.equal(res.gates.length, 13);
  for (const g of res.gates) assert.ok(["pass", "fail"].includes(g.status));
  assert.equal(res.ok, true);
});

test("real assets: reference.html and simulator.html pass all gates", () => {
  for (const f of ["../../assets/reference.html", "../../assets/simulator.html"]) {
    const html = readFileSync(join(here, f), "utf8");
    const res = checkHtml(html);
    const failed = res.gates.filter((g) => g.status === "fail");
    assert.deepEqual(failed.map((g) => g.id), [], `${f}: ${JSON.stringify(failed)}`);
  }
});

test("registry sync: c-*/t-* classes match assets/design-tokens.css definitions", () => {
  const css = readFileSync(join(here, "../../assets/design-tokens.css"), "utf8");
  const defined = new Set(
    [...css.matchAll(/\.((?:c|t)-[a-z0-9-]+)/g)].map((m) => m[1])
  );
  for (const cls of defined) assert.ok(REGISTRY.classes.includes(cls), `registry missing: ${cls}`);
  for (const cls of REGISTRY.classes) {
    if (/^(c|t)-/.test(cls)) assert.ok(defined.has(cls), `registry stale: ${cls}`);
  }
});

test("tokens-present: version marker required (bare name not enough)", () => {
  const res = run(goodPage.replace("aha-design-tokens v1", "aha-design-tokens"));
  assert.equal(gate(res, "tokens-present").status, "fail");
});

test("no-inline-colors: only the FIRST tokens block is exempt, a second marked block with hex fails", () => {
  const sneaky = goodPage.replace(
    "<h1 class=\"t-2\">标题</h1>",
    '<style>/* aha-design-tokens v1 */ .x { color: #ff0000; }</style>\n<h1 class="t-2">标题</h1>'
  );
  const res = run(sneaky);
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

// —— 评审加固：B1/B2/B3/M2/M3/M4 ——

test("B1: single-quoted and unquoted style/fill/class attributes are scanned", () => {
  const a = run(goodPage.replace("<h1", "<div style='color:#ff0000'>x</div>\n<h1"));
  assert.equal(gate(a, "no-inline-colors").status, "fail");
  const b = run(goodPage.replace("<h1", "<div fill='#ff0000'>x</div>\n<h1"));
  assert.equal(gate(b, "no-inline-colors").status, "fail");
  const c = run(goodPage.replace('class="t-2"', "class='c-evil'"));
  assert.equal(gate(c, "classes-known").status, "fail");
});

test("B2: 4/8-digit hex (#f00a, #ff0000aa) outside tokens block fails", () => {
  const a = run(goodPage.replace("border-color: var(--accent);", "border-color: #f00a;"));
  assert.equal(gate(a, "no-inline-colors").status, "fail");
  const b = run(goodPage.replace("border-color: var(--accent);", "border-color: #ff0000aa;"));
  assert.equal(gate(b, "no-inline-colors").status, "fail");
});

test("B3: external <script src> violates single-file contract → script-syntax fails", () => {
  const res = run(goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script src="https://evil.example/x.js"></script>'
  ));
  assert.equal(gate(res, "script-syntax").status, "fail");
});

test("M2: a style block with marker comment but no real token selectors is not tokens", () => {
  const res = run(goodPage.replace(
    "<h2>节</h2>",
    "<style>/* aha-design-tokens v1 */ .fake { color: #ff0000; }</style>\n<h2>节</h2>"
  ));
  // 伪造 tokens 块不含 :root/--accent → 既不算 tokens，颜色也不豁免
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

test("M3: module script with multi-line import does not false-fail", () => {
  const res = run(goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script type="module">import {\n  a,\n  b,\n} from "x";\nconst ok = 1;</script>'
  ));
  assert.equal(gate(res, "script-syntax").status, "pass");
});

test("M4: headings inside HTML comments are not counted", () => {
  const res = run(goodPage.replace("<h2>节</h2>", "<!-- <h1>commented</h1> -->\n<h2>节</h2>"));
  assert.equal(gate(res, "single-h1").status, "pass");
});

test("canonical sync: embedded canonical equals assets/design-tokens.css", async () => {
  const { CANONICAL_TOKENS } = await import("../src/canonical-tokens.mjs");
  // 归一换行:Windows checkout 的 autocrlf 会把 assets 变 CRLF,内容语义没变
  const css = readFileSync(join(here, "../../assets/design-tokens.css"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(CANONICAL_TOKENS, css);
});

test("gate5: tampered tokens at current version fails; older snapshot passes", async () => {
  const { CANONICAL_TOKENS } = await import("../src/canonical-tokens.mjs");
  const ver = CANONICAL_TOKENS.match(/aha-design-tokens v(\d[\d.]*)/)[1];
  const tampered = CANONICAL_TOKENS.replace("#ffab2e", "#ffab2f");
  const page = (css) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>t</title>
<style>${css}</style></head><body><h1>t</h1></body></html>`;
  assert.equal(gate(run(page(tampered)), "tokens-present").status, "fail");
  const older = CANONICAL_TOKENS.replace(`v${ver}`, "v0.9");
  assert.equal(gate(run(page(older)), "tokens-present").status, "pass"); // 旧快照放行
  assert.equal(gate(run(page(CANONICAL_TOKENS)), "tokens-present").status, "pass");
});

test("gate6/8 误判修复: url(#id) paint 引用 / module 顶层 await / importmap 不误杀", () => {
  const a = run(goodPage.replace("<h1", '<svg><rect fill="url(#grad)"/></svg>\n<h1'));
  assert.equal(gate(a, "no-inline-colors").status, "pass");
  const b = run(goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script type="module">import x from "x"; const r = await x();</script>'
  ));
  assert.equal(gate(b, "script-syntax").status, "pass");
  const c = run(goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script type="importmap">{"imports":{"x":"https://e.example/x.js"}}</script>'
  ));
  assert.equal(gate(c, "script-syntax").status, "pass");
});

test("gate6: 命名颜色字面量在 style 属性内被拦", () => {
  const res = run(goodPage.replace("<h1", '<div style="color:red">x</div>\n<h1'));
  assert.equal(gate(res, "no-inline-colors").status, "fail");
});

test("gate 9-11: questioner-ref / fail-tag / zh sim-label gates", () => {
  const a = run(goodPage.replace("<h2>节</h2>", "<p>先回答你的问题：就是这样。</p>"));
  assert.equal(gate(a, "no-questioner-ref").status, "fail");
  const b = run(goodPage.replace("<h2>节</h2>", '<div class="fail"><span class="tag">窗窄之困</span>x</div>'));
  assert.equal(gate(b, "fail-tag-consistency").status, "fail");
  const c = run(goodPage.replace('<div class="sim-node is-active" data-node="x">x</div>', '<div class="sim-node is-active" data-node="x"><span class="k">Merge</span>x</div>'));
  assert.equal(gate(c, "sim-label-lang").status, "fail");
  const d = run(goodPage.replace('<div class="sim-node is-active" data-node="x">x</div>', '<div class="sim-node is-active" data-node="x"><span class="k">ClientHello</span>x</div>'));
  assert.equal(gate(d, "sim-label-lang").status, "pass"); // 白名单
});

test("R-MINORS: named color in style block / single-quoted tag & k labels / ref in script ok", () => {
  const a = run(goodPage.replace("border-color: var(--accent);", "border-color: crimson;"));
  assert.equal(gate(a, "no-inline-colors").status, "fail");
  const b = run(goodPage.replace("<h2>节</h2>", "<div class='fail'><span class='tag'>坏料</span>x</div>"));
  assert.equal(gate(b, "fail-tag-consistency").status, "pass");
  const c = run(goodPage.replace("<h2>节</h2>", "<div class='fail'><span class='tag'>坏原料</span>x</div>"));
  assert.equal(gate(c, "fail-tag-consistency").status, "fail");
  const d = run(goodPage.replace('class="sim-node is-active" data-node="x">x</div>', "class='sim-node is-active' data-node='x'><span class='k'>Merge</span>x</div>"));
  assert.equal(gate(d, "sim-label-lang").status, "fail");
  const e = run(goodPage.replace("const ok = 1;", 'const s = "先回答你的问题";'));
  assert.equal(gate(e, "no-questioner-ref").status, "pass"); // 脚本字符串不误伤
});

test("final polish: font-family string exempt; unquoted class forms caught", () => {
  const a = run(goodPage.replace("border-color: var(--accent);", "border-color: var(--accent);font-family:'Red Hat Text',serif;"));
  assert.equal(gate(a, "no-inline-colors").status, "pass");
  const b = run(goodPage.replace("<h2>节</h2>", "<div class=fail><span class=tag>坏原料</span>x</div>"));
  assert.equal(gate(b, "fail-tag-consistency").status, "fail");
  const c = run(goodPage.replace('<div class="sim-node is-active" data-node="x">x</div>', "<div class=sim-node data-node=x><span class=k>Merge</span>x</div>"));
  assert.equal(gate(c, "sim-label-lang").status, "fail");
});

test("micro-FP: data-class attribute is not class", () => {
  const a = run(goodPage.replace("<h2>节</h2>", '<div data-class="tag">超长内容示意</div>'));
  assert.equal(gate(a, "fail-tag-consistency").status, "pass");
});

// —— 门 12：自测块（检索练习）——
// 依据 references/theory.md 第 7 层：测试效应（Roediger & Karpicke 2006）——
// 有「记」层的完整图解页必须带 ≥2 个自测问题，答案默认折叠（读者先答后看）。
const quizOk = `<section class="section quiz" data-quiz>
  <h2>合上页面前</h2>
  <ol class="quiz-q"><li>问题一</li><li>问题二</li></ol>
  <button type="button" class="quiz-toggle" data-quiz-toggle aria-expanded="false" aria-controls="quiz-answers">查看答案</button>
  <div class="quiz-ans" id="quiz-answers" data-quiz-answers hidden><p>答一</p><p>答二</p></div>
</section>`;
const withTakeaway = (quiz) =>
  goodPage.replace("<h3>小节</h3>", `<h3>小节</h3>\n<div class="takeaway"><p><mark>记</mark>住</p></div>\n${quiz}`);

test("gate12 self-test: page without takeaway is exempt (component demos / partial pages)", () => {
  assert.equal(gate(run(goodPage), "self-test").status, "pass");
});

test("gate12 self-test: takeaway without quiz block fails", () => {
  const res = run(withTakeaway(""));
  assert.equal(gate(res, "self-test").status, "fail");
});

test("gate12 self-test: takeaway + quiz (≥2 questions, answers hidden) passes", () => {
  const res = run(withTakeaway(quizOk));
  assert.equal(gate(res, "self-test").status, "pass", JSON.stringify(gate(res, "self-test")));
});

test("gate12 self-test: only one question fails", () => {
  const res = run(withTakeaway(quizOk.replace("<li>问题二</li>", "")));
  assert.equal(gate(res, "self-test").status, "fail");
});

test("gate12 self-test: answers not hidden by default fails (reader must answer first)", () => {
  const res = run(withTakeaway(quizOk.replace("data-quiz-answers hidden", "data-quiz-answers")));
  assert.equal(gate(res, "self-test").status, "fail");
});

test("gate12 self-test: quiz block without answers container fails", () => {
  const res = run(withTakeaway(quizOk.replace(/<div class="quiz-ans"[\s\S]*?<\/div>/, "")));
  assert.equal(gate(res, "self-test").status, "fail");
});

test("gate12 self-test: takeaway mentioned only in CSS is not a takeaway block", () => {
  const res = run(goodPage.replace(".hero { border-color: var(--accent); }", ".takeaway { border-color: var(--accent); }"));
  assert.equal(gate(res, "self-test").status, "pass");
});

// —— 门 13：数字账本 ——
// 依据 SKILL.md「数字纪律」：比例类数字（N% / N 倍）最容易"看起来像事实错误"；
// 完整页（有 takeaway）须带 [data-ledger]，正文出现的每个 N%/N倍 字面量都要在账本里有条目，
// 每条标 data-kind ∈ {实算, 出处, 估算}。
const ledger = (items) => `<details class="ledger" data-ledger><summary>本页数字从哪来</summary><ul>${items}</ul></details>`;
const fullPage = (body, led) =>
  goodPage.replace("<h3>小节</h3>", `<h3>小节</h3>\n${body}\n<div class="takeaway"><p><mark>记</mark>住</p></div>\n${quizOk}\n${led}`);

test("gate13 number-ledger: page without takeaway is exempt", () => {
  assert.equal(gate(run(goodPage.replace("<h3>小节</h3>", "<h3>小节</h3><p>省 40%</p>")), "number-ledger").status, "pass");
});

test("gate13 number-ledger: full page without ledger block fails", () => {
  assert.equal(gate(run(fullPage("<p>无数字</p>", "")), "number-ledger").status, "fail");
});

test("gate13 number-ledger: no ratio literals + empty ledger passes", () => {
  const res = run(fullPage("<p>无数字</p>", ledger("")));
  assert.equal(gate(res, "number-ledger").status, "pass", JSON.stringify(gate(res, "number-ledger")));
});

test("gate13 number-ledger: every N% / N倍 literal in body must appear in the ledger", () => {
  const body = `<p>误报率约 3.1%，吞吐提升 17 倍，另有 1,000 倍差距</p>`;
  const ok = ledger(
    `<li data-kind="实算"><b>3.1%</b> — (1-e^{-kn/m})^k，k=7,n/m=1/10</li>
     <li data-kind="出处"><b>17倍</b> — 论文表 2</li>
     <li data-kind="估算"><b>1000 倍</b> — 示意量级</li>`,
  );
  assert.equal(gate(run(fullPage(body, ok)), "number-ledger").status, "pass", JSON.stringify(gate(run(fullPage(body, ok)), "number-ledger")));
  const missing = ledger(`<li data-kind="实算"><b>3.1%</b> — 算式</li>`);
  const res = run(fullPage(body, missing));
  assert.equal(gate(res, "number-ledger").status, "fail");
  assert.match(gate(res, "number-ledger").detail, /17倍/);
});

test("gate13 number-ledger: literals inside <script>/<style>/comments/attributes are not counted", () => {
  const body = `<!-- 50% --><script>const x = "60%";</script><style>.a{width:70%}</style><div style="width:80%">文字</div>`;
  assert.equal(gate(run(fullPage(body, ledger(""))), "number-ledger").status, "pass");
});

test("gate13 number-ledger: SVG <text> percentages count as body numbers", () => {
  const body = `<svg viewBox="0 0 10 10"><text x="1" y="1">25%</text></svg>`;
  assert.equal(gate(run(fullPage(body, ledger(""))), "number-ledger").status, "fail");
  assert.equal(gate(run(fullPage(body, ledger(`<li data-kind="估算">25% — 示意</li>`))), "number-ledger").status, "pass");
});

test("gate13 number-ledger: modulo operator (95 % 3 = 2, column header '% 4') is not a percentage", () => {
  const body = `<table><tr><th>% 3</th><th>% 4</th></tr><tr><td>95 % 3 = 2</td><td>95 % 4 = 3</td></tr></table><p>取模：95 % 3 = 2 而 95 % 4 = 3</p>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "pass", JSON.stringify(gate(res, "number-ledger")));
});

test("gate13 number-ledger: a percentage in a table cell followed by a number in the next row still counts", () => {
  const body = `<table><tr><td>5</td><td>≈ 9.2%</td></tr><tr><td>10</td><td>≈ 0.82%</td></tr></table>`;
  const res = run(fullPage(body, ledger(`<li data-kind="实算">0.82% — 公式</li>`)));
  assert.equal(gate(res, "number-ledger").status, "fail");
  assert.match(gate(res, "number-ledger").detail, /9\.2%/);
});

test("gate13 number-ledger: entry with unknown or missing data-kind fails", () => {
  const body = `<p>省 40%</p>`;
  assert.equal(gate(run(fullPage(body, ledger(`<li data-kind="猜的">40% — x</li>`))), "number-ledger").status, "fail");
  assert.equal(gate(run(fullPage(body, ledger(`<li>40% — x</li>`))), "number-ledger").status, "fail");
});

test("gate13 number-ledger: unfilled scaffold placeholder entry passes (scaffold stays green)", () => {
  const res = run(fullPage("<p>无数字</p>", ledger(`<li data-kind="实算">（SLOT8: 数字 — 算式/出处/假设）</li>`)));
  assert.equal(gate(res, "number-ledger").status, "pass");
});

test("governance: SIM_LABEL_WHITELIST exported as non-empty array of identifiers", async () => {
  const { SIM_LABEL_WHITELIST } = await import("../src/check.mjs");
  assert.ok(Array.isArray(SIM_LABEL_WHITELIST) && SIM_LABEL_WHITELIST.length >= 5);
  for (const w of SIM_LABEL_WHITELIST) assert.ok(/^[A-Z][A-Za-z0-9·ᵀ]*$/.test(w), `白名单应为大写开头的标识符: ${w}`);
});
