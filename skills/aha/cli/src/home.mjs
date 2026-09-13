import { join, resolve } from "node:path";
import { homedir } from "node:os";
import * as fs from "node:fs";
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, cpSync, unlinkSync, accessSync, constants } = fs;

/** 本 CLI 配套的 skill 版本 —— 必须与 skills/aha/SKILL.md frontmatter 的
 *  metadata.version 一致(单测强制同步);new 据此提示 agent 自查升级 */
export const SKILL_VERSION = "1.3.2";

/** skill 升级命令(与安装同一条,skills CLI 幂等覆盖) */
export const SKILL_UPGRADE_CMD = "npx skills add dimples-wiki/agent-skills -s aha -y";

/**
 * aha 根目录 —— 恒为 ~/.aha,始终存在:
 * 存放 config.json(动态配置)、bin/(cloudflared)、.serve.pid/.serve.log。
 * 不随页面目录迁移而移动 —— 服务启动时从这里读配置,才能找到别处的页面。
 * @returns {string}
 */
export function ahaRoot() {
  return join(homedir(), ".aha");
}

/** @typedef {{ pagesDir?: string }} AhaConfig */

/**
 * 读 ~/.aha/config.json;不存在/损坏 → 空配置(缺省语义),损坏时下次写入自愈。
 * 旧版本无此文件 = 全兼容(全部走默认,零迁移)。
 * 刻意不在 start/serve 时回填:回填只是复读默认值,还会把"未决定"误标成
 * "已决定"(config 里出现 pagesDir),Windows 用户在 aha new 的存储选择
 * 引导就永远不触发了 —— 文件只在用户显式选择时落盘(aha config)。
 * @param {string} [root] 测试注入用
 * @returns {AhaConfig}
 */
export function readConfig(root = ahaRoot()) {
  const file = join(root, "config.json");
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {}; // 损坏视同未配置:回默认,下次写入时自愈
  }
}

/**
 * 写 ~/.aha/config.json(根目录不存在则创建)。
 * @param {AhaConfig} config
 * @param {string} [root] 测试注入用
 */
export function writeConfig(config, root = ahaRoot()) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "config.json"), JSON.stringify(config, null, 2) + "\n");
}

/**
 * HTML 产物目录解析,优先级:
 *   1. 环境变量 AHA_HOME(CI/测试逃生门,社区惯例:env 覆盖文件)
 *   2. ~/.aha/config.json 的 pagesDir(用户迁移 Windows C 盘的正途)
 *   3. 默认 = 根目录本身(向后兼容:老用户的页面就住在 ~/.aha)
 * @param {string} [root] 测试注入用
 * @returns {string}
 */
export function pagesDir(root = ahaRoot()) {
  const env = process.env.AHA_HOME;
  if (env && env.trim()) return resolve(env.trim());
  const { pagesDir: configured } = readConfig(root);
  if (configured && configured.trim()) return resolve(configured.trim());
  return root;
}

/**
 * 确保产物目录存在(自动创建);Windows 首次创建时提示迁移方式,之后零噪音。
 * @param {string} [dir] 显式目录(测试注入用;缺省走 AHA_HOME / config / ~/.aha)
 * @returns {string} 产物目录
 */
export function ensurePagesDir(dir = pagesDir()) {
  const first = !existsSync(dir);
  mkdirSync(dir, { recursive: true });
  if (first && process.platform === "win32") {
    // stderr:stdout 留给 skill 引用的回执两行,不被提示污染
    console.error(`aha 页面目录已创建:${dir}`);
    console.error('如需放到其他盘(默认在 C 盘):aha config "D:\\aha"(旧页面需自行迁移)');
  }
  return dir;
}

/** 数目录里的 HTML 篇数;目录不存在视同 0(全新用户没有 ~/.aha —— CI 实测踩过) */
export function countHtmlPages(dir) {
  try { return readdirSync(dir).filter((n) => n.endsWith(".html")).length; }
  catch { return 0; }
}

/**
 * Windows 存储选择决策(纯函数,可测试):new 命令调用,决定是否要拦下让用户选。
 *   "none"    正常放行(非 Windows / 已有明确配置 / 只有 C 盘没得选 / 环境变量已指定)
 *   "first"   首次使用(默认目录无 HTML)→ 必须选一个存储位置
 *   "migrate" 有存量页面(默认目录有 HTML)→ 选迁移或留守
 * @param {{ platform?: string, envSet?: boolean, configured?: boolean, htmlCount?: number, hasAltDrive?: boolean }} s
 * @returns {"none" | "first" | "migrate"}
 */
export function storageChoice(s = {}) {
  const {
    platform = process.platform,
    envSet = Boolean(process.env.AHA_HOME && process.env.AHA_HOME.trim()),
    configured = Boolean(readConfig().pagesDir),
    htmlCount = countHtmlPages(ahaRoot()),
    hasAltDrive = suggestNonCDrive() !== null,
  } = s;
  if (platform !== "win32") return "none";
  if (envSet || configured || !hasAltDrive) return "none";
  return htmlCount === 0 ? "first" : "migrate";
}

/**
 * 建议的非 C 盘目录:按 D→Z 找第一个存在、可写、剩余空间 ≥1GiB 的盘,
 * 返回如 "D:\\aha";找不到(只有 C 盘)返回 null。
 * 不做更激进的猜测 —— 盘符存在且宽敞才算"值得建议"。
 * statfs 需 Node ≥18.15,缺失时退化为"存在即可写"。
 * @returns {string | null}
 */
export function suggestNonCDrive() {
  if (process.platform !== "win32") return null;
  const hasStatfs = typeof fs.statfsSync === "function";
  for (let code = 68; code <= 90; code++) { // D..Z
    const drive = String.fromCharCode(code) + ":\\";
    if (!existsSync(drive)) continue;
    try {
      accessSync(drive, constants.W_OK);
      if (hasStatfs) {
        const st = fs.statfsSync(drive);
        if (st.bavail * st.bsize < 1024 ** 3) continue; // 剩余 <1GiB → 不建议
      }
      return String.fromCharCode(code) + ":\\aha";
    } catch { /* 不可写 → 换下一个 */ }
  }
  return null;
}

/**
 * 迁移存量页面:把 from 下的 *.html 与 exports/ 挪到 to(跨盘也能搬:
 * rename 失败退化为 copy+delete)。返回迁移的 HTML 篇数。
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
export function migratePages(from, to) {
  mkdirSync(to, { recursive: true });
  const names = readdirSync(from).filter((n) => n.endsWith(".html"));
  for (const n of names) {
    const src = join(from, n), dst = join(to, n);
    try { renameSync(src, dst); }
    catch { cpSync(src, dst); unlinkSync(src); } // 跨盘 EXDEV
  }
  const exportsDir = join(from, "exports");
  if (existsSync(exportsDir)) {
    cpSync(exportsDir, join(to, "exports"), { recursive: true });
    for (const n of readdirSync(exportsDir)) unlinkSync(join(exportsDir, n));
  }
  return names.length;
}
