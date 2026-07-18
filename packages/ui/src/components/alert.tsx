import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";

export type AlertStatus = "info" | "success" | "warning" | "critical";

export type AlertProps = ComponentPropsWithoutRef<"div"> & {
  action?: ReactNode;
  status?: AlertStatus;
  title: ReactNode;
};

export function Alert({
  action,
  children,
  className,
  status = "info",
  title,
  ...props
}: AlertProps) {
  return (
    <div
      className={cn("vc-alert", `vc-alert--${status}`, className)}
      role={status === "critical" ? "alert" : "status"}
      {...props}
    >
      <div className="vc-alert__title">{title}</div>
      {children ? <div className="vc-alert__description">{children}</div> : null}
      {action}
    </div>
  );
}
