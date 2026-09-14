/** 轨道词与穹顶标定 —— 3D(WebGPU)与 2D 降级(Canvas2D)共用的事实源 */

export interface Word {
  w: string;
  gallery?: string;
  compactHide?: boolean;
  /** —— 以下为移动端卡片版元数据(3D 轨道版不消费)—— */
  /** 中文译名/副标 */
  zh?: string;
  /** 起点层级:1 一句话能懂 / 2 需要一点背景 / 3 进阶 */
  lv?: 1 | 2 | 3;
  /** 一句话核心(≤16 字,卡片排版用) */
  core?: string;
}

export const WORDS: Word[] = [
  { w: "RAG", zh: "检索增强生成", lv: 1, core: "生成前先查资料,答案有据可依" },
  { w: "Agent", zh: "智能体", lv: 2, core: "会拆任务、调工具的执行者", compactHide: true },
  { w: "Transformer", zh: "变换器", lv: 1, core: "并行读懂全句的注意力机器", gallery: "attention", compactHide: true },
  { w: "Diffusion", zh: "扩散模型", lv: 2, core: "从噪声里一步步还原图像" },
  { w: "MoE", zh: "混合专家", lv: 3, core: "按需路由,只唤醒相关专家" },
  { w: "Attention", zh: "注意力机制", lv: 1, core: "让每个字重新分配重要性", gallery: "attention" },
  { w: "LoRA", zh: "低秩适配", lv: 3, core: "冻结原模型,只训一小片插件", compactHide: true },
  { w: "RLHF", zh: "人类反馈强化学习", lv: 2, core: "用人类偏好校准模型行为" },
  { w: "Embedding", zh: "向量化", lv: 1, core: "把语义压成一串可计算的数", compactHide: true },
  { w: "CoT", zh: "思维链", lv: 1, core: "把推理过程写出来再下结论" },
  { w: "MCP", zh: "模型上下文协议", lv: 3, core: "模型与工具的统一插座", compactHide: true },
  { w: "多模态", zh: "Multimodal", lv: 1, core: "文字图像声音一锅端" },
  { w: "量化", zh: "Quantization", lv: 3, core: "用更少的位数装下权重", compactHide: true },
  { w: "蒸馏", zh: "Distillation", lv: 3, core: "大模型教出小模型" },
  { w: "Prompt", zh: "提示词", lv: 1, core: "和模型说话的方式", compactHide: true },
  { w: "Copilot", zh: "副驾驶", lv: 1, core: "人在环里的协作助手" },
  { w: "对齐", zh: "Alignment", lv: 2, core: "让模型行为符合人类意图", compactHide: true },
  { w: "涌现", zh: "Emergence", lv: 2, core: "规模过了坎,新能力出现" },
  { w: "向量库", zh: "Vector Store", lv: 2, core: "按语义最近邻存取记忆", compactHide: true },
  { w: "微调", zh: "Fine-tuning", lv: 2, core: "在预训练底子上继续教" },
  { w: "幻觉", zh: "Hallucination", lv: 1, core: "一本正经地编造事实", compactHide: true },
  { w: "长上下文", zh: "Long Context", lv: 2, core: "一次能记住整本书" },
  { w: "Tool Use", zh: "工具调用", lv: 2, core: "让模型伸手用外部工具", compactHide: true },
  { w: "知识图谱", zh: "Knowledge Graph", lv: 2, core: "实体与关系织成的网" },
  { w: "预训练", zh: "Pre-training", lv: 1, core: "先在海量文本上通识", compactHide: true },
  { w: "Token", zh: "词元", lv: 1, core: "模型眼里文本的最小单位" },
  { w: "温度", zh: "Temperature", lv: 2, core: "采样随机性的旋钮", compactHide: true },
  { w: "强化学习", zh: "Reinforcement", lv: 2, core: "在试错与奖励中学策略" },
  { w: "推理", zh: "Inference", lv: 2, core: "训练完之后,模型开工", compactHide: true },
  { w: "思维链", zh: "Chain of Thought", lv: 1, core: "一步一步想,再回答" },
  { w: "梯度", zh: "Gradient", lv: 2, core: "损失下降最陡的方向", compactHide: true },
  { w: "反向传播", zh: "Backprop", lv: 2, core: "误差从尾到头逐层分账" },
  { w: "Softmax", zh: "归一化指数", lv: 2, core: "把分数变成概率分布", compactHide: true },
  { w: "归一化", zh: "Normalization", lv: 2, core: "把量纲拉回同一尺度" },
  { w: "分词", zh: "Tokenization", lv: 1, core: "把句子切成词元", compactHide: true },
  { w: "语料", zh: "Corpus", lv: 1, core: "训练用的原始文本堆" },
  { w: "插件", zh: "Plugin", lv: 2, core: "给主程序外挂能力", compactHide: true },
  { w: "缓存", zh: "Cache", lv: 1, core: "把慢的结果存起来复用" },
  { w: "并发", zh: "Concurrency", lv: 2, core: "同时处理多件事的秩序", compactHide: true },
  { w: "分布式", zh: "Distributed", lv: 2, core: "多机协同如一台" },
  { w: "数据库", zh: "Database", lv: 1, core: "有组织地存取数据", compactHide: true },
  { w: "编译器", zh: "Compiler", lv: 2, core: "把人话翻译成机器话" },
  { w: "递归", zh: "Recursion", lv: 1, core: "函数调用自己解小问题", compactHide: true },
  { w: "采样", zh: "Sampling", lv: 2, core: "从分布里抽出答案" },
  { w: "KV Cache", zh: "键值缓存", lv: 3, core: "推理时记住算过的注意力" },
  { w: "CNN", zh: "卷积网络", lv: 1, core: "滑动窗口提取局部特征", compactHide: true },
  { w: "RNN", zh: "循环网络", lv: 1, core: "按顺序读、带记忆的网络" },
  { w: "LSTM", zh: "长短期记忆", lv: 2, core: "会遗忘的改进版 RNN", compactHide: true },
  { w: "GAN", zh: "生成对抗", lv: 2, core: "造假者与鉴别者互相磨" },
  { w: "VAE", zh: "变分自编码器", lv: 3, core: "学一个隐空间再解码", compactHide: true },
  { w: "Dropout", zh: "随机失活", lv: 2, core: "训练时随机静音防过拟合" },
  { w: "Residual", zh: "残差连接", lv: 2, core: "给梯度留一条高速旁路", compactHide: true },
  { w: "位置编码", zh: "Positional Encoding", lv: 2, core: "给词元发座位号" },
  { w: "Merkle Tree", zh: "默克尔树", lv: 3, core: "叶到根的改动指纹", compactHide: true },
  { w: "布隆过滤器", zh: "Bloom Filter", lv: 3, core: "用位数组快速说「没有」" },
  { w: "Gossip", zh: "流言协议", lv: 3, core: "节点间传小道消息达成一致", compactHide: true },
  { w: "幂等", zh: "Idempotency", lv: 2, core: "同一操作做几遍结果不变" },
  { w: "CAP 定理", zh: "CAP Theorem", lv: 2, core: "一致、可用、分区三选二", compactHide: true },
  { w: "MVCC", zh: "多版本并发控制", lv: 3, core: "写不挡读,各看各版本" },
  { w: "B+ Tree", zh: "B+ 树", lv: 2, core: "为磁盘排序而生的树", compactHide: true },
  { w: "推测解码", zh: "Speculative Decoding", lv: 3, core: "小模型打草稿,大模型批改" },
  { w: "联邦学习", zh: "Federated Learning", lv: 3, core: "数据不动,模型动", compactHide: true },
  { w: "同态加密", zh: "Homomorphic", lv: 3, core: "在密文上直接计算" },
  { w: "过拟合", zh: "Overfitting", lv: 2, core: "把训练题背成了答案", compactHide: true },
  { w: "正则化", zh: "Regularization", lv: 2, core: "给模型套上缰绳" },
  { w: "随机森林", zh: "Random Forest", lv: 2, core: "多棵决策树一起投票", compactHide: true },
  { w: "朴素贝叶斯", zh: "Naive Bayes", lv: 2, core: "假设特征独立的最快分类" },
  { w: "t-SNE", zh: "随机邻域嵌入", lv: 3, core: "高维数据压成二维散点" },
  { w: "缩放定律", zh: "Scaling Law", lv: 2, core: "性能随规模的可预测曲线" },
  { w: "上下文学习", zh: "In-Context Learning", lv: 2, core: "不改权重,看例子就会", compactHide: true },
  { w: "一致性哈希", zh: "Consistent Hashing", lv: 3, core: "扩容时少搬家" },
  { w: "倒排索引", zh: "Inverted Index", lv: 2, core: "从词找到包含它的文档", compactHide: true },
  { w: "马尔可夫", zh: "Markov Chain", lv: 2, core: "下一步只看当前状态" },
  { w: "蒙特卡罗", zh: "Monte Carlo", lv: 2, core: "随机撒点逼近答案", compactHide: true },
];

export const IDLE_QUOTES = [
  "这些东西……都是啥?",
  "每一个都听说过,没有一个真懂",
  "搜了三篇帖子,问号更多了",
  "别装了,问号都写在脸上了",
];

export const AHA_QUOTES = ["噢!原来如此!", "懂了懂了,就是这么回事!", "原来这么简单?!", "顿悟时刻——"];

/** Fibonacci 球面(纬度带,黄金角均匀分布):词像卫星云绕球自转。
 *  带取赤道及以下半球(y≥-0.05,屏幕向下为正)——球冠与命令行区保持干净。 */
const FIB_Y_MIN = -0.26;
const FIB_Y_MAX = 0.62;
export const FIB: { x: number; y: number; z: number }[] = WORDS.map((_, i) => {
  const y = FIB_Y_MAX - (FIB_Y_MAX - FIB_Y_MIN) * ((i + 0.5) / WORDS.length);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * Math.PI * (3 - Math.sqrt(5)); // 黄金角
  return { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
});

export const ORBIT_SPEED = 0.13;
export const ORBIT_TILT = 0.12;
/* 与 sphere.wgsl 相机标定耦合:中心 50%vw/59%vh、球半径 36%vh —— 改相机必须同步这里 */
export const ORBIT_CALIB = { cxr: 0.5, cyr: 0.59, ballRr: 0.36, shellRr: 1.55, maxWr: 0.47 };
