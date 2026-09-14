export interface ScenePoint {
  x: number;
  y: number;
}

export interface SphereFrameState {
  pointer: readonly [number, number];
  expressionMix: number;
  blink: number;
  yaw: number;
  pitch: number;
}

export const EXPRESSION_DURATION_MS = 450;
export const IDLE_SWITCH_MS = 8_000;
/** Subtle orbit follow — about ±35° yaw / ±28° pitch. */
export const YAW_MAX_RADIANS = (35 * Math.PI) / 180;
export const PITCH_MAX_RADIANS = (28 * Math.PI) / 180;

const BLINK_DURATION_MS = 160;
const BLINK_MIN_DELAY_MS = 2_600;
const BLINK_DELAY_RANGE_MS = 2_200;
const POINTER_DAMPING = 12;
const SPHERE_CENTER_Y = 0.04;
const SPHERE_RADIUS = 0.72;
const GROUND_Y = -0.39;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const mix = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

export function toScenePoint(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): ScenePoint {
  const scale = Math.max(1, Math.min(width, height));
  return {
    x: ((clientX - width / 2) * 2) / scale,
    y: ((height / 2 - clientY) * 2) / scale,
  };
}

export function isVisibleSphereHit(point: ScenePoint): boolean {
  if (point.y < GROUND_Y) return false;

  const dx = point.x;
  const dy = point.y - SPHERE_CENTER_Y;
  return dx * dx + dy * dy <= SPHERE_RADIUS * SPHERE_RADIUS;
}

export interface SphereStateOptions {
  /** When true, expression auto-toggles after idleSwitchMs. Default false. */
  idleSwitch?: boolean;
  idleSwitchMs?: number;
  /** Initial expression: 0 surprised, 1 skeptical. */
  expression?: 0 | 1;
}

export class SphereState {
  private pointerX = 0;
  private pointerY = 0;
  private targetX = 0;
  private targetY = 0;
  private expressionFrom = 0;
  private expressionTarget = 0;
  private expressionStartedAt = Number.NEGATIVE_INFINITY;
  private lastSwitchAt: number;
  private blinkStartedAt: number | null = null;
  private nextBlinkAt: number;
  private readonly idleSwitch: boolean;
  private readonly idleSwitchMs: number;

  constructor(
    startAt: number,
    private readonly random: () => number = Math.random,
    options: SphereStateOptions = {},
  ) {
    this.idleSwitch = options.idleSwitch === true;
    this.idleSwitchMs = options.idleSwitchMs ?? IDLE_SWITCH_MS;
    const initial = options.expression === 1 ? 1 : 0;
    this.expressionFrom = initial;
    this.expressionTarget = initial;
    this.lastSwitchAt = startAt;
    this.nextBlinkAt = this.scheduleBlink(startAt);
  }

  movePointer(point: ScenePoint): void {
    this.targetX = clamp(point.x, -1, 1);
    this.targetY = clamp(point.y, -1, 1);
  }

  leavePointer(): void {
    this.targetX = 0;
    this.targetY = 0;
  }

  click(point: ScenePoint, now: number): boolean {
    if (!isVisibleSphereHit(point)) return false;

    this.toggleExpression(now);
    return true;
  }

  getExpression(): 0 | 1 {
    return this.expressionTarget >= 0.5 ? 1 : 0;
  }

  setExpression(expression: 0 | 1, now: number): void {
    const target = expression >= 0.5 ? 1 : 0;
    this.lastSwitchAt = now;
    if (this.expressionTarget === target) return;

    this.expressionFrom = this.expressionAt(now);
    this.expressionTarget = target;
    this.expressionStartedAt = now;
    this.blinkStartedAt = null;
    this.nextBlinkAt = this.scheduleBlink(now);
  }

  toggleExpression(now: number): void {
    this.setExpression(this.getExpression() === 0 ? 1 : 0, now);
  }

  frame(now: number, deltaMs: number): SphereFrameState {
    if (this.idleSwitch && now - this.lastSwitchAt >= this.idleSwitchMs) {
      this.toggleExpression(now);
    }

    const expressionMix = this.expressionAt(now);
    const transitioning =
      now - this.expressionStartedAt < EXPRESSION_DURATION_MS;
    const blink = this.updateBlink(now, transitioning);

    const safeDelta = clamp(deltaMs, 0, 100) / 1_000;
    const damping = 1 - Math.exp(-POINTER_DAMPING * safeDelta);
    this.pointerX = mix(this.pointerX, this.targetX, damping);
    this.pointerY = mix(this.pointerY, this.targetY, damping);

    // Face turns toward the pointer; camera/stage stay fixed.
    const yaw = this.pointerX * YAW_MAX_RADIANS;
    const pitch = -this.pointerY * PITCH_MAX_RADIANS;

    return {
      pointer: [this.pointerX, this.pointerY] as const,
      expressionMix,
      blink,
      yaw,
      pitch,
    };
  }

  private expressionAt(now: number): number {
    if (!Number.isFinite(this.expressionStartedAt)) {
      return this.expressionTarget;
    }

    const progress = (now - this.expressionStartedAt) / EXPRESSION_DURATION_MS;
    if (progress >= 1) {
      this.expressionFrom = this.expressionTarget;
      return this.expressionTarget;
    }

    return mix(
      this.expressionFrom,
      this.expressionTarget,
      smoothstep(progress),
    );
  }

  private updateBlink(now: number, transitioning: boolean): number {
    if (transitioning) {
      this.blinkStartedAt = null;
      return 0;
    }

    if (this.blinkStartedAt === null && now >= this.nextBlinkAt) {
      this.blinkStartedAt = now;
    }

    if (this.blinkStartedAt === null) return 0;

    const progress = (now - this.blinkStartedAt) / BLINK_DURATION_MS;
    if (progress >= 1) {
      this.blinkStartedAt = null;
      this.nextBlinkAt = this.scheduleBlink(now);
      return 0;
    }

    return Math.sin(Math.PI * clamp(progress, 0, 1));
  }

  private scheduleBlink(from: number): number {
    return (
      from +
      BLINK_MIN_DELAY_MS +
      clamp(this.random(), 0, 1) * BLINK_DELAY_RANGE_MS
    );
  }
}

