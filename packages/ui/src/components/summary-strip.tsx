import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";

export type SummaryStripTone = "critical" | "info" | "neutral" | "success" | "warning";

export type SummaryStripItem = Readonly<{
  detail?: ReactNode;
  label: ReactNode;
  tone?: SummaryStripTone;
  value: ReactNode;
}>;

export type SummaryStripProps = Omit<ComponentPropsWithoutRef<"dl">, "children"> & {
  items: readonly SummaryStripItem[];
};

export function SummaryStrip({
  "aria-label": ariaLabel = "Samenvatting",
  className,
  items,
  ...props
}: SummaryStripProps) {
  return (
    <dl aria-label={ariaLabel} className={cn("vc-summary-strip", className)} {...props}>
      {items.map((item, index) => (
        <div
          className={cn(
            "vc-summary-strip__item",
            `vc-summary-strip__item--${item.tone ?? "neutral"}`
          )}
          key={`${typeof item.label === "string" ? item.label : "stat"}-${index}`}
        >
          <dt className="vc-summary-strip__label">{item.label}</dt>
          <dd className="vc-summary-strip__value">{item.value}</dd>
          {item.detail ? <dd className="vc-summary-strip__detail">{item.detail}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export const CompactStats = SummaryStrip;
