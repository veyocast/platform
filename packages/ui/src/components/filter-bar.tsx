"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useState } from "react";

import { cn } from "../utils";

export type FilterBarProps = Omit<ComponentPropsWithoutRef<"div">, "results"> & {
  activeCount?: number;
  clearHref?: string;
  results: ReactNode;
};

export function FilterBar({
  activeCount = 0,
  children,
  className,
  clearHref,
  results,
  ...props
}: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      className={cn("vc-filter-bar", className)}
      onOpenChange={setOpen}
      open={open}
      {...props}
    >
      <div className="vc-filter-bar__header">
        <Collapsible.Trigger className="vc-filter-bar__trigger" type="button">
          <span>Filters{activeCount ? ` (${activeCount})` : ""}</span>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </Collapsible.Trigger>
        <div aria-live="polite" className="vc-filter-bar__results">{results}</div>
      </div>
      <Collapsible.Content className="vc-filter-bar__content" forceMount>
        <div className="vc-filter-bar__controls">{children}</div>
        {activeCount > 0 && clearHref ? (
          <a className="vc-filter-bar__clear" href={clearHref}>Filters wissen</a>
        ) : null}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
