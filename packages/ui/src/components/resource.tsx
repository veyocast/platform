import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils";
import { Alert } from "./alert";
import { Badge, type BadgeStatus } from "./badge";
import { Skeleton } from "./states";

export type StatusTone = BadgeStatus;

export type StatusPillProps = ComponentPropsWithoutRef<"span"> & {
  label: string;
  tone?: StatusTone;
};

export function StatusPill({ label, tone = "neutral", ...props }: StatusPillProps) {
  return (
    <Badge status={tone} {...props}>
      {label}
    </Badge>
  );
}

export type PageHeaderProps = ComponentPropsWithoutRef<"header"> & {
  actions?: ReactNode;
  breadcrumbs?: readonly Readonly<{ href?: string; label: string }>[];
  description: string;
  eyebrow?: string;
  status?: Readonly<{ label: string; tone: StatusTone }>;
  title: string;
};

export function PageHeader({
  actions,
  breadcrumbs,
  className,
  description,
  eyebrow,
  status,
  title,
  ...props
}: PageHeaderProps) {
  const trail = breadcrumbs ?? [
    { label: "Control" },
    ...(eyebrow ? [{ label: eyebrow }] : []),
    { label: title }
  ];

  return (
    <header className={cn("vc-page-header", className)} {...props}>
      <nav aria-label="Broodkruimel" className="vc-breadcrumbs">
        <ol>
          {trail.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <div className="vc-page-header__main">
        <div className="vc-page-header__copy">
          <h1 className="vc-page-header__title">{title}</h1>
          <p className="vc-page-header__description">{description}</p>
          {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
        </div>
        {actions ? <div className="vc-page-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export type ToolbarProps = ComponentPropsWithoutRef<"div"> & {
  summary?: ReactNode;
};

export function Toolbar({ children, className, summary, ...props }: ToolbarProps) {
  return (
    <div className={cn("vc-toolbar", className)} {...props}>
      <div className="vc-toolbar__controls">{children}</div>
      {summary ? <div className="vc-toolbar__summary">{summary}</div> : null}
    </div>
  );
}

export type DataTableProps = ComponentPropsWithoutRef<"table"> & {
  caption: ReactNode;
  frameClassName?: string;
  responsive?: boolean;
};

export function DataTable({
  caption,
  children,
  className,
  frameClassName,
  responsive = true,
  ...props
}: DataTableProps) {
  return (
    <div className={cn("vc-data-table-frame", frameClassName)}>
      <table
        className={cn(
          "vc-data-table",
          responsive && "vc-data-table--responsive",
          className
        )}
        {...props}
      >
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export type InspectorProps = ComponentPropsWithoutRef<"section"> & {
  actions?: ReactNode;
  description?: ReactNode;
  status?: Readonly<{ label: string; tone: StatusTone }>;
  title: ReactNode;
};

export function Inspector({
  actions,
  children,
  className,
  description,
  status,
  title,
  ...props
}: InspectorProps) {
  return (
    <section className={cn("vc-inspector", className)} {...props}>
      <div className="vc-inspector__header">
        <div>
          <h2 className="vc-inspector__title">{title}</h2>
          {description ? <p className="vc-inspector__description">{description}</p> : null}
        </div>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </div>
      <div className="vc-inspector__content">{children}</div>
      {actions ? <div className="vc-inspector__actions">{actions}</div> : null}
    </section>
  );
}

export type ResourceStateKind = "empty" | "error" | "forbidden" | "loading" | "stale";

export type ResourceStateProps = ComponentPropsWithoutRef<"section"> & {
  action?: ReactNode;
  kind: ResourceStateKind;
  title: ReactNode;
};

export function ResourceState({
  action,
  children,
  className,
  kind,
  title,
  ...props
}: ResourceStateProps) {
  if (kind === "loading") {
    return (
      <section
        aria-busy="true"
        aria-label={typeof title === "string" ? title : "Gegevens laden"}
        className={cn("vc-resource-state", "vc-resource-state--loading", className)}
        {...props}
      >
        <Skeleton style={{ height: "1.5rem", width: "45%" }} />
        <Skeleton style={{ height: "4rem" }} />
        <span className="vc-visually-hidden">{title}</span>
      </section>
    );
  }

  const alertStatus = kind === "error" ? "critical" : kind === "stale" ? "warning" : "info";

  return (
    <section
      className={cn("vc-resource-state", `vc-resource-state--${kind}`, className)}
      {...props}
    >
      <Alert action={action} status={alertStatus} title={title}>
        {children}
      </Alert>
    </section>
  );
}
