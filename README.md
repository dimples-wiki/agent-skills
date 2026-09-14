# Agent Skills

[English](./README_EN.md) | 简体中文

dimples-wiki 的 AI 编程代理技能集合，托管于 [skills.sh](https://skills.sh/dimples-wiki/agent-skills)。

## 可用技能

### dev-log

AI 调试协作方案。将运行时日志通过 HTTP 请求实时收集，用户操作完成后 AI 可自行查看分析，无需截图或复制控制台。

**支持 13 种语言：** JavaScript、TypeScript、Python、Go、PHP、Ruby、Java、C++、C#、Rust、Swift、Kotlin、Dart

**解决的问题：**

传统调试需要开发者打开控制台截图或复制输出发送给 AI，效率低下。dev-log 通过 HTTP 服务收集日志，AI 可以**自行查看**日志，无需用户手动操作。

**使用场景：**
- 需要调试/验证代码
- 追踪异步流程（fetch、Promise、async/await）
- 验证逻辑（表单验证、状态更新、条件判断）
- 查看变量值（特别是动态生成或用户输入的值）

**功能特性：**
- 一条 CLI 命令生成 13 种语言的日志代码（`npx dev-log gen`）
- 固定端口 HTTP 服务（7331），无需随机端口或端口文件
- 内网穿透可选（HTTPS 页面/远程访问）
- 会话隔离（sessionId 过滤），多会话共享服务
- 自动注入 `__ready__` 连通性探测与时间戳

**典型工作流：**

1. **启动服务** - `npx dev-log start`
2. **生成埋点** - `npx dev-log gen --lang js --type state --data '{...}'`，AI 将打印的代码插入关键位置
3. **等待操作** - AI 告知「已在关键位置添加日志，请操作」
4. **完成操作** - 用户操作完成后说「我已操作完成」
5. **自动分析** - `npx dev-log logs --session sess_xxx`，AI 自行读取并分析

整个过程无需截图或复制日志，AI 完全自主完成调试分析。

**安装：**
```bash
npx skills add dimples-wiki/agent-skills -s dev-log -y
```

> dev-log 的 CLI 也已发布到 npm，可独立使用：`npx @dev-log/cli start`

### llm-wiki

将 LLM 变成你的 Wiki 维护者。LLM 增量构建并维护一个持久的、相互关联的 Markdown 知识库。知识被编译一次并持续更新，而非每次重新推导。

**灵感来源：**
- [Karpathy - LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 增量知识库架构
- [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin) — 知识复利理念

**5 个操作：**

| 操作 | 用途 |
|------|------|
| `init` | 初始化知识库目录和模板 |
| `ingest` | 摄入新资料，提取知识并整合到 Wiki |
| `compound` | 将解决问题的经验文档化（Bug Track / Knowledge Track） |
| `query` | 基于 Wiki 内容回答问题，好的回答归档为主题页 |
| `lint` | 健康检查：矛盾、孤儿页面、缺失概念等 |

**适用场景：**
- 学术研究、阅读笔记、竞品分析
- 工程实践记录（bug 修复、最佳实践）
- 长期主题研究的知识积累

**典型工作流：**

1. **初始化** - 「帮我建一个 wiki」→ AI 创建目录结构和模板
2. **摄入资料** - 用户放入文章/论文/链接 → AI 提取知识，创建实体页、概念页、来源摘要
3. **经验积累** - 解决问题后说「搞定了」→ AI 自动文档化为 Bug Track 或 Knowledge Track
4. **查询知识** - 「X 和 Y 有什么区别？」→ AI 综合多页面回答，好的回答归档为主题页
5. **健康检查** - 「检查一下 wiki」→ AI 检测矛盾、孤儿页面、缺失概念，建议修复

**安装：**
```bash
npx skills add dimples-wiki/agent-skills -s llm-wiki -y
```

### aha

把任意复杂概念讲成一份**渐进分层、大图少字、可交互**的独立 HTML 解释页。目标是建立正确的心智模型 —— 不是让人"觉得懂了"，而是"真的懂了"。

**设计来源**（调研了 4 个实现后的合成）：
- [cloudflare-docs/eli5](https://github.com/cloudflare/cloudflare-docs/tree/production/.agents/skills/aha) — 受众立场（聪明但缺上下文）与禁用词表、类比边界、反模式语料
- [eli5-plus](https://github.com/qqyumidi/eli5-plus) — 七层教学骨架与动画体面契约
- [archify](https://github.com/tt-a1i/archify) — "质量来自随包资产与机器质量门，不来自提示词"
- [vgpu](https://github.com/vercel-labs/vgpu) — 着色器展示层（选配，静态降级）

**核心机制：**

| 机制 | 说明 |
|------|------|
| 七层骨架 | 一句话核心 → 为什么 → 直觉（类比+失效边界）→ 真实机制 → 容易混淆 → 边界/失败模式 → 记 |
| 起点校准 | 按提问用词判 L1/L2/L3 起点，只调起点与类比选择，永不删层 |
| 随包资产 | design-tokens.css（明暗双主题）+ 范例页 + 步骤模拟器脚手架 + 片段库 |
| 11 道质量门 | `aha check`：单 h1 / 标题层级 / head 元数据 / img alt / tokens 内联且与 canonical 一致 / 无颜色字面量 / 类词表 / 脚本语法 / 无提问者指代 / 失败标签一致 / 中文页模拟器标签中文化 |
| 诚实回执 | 没做过浏览器视觉验证，不得声称视觉验证通过 |

**典型工作流：**

1. **提问** - 「/aha Transformer 注意力机制」
2. **校准** - Agent 按提问信号判定起点（如 L2：用过"梯度下降"）
3. **生成** - 写 `~/.aha/transformer-attention.html`（token + 片段 + 模拟器），页面自带主题/风格/分享工具条
4. **验证** - `npx @dimples/aha check <file>` 跑 11 门，回执如实报告
5. **启动** - `npx @dimples/aha start` 后台守护（幂等），交付页链接 + 书架入口两行回执
6. **分享** - `npx @dimples/aha serve`（本地 7332，主页即 `~/.aha` 历史列表）/ `share`（cloudflared 临时公网链接，免账号）

**安装：**
```bash
npx skills add dimples-wiki/agent-skills -s aha -y
```

> **CLI**：发布到 npm 后用 `npx @dimples/aha check|serve|share`（零运行时依赖）；
> 发布前可直接跑仓库内等价命令：`node packages/aha-cli/src/cli.mjs <command>`
> 存储布局：根目录 `~/.aha` 恒存在（配置 + cloudflared + 守护文件），HTML 产物目录由
> `~/.aha/config.json` 决定。Windows 用户首次 `aha new` 会自动引导选择：建议非 C 盘
> （或 `aha config "D:\aha" --migrate` 迁移存量 / `aha config --keep-c` 留守）。

## 安装

**安装全部技能：**

```bash
npx skills add dimples-wiki/agent-skills -s '*' -y
```

**按语言安装单个技能：**

```bash
# 中文版
npx skills add dimples-wiki/agent-skills -s dev-log -y
npx skills add dimples-wiki/agent-skills -s llm-wiki -y
npx skills add dimples-wiki/agent-skills -s aha -y

# English
npx skills add dimples-wiki/agent-skills -s llm-wiki-en -y
```

## 相关链接

- [Skills Directory](https://skills.sh/dimples-wiki/agent-skills)
- [Agent Skills Specification](https://agentskills.io/specification)
- [Vercel Skills CLI](https://github.com/vercel-labs/skills)

## License

ISC
