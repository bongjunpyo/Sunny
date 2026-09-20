"use client";

import { useEffect, useRef } from "react";
import styles from "./SeaCover.module.css";

/** 윤슬 커버 — 해 아래로 모이는 짧은 반사광을 코드로 그린다.
 *  시안: docs/design/stories-wearing-light.html
 *
 *  실제 촬영이 아니다. 나중에 사진이나 AI 생성물(표기)로 바꾼다.
 *  화면 밖에서는 그리지 않고, 모션 감소 설정이면 한 장만 그린다. */
export function SeaCover({ label, seed = 7, tall = false }: { label: string; seed?: number; tall?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const TAU = Math.PI * 2;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = (i: number) => {
      const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    let width = 0;
    let height = 0;
    let visible = false;
    let frame = 0;
    let parts: { d: number; g: number; s: number; ph: number; f: number }[] = [];

    function build() {
      const count = Math.round((width * height) / 330);
      parts = Array.from({ length: count }, (_, i) => {
        const d = Math.pow(random(i), 1.5);
        const g = (random(i + 0.5) + random(i + 0.7) + random(i + 0.9)) / 3 - 0.5;
        return { d, g, s: 0.35 + d * 2.1, ph: random(i + 0.3) * TAU, f: 1.2 + random(i + 0.1) * 3.6 };
      });
    }

    function draw(t: number) {
      if (!ctx || !width) return;
      const sunX = width * 0.58;

      const water = ctx.createLinearGradient(0, 0, 0, height);
      water.addColorStop(0, "#8d7a64");
      water.addColorStop(1, "#2d2c2b");
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(sunX, 0, 0, sunX, 0, height * 1.05);
      glow.addColorStop(0, "rgba(243,178,100,.34)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = "rgba(255,225,190,.07)";
      for (let i = 1; i < 40; i++) {
        const d = Math.pow(i / 40, 1.5);
        const y = d * height;
        ctx.beginPath();
        for (let x = 0; x <= width + 20; x += 20) {
          ctx.lineTo(x, y + Math.sin((x * 0.018) / (0.25 + d) + i * 1.7 + t * 0.5) * (0.6 + 3 * d));
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        const a = Math.pow(Math.max(0, Math.sin(t * p.f + p.ph)), 9);
        if (a < 0.03) continue;
        const spread = (0.03 + 0.5 * p.d) * width * 0.62;
        const x = sunX + p.g * 2 * spread;
        const y = p.d * height;
        const r = p.s * (0.55 + a * 0.8);
        ctx.fillStyle = `rgba(255,220,160,${a})`;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2.3, r * 0.62, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function resize() {
      const box = canvas!.getBoundingClientRect();
      if (!box.width) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      canvas!.width = box.width * dpr;
      canvas!.height = box.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(2.4);
    }

    const sizeWatcher = new ResizeObserver(resize);
    sizeWatcher.observe(canvas);
    const viewWatcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    viewWatcher.observe(canvas);

    if (!reduced) {
      const loop = (ms: number) => {
        if (visible) draw(ms / 1000);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      sizeWatcher.disconnect();
      viewWatcher.disconnect();
    };
  }, [seed]);

  return (
    <div className={tall ? `${styles.cover} ${styles.tall}` : styles.cover}>
      <canvas ref={ref} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
