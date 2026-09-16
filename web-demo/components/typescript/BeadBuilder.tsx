"use client";

import { useState } from "react";
import {
  COLOR_HEX,
  COLOR_LABEL,
  activatedColor,
  beadStrength,
  type Bead,
  type Concentration,
  type PhotochromicColor,
} from "@/lib/bead";
import styles from "./BeadBuilder.module.css";

// 타입에서 선택지를 만들기 때문에, 타입에 없는 값은 버튼으로도 만들 수 없다
const COLORS = Object.keys(COLOR_HEX) as PhotochromicColor[];
const CONCENTRATIONS: Concentration[] = [3, 6, 9];

export default function BeadBuilder() {
  const [color, setColor] = useState<PhotochromicColor>("violet");
  const [concentration, setConcentration] = useState<Concentration>(6);
  const [uv, setUv] = useState(8);

  const bead: Bead = { id: "preview", color, concentration };

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <fieldset>
          <legend>색 · PhotochromicColor</legend>
          <div className={styles.row}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === color}
                className={styles.chip}
                onClick={() => setColor(c)}
              >
                <i style={{ background: COLOR_HEX[c] }} />
                {COLOR_LABEL[c]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>농도 · Concentration</legend>
          <div className={styles.row}>
            {CONCENTRATIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === concentration}
                className={styles.chip}
                onClick={() => setConcentration(n)}
              >
                {n} wt%
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>자외선지수 · number</legend>
          <input
            type="range"
            min={0}
            max={11}
            step={0.5}
            value={uv}
            onChange={(e) => setUv(Number(e.target.value))}
            className={styles.range}
          />
          <span className={styles.uv}>{uv.toFixed(1)}</span>
        </fieldset>

        <pre className={styles.json}>
          <code>{`const bead: Bead = ${JSON.stringify(bead, null, 2)}`}</code>
        </pre>
      </div>

      <div className={styles.preview}>
        <figure>
          <div className={styles.bead} style={{ background: activatedColor(bead, 0) }} />
          <figcaption>실내 (UV 0)</figcaption>
        </figure>
        <figure>
          <div className={styles.bead} style={{ background: activatedColor(bead, uv) }} />
          <figcaption>
            햇빛 (UV {uv.toFixed(1)}) · 발색 {Math.round(beadStrength(bead, uv) * 100)}%
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
