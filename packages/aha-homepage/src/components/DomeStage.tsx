import { Suspense, lazy, useEffect, useState } from "react";
import { DomeStage2D } from "./DomeStage2D";

export * from "./orbit-words";

/** 3D(WebGPU + vgpu + sphere 睡着也不小)拆独立 chunk:移动端走 2D 时完全不下载 */
const DomeStage3D = lazy(() =>
  import("./DomeStage3D").then((m) => ({ default: m.DomeStage3D })),
);

/** 舞台入口:移动端(触摸设备,微信/飞书等嵌入式浏览器多无 WebGPU,交互与尺寸也不同)
 *  无条件用 DOM 轨道动画版 —— 不加载 WebGPU 组件、不做能力探测;
 *  桌面走 WebGPU,初始化失败(onError)再兜底降级。判定只做一次,避免跨断点来回切换撕裂状态。
 *  ?stage=2d|3d 可强制指定(QA/演示用)。 */
export function DomeStage({ onWordClick }: { onWordClick?: (word: string) => void }) {
  const [flat, setFlat] = useState<boolean | null>(null);
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get("stage");
    if (forced === "2d") { setFlat(true); return; }
    if (forced === "3d") { setFlat(false); return; }
    setFlat(matchMedia("(pointer: coarse)").matches);
  }, []);
  if (flat === null) return null;
  if (flat) return <DomeStage2D onWordClick={onWordClick} />;
  return (
    <Suspense fallback={null}>
      <DomeStage3D onWordClick={onWordClick} onFail={() => setFlat(true)} />
    </Suspense>
  );
}
