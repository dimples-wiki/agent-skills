#!/usr/bin/env node
/**
 * Windows 真机端到端(仅 windows-latest + subst 造出的 D: 盘上跑,见
 * .github/workflows/aha-cli-test.yml;本地/其他平台直接跳过):
 *   A. 首次引导:全新 HOME → new 被拦(exit 2)并建议 D:\aha → config 设置 → 重跑成功落 D:
 *   B. 存量用户:有旧页面 → new 被拦给迁移/留守二选一 → --keep-c → 重跑成功留守原目录
 *   C. 迁移:--migrate 把存量 *.html + exports/ 搬到 D:,config/工具留原地 → new 落新目录
 * 通过 USERPROFILE 重定向 HOME,不碰 runner 真实用户目录。
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("skip: windows-e2e only runs on win32");
  process.exit(0);
}
if (!existsSync("D:\\")) {
  console.error("skip: D: 未映射(需要 workflow 里 subst D: C:\\fakedrive)");
  process.exit(0);
}

const cli = resolve(fileURLToPath(import.meta.url), "../../src/cli.mjs");
const base = process.env.AHA_TEST_HOME ?? "C:\\aha-test-home";
let failed = 0;
const fails = [];
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "  ✔" : "  ✖"} ${msg}${cond || !detail ? "" : `\n     └ ${detail}`}`);
  if (!cond) { failed++; fails.push(`${msg} || ${(detail || "").split("\n").slice(0, 3).join(" ⏎ ").slice(0, 220)}`); }
};
/** 在指定伪 HOME 下跑真实 CLI;失败时附带完整输出便于无日志诊断 */
const run = (home, ...args) => {
  const r = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, USERPROFILE: home, AHA_HOME: "" },
  });
  const out = (r.stdout || "") + (r.stderr || "");
  return { code: r.status, out, detail: `exit=${r.status} argv=${JSON.stringify(args)}\n${out.slice(0, 500)}` };
};
const freshHome = (name, withLegacy = false) => {
  const home = join(base, name);
  rmSync(home, { recursive: true, force: true });
  if (withLegacy) {
    mkdirSync(join(home, ".aha"), { recursive: true });
    writeFileSync(join(home, ".aha", "old-page.html"), "<!DOCTYPE html><html lang=zh><title>旧页</title></html>");
    mkdirSync(join(home, ".aha", "exports"));
    writeFileSync(join(home, ".aha", "exports", "old-page.md"), "# 旧页");
  }
  return home;
};

console.log("A. 首次使用 → 必选位置 → 设置后重跑成功");
{
  const home = freshHome("a-first");
  const blocked = run(home, "new", "t1", "概念一");
  ok(blocked.code === 2, `首次 new 被拦(exit ${blocked.code})`, blocked.detail);
  ok(/推荐:\s*D:\\aha/.test(blocked.out), "建议了 D:\\aha");
  ok(/aha config "D:\\aha"/.test(blocked.out), "给出设置命令");
  ok(!existsSync(join(home, ".aha", "t1.html")), "未擅自生成页面");
  const set = run(home, "config", "D:\\aha");
  ok(set.code === 0 && /页面目录已设为/.test(set.out), "config 设置成功", set.detail);
  const again = run(home, "new", "t1", "概念一");
  ok(again.code === 0 && again.out.includes("D:\\aha\\t1.html"), "重跑落盘 D:\\aha\\t1.html");
  ok(existsSync("D:\\aha\\t1.html"), "D: 盘上文件真实存在");
}

console.log("B. 存量用户 → 二选一 → 留守 C 盘");
{
  const home = freshHome("b-keep", true);
  const blocked = run(home, "new", "t2", "概念二");
  ok(blocked.code === 2, "存量 new 被拦", blocked.detail);
  ok(/1 篇存量页面/.test(blocked.out) && /--migrate/.test(blocked.out) && /--keep-c/.test(blocked.out), "给出迁移/留守二选一");
  const keep = run(home, "config", "--keep-c");
  ok(keep.code === 0, "--keep-c 记录选择", keep.detail);
  const cfg = JSON.parse(readFileSync(join(home, ".aha", "config.json"), "utf8"));
  ok(cfg.pagesDir === join(home, ".aha"), "config 记录留守当前目录");
  const again = run(home, "new", "t2", "概念二");
  ok(again.code === 0 && again.out.includes(join(home, ".aha", "t2.html")), "重跑留守原目录");
  ok(existsSync(join(home, ".aha", "old-page.html")), "存量页面未动");
}

console.log("C. 存量用户 → 迁移到 D:");
{
  const home = freshHome("c-migrate", true);
  const set = run(home, "config", "D:\\aha2", "--migrate");
  ok(set.code === 0 && /已迁移 1 篇/.test(set.out), "--migrate 报出迁移篇数", set.detail);
  ok(existsSync("D:\\aha2\\old-page.html"), "HTML 已到 D:");
  ok(existsSync("D:\\aha2\\exports\\old-page.md"), "exports/ 一并迁移");
  ok(existsSync(join(home, ".aha", "config.json")), "config.json 留在根目录");
  ok(!existsSync(join(home, ".aha", "old-page.html")), "旧目录 HTML 已清");
  const again = run(home, "new", "t3", "概念三");
  ok(again.code === 0 && again.out.includes("D:\\aha2\\t3.html"), "新页面落迁移后目录");
}

// 失败明细打成 GitHub 注解(::error::)—— Actions 日志匿名不可读,注解公开可读
for (const f of fails.slice(0, 8)) console.log(`::error title=aha-e2e::${f}`);
console.log(failed === 0 ? "\nwindows-e2e: 全部通过" : `\nwindows-e2e: ${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
