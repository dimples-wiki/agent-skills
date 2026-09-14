#!/usr/bin/env node
// @dimples/aha · share —— cloudflared quick tunnel 公网分享（零依赖）
//
// 两条使用路径：
//   CLI:  aha share —— 检测/安装 cloudflared → serve → 隧道 → 打印链接
//   Web:  serve 索引页/页面工具条的分享按钮 → /api/share → webTunnelFactory（同逻辑）
// quick tunnel 免账号、临时有效；进程退出链接即失效。
//
// 隧道生命周期契约（评审 B5）：URL 交付后 cloudflared 若死亡，必须通过
// onDown 通知调用方 —— CLI 路径退出并报错，Web 路径把状态翻成 error，
// 绝不允许"页面显示活链接、隧道实际已死"。
// 安装子进程契约（评审 B6）：brew/tar 等安装子进程登记进 killables，
// 由 serve 的 close() 一并回收，杜绝安装期孤儿。

import { spawn, spawnSync, execFile } from "node:child_process";
import { writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ahaRoot } from "./home.mjs";
import { join } from "node:path";
import { startServer, DEFAULT_PORT, friendlyListenError, resolveServeDir } from "./serve.mjs";

/** 下载锁定版本（评审 M9：不追 latest，升级时改这里并回归 share 冒烟） */
const CLOUDFLARED_VERSION = "2026.8.3";

/** 从 cloudflared 输出中解析 quick tunnel 公网 URL；没有则 null */
export function parseTunnelUrl(log) {
  const m = String(log).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return m ? m[0] : null;
}

/** cloudflared 未安装且无法自动安装时的指引（不静默失败；含 Windows） */
export function cloudflaredMissingHelp() {
  return [
    "aha share 需要 cloudflared（Cloudflare 官方 CLI，免费，无需账号）：",
    "  macOS:   brew install cloudflared",
    "  Linux:   参见 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
    "  Windows: winget install --id Cloudflare.cloudflared （或 choco install cloudflared）",
    "  手动验证: cloudflared tunnel --url http://localhost:7332",
  ].join("\n");
}

/** 安装策略：darwin+brew 走 brew；darwin/linux 其余走官方二进制下载；Windows 只给指引 */
export function pickInstallMethod(platform = process.platform, hasBrew = null) {
  if (platform === "win32") return "none"; // 自动安装不支持 Windows，指引代替（评审 M8）
  if (platform === "darwin") return hasBrew === false ? "download" : "brew";
  if (platform === "linux") return "download";
  return "none";
}

const isWin = () => process.platform === "win32";
const localBin = () =>
  isWin() ? join(ahaRoot(), "bin", "cloudflared.exe")
          : join(ahaRoot(), "bin", "cloudflared");

/** cloudflared 可执行文件解析：PATH 优先，其次 ~/.aha/bin/；找不到返回 null */
export function resolveCloudflared() {
  const binName = isWin() ? "cloudflared.exe" : "cloudflared";
  if (spawnSync(binName, ["--version"]).status === 0) return binName;
  if (existsSync(localBin()) && spawnSync(localBin(), ["--version"]).status === 0) return localBin();
  return null;
}

function hasBrew() {
  return !isWin() && spawnSync("brew", ["--version"]).status === 0;
}

/**
 * 追踪型子进程：登记进 killables，供宿主（serve.close）统一回收（评审 B6）
 * @returns {import("node:child_process").ChildProcess}
 */
export function spawnTracked(cmd, args, killables = []) {
  const child = execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 });
  killables.push(child);
  return child;
}

const run = (cmd, args, killables) =>
  new Promise((resolveP, rejectP) => {
    const child = spawnTracked(cmd, args, killables);
    child.on("error", rejectP);
    child.on("exit", (code) => (code === 0 ? resolveP() : rejectP(new Error(`${cmd} 退出码 ${code}`))));
  });

/**
 * 确保 cloudflared 可用：已装直接返回；没装则按平台自动安装
 * （brew 或 GitHub Releases 官方二进制下载到 ~/.aha/bin，版本锁定）。
 * @param {(msg: string) => void} [onLog] 进度回调（Web UI 用来显示"安装中…"）
 * @param {import("node:child_process").ChildProcess[]} [killables] 安装子进程登记表
 * @returns {Promise<{ ok: boolean, bin?: string, method?: string, error?: string }>}
 */
export async function ensureCloudflared(onLog = () => {}, killables = []) {
  const found = resolveCloudflared();
  if (found) return { ok: true, bin: found, method: "existing" };

  const method = pickInstallMethod(process.platform, hasBrew());
  try {
    if (method === "brew") {
      onLog("brew install cloudflared（首次约一分钟）…");
      await run("brew", ["install", "cloudflared"], killables);
    } else if (method === "download") {
      const plat =
        process.platform === "darwin"
          ? process.arch === "arm64" ? "darwin-arm64" : "darwin-amd64"
          : process.arch === "arm64" ? "linux-arm64" : "linux-amd64";
      const binDir = join(ahaRoot(), "bin");
      const tgz = join(binDir, `cloudflared-${plat}.tgz`);
      onLog(`下载 cloudflared ${CLOUDFLARED_VERSION}（${plat}）…`);
      await mkdir(binDir, { recursive: true });
      const res = await fetch(
        `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-${plat}.tgz`
      );
      if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
      await writeFile(tgz, Buffer.from(await res.arrayBuffer()));
      await run("tar", ["-xzf", tgz, "-C", binDir], killables); // tar 为系统自带
      await chmod(localBin(), 0o755);
    } else {
      return { ok: false, error: "此平台不支持自动安装，请按指引手动安装" };
    }
  } catch (e) {
    return { ok: false, error: `自动安装失败：${e.message}` };
  }
  const bin = resolveCloudflared();
  return bin ? { ok: true, bin, method } : { ok: false, error: "安装后仍找不到 cloudflared" };
}

/**
 * 启动 quick tunnel，等 URL 出现（最多 30s）。
 * URL 交付后 cloudflared 若退出（外部 kill / 崩溃 / stop()）→ onDown() 通知（评审 B5）。
 * @param {number} port
 * @param {string} bin
 * @param {() => void} [onDown]
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
export function startTunnel(port, bin = "cloudflared", onDown = () => {}) {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(bin, ["tunnel", "--url", `http://127.0.0.1:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let downNotified = false;
    let log = "";
    const notifyDown = () => {
      if (settled && !downNotified) { downNotified = true; try { onDown(); } catch {} }
    };
    const timer = setTimeout(() => {
      cleanup();
      child.kill("SIGTERM");
      rejectP(new Error(`30s 内未取得隧道链接。cloudflared 输出：${log.slice(-400)}`));
    }, 30000);
    const onData = (chunk) => {
      log += chunk;
      const url = parseTunnelUrl(log);
      if (url && !settled) {
        settled = true;
        cleanup();
        resolveP({ url, pid: child.pid, stop: () => child.kill("SIGTERM") });
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.stderr.off("data", onData);
      child.stdout.off("data", onData);
    };
    child.stderr.on("data", onData);
    child.stdout.on("data", onData);
    child.on("exit", () => {
      cleanup();
      if (!settled) {
        rejectP(new Error(`隧道提前退出。cloudflared 输出：${log.slice(-400)}`));
      } else {
        notifyDown(); // 已交付后死亡：必须上报，不许静默（评审 B5）
      }
    });
  });
}

/**
 * Web/API 用的隧道工厂：installing → starting → {url, stop}。
 * @param {number} port
 * @param {{ onStatus?: (phase: 'installing'|'starting', msg?: string) => void,
 *           onDown?: () => void, bin?: string,
 *           killables?: import("node:child_process").ChildProcess[] }} [opts]
 */
export async function webTunnelFactory(port, opts = {}) {
  const { onStatus = () => {}, onDown = () => {}, bin: binOverride, killables = [] } = opts;
  const bin = binOverride ?? (await ensureCloudflared((m) => onStatus("installing", m), killables)).bin;
  if (!bin) throw new Error("cloudflared 不可用");
  onStatus("starting", "建立隧道…");
  return startTunnel(port, bin, onDown);
}

/** CLI 入口 */
export async function shareCommand(dirArg, opts = {}) {
  const killables = [];
  const ensured = await ensureCloudflared((m) => console.error(`aha share: ${m}`), killables);
  if (!ensured.ok) {
    console.error(`aha share: ${ensured.error}`);
    console.error(cloudflaredMissingHelp());
    process.exit(2);
  }

  let dir;
  try {
    dir = resolveServeDir(dirArg); // 评审 BL2：share 与 serve 同一目录语义（默认 ~/.aha、拒绝不存在/非目录）
  } catch (e) {
    console.error(`aha share: ${e.message}`);
    process.exit(2);
  }
  let server;
  try {
    server = await startServer({ dir, port: Number(opts.port ?? DEFAULT_PORT) });
  } catch (e) {
    console.error(friendlyListenError(e, opts.port ?? DEFAULT_PORT));
    process.exit(1);
  }
  console.log(`aha share · 本地服务 http://127.0.0.1:${server.port}，正在建立隧道…`);

  let tunnel;
  try {
    tunnel = await startTunnel(server.port, ensured.bin, () => {
      console.error("aha share: 隧道已断开（cloudflared 退出）。");
      process.exit(1);
    });
  } catch (e) {
    console.error(`aha share: ${e.message}`);
    process.exit(1);
  }

  console.log(`\n  公网链接（临时，Ctrl-C 结束后失效）：`);
  console.log(`  →  ${tunnel.url}\n`);

  const cleanup = () => {
    tunnel.stop();
    server.close();
    for (const c of killables) c.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
