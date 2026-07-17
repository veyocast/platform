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

type HealthListItem = {
  detail: string;
  label: string;
  status: string;
  tone: StatusTone;
};

type TimelineItem = {
  detail: string;
  label: string;
  meta: string;
  tone: StatusTone;
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

export function HealthList({
  ariaLabel,
  items
}: {
  ariaLabel: string;
  items: readonly HealthListItem[];
}) {
  return (
    <ul className="health-list" aria-label={ariaLabel}>
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
  items
}: {
  ariaLabel: string;
  items: readonly TimelineItem[];
}) {
  return (
    <ol className="timeline-list" aria-label={ariaLabel}>
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
