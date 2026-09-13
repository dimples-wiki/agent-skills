# 寓言写作契约（寓言故事模式 —— 用户明确要求时才用）

> 触发：用户对已交付的页面说「**补充寓言故事**」（或明确表达"要个寓言帮我记"
> / "加个记故事" / "fable" 的意图）。**默认不生成** —— 交付回执里的提醒行
> 是唯一主动推销，用户不接话就到此为止。

围绕本页已解释的概念，写一则寓言来**完整地**解释它。
要像真正的寓言那样间接讲，不要直接点破。

**输入**：目标概念 + 已生成页面的正文（先读一遍）。
寓言必须与页面讲的**真实机制同构** —— 情节里的每次转折都要映射页面里
机制的真实因果，不得为了故事好看扭曲机制（寓言版的数字纪律：
一个与机制矛盾的寓言比没有寓言更糟，它会锚定错误的心智模型）。

---

## 一、寓言体感

- 篇幅：**1000 字以内**。真正的寓言是精炼的，靠一个核心场景、
  一两次转折把意思撑起来，不需要铺陈。
- 世界观：故事是虚构的，可以拟人化 —— 动物、植物、器物开口说话都行；
  可以发生在一个不写实的小世界里，也可以落在一个看似日常的微观场景中。
- 角色：**不超过三个，最好两个**。它们之间的关系或互动本身就要承载寓意。
- 揭示节奏：故事正文中全程不出现概念名称，不使用该领域术语。
  只在接近结尾时，才让读者隐约意识到讲的是什么。
  **唯一的点破处是答案区**（见四）—— 故事负责埋，答案负责揭。
- 叙事纪律：让情节和细节本身承载意义，不要让角色跳出来当解说员。

---

## 二、防套路自检

动笔前先过一遍以下清单，逐项避开。

### 意象黑名单
钟、河流、镜子、迷宫、织布机、地图、灯塔、棋盘、回声、影子、
沙漏、风、蜡烛、种子、桥、星辰、蝴蝶、蛛网。

### 地名黑名单
不要写"回声城""记忆之村""遗忘之海""寂静谷"这类过度文艺化的虚构地名。
给个普通地理名词，或者干脆不命名。

### 结构黑名单
- 旅行者求教智者
- 村庄异象 → 众人顿悟
- 孩童一句话点醒大人
- 师徒辩难
- 临终遗言

### 角色黑名单
钟表匠、图书管理员、隐士、说书人、老船夫、酿酒师、铁匠、抄经人。

### 开头黑名单
不要写"从前有个地方……""某天某人遇见某事……""在很远的山里……"
这种起手式。直接进入场景。

---

## 三、切入角度

鼓励以下方向优先考虑，可以组合使用：

- 非人类视角：一件工具、一只动物、一种植物、一个机构在自述。
- 具体的现代职业和场景：理赔员、电梯保养工、菜市场摊主、夜班护士。

---

## 四、收尾

故事结束后，提出两个问题：

1. 一个检验读者有没有真正理解概念的**核心**。
2. 一个看读者能不能把学到的东西**迁移到其他领域**。

两问之后必须写出**答案**，藏在「查看答案」按钮后（骨架见五）：

- **答案 1**：这里是全寓言唯一允许点破的地方 —— 正式说出概念名，
  并用一两句把寓言道具映射回真实机制（白板=什么、腕带=什么、
  闭环=什么），让读者对自己的理解做最终校对。
- **答案 2**：给 2-3 个其他领域的具体实例 + 两种秩序各自的代价对比。
- 答案合计 ≤200 字（篇幅限制的 1000 字只算故事正文）。
- 顺序纪律：先问题后答案、默认隐藏 —— 读者必须先经过一次自测。

---

## 五、页面集成（aha 契约）

1. 寓言作为**末章**插入已生成页面：放在「记」（takeaway）与**自测块**
   （`<section ... data-quiz>`）**之后**、`</div><!-- /container -->` 之前 ——
   全页最后一个 section。自测块保留不动（门 12 要求它存在）。
2. 用下面的骨架（全部用 tokens 已有类，不写新 CSS，不引入颜色字面量；
   `aha check` 12 门必须全过）：

```html
<!-- ===== 末章：寓言（选配，用户要求时才有） ===== -->
<section class="section">
  <p class="eyebrow" data-n="寓言">帮你记住</p>
  <h2>（寓言标题 —— 同样不点破概念）</h2>
  <p>（故事正文，1000 字以内，分段）</p>
  <div class="callout">
    <p><strong>合上页面前，问自己两个问题：</strong><br>
    1）……（检验概念核心）<br>
    2）……（检验能否迁移到别的领域）</p>
  </div>
  <button type="button" class="fable-toggle" data-fable-toggle
          aria-expanded="false" aria-controls="fable-answers">查看答案</button>
  <div class="fable-ans" id="fable-answers" data-fable-answers hidden>
    <p><strong>1）</strong>（点破概念 + 道具→机制映射，≤120 字）</p>
    <p><strong>2）</strong>（2-3 个跨领域实例 + 代价对比，≤120 字）</p>
  </div>
</section>
<style>
/* 寓言答案区（颜色只用 var()，过门 6） */
.fable-toggle{font:650 .85rem/1 var(--font-sans);cursor:pointer;color:var(--t-2);
  background:var(--surface);border:1px solid var(--line-2);border-radius:999px;
  padding:.55em 1.3em;margin-top:var(--sp-2);transition:border-color .2s,color .2s}
.fable-toggle:hover{color:var(--t-1);border-color:var(--accent)}
.fable-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.fable-ans{margin-top:var(--sp-2);border-left:3px solid var(--accent);
  background:var(--accent-soft);border-radius:0 var(--r-m) var(--r-m) 0;
  padding:var(--sp-2) var(--sp-3);font-size:var(--fs-small);color:var(--t-2)}
</style>
<script>
/* [FABLE-TOGGLE] 答案开关 —— 原样复制，勿改 */
(() => {
  const btn = document.querySelector("[data-fable-toggle]");
  const ans = document.querySelector("[data-fable-answers]");
  if (!btn || !ans) return;
  btn.addEventListener("click", () => {
    const show = ans.hidden;            // 当前隐藏 → 本次点击即显示
    ans.hidden = !show;
    btn.setAttribute("aria-expanded", String(show));
    btn.textContent = show ? "收起答案" : "查看答案";
  });
})();
</script>
```

3. 标题层级：本节用 `<h2>`（与第 2-6 层及自测块同级），不再降级 —— 12 门的
   heading-monotonic 不会因此触发。寓言的「查看答案」与自测块的开关是两套
   独立的 data-* 与 id（`fable-answers` / `quiz-answers`），互不干扰。
4. 完成后重跑 `aha check`（12/12），回执沿用 SKILL.md「交付回执」格式，
   并附一句寓言标题（不剧透内容）。
5. 寓言**不进**第 3 层直觉层、不替代类比框 —— 页面原有的类比边界契约照旧；
   寓言是终章的记忆钩子，两套类比系统并存但互不指涉。
