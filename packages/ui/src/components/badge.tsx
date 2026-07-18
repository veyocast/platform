import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export type BadgeStatus = "neutral" | "success" | "warning" | "critical" | "info";

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  showDot?: boolean;
  status?: BadgeStatus;
};

export function Badge({
  children,
  className,
  showDot = true,
  status = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span className={cn("vc-badge", `vc-badge--${status}`, className)} {...props}>
      {showDot ? <span aria-hidden="true" className="vc-badge__dot" /> : null}
      {children}
    </span>
  );
}

export type StatusDotProps = ComponentPropsWithoutRef<"span"> & {
  label?: string;
  status?: BadgeStatus;
};

export function StatusDot({ className, label, status = "neutral", ...props }: StatusDotProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("vc-status-dot", `vc-status-dot--${status}`, className)}
      role={label ? "img" : undefined}
      {...props}
    />
  );
}
