"use client";

import type { ChangeEvent, ReactNode } from "react";

export function SyncPlanningFilters({ children, className="row" }: { children: ReactNode; className?:string }) {
  function changed(event: ChangeEvent<HTMLFormElement>) {
    if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
  }
  return <form className={className} method="get" onChange={changed}>{children}</form>;
}
