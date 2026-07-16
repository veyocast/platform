import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cn } from "../utils";

type CssVars = CSSProperties & Record<string, string | number | undefined>;

export type ProgressProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  label?: string;
  max?: number;
  value?: number;
};

export function Progress({ className, label, max = 100, value, style, ...props }: ProgressProps) {
  const hasValue = typeof value === "number";
  const safeMax = max > 0 ? max : 100;
  const safeValue = hasValue ? Math.min(Math.max(value, 0), safeMax) : undefined;
  const progressStyle: CssVars = {
    ...style,
    "--cv-progress-value": hasValue ? `${((safeValue ?? 0) / safeMax) * 100}%` : undefined
  };

  return (
    <div
      aria-label={label}
      aria-valuemax={safeMax}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn("cv-progress", !hasValue && "cv-progress--indeterminate", className)}
      role="progressbar"
      style={progressStyle}
      {...props}
    >
      <div className="cv-progress__bar" />
    </div>
  );
}
