import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
const __dirname = dirname(new URL(import.meta.url).pathname);
import { storageChoice, migratePages, suggestNonCDrive, SKILL_VERSION } from "../src/home.mjs";
import { windowsStorageGuard } from "../src/new.mjs";

const tmp = mkdtempSync(join(tmpdir(), "aha-home2-"));

test("storageChoice: decision table (platform / data / drives / config)", () => {
  const s = { platform: "win32", htmlCount: 0, hasAltDrive: true };
  assert.equal(storageChoice({ ...s }), "first", "Windows 首次(无 HTML)→ 必选位置");
  assert.equal(storageChoice({ ...s, htmlCount: 3 }), "migrate", "Windows 存量 → 迁移或留守");
  assert.equal(storageChoice({ ...s, hasAltDrive: false }), "none", "只有 C 盘 → 没得选,放行");
  assert.equal(storageChoice({ ...s, configured: true }), "none", "已有配置 → 不再打扰");
  assert.equal(storageChoice({ ...s, envSet: true }), "none", "环境变量(CI)→ 放行");
  assert.equal(storageChoice({ ...s, platform: "darwin" }), "none", "非 Windows → 完全不参与");
});

test("migratePages: moves html files and exports/, leaves config alone", () => {
  const from = mkdtempSync(join(tmp, "mig-from-"));
  const to = mkdtempSync(join(tmp, "mig-to-"));
  writeFileSync(join(from, "a.html"), "<html></html>");
  writeFileSync(join(from, "b.html"), "<html></html>");
  writeFileSync(join(from, "config.json"), "{}"); // 不是页面,不迁
  mkdirSync(join(from, "exports"));
  writeFileSync(join(from, "exports", "a.md"), "# a");
  const n = migratePages(from, to);
  assert.equal(n, 2, "迁移 2 篇 HTML");
  assert.deepEqual(readdirSync(to).filter((f) => f.endsWith(".html")).sort(), ["a.html", "b.html"]);
  assert.ok(existsSync(join(to, "exports", "a.md")), "exports/ 一并迁移");
  assert.ok(existsSync(join(from, "config.json")), "配置/工具留在原地");
  assert.equal(readdirSync(from).filter((f) => f.endsWith(".html")).length, 0, "旧目录 HTML 清空");
});

test("suggestNonCDrive: non-Windows returns null (guard only)", () => {
  if (process.platform !== "win32") assert.equal(suggestNonCDrive(), null);
});

test("new: slug sanitization — strip full dash runs, reject non-ASCII-only slugs", async () => {
  const { newCommand } = await import("../src/new.mjs");
  const clean = (s) => s.replace(/[^a-z0-9-]/gi, "-").replace(/^-+|-+$/g, "");
  assert.equal(clean("transformer-attention"), "transformer-attention");
  assert.equal(clean("Transformer 注意力"), "Transformer", "尾部连字符整段剥掉");
  assert.equal(clean("傅里叶变换"), "", "纯中文清洗后为空 → 用法错而非垃圾文件名");
  // 真跑一次:纯中文 slug 退出码 2(不落任何文件)
  const pagesDir = process.env.AHA_HOME;
  process.env.AHA_HOME = mkdtempSync(join(tmp, "aha-slug-"));
  try {
    let code = 0;
    const origExit = process.exit;
    process.exit = (c) => { code = c; throw new Error("__exit__"); };
    const origErr = console.error;
    console.error = () => {};
    try { newCommand("傅里叶变换", "傅里叶变换"); }
    catch (e) { assert.equal(e.message, "__exit__"); }
    finally { process.exit = origExit; console.error = origErr; }
    assert.equal(code, 2, "纯中文 slug → 用法错退出码 2");
    assert.equal(readdirSync(process.env.AHA_HOME).length, 0, "不应产生垃圾文件");
    // 正常 ASCII slug 落盘
    const page = newCommand("slug-test-1", "标题");
    assert.ok(page.endsWith("slug-test-1.html"));
    assert.ok(existsSync(page));
  } finally {
    if (pagesDir === undefined) delete process.env.AHA_HOME; else process.env.AHA_HOME = pagesDir;
  }
});

test("windowsStorageGuard: renders both prompt variants, blocks with true", () => {
  const errs = [];
  const orig = console.error;
  console.error = (...a) => errs.push(a.join(" "));
  try {
    errs.length = 0;
    assert.equal(windowsStorageGuard("none"), false, "none → 放行不输出");
    assert.equal(errs.length, 0);

    assert.equal(windowsStorageGuard("first", "E:\\aha"), true, "first → 拦下");
    assert.match(errs.join("\n"), /推荐:E:\\aha/, "给出非 C 盘建议");
    assert.match(errs.join("\n"), /aha config "E:\\aha"/, "给出设置命令");

    errs.length = 0;
    assert.equal(windowsStorageGuard("migrate", "E:\\aha", 16), true, "migrate → 拦下");
    const out = errs.join("\n");
    assert.match(out, /16 篇存量页面/, "报出存量篇数");
    assert.match(out, /--migrate/, "选项 1 = 迁移");
    assert.match(out, /--keep-c/, "选项 2 = 留守 C 盘");
  } finally {
    console.error = orig;
  }
});

// SKILL_VERSION 与 SKILL.md metadata.version 必须一致(发布防漂移)
test("SKILL_VERSION 与 SKILL.md 同步", () => {
  const md = readFileSync(join(__dirname, "../../../skills/aha/SKILL.md"), "utf8");
  const v = md.match(/version:\s*([\d.]+)/)?.[1];
  assert.ok(v, "SKILL.md 应含 metadata.version");
  assert.equal(SKILL_VERSION, v, `CLI SKILL_VERSION=${SKILL_VERSION} 应等于 SKILL.md 的 ${v}`);
});
