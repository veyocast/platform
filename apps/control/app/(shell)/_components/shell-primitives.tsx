import type { ReactNode } from "react";

type StatusTone = "critical" | "info" | "neutral" | "success" | "warning";

type PageHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  status?: {
    label: string;
    tone: StatusTone;
  };
  title: string;
};

type MetricCardProps = {
  detail: string;
  label: string;
  tone?: StatusTone;
  value: string;
};

export function StatusPill({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  status,
  title
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <p className="page-kicker">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  detail,
  label,
  tone = "neutral",
  value
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="status-row">
        <span className="metric-card__label">{label}</span>
        <StatusPill label={toneLabel[tone]} tone={tone} />
      </div>
      <p className="metric-card__value">{value}</p>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}

const toneLabel: Record<StatusTone, string> = {
  critical: "Actie",
  info: "Info",
  neutral: "Rustig",
  success: "Goed",
  warning: "Let op"
};
