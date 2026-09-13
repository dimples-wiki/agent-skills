---
name: aha
description: Use when the user wants to truly understand a concept rather than get a quick answer — triggers include "aha", "讲懂 X", "讲讲 X", "X 到底是什么 / 怎么工作的", "X 和 Y 有什么区别", or any request for a visual / diagram explanation. Produces a standalone HTML explainer page that builds a correct mental model. Not for one-line answers, expert-first deep dives, or rewriting existing documentation.
license: ISC
metadata:
  version: 1.2.0
  tags:
    - explanation
    - visualization
    - education
    - html
---

# AHA · 概念图解

把任意复杂概念讲成一份**渐进分层、大图少字、可交互**的独立 HTML 页面。
目标是建立**正确的心智模型** —— 不是模仿幼儿说话，不是让人"觉得懂了"，
而是让人"真的懂了"。

## When to Use

**用：** 用户想真正理解某概念（"讲讲 X""X 到底是什么""X 和 Y 有什么区别"）、
要求图解 / 可视化 / 做一页解释（含 aha）、想给别人分享一份概念讲解。

**便宜预检**：两三句话能答清的问题直接答，不起本 skill ——
完整的图解页是为"值得读五分钟"的概念准备的。

**不用：** 超短摘要、一句话回答；专家向深潜（读者本来就会，缺的不是解释）；
改写既有文档（那是文档编辑任务）。

## 立场（先读这个）

1. **用户的明确要求 > 本 skill 的默认建议。** 用户指定语言、受众、文件位置、
   讲解范围或动效偏好时，按用户的执行。
2. 语言跟随用户提问的语言。
3. 简化不得牺牲准确性：说不准的事实不编精确数字，注明推断与未验证的部分。
4. 读者是**聪明的、只是不熟悉这个领域的人** —— 尊重他们，不居高临下，
   禁用"很简单""显然""只要……就行"。

## 七层骨架（固定，内容可取舍）

每层的顺序、要求与常数都有学习科学依据，见 `references/theory.md`
（**改层、改顺序、改常数前必读**；日常生成不用读）。

| # | 层 | 必须做到 | 依据 |
|---|-----|----------|------|
| 1 | 一句话核心 | 首屏：概念名 + 一句话说清 + 主视觉 + 起点徽章 | 先行组织者（Ausubel） |
| 2 | 为什么存在 | before/after 对比：没有它时怎么办、痛点是什么 | 先感知问题再讲解（Schwartz & Bransford） |
| 3 | 直觉 | 一个类比 + **失效边界**（不写失效点的类比不许上页） | 结构映射（Gentner）；单类比必误导（Spiro） |
| 4 | 真实机制 | 大白话先行，术语后置且全文含义一致；**至少一个带真实值的具体实例**；核心机制有图形载体；流程类配**步骤模拟器** | 具体先于抽象（Bruner）；双重编码 + 分段（Paivio；Mayer）；样例效应（Sweller） |
| 5 | 容易混淆 | 按"各自**改变什么**"对比 2-3 个邻居概念，每卡有"输出："行 | 变异理论（Marton） |
| 6 | 边界与失败 | 失败模式配 1-2 字记忆标签（同页长度一致）；误区用三段式**「你可能以为 X → 其实 Y → 分界在 Z」** | 概念转变（Posner）；反驳式文本（Tippett） |
| 7 | 记 + 自测 + 账本 | 一句话公式式收尾，关键词 `<mark>` 2-6 处，不引入新概念；随后 **2-3 个自测问题，答案默认折叠**（至少一问针对类比失效点、一问让读者预测反例结果）；页尾**数字账本**列出比例类数字的来源 | 测试效应（Roediger & Karpicke）；流畅度错觉（Bjork）；论证依据层（Toulmin） |

**菜单，不是模板**：按主题取舍 —— 不是每层都要写满；某层对这个主题没价值
就不写，但第 1、4、7 层永远要有。反过来，**不得为了凑层加没有解释价值的内容**。

## 起点校准（渐进式的实现）

| 级别 | 信号 | 动作 |
|------|------|------|
| L1 零基础 | 纯白话提问 | 标准起点，类比从生活经验取 |
| L2 相邻背景 | 提问露出相邻领域身份（"我写 Rust 的，讲讲 GC"） | 用相邻领域做桥接类比，跳过最基础铺垫 |
| L3 已入门 | 已正确使用本领域术语（"梯度下降"用得准） | 起点上移，跳过基础类比，直入机制与边界 |

**校准只调起点与类比选择，永不删层。** 判断错了，读者往下读一层就自愈；
但砍掉内容是不可挽回的。用户显式指定受众时，覆盖一切信号。
页首徽章透明标注，且**必须点明依据**（`起点 L2 · 有相邻背景：统计基础`
`起点 L3 · 术语使用准确：hidden state`），L2 页同时点明桥接来源
（pill："桥接自：Rust 所有权" —— 不写"你熟悉的"，页面会被分享给其他读者）。

## 关键契约

**类比边界** —— 每个类比：① 只讲一个映射；② 标注在哪里失效，
且失效点中至少一条要指向**类比所掩盖的真实机制**
（如手套类比掩盖了"结果测量前不存在"、房卡类比掩盖了"静态判定 vs 动态巡视"）；
③ 建立直觉后仍要讲真实机制，类比不能替代机制。

**具体实例** —— 第 4 层至少一个带真实值的实例（4 个采样点手算一次 DFT、
D↔E 成环从根走不到）。大白话降低语言门槛，实例才让抽象落地，两者不可互相替代。

**数字纪律 + 数字账本** —— 关键数字当场复算或给出处；同一句不得混用不同量纲的比例
（坡度比 ≠ 曲率比、倍数 ≠ 百分点）；图形若做了非等比拉伸，caption 必须注明。
页尾账本（脚手架自带 `[data-ledger]`）：正文里**每个 `N%` / `N 倍`** 都要有一条，
`data-kind` 三选一 —— `实算`（页内可复算，写算式）/ `出处`（外部来源，写名字）/
`估算`（示意值，写假设）；其他关键数字（时长、容量、次数）也建议入账。
没有比例类数字就删掉全部条目、保留块。"看起来像事实错误"的表述比模糊更糟 ——
这套页面的信誉押在每个数字都经得起复算上；**账本缺条目时补来源，不是删数字**。

**自测题** —— 问题不能靠复述第 7 层公式回答；答案 ≤80 字/问，默认折叠；
只改脚手架里的文字，不改 `data-quiz*` 与 `hidden`（门 12 靠它们判定）。

**形式选择映射**（选错形式 = 白画）：

| 要表达 | 用 |
|--------|-----|
| 结构 / 层级 | 结构图（标注清晰的自绘 SVG） |
| 关系 / 对比 | 对比卡片（comparison-cards） |
| 流程 / 数据流（静态即可懂） | 流程图（flow-diagram） |
| 随时间发生的过程 | **步骤模拟器**（simulator） |
| 状态变化 | 状态图或有意义的动画 |
| 连续场 / 波 / 流 | 静态 SVG 示意；（选配）vgpu 展示层 |

**大图少字**：每节一个视觉中心；文字只留标题、关键标签、必要解释与边界。
**禁止把长篇正文拆成多个文字卡片伪装成视觉化。**
第 4 层的核心机制（对象图 / 交换过程 / 混合过程）至少要有一个图形载体 ——
"判活看根""混颜料"这类核心概念不允许只活在旁白文字里；
视觉性强的类比（调颜料、滚雪球）优先配图而非纯文字。

**动画体面**：动画必须表现内容或状态的真实变化，不许只让成品闪烁/脉冲/高亮；
非首屏动画进视口自动播一次，保留暂停/逐步/重播；`prefers-reduced-motion`
直出静态结果；每个动画都有可读的静态版本。

**因果链**：输入或条件 → 发生什么 → 输出或影响。优先讲清少量相互连接的概念，
不罗列事实；不为"简短"删掉会改变含义的关键限定。

**形式硬规则**：
- 单文件自包含，渲染零远程依赖（tokens/引擎/工具条/自测块/账本已由 CLI 注入）
- 取色只能 `var(--token)`，tokens 块外禁止 hex/rgb/hsl；
  SVG 取色 `var(--cat-a/b/c)` / `var(--accent)` / `var(--warn)` / `var(--ok)`
- **页面局部布局样式允许且常需要**（before/after 网格、手算表、SVG 尺寸等）：
  集中放在 `<head>` 里一个新增的 `<style>`，只用 `var()`；不改 tokens 块，
  不改 `[SCAFFOLD-STYLE]`。tokens 已提供的类（`.card .callout .compare
  .fails .flow .pipe .analogy .panel .pill .grid-2/3`）优先复用
- 模拟器的 `.sim-node` 可按需增删（引擎遍历全部 `[data-node]`），值需唯一
- 语义 HTML：恰好一个 `<h1>`，标题不跳档，img 必带 alt
- 模拟器标签跟随页面语言（专有标识符 ClientHello/Q·Kᵀ 除外）
- 正文不得有"你问的"等提问者指代（页面会被分享给未提问的读者）

## 工作流（三步）

> 模型推理是主要耗时（写约 220 行高质量解释，实测分钟级），工具调用不到 1 分钟。
> 能砍的只有读文件（已归零）、浏览器验证（默认跳过）、探索性命令（禁止）。
> CLI 做施工（样板注入/check/serve），你只做内容创意。

### Step 1 · 跑一条命令

命令输出的第一行（stderr）会标注**配套 skill 版本**：与你读到的这份
SKILL.md 开头 `metadata.version` 比对 —— 不低于它就直接继续；低于它说明
skill 是旧版，先执行输出里给的升级命令（`npx skills add ...`，幂等覆盖），
**升级后必须重新读取 SKILL.md 再从 Step 1 重来**（本次生成作废，脚手架
结构可能已变）。

```bash
npx @dimples/aha new <slug> "<概念名>"
```

```bash
npx @dimples/aha new <slug> "<概念名>"
```

若命令退出并输出"存储位置选择"（仅 Windows 首次/存量用户会出现）：
把给出的选项**转述给用户**，按其选择执行对应的 `aha config ...` 命令，
然后重新运行本命令即可。

**零 skill 文件读取、零探索命令**。脚手架 = canonical tokens + 工具条 + 引擎 +
七节空槽（第 7 层含自测块与数字账本），未填即过 13 门。跑完直接进 Step 2，
**不要 ls/find/grep skill 目录、不要读任何 assets / references / cli 源码**
（实测：探索过的一律显著更慢；唯一例外是选配模式按 `references/modes.md` 明示的文件）。
读取**刚生成的页面本身**不受此限 —— Edit 需要精确的 old_string，读它是必需的。

### Step 2 · 3-5 次 Edit 填完全部内容

动笔前先定界（默想一行，不进页面）：**本页讲 X 的 A/B/C，不讲 D** ——
它同时是第 6 层「边界」的素材。随后校准起点（见上节），用 **3-5 次 Edit**
填完（按内容分块，不逐槽反复小改）：① `<head>` 新增一个页面局部 `<style>`；
② 起点徽章 `起点 L1 · （依据）` + 容器内七槽正文 + 自测块 + 账本条目
（从 `（SLOT1:` 到 `（SLOT8:`，约 200 行，可拆成两次）；③ `SIM_STEPS` 步骤数据。
`[SCAFFOLD-STYLE]` / `[QUIZ-TOGGLE]` / `[SIM-ENGINE]` / `[TOOLBAR]` 四段
**原样保留，不进 Edit 范围**；脚手架的说明注释可留可删，不影响门。
填完 grep 一次页面，确认不再有 `（SLOT` / `（依据）` / `（中文标签）` 字样。
内容约束见上方「七层骨架」「关键契约」—— 不要读 reference.html。

### 内容自检（Step 2 写完 → Step 3 之前，7 个是/否，不需要工具）

讲不清的地方就是知识漏洞 —— 补齐再交付，哪条答不上就回资料补哪条：

1. 第 4 层每个关键术语，我都能用一句大白话说出它「做了什么」？
2. 第 4 层有至少一个带真实值的具体实例，而不只有抽象描述？
3. 每个类比的失效点里，至少一条指向了类比掩盖的**真实机制**？
4. 页面里每个精确数字，我都复算过或有出处，并且比例类数字已入账本？
5. 第 5 层邻居概念，我是在按「各自改变什么」对比，而不是罗列特性？
6. 第 6 层的误区，先点名了错误直觉（你可能以为 X）再纠正，而不是只陈述正确答案？
7. 第 7 层：公式单独拿给读者不借助上文也成立；自测题不能靠复述公式回答？

全部「是」才进 Step 3；有「否」→ 先改内容（改了几处，回执里如实记）。

### Step 3 · check + 交付（跳过浏览器验证）

```bash
npx @dimples/aha check <aha new 输出的路径> && npx @dimples/aha start
```

**13 门**：单 h1 / 标题不跳档 / head 元数据 / img alt / tokens 与 canonical 一致 /
块外无颜色字面量 / 语义类在词表 / 脚本可解析且无外链 / 无提问者指代 /
失败标签 1-2 字一致 / 中文页模拟器标签中文化 / **自测块**（≥2 问，答案默认 `hidden`）/
**数字账本**（每个 `N%`/`N 倍` 有条目，`data-kind` 合法）。
门不过 → 修 → 重跑，**每轮只修被点名的那一个问题**；连续两轮无改善 → 停止修复、
如实报告。不得为了过门删内容、藏溢出、缩字号。门的细节与已知覆盖边界见
`references/gates.md`（修门修不动时才读）。

check 过 → `aha start`（幂等：未运行则后台拉起守护，已运行则复用）→ 交付。
**默认不打开浏览器截图/点击模拟器**；用户说「看效果」或反馈「页面有问题」时才截图核查，
此时回执视觉验证如实写 `passed（已截图核查）`。
交付物 = **可点击的文件链接**（粘贴 HTML 源码到聊天不算交付）+ 回执。

### 交付回执（固定格式）

check 输出的最后两行与下面前两行逐字一致，可直接复用：

```
check: 13/13 门通过
视觉验证: skipped（默认跳过；说「看效果」即可触发）
校准: 起点 Lx（依据：<一句证据>）
内容自检: 7/7 通过（修正 N 处）
形式门: N 轮
```

`aha start` 只输出书架地址与篇数 N，**不含本页链接** —— 按下面三行模板写给用户
（三行都必须给出：直达本页 / 书架入口 / 寓言模式的唯一推销，用户不接话就到此为止）：

```
http://127.0.0.1:7332/<slug>.html
你历史产生过 N 条概念图解，可以访问 http://127.0.0.1:7332 查看概念书架
如果你还想通过一个寓言故事来方便记忆，请对我说：补充寓言故事
```

其他命令：`npx @dimples/aha serve`（本地 7332，主页 = 概念书架）、
`npx @dimples/aha share`（临时公网链接）。

## 选配模式（默认不用，用户明确要求才触发）

- **寓言故事**：用户在交付后说「补充寓言故事」/「加个寓言帮我记」/ fable 时，
  读 `references/modes.md` 与 `assets/fable.md`，按其契约写 ≤1000 字同构寓言，
  插入自测块之后、账本之前，重跑 check 13/13。
- **vgpu 着色器展示层**：仅当概念本质是连续场/波/流 **且** 用户明确要求更炫/实时演示；
  核心解释永不依赖它。细则见 `references/modes.md`。

## 反模式（违反即重做）

- ❌ 跳过或假做内容自检（7 问有「否」却照样交付）
- ❌ 类比没有失效边界；类比替代了真实机制
- ❌ 第 4 层只有抽象机制没有带真实值的实例
- ❌ 特性罗列式对比（必须按"改变什么"对比）
- ❌ 误区只陈述正确答案、不点名错误直觉
- ❌ 自测题能靠复述公式回答；答案默认展开；删掉自测块过门
- ❌ 账本缺条目时删数字过门；把估算标成实算
- ❌ 文字卡片阵列伪装视觉化
- ❌ 只会闪烁/高亮的装饰动画；声称存在但没实现的交互
- ❌ 内联颜色、修改 tokens、引入远程渲染依赖
- ❌ 居高临下的语气词（"很简单""显然""只要"）
- ❌ 为了过 check 删内容 / 藏溢出 / 缩字号 —— 这算作弊，不算修复
- ❌ 把没有视觉验证说成"已验证"

## English quick reference

The Chinese sections above are the contract; this is only the command sheet.

1. `npx @dimples/aha new <slug> "<concept>"` — CLI injects tokens, toolbar,
   simulator engine, seven empty slots (layer 7 includes the self-test block and
   the number ledger). **Read nothing else** (no ls/grep of the skill dir, no
   assets/references/cli).
2. Decide page scope (covers / doesn't cover), calibrate L1/L2/L3 from the
   user's phrasing, fill badge + slots + ledger entries + `SIM_STEPS` in **3-5 Edits**
   (~220 lines, colors only via `var(--token)`, page-local layout CSS allowed
   in one `<style>`), grep that no `（SLOT` placeholder remains, then answer the
   7 content self-check questions.
3. `npx @dimples/aha check <path>` must pass 13/13 → `npx @dimples/aha start`
   → deliver the file link + the receipt above (visual verification stays
   `skipped` unless actually screenshotted).

Optional, never default: fable end-chapter and the vgpu shader layer — explicit
user request only, see `references/modes.md`.
