import { clock, effect, frame, init, surface } from "vgpu";
import sphereShader from "./shaders/sphere.wgsl";
import {
  SphereState,
  type SphereStateOptions,
  toScenePoint,
} from "./sphere-state";

export interface SphereRendererOptions extends SphereStateOptions {
  clickToReact?: boolean;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onExpressionChange?: (expression: 0 | 1) => void;
  /** 词轨道覆盖层:在球体渲染后追加一个 instanced render pass(同一 canvas) */
  wordOverlay?: {
    /** 词纹理图集(Canvas2D 离屏画好的;dataset.rev 变化表示已重画需重传) */
    atlasCanvas: HTMLCanvasElement;
    /** 每帧由外部更新的 instance 数据(Float32Array,与 WGSL struct 对齐) */
    getInstanceData: () => { data: Float32Array; count: number } | null;
  };
}

/** 自管 rAF 的停摆句柄(不依赖 vgpu frameLoop —— 我们自己控制节流) */
interface LoopHandle {
  stop(): void;
}

export interface SphereRenderer {
  readonly canvas: HTMLCanvasElement;
  getExpression(): 0 | 1;
  setExpression(expression: 0 | 1): void;
  toggleExpression(): void;
  /** 标记词轨道脏(外部动画循环调用):下一次 tick 会整帧重画球体+词 */
  requestWordRedraw(): void;
  dispose(): void;
}

export function startSphere(
  canvas: HTMLCanvasElement,
  options: SphereRendererOptions = {},
): SphereRenderer {
  const clickToReact = options.clickToReact === true;
  let disposed = false;
  let gpu: Awaited<ReturnType<typeof init>> | undefined;
  let loop: LoopHandle | undefined;
  let removeListeners: (() => void) | undefined;
  let stateRef: SphereState | undefined;
  let shownExpression: 0 | 1 = options.expression === 1 ? 1 : 0;
  // 词脏标记:在外层声明 → init 完成前调用 requestWordRedraw 也不会丢
  let wordActive = false;

  const api: SphereRenderer = {
    canvas,
    getExpression() {
      return stateRef?.getExpression() ?? shownExpression;
    },
    setExpression(expression) {
      const now = performance.now();
      if (stateRef) {
        stateRef.setExpression(expression, now);
      } else {
        shownExpression = expression;
      }
    },
    toggleExpression() {
      api.setExpression(api.getExpression() === 0 ? 1 : 0);
    },
    requestWordRedraw() {
      wordActive = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      removeListeners?.();
      loop?.stop();
      gpu?.dispose();
      gpu = undefined;
      stateRef = undefined;
    },
  };

  void (async () => {
    try {
      const context = await init();
      gpu = context;

      if (disposed) {
        context.dispose();
        return;
      }

      const canvasSurface = surface(context, canvas, { dpr: [1, 2] });
      const startedAt = performance.now();
      const state = new SphereState(startedAt, Math.random, {
        idleSwitch: options.idleSwitch,
        idleSwitchMs: options.idleSwitchMs,
        expression: shownExpression,
      });
      stateRef = state;
      const animationClock = clock(context);
      let lastFrameAt = startedAt;

      const sphere = effect(context, sphereShader, {
        label: "msg-sphere",
        set: {
          params: {
            resolution: [canvasSurface.size[0], canvasSurface.size[1]],
            pointer: [0, 0],
            time: 0,
            expressionMix: shownExpression,
            blink: 0,
            yaw: 0,
            pitch: 0,
            padding: 0,
          },
        },
      });

      // —— 词轨道覆盖管线(与球体共享同一 canvas,球体 pass 之后追加) ——
      let wordPipeline: GPURenderPipeline | null = null;
      let wordUniBuf: GPUBuffer | null = null;
      let wordInstBuf: GPUBuffer | null = null;
      let wordBind: GPUBindGroup | null = null;
      let wordTex: GPUTexture | null = null;
      let wordTexRev = "";
      let wordTexW = 0;
      let wordTexH = 0;
      let syncWordResources: ((count: number) => void) | null = null;
      let wordUniform: Float32Array | null = null;
      // uniform 只在尺寸变化时重传(canvas backing 或图集尺寸)
      let uniW = 0;
      let uniH = 0;
      let uniAW = 0;
      let uniAH = 0;
      if (options.wordOverlay) {
        const wo = options.wordOverlay;
        // isHover/_p0/_p1 目前未在 WGSL 消费(hover 行选择在 JS 侧完成),
        // 保留 48B 步长是为 struct 对齐留余量 —— 上传量 3.6KB/帧,可忽略
        const WORD_SHADER = /* wgsl */ `
struct WParams { res: vec2f, atlasSize: vec2f };
@group(0) @binding(0) var<uniform> params: WParams;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
struct WInst {
  pos: vec2f, size: vec2f, alpha: f32, isHover: f32,
  uv0: vec2f, uvSize: vec2f, _p0: f32, _p1: f32,
};
@group(0) @binding(3) var<storage> insts: array<WInst>;
struct VSOut { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) alpha: f32 };
@vertex fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  var q = array<vec2f, 6>(vec2f(-0.5,-0.5),vec2f(0.5,-0.5),vec2f(-0.5,0.5),vec2f(-0.5,0.5),vec2f(0.5,-0.5),vec2f(0.5,0.5));
  let inst = insts[ii];
  let corner = q[vi];
  let px = inst.pos + corner * inst.size;
  let ndc = px / params.res * 2.0 - 1.0;
  var out: VSOut;
  out.position = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
  out.uv = inst.uv0 + (corner + vec2f(0.5)) * inst.uvSize;
  out.alpha = inst.alpha;
  return out;
}
@fragment fn fs_main(in: VSOut) -> @location(0) vec4f {
  let c = textureSample(tex, samp, in.uv);
  return vec4f(c.rgb, c.a * in.alpha);
}`;
        const rawDevice = context.gpu; // Gpu.gpu = 原生 GPUDevice(device 是 vgpu 包装器)
        const module = rawDevice.createShaderModule({ code: WORD_SHADER });
        const pipeline = rawDevice.createRenderPipeline({
          layout: "auto",
          vertex: { module, entryPoint: "vs_main" },
          fragment: {
            module, entryPoint: "fs_main",
            targets: [{
              format: canvasSurface.format,
              blend: {
                color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
                alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
              },
            }],
          },
        });
        wordPipeline = pipeline;
        const wordSampler = rawDevice.createSampler({ magFilter: "linear", minFilter: "linear" });
        wordUniform = new Float32Array(4); // [canvasW, canvasH, atlasW, atlasH] 尺寸变化时覆写
        // 图集由 DomeStage 在断点切换时重画(data-rev 递增);
        // 实例缓冲按当前可见词数按需扩容。任一重建后绑定组重挂。
        // usage 数值 = WebGPU 规范位标志(lib.dom 缺全局常量):
        //   纹理 0x02 COPY_DST | 0x04 TEXTURE_BINDING | 0x10 RENDER_ATTACHMENT
        //   缓冲 0x08 COPY_DST | 0x40 UNIFORM | 0x80 STORAGE
        syncWordResources = (count: number) => {
          const ac = wo.atlasCanvas;
          const rev = ac.dataset.rev ?? "";
          if (rev !== wordTexRev || ac.width !== wordTexW || ac.height !== wordTexH) {
            wordTex?.destroy();
            wordTex = rawDevice.createTexture({
              size: [ac.width, ac.height],
              format: "rgba8unorm",
              usage: 0x02 | 0x04 | 0x10,
            });
            rawDevice.queue.copyExternalImageToTexture(
              { source: ac }, { texture: wordTex },
              [ac.width, ac.height],
            );
            wordTexRev = rev;
            wordTexW = ac.width;
            wordTexH = ac.height;
            wordBind = null;
          }
          if (!wordUniBuf) {
            wordUniBuf = rawDevice.createBuffer({ size: 32, usage: 0x48 });
            wordBind = null;
          }
          if (!wordInstBuf || wordInstBuf.size < count * 48) {
            wordInstBuf?.destroy();
            wordInstBuf = rawDevice.createBuffer({ size: count * 48, usage: 0x88 });
            wordBind = null;
          }
          if (!wordBind) {
            wordBind = rawDevice.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: wordUniBuf } },
                { binding: 1, resource: wordTex!.createView() },
                { binding: 2, resource: wordSampler },
                { binding: 3, resource: { buffer: wordInstBuf } },
              ],
            });
          }
        };
      }

      const pointFromEvent = (event: MouseEvent) => {
        const bounds = canvas.getBoundingClientRect();
        return toScenePoint(
          event.clientX - bounds.left,
          event.clientY - bounds.top,
          bounds.width,
          bounds.height,
        );
      };

      const onPointerMove = (event: PointerEvent): void => {
        state.movePointer(pointFromEvent(event));
      };
      const onPointerLeave = (): void => {
        state.leavePointer();
      };
      const onClick = (event: MouseEvent): void => {
        state.click(pointFromEvent(event), performance.now());
      };

      // window 级跟随:指针悬停在页面内任何元素(词/文案)上时,
      // 脸保持跟随该方向 —— 只有离开整个页面才缓回中。
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("mouseleave", onPointerLeave);
      if (clickToReact) {
        canvas.addEventListener("click", onClick);
      }
      removeListeners = () => {
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("mouseleave", onPointerLeave);
        if (clickToReact) {
          canvas.removeEventListener("click", onClick);
        }
      };

      // —— 自适应渲染:交互/过渡/眨眼时满帧渲染;静止时零 GPU 提交(画面冻结)。
      // 状态机仍以 rAF 频率推进(眨眼/阻尼定时),只跳过 GPU 编码。
      const ACTIVE_MS = 900; // 指针活动后的满帧保持窗口
      let lastActiveAt = performance.now();
      const markActive = () => { lastActiveAt = performance.now(); };
      window.addEventListener("pointermove", markActive, { passive: true });
      window.addEventListener("pointerdown", markActive, { passive: true });

      let rafId = 0;
      // tick 中途抛错(上下文丢失/验证错误)→ 完整拆除并上报,不留僵尸监听
      let failed = false;
      const failRender = (error: unknown) => {
        if (failed || disposed) return;
        failed = true;
        loop?.stop();
        removeListeners?.();
        window.removeEventListener("pointermove", markActive);
        window.removeEventListener("pointerdown", markActive);
        gpu?.dispose();
        gpu = undefined;
        stateRef = undefined;
        if (!disposed) options.onError?.(error);
      };
      loop = {
        stop() {
          cancelAnimationFrame(rafId);
          vio.disconnect();
          ro.disconnect();
          window.removeEventListener("pointermove", markActive);
          window.removeEventListener("pointerdown", markActive);
        },
      };
      // 视口外挂起:球体在首屏,滚走后整段 rAF 停摆(滚回来立即恢复)
      let stageVisible = true;
      const vio = new IntersectionObserver(
        ([entry]) => {
          const was = stageVisible;
          stageVisible = entry.isIntersecting;
          if (stageVisible && !was && !rafId && !failed) {
            lastFrameAt = performance.now();
            rafId = requestAnimationFrame(tick);
          }
        },
        { threshold: 0.05 },
      );
      vio.observe(canvas);
      // F1 修复:静止期 resize(旋转屏/分屏/DevTools 开合)时,vgpu 的
      // applyAutoResize 只在 frame() 内跑 —— 零提交会把旧帧 CSS 拉伸成椭圆。
      // RO 检测 CSS 尺寸变化 → 强制一次提交让 backing size 跟上。
      let needsResize = false;
      const ro = new ResizeObserver(() => { needsResize = true; });
      ro.observe(canvas);
      // 设备丢失(驱动重置等)→ 静默失败变显式下线
      void context.gpu.lost.then((info) => {
        failRender(new Error(`WebGPU device lost: ${info.reason}`));
      });
      const tick = () => {
        const now = performance.now();
        if (!stageVisible) {
          // 离屏:彻底停摆(rAF 链断),交给 IO 复活 —— 不再排程,避免双排程扇出
          rafId = 0;
          return;
        }
        if (document.hidden) {
          // 标签页隐藏:rAF 本就被浏览器挂起,保留单链即可
          lastFrameAt = now;
          rafId = requestAnimationFrame(tick);
          return;
        }
        try {
          const snapshot = state.frame(now, now - lastFrameAt);
          lastFrameAt = now;

          const nextExpression: 0 | 1 =
            snapshot.expressionMix >= 0.5 ? 1 : 0;
          if (nextExpression !== shownExpression) {
            shownExpression = nextExpression;
            options.onExpressionChange?.(nextExpression);
          }

          // 活动判定:指针刚动过 / 表情过渡中 / 眨眼中 / 尺寸变了 —— 必须提交
          const transitioning =
            snapshot.expressionMix > 0.001 && snapshot.expressionMix < 0.999;
          const blinking = snapshot.blink > 0.02;
          const active =
            now - lastActiveAt < ACTIVE_MS || transitioning || blinking || needsResize;
          // 静止 = 零 GPU 提交,画面冻结在最后一帧。
          // 注:静止呼吸(1.8% 亮度脉动)已移除 —— 任何在 canvas 上方做动画的层
          // (含独立遮罩)都会迫使合成器逐帧重组 WebGPU 纹理,实测 +25% CPU;
          // 生命感由眨眼(触发即渲染)、轨道词公转和 hover 响应承担。
          // 词画在球体之上 → 词动 = 整帧(球体+词)一起重画:
          // 只重画词会把新四边形叠进旧帧留下残影。静止时两者一起冻结(零提交)。
          const needFrame = active || wordActive;
          // 尺寸塌缩(窗口拖到极小):0 尺寸 canvas 上 getCurrentTexture 会抛。
          // 跳过本帧提交,尺寸恢复后 RO → needsResize 自动重画
          const collapsed = canvas.clientWidth === 0 || canvas.clientHeight === 0;
          if (needFrame && !collapsed) {
            frame(context, (fr) => {
              sphere.set({
                params: {
                  resolution: [canvasSurface.size[0], canvasSurface.size[1]],
                  pointer: [snapshot.pointer[0], snapshot.pointer[1]],
                  time: animationClock.time,
                  expressionMix: snapshot.expressionMix,
                  blink: snapshot.blink,
                  yaw: snapshot.yaw,
                  pitch: snapshot.pitch,
                  padding: 0,
                },
              });
              fr.pass(canvasSurface, sphere);
            });
            needsResize = false; // 成功提交后才清除,中途抛错下一帧重试

            // 词轨道覆盖:球体 pass 之后追加(loadOp=load 叠加,同一帧纹理)。
            // 词层是装饰 —— 它的任何异常只下线词层(wordPipeline 置空),
            // 不允许拖死球体本身(快速缩放视窗的越界一旦漏网,代价只是词消失一帧)
            const wo = options.wordOverlay;
            if (wo && wordPipeline) {
              try {
                const inst = wo.getInstanceData();
                if (inst && inst.count > 0) {
                  const device = context.gpu;
                  syncWordResources?.(inst.count);
                  if (
                    canvas.width !== uniW || canvas.height !== uniH ||
                    wo.atlasCanvas.width !== uniAW || wo.atlasCanvas.height !== uniAH
                  ) {
                    uniW = canvas.width; uniH = canvas.height;
                    uniAW = wo.atlasCanvas.width; uniAH = wo.atlasCanvas.height;
                    wordUniform![0] = uniW; wordUniform![1] = uniH;
                    wordUniform![2] = uniAW; wordUniform![3] = uniAH;
                    device.queue.writeBuffer(wordUniBuf!, 0, wordUniform!);
                  }
                  device.queue.writeBuffer(wordInstBuf!, 0, inst.data, 0, inst.count * 12);
                  const enc = device.createCommandEncoder();
                  const rp = enc.beginRenderPass({
                    colorAttachments: [{
                      view: canvasSurface.context.getCurrentTexture().createView(),
                      loadOp: "load" as GPULoadOp,
                      storeOp: "store" as GPUStoreOp,
                    }],
                  });
                  rp.setPipeline(wordPipeline);
                  rp.setBindGroup(0, wordBind!);
                  rp.draw(6, inst.count);
                  rp.end();
                  device.queue.submit([enc.finish()]);
                }
              } catch (overlayError) {
                wordPipeline = null;
                console.error("word overlay disabled:", overlayError);
              }
            }
          }
          wordActive = false;
        } catch (error) {
          failRender(error);
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      options.onReady?.();
    } catch (error) {
      removeListeners?.();
      loop?.stop();
      gpu?.dispose();
      gpu = undefined;
      if (!disposed) options.onError?.(error);
    }
  })();

  return api;
}
