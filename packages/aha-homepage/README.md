# @dimples/aha-homepage

[aha](https://github.com/dimples-wiki/agent-skills/tree/main/skills/aha) 概念图解引擎的产品主页。

## 技术栈

- **Vite 8** + **React 19** + **TypeScript** —— 最新工具链
- **Tailwind CSS 4**(`@tailwindcss/vite`)
- **vgpu** —— WebGPU 着色器:hero「顿悟球」(MSG Sphere 风 LED 表情球,WGSL 解析光线求交 + SDF 表情,
  视线跟随 / 眨眼 / hover 名词时从困惑变惊喜并发金色脉冲环)+ 页脚「波带」,
  与 aha 图解页的 vgpu 展示层同款引擎
- **motion** —— 滚动动效;**lucide-react** 图标;**Fontsource** 自托管字体

## 开发

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # 产物 dist/
pnpm preview   # 预览构建产物
pnpm typecheck
```

## Hero 交互:「顿悟球 · msg-sphere」

首屏主体是集成自 [msg-sphere](https://github.com/)(独立 vgpu/WebGPU raymarching 模块,
源码在 `src/msg-sphere/`)的金色金属球:144 步 raymarch + 接触弧自适应 AA、
双瓣金属高光 + 环境反射、内建指针跟随(±35° 脸转向 + 瞳孔)、随机眨眼、呼吸微光。

- **表情语义映射**:平时 = `skeptical`(平眉+线嘴,疑惑);hover 名词 = `surprised`(挑眉+O 嘴,啊哈)
- **降级**:无 WebGPU / reduced-motion / 初始化失败 → CSS 穹顶(此前的实现完整保留)
- `?aha=词` 演示链接自动进入顿悟态

## 旧版 CSS 穹顶(现作为降级方案)

首屏是一整块 Canvas 2D 画布:夜幕星空之下,一枚 LED 半球穹顶贴满底部,文案直接叠加在天空区。

> **渲染器说明**:初版用 vgpu(WebGPU)渲染穹顶,但在三方对照实验中
> (裸 WebGPU / esm.sh vgpu / npm vgpu,同一页面同一浏览器)所有路径的画布
> 均无法呈现像素(编译与循环正常、像素全黑),且此问题跨机器复现。
> 现已改为**零依赖 Canvas 2D 渲染器**(`src/lib/dome2d.ts`)——视觉设计不变,
> 所有设备稳定渲染,且可用"截图 + 像素统计"客观验证。WGSL 着色器保留在
> `src/shaders.ts` 备将来 WebGPU 环境恢复后启用。

- **穹顶**:LED 经纬点阵(正交投影,边缘压缩)+ 暖金渐变 + 极光噪声流 +
  菲涅尔轮廓辉光;开机时从地平线逐排点亮
- **灵魂是大眼睛**:眼白 + 琥珀瞳 + 高光,瞳孔跟随光标,~4.3s 眨眼;
  hover 名词时瞳孔化作**金色四芒星**,微笑弧加深,地平线光浪扫过
- **名词是开普勒卫星**:独立椭圆轨道(牛顿迭代解方程,近快远慢),
  绕到穹顶背后变暗失焦;光标附近词被磁力吸向光标(利于选中);闲置随机词「求科普」
- **性能与降级**:30fps 上限、离屏暂停、`?fps=N` 调试、`?aha=词` 零交互演示链接;
  reduced-motion 时退为 CSS 静态穹顶

## 截图素材

`public/shots/*.png` 来自本机真实书架(`aha serve` @ 127.0.0.1:7332)与真实图解页,
由 agent-browser @2x 截取。刷新素材:

```bash
node ../cli/src/cli.mjs start   # 确保书架在跑
agent-browser --color-scheme dark open http://127.0.0.1:7332
agent-browser set viewport 1440 1000 2
agent-browser screenshot public/shots/bookshelf.png
# ……逐页同理
```

## 设计契约

- 颜色基因来自 `skills/aha/assets/design-tokens.css`(warm/dark 派生),主打 aha 金 `#ffab2e`。
- 着色器 tint 从外部 uniform 传入,不在 WGSL 里硬编码品牌色(与 aha 颜色纪律同源)。
- WebGPU 四条降级路径:无 WebGPU / `prefers-reduced-motion` / 动态导入失败 / 编译失败
  —— 全部落回静态 CSS 渐变,控制台零报错。
