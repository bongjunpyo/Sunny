"use client";

import { useId } from "react";
import styles from "./auth.module.css";

/** 라벨 · 입력 · 오류를 묶은 입력칸. 오류는 입력칸과 연결해 읽어 준다. */
export function Field({
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}: {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
