import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";

export type SkeletonProps = ComponentPropsWithoutRef<"div"> & {
  shape?: "block" | "circle";
};

export function Skeleton({ className, shape = "block", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("vc-skeleton", shape === "circle" && "vc-skeleton--circle", className)}
      {...props}
    />
  );
}

export type EmptyStateProps = ComponentPropsWithoutRef<"div"> & {
  action?: ReactNode;
  title: ReactNode;
};

export function EmptyState({ action, children, className, title, ...props }: EmptyStateProps) {
  return (
    <div className={cn("vc-empty-state", className)} {...props}>
      <div className="vc-empty-state__title">{title}</div>
      {children ? <div className="vc-empty-state__description">{children}</div> : null}
      {action}
    </div>
  );
}

export type ErrorStateProps = ComponentPropsWithoutRef<"div"> & {
  action?: ReactNode;
  title: ReactNode;
};

export function ErrorState({ action, children, className, title, ...props }: ErrorStateProps) {
  return (
    <div className={cn("vc-error-state", className)} role="alert" {...props}>
      <div className="vc-error-state__title">{title}</div>
      {children ? <div className="vc-error-state__description">{children}</div> : null}
      {action}
    </div>
  );
}
