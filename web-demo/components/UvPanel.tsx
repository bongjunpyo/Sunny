"use client";

import type { RefObject } from "react";

interface UvPanelProps {
  targetUv: number;
  auto: boolean;
  readoutRef: RefObject<HTMLSpanElement | null>; // 매 프레임 숫자는 React 상태 대신 DOM에 직접 씀
  onTargetUv: (uv: number) => void;
  onAuto: (auto: boolean) => void;
}

export function UvPanel({ targetUv, auto, readoutRef, onTargetUv, onAuto }: UvPanelProps) {
  return (
    <div className="uv-panel">
      <span>
        자외선지수
        <br />
        <strong>
          <span ref={readoutRef}>{targetUv.toFixed(1)}</span>
        </strong>
      </span>
      <input
        type="range"
        min={0}
        max={11}
        step={0.1}
        value={targetUv}
        disabled={auto}
        aria-label="자외선지수 조절"
        onChange={(e) => onTargetUv(Number(e.target.value))}
      />
      <button type="button" aria-pressed={auto} onClick={() => onAuto(!auto)}>
        {auto ? "자동: 해 뜨고 지기" : "직접 조절 중"}
      </button>
    </div>
  );
}
