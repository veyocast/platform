"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useState } from "react";

import { cn } from "../utils";

export type FilterBarProps = Omit<ComponentPropsWithoutRef<"div">, "results"> & {
  actions?: ReactNode;
  activeCount?: number;
  clearHref?: string;
  clearLabel?: string;
  defaultOpen?: boolean;
  filterLabel?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  primary?: ReactNode;
  results?: ReactNode;
};

export function FilterBar({
  actions,
  activeCount = 0,
  children,
  className,
  clearHref,
  clearLabel = "Filters wissen",
  defaultOpen = false,
  filterLabel = "Filters",
  onOpenChange,
  open: controlledOpen,
  primary,
  results,
  ...props
}: FilterBarProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  return (
    <Collapsible.Root
      className={cn("vc-filter-bar", className)}
      onOpenChange={handleOpenChange}
      open={open}
      {...props}
    >
      <div className="vc-filter-bar__primary">
        {primary ? <div className="vc-filter-bar__primary-controls">{primary}</div> : null}
        <div className="vc-filter-bar__meta">
          {results ? (
            <div aria-live="polite" className="vc-filter-bar__results">
              {results}
            </div>
          ) : null}
          <Collapsible.Trigger
            aria-label={`${filterLabel}${activeCount ? `, ${activeCount} actief` : ""}`}
            className="vc-filter-bar__trigger"
            type="button"
          >
            <span>
              {filterLabel}
              {activeCount ? <span className="vc-filter-bar__count">{activeCount}</span> : null}
            </span>
            <span aria-hidden="true" className="vc-filter-bar__chevron">
              {open ? "−" : "+"}
            </span>
          </Collapsible.Trigger>
          {actions ? <div className="vc-filter-bar__actions">{actions}</div> : null}
        </div>
      </div>
      <Collapsible.Content className="vc-filter-bar__content" forceMount>
        <div className="vc-filter-bar__controls">{children}</div>
        {activeCount > 0 && clearHref ? (
          <a className="vc-filter-bar__clear" href={clearHref}>
            {clearLabel}
          </a>
        ) : null}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
