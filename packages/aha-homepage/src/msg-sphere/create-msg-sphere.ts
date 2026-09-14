import { startSphere, type SphereRendererOptions } from "./render-sphere";
export type MsgSphereExpressionName = "surprised" | "skeptical";
export type MsgSphereExpression = MsgSphereExpressionName | 0 | 1;

export interface MsgSphereOptions {
  clickToReact?: boolean;
  idleSwitch?: boolean;
  idleSwitchMs?: number;
  expression?: MsgSphereExpression;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onExpressionChange?: (
    expression: 0 | 1,
    name: MsgSphereExpressionName,
  ) => void;
  /** 词轨道覆盖层(透传给 startSphere 的 SphereRendererOptions.wordOverlay) */
  wordOverlay?: SphereRendererOptions["wordOverlay"];
}

export interface MsgSphere {
  readonly canvas: HTMLCanvasElement;
  readonly mount: HTMLElement;
  getExpression(): 0 | 1;
  getExpressionName(): MsgSphereExpressionName;
  /** Set expression, or toggle when called with no argument. */
  changeExpression(expression?: MsgSphereExpression): void;
  /** 标记词轨道脏:下一次渲染 tick 会整帧重画球体+词 */
  requestWordRedraw(): void;
  dispose(): void;
}

function expressionIndex(expression: MsgSphereExpression): 0 | 1 {
  if (expression === "skeptical" || expression === 1) return 1;
  return 0;
}

function expressionName(expression: 0 | 1): MsgSphereExpressionName {
  return expression === 1 ? "skeptical" : "surprised";
}

function resolveCanvas(mount: HTMLElement): HTMLCanvasElement {
  if (mount instanceof HTMLCanvasElement) return mount;

  const existing = mount.querySelector("canvas");
  if (existing instanceof HTMLCanvasElement) return existing;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Interactive glowing MSG Sphere");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  mount.appendChild(canvas);
  return canvas;
}

/**
 * Mount an interactive MSG Sphere into a DOM element.
 *
 * @example
 * ```ts
 * const msgSphere = createMsgSphere(document.querySelector("#stage")!, {
 *   clickToReact: true,
 *   idleSwitch: true,
 * });
 * msgSphere.changeExpression("skeptical");
 * ```
 */
export function createMsgSphere(
  mount: HTMLElement,
  options: MsgSphereOptions = {},
): MsgSphere {
  if (!(mount instanceof HTMLElement)) {
    throw new TypeError("createMsgSphere(mount, options): mount must be an HTMLElement.");
  }

  const canvas = resolveCanvas(mount);
  const initial = options.expression !== undefined
    ? expressionIndex(options.expression)
    : 0;

  const rendererOptions: SphereRendererOptions = {
    clickToReact: options.clickToReact,
    idleSwitch: options.idleSwitch,
    idleSwitchMs: options.idleSwitchMs,
    expression: initial,
    onReady: options.onReady,
    onError: options.onError,
    onExpressionChange(expression) {
      options.onExpressionChange?.(expression, expressionName(expression));
    },
    wordOverlay: options.wordOverlay,
  };

  const renderer = startSphere(canvas, rendererOptions);

  return {
    canvas,
    mount,
    getExpression() {
      return renderer.getExpression();
    },
    getExpressionName() {
      return expressionName(renderer.getExpression());
    },
    changeExpression(expression) {
      if (expression === undefined) {
        renderer.toggleExpression();
        return;
      }
      renderer.setExpression(expressionIndex(expression));
    },
    requestWordRedraw() {
      renderer.requestWordRedraw();
    },
    dispose() {
      renderer.dispose();
    },
  };
}
