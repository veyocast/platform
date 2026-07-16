import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";

export type SkeletonProps = ComponentPropsWithoutRef<"div"> & {
  shape?: "block" | "circle";
};

export function Skeleton({ className, shape = "block", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("cv-skeleton", shape === "circle" && "cv-skeleton--circle", className)}
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
    <div className={cn("cv-empty-state", className)} {...props}>
      <div className="cv-empty-state__title">{title}</div>
      {children ? <div className="cv-empty-state__description">{children}</div> : null}
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
    <div className={cn("cv-error-state", className)} role="alert" {...props}>
      <div className="cv-error-state__title">{title}</div>
      {children ? <div className="cv-error-state__description">{children}</div> : null}
      {action}
    </div>
  );
}
