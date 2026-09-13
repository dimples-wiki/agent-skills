#!/usr/bin/env node
// @dimples/aha —— aha skill 的 CLI：check / serve / share
import { checkFile } from "./check.mjs";
import { serveCommand, DEFAULT_PORT, startDaemon, stopDaemon } from "./serve.mjs";
import { shareCommand } from "./share.mjs";
import { newCommand } from "./new.mjs";
import { ahaRoot, pagesDir, readConfig, writeConfig, migratePages } from "./home.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = `aha —— 概念图解页面的质量门 / 本地服务 / 公网分享

用法:
  aha check <file.html>      跑 12 道质量门，输出回执（非 0 退出码 = 有门未过）
  aha start [dir] [--port N] 后台守护启动（已运行则换血重启；日志 <页面目录>/.serve.log）
  aha stop  [dir] [--port N] 停止后台守护
  aha serve [dir] [--port N] 前台运行（调试用；默认走配置的页面目录，端口 ${DEFAULT_PORT}）
  aha share [dir] [--port N] serve + cloudflared 临时隧道（trycloudflare.com，免账号）
  aha config [dir]          查看设置;设置 HTML 产物目录(--migrate 迁移存量;--keep-c 留守 C 盘)
                            Windows 首次/存量用户由 aha new 自动引导,选一次即记入配置

示例:
  npx @dimples/aha check ~/.aha/rag.html
  npx @dimples/aha serve
  npx @dimples/aha share

存储布局:
  根目录 ~/.aha 恒存在 —— config.json(动态配置) + bin/(cloudflared) + 守护文件
  HTML 产物目录由 ~/.aha/config.json 的 pagesDir 决定(aha config <dir> 设置;
  默认就是 ~/.aha;环境变量 AHA_HOME 可临时覆盖,优先级最高)`;

/**
 * 解析命令行参数（纯函数，可测试 —— 评审 M11）
 * @param {string[]} argv
 * @returns {{ cmd: string|undefined, positionals: string[], opts: { port?: number, migrate?: boolean, keepC?: boolean } }}
 * @throws 用法错误（含坏端口 —— 评审 B4）
 */
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    let a = rest[i];
    if (a === "--port") {
      a = `--port=${rest[++i] ?? ""}`; // 缺值统一走下面的校验报错（评审 B4）
    }
    if (a.startsWith("--port=")) {
      const raw = a.slice("--port=".length);
      const n = Number(raw);
      if (!raw || !Number.isInteger(n) || n < 0 || n > 65535) {
        throw new Error(`--port 需要一个 0-65535 的整数，收到的是：${raw || "（缺值）"}`);
      }
      opts.port = n;
    } else if (a === "--migrate") {
      opts.migrate = true; // aha config <dir> --migrate:迁移存量页面
    } else if (a === "--keep-c") {
      opts.keepC = true; // aha config --keep-c:明确选择留在 C 盘(不再询问)
    } else if (a.startsWith("--")) {
      throw new Error(`未知选项：${a}`);
    } else {
      positionals.push(a);
    }
  }
  return { cmd, positionals, opts };
}

/** 主入口（可测试）；返回 Promise 以便测试断言 */
export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    console.error(`aha: ${e.message}\n`);
    console.log(HELP);
    process.exit(2);
  }
  const { cmd, positionals, opts } = parsed;

  switch (cmd) {
    case "new":
      return newCommand(positionals[0], positionals[1]);
    case "check":
      if (!positionals[0]) {
        console.error("用法: aha check <file.html>");
        process.exit(2);
      }
      checkFile(positionals[0]);
      break;
    case "serve":
      return serveCommand(positionals[0], opts);
    case "start":
      return startCommand(positionals[0], opts);
    case "stop":
      return stopCommand(positionals[0], opts);
    case "share":
      return shareCommand(positionals[0], opts);
    case "config":
      return configCommand(positionals[0], opts);
    case "--version":
    case "-v":
      console.log(VERSION);
      break;
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`未知命令: ${cmd}\n`);
      console.log(HELP);
      process.exit(2);
  }
}

// 作为脚本直跑时执行；被 import 时不执行。
// 必须用 realpath 比对：npm 安装后 bin 是符号链接，argv[1] 是
// node_modules/.bin/aha —— 用 endsWith("cli.mjs") 判定会把 npx 调用变成静默 no-op（评审 BL1）
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
const invokedAsScript = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (invokedAsScript) {
  main();
}

/** aha start：幂等后台守护 + 书架回执（skill 交付时引用这两行输出） */
export async function startCommand(dirArg, opts = {}) {
  const r = await startDaemon({ dir: dirArg, port: opts.port });
  console.log(!r.reused   ? `aha serve 已在后台运行（pid ${r.pid}，日志 ${r.dir}/.serve.log）`
    : r.pid > 0           ? `aha serve 已在运行（pid ${r.pid}），复用`
    :                       `端口 ${r.port} 上已有 aha serve（非本工具拉起的守护），直接复用`);
  console.log(`  书架 http://127.0.0.1:${r.port} · ${r.count} 篇`);
}

/** aha stop */
export async function stopCommand(dirArg, opts = {}) {
  await stopDaemon({ dir: dirArg, port: opts.port });
  console.log("aha serve 已停止");
}

/**
 * aha config [dir] [--migrate | --keep-c] —— 查看 / 设置 HTML 产物目录。
 * 配置恒存 ~/.aha/config.json(根目录不迁移,服务才能从固定位置读到动态配置);
 * Windows 用户把页面迁出 C 盘的正途:`aha config "D:\aha"`,
 * 存量用户迁移:`aha config "D:\aha" --migrate`;留守 C 盘:`aha config --keep-c`。
 * @param {string | undefined} dirArg
 * @param {{ migrate?: boolean, keepC?: boolean }} [opts]
 */
export function configCommand(dirArg, opts = {}) {
  if (opts.keepC) {
    writeConfig({ ...readConfig(), pagesDir: ahaRoot() });
    console.log(`已选择继续存放在 C 盘:${ahaRoot()}(不再询问)`);
    console.log(`  以后想迁移随时:aha config "<其他盘>:\\aha" --migrate`);
    return;
  }
  if (!dirArg) {
    const env = process.env.AHA_HOME;
    const { pagesDir: configured } = readConfig();
    const source = env && env.trim() ? "环境变量 AHA_HOME"
      : configured && configured.trim() ? `config.json(${join(ahaRoot(), "config.json")})`
      : "默认";
    console.log(`根目录(配置/工具,恒在): ${ahaRoot()}`);
    console.log(`页面目录: ${pagesDir()}  [来源: ${source}]`);
    return;
  }
  const dir = resolve(dirArg.trim());
  mkdirSync(dir, { recursive: true });
  const prev = pagesDir();
  const moved = opts.migrate && prev !== dir ? migratePages(prev, dir) : 0;
  writeConfig({ ...readConfig(), pagesDir: dir });
  console.log(`页面目录已设为: ${dir}`);
  console.log(`  配置文件: ${join(ahaRoot(), "config.json")}(根目录与工具不迁移)`);
  if (opts.migrate) {
    console.log(moved > 0
      ? `  已迁移 ${moved} 篇存量页面(exports/ 一并搬移;正在运行的 aha serve 请重启)`
      : `  无存量页面需要迁移`);
  } else {
    console.log(`  新页面将写入新目录;旧页面不自动搬迁,需要的话加 --migrate 重设`);
  }
}
