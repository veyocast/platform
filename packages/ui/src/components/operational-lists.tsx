import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";
import { StatusPill, type StatusTone } from "./resource";

export type HealthListItem = {
  detail: string;
  label: string;
  status: string;
  tone: StatusTone;
};

export type TimelineItem = {
  detail: string;
  label: string;
  meta: string;
  tone: StatusTone;
};

export function HealthList({
  ariaLabel,
  className,
  items,
  ...props
}: ComponentPropsWithoutRef<"ul"> & {
  ariaLabel: string;
  items: readonly HealthListItem[];
}) {
  return (
    <ul
      {...props}
      aria-label={ariaLabel}
      className={cn("health-list", className)}
    >
      {items.map((item) => (
        <li className="health-item" key={item.label}>
          <span className="health-item__copy">
            <span className="health-item__title">{item.label}</span>
            <span className="work-panel__meta">{item.detail}</span>
          </span>
          <StatusPill label={item.status} tone={item.tone} />
        </li>
      ))}
    </ul>
  );
}

export function Timeline({
  ariaLabel,
  className,
  items,
  ...props
}: ComponentPropsWithoutRef<"ol"> & {
  ariaLabel: string;
  items: readonly TimelineItem[];
}) {
  return (
    <ol
      {...props}
      aria-label={ariaLabel}
      className={cn("timeline-list", className)}
    >
      {items.map((item, index) => (
        <li className="timeline-item" key={item.label}>
          <span className={`timeline-item__marker timeline-item__marker--${item.tone}`}>
            {index + 1}
          </span>
          <span className="timeline-item__copy">
            <span className="timeline-item__title">{item.label}</span>
            <span className="work-panel__meta">{item.detail}</span>
          </span>
          <StatusPill label={item.meta} tone={item.tone} />
        </li>
      ))}
    </ol>
  );
}
