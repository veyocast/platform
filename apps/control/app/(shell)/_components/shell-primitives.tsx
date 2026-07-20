import { StatusPill, type StatusTone } from "@veyocast/ui";

export { PageHeader, StatusPill } from "@veyocast/ui";

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
  critical: "Actie nodig",
  info: "Informatie",
  neutral: "Overzicht",
  success: "Op orde",
  warning: "Aandacht"
};
