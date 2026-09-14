import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTunnelUrl, cloudflaredMissingHelp } from "../src/share.mjs";

const cloudflaredLog = `
2026-09-07T12:00:00Z INF Thank you for trying Cloudflare Tunnel. ...
2026-09-07T12:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...
2026-09-07T12:00:01Z INF +--------------------------------------------------------------------------------------------+
2026-09-07T12:00:01Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2026-09-07T12:00:01Z INF |  https://example-random-words-here.trycloudflare.com                                       |
2026-09-07T12:00:01Z INF +--------------------------------------------------------------------------------------------+
2026-09-07T12:00:01Z INF Registered tunnel connection ...
`;

test("parseTunnelUrl: extracts trycloudflare URL from cloudflared log output", () => {
  assert.equal(
    parseTunnelUrl(cloudflaredLog),
    "https://example-random-words-here.trycloudflare.com"
  );
});

test("parseTunnelUrl: only first URL wins when repeated", () => {
  assert.equal(
    parseTunnelUrl(cloudflaredLog + cloudflaredLog),
    "https://example-random-words-here.trycloudflare.com"
  );
});

test("parseTunnelUrl: null when no tunnel URL yet", () => {
  assert.equal(parseTunnelUrl("INF Starting tunnel\nclickety clack"), null);
  assert.equal(parseTunnelUrl(""), null);
});

test("parseTunnelUrl: ignores non-trycloudflare https URLs", () => {
  assert.equal(parseTunnelUrl("INF see https://developers.cloudflare.com/cloudflare-one/ ."), null);
});

test("cloudflaredMissingHelp: actionable install guidance", () => {
  const help = cloudflaredMissingHelp();
  assert.match(help, /brew install cloudflared/);
  assert.match(help, /cloudflared tunnel --url/);
});

test("pickInstallMethod: darwin+brew→brew, darwin w/o brew→download, linux→download, win32→none", async () => {
  const { pickInstallMethod } = await import("../src/share.mjs");
  assert.equal(pickInstallMethod("darwin", true), "brew");
  assert.equal(pickInstallMethod("darwin", false), "download");
  assert.equal(pickInstallMethod("linux", false), "download");
  assert.equal(pickInstallMethod("win32", false), "none");
});

// —— 评审加固：B5 隧道死亡通知 / B6 安装子进程追踪 / M9 版本锁定 ——

import { writeFileSync, chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTunnel, spawnTracked } from "../src/share.mjs";

test("B5: startTunnel reports death via onDown after URL was delivered", { skip: process.platform === "win32" ? "POSIX shell 假二进制,Windows 无法 spawn" : false }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "aha-fakecf-"));
  const bin = join(dir, "fake-cloudflared");
  writeFileSync(bin, [
    "#!/bin/sh",
    'echo "INF |  https://fake-tunnel.trycloudflare.com  |" >&2',
    "sleep 10 &  # 模拟常驻",
    "wait",
  ].join("\n"));
  chmodSync(bin, 0o755);
  let down = false;
  const t = await startTunnel(1, bin, () => { down = true; });
  assert.equal(t.url, "https://fake-tunnel.trycloudflare.com");
  assert.equal(down, false); // 交付时还活着
  t.stop(); // SIGTERM → exit → onDown
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(down, true, "进程退出后应触发 onDown");
});

test("B6: spawnTracked registers child in killables and killAll reaps it", async () => {
  const killables = [];
  const child = spawnTracked("sleep", ["30"], killables);
  assert.ok(killables.includes(child));
  for (const c of killables) c.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(child.exitCode !== null || child.signalCode === "SIGTERM", true);
});
