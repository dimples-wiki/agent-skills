import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/cli.mjs";

test("parseArgs: commands, positionals, --port N and --port=N", () => {
  assert.deepEqual(parseArgs(["check", "a.html"]), { cmd: "check", positionals: ["a.html"], opts: {} });
  assert.deepEqual(parseArgs(["serve", "--port", "8080"]), { cmd: "serve", positionals: [], opts: { port: 8080 } });
  assert.deepEqual(parseArgs(["serve", "--port=8080", "dir"]), { cmd: "serve", positionals: ["dir"], opts: { port: 8080 } });
});

test("parseArgs: bad ports rejected (B4) — abc / 99999 / 80.5 / missing value", () => {
  for (const bad of [["serve", "--port", "abc"], ["serve", "--port", "99999"], ["serve", "--port", "80.5"], ["serve", "--port"]]) {
    assert.throws(() => parseArgs(bad), /--port/);
  }
});

test("parseArgs: unknown flags rejected", () => {
  assert.throws(() => parseArgs(["serve", "--evil"]), /未知选项/);
});

test("BL1: bin symlink execution works (npx form) — not a silent no-op", async () => {
  const { symlinkSync, mkdirSync, rmSync, chmodSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const binDir = join(tmpdir(), "aha-bin-smoke");
  rmSync(binDir, { recursive: true, force: true });
  mkdirSync(binDir);
  const bin = join(binDir, "aha");
  const real = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
  symlinkSync(real, bin);
  chmodSync(bin, 0o755);
  const out = execFileSync(process.execPath, [bin, "--help"], { encoding: "utf8" });
  rmSync(binDir, { recursive: true, force: true });
  assert.ok(out.includes("aha ——"), "经符号链接执行必须输出帮助而非静默");
});

test("B4 command-level: serve on occupied port exits 1 with friendly message", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { fileURLToPath } = await import("node:url");
  const { startServer } = await import("../src/serve.mjs");
  const exec = promisify(execFile);
  const blocker = await startServer({ dir: process.cwd(), port: 0 });
  try {
    const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
    await exec(process.execPath, [cli, "serve", "--port", String(blocker.port)]);
    assert.fail("应当以非 0 退出");
  } catch (e) {
    assert.ok(/已被占用/.test(e.stderr + e.stdout), "应输出人话提示: " + (e.stderr || e.stdout));
    assert.notEqual(e.code, 0);
  } finally {
    blocker.close();
  }
});

test("aha new: scaffold passes all gates before any content fill", async () => {
  const { scaffoldHtml } = await import("../src/new.mjs");
  const { checkHtml } = await import("../src/check.mjs");
  const html = scaffoldHtml("测试概念", "test-concept");
  const res = checkHtml(html);
  const failed = res.gates.filter(g => g.status === "fail");
  assert.deepEqual(failed.map(g => g.id), [], `空槽骨架应过全部门: ${JSON.stringify(failed)}`);
  // 槽标记齐全且唯一
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    assert.ok(html.includes(`SLOT${n}`), `缺 SLOT${n}`);
  }
  assert.ok(html.includes("[SIM-ENGINE]"), "缺引擎");
  assert.ok(html.includes("[TOOLBAR]"), "缺工具条");
  // 第 7 层自测块（门 12）：骨架自带 ≥2 问 + 折叠答案 + 开关脚本
  assert.ok(html.includes("data-quiz"), "缺自测块 data-quiz");
  assert.ok(/data-quiz-answers[^>]*\bhidden\b/.test(html), "自测答案应默认 hidden");
  assert.ok(html.includes("[QUIZ-TOGGLE]"), "缺自测答案开关脚本");
  assert.ok(html.indexOf('class="takeaway"') < html.indexOf("data-quiz"), "自测块应在「记」之后");
  // 数字账本（门 13）：骨架自带 [data-ledger]，占位条目 data-kind 合法，位于自测块之后
  assert.ok(html.includes("data-ledger"), "缺数字账本 data-ledger");
  assert.ok(html.indexOf("data-quiz") < html.indexOf("data-ledger"), "账本应在自测块之后");
  assert.ok(/<li data-kind="(实算|出处|估算)">/.test(html), "账本占位条目应带合法 data-kind");
  // 脚手架注释不得含 SLOT 关键字（SKILL 让生成方 grep「（SLOT」判残留；说明注释不应被误删）
  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
  assert.deepEqual(comments.filter((c) => /（SLOT/.test(c)), [], "HTML 注释里不应出现「（SLOT」占位形式");
  assert.ok(html.includes("aha-design-tokens"), "缺 canonical tokens");
});

test("aha new: every class in the scaffold is defined (tokens CSS or scaffold's own <style>)", async () => {
  // 守卫"模板里的类在 CSS 里不存在"这类静默 bug（曾出现 .hp / .hero-head 未定义）。
  // 门 7 只锁 c-/t-/sim 前缀（锁美学、放布局），布局类靠这条测试守。
  const { scaffoldHtml } = await import("../src/new.mjs");
  const html = scaffoldHtml("测试概念", "test-concept");
  const tokens = readFileSync(new URL("../../../skills/aha/assets/design-tokens.css", import.meta.url), "utf8");
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const css = tokens + "\n" + inlineCss;
  const used = new Set(
    [...html.matchAll(/class=(?:"([^"]*)"|'([^']*)')/g)].flatMap((m) => (m[1] ?? m[2]).split(/\s+/)).filter(Boolean)
  );
  const undefinedClasses = [...used]
    .filter((c) => !/^is-/.test(c)) // is-* 状态类由引擎运行时添加
    .filter((c) => !new RegExp(`\\.${c.replace(/[-]/g, "\\-")}(?![\\w-])`).test(css));
  assert.deepEqual(undefinedClasses, [], `脚手架用了未定义的类: ${undefinedClasses.join(", ")}`);
});

test("-v / --version prints package.json version", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const out = execFileSync(process.execPath, [fileURLToPath(new URL("../src/cli.mjs", import.meta.url)), "-v"], { encoding: "utf8" }).trim();
  assert.ok(out.includes(pkg.version), `输出应含版本号 ${pkg.version}，实际: ${out}`);
});
