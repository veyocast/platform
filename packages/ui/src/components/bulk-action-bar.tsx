import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";

export type BulkActionBarProps = ComponentPropsWithoutRef<"section"> & {
  actions: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
};

export function BulkActionBar({
  actions,
  className,
  description,
  title = "Bulkacties",
  ...props
}: BulkActionBarProps) {
  return (
    <section
      aria-label={typeof title === "string" ? title : "Bulkacties"}
      className={cn("vc-bulk-action-bar", className)}
      {...props}
    >
      <div className="vc-bulk-action-bar__copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="vc-bulk-action-bar__actions">{actions}</div>
    </section>
  );
}
