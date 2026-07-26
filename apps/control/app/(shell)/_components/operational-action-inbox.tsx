"use client";

import {
  Button,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  StatusPill
} from "@veyocast/ui";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";

import type { OperationalSignal } from "../../../lib/control-operations";

export function OperationalActionInbox({
  signals,
  totalCount
}: {
  signals: readonly OperationalSignal[];
  totalCount: number;
}) {
  const inboxTone = signals.some((signal) => signal.severity === "critical")
    ? "critical"
    : signals.some((signal) => signal.severity === "warning")
      ? "warning"
      : totalCount
        ? "info"
        : "success";

  if (!signals.length && totalCount === 0) {
    return (
      <section
        aria-labelledby="action-inbox-title"
        className="dashboard-health-line control-motion-enter"
      >
        <CheckCircle2 aria-hidden="true" />
        <div>
          <h2 id="action-inbox-title">Alles werkt normaal</h2>
          <p>Er zijn geen operationele signalen die nu aandacht vragen.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="workspace-section action-inbox control-motion-enter"
      aria-labelledby="action-inbox-title"
    >
      <div className="workspace-section__header">
        <div>
          <h2 className="workspace-section__title" id="action-inbox-title">
            Actie nodig
          </h2>
          <p className="work-panel__meta">
            De belangrijkste signalen, gesorteerd op ernst en leeftijd.
          </p>
        </div>
        <StatusPill
          label={totalCount ? `${totalCount} open` : "Alles op orde"}
          tone={inboxTone}
        />
      </div>

      {signals.length ? (
        <ol
          className="operational-signal-list operational-signal-list--compact"
          aria-label="Belangrijkste operationele signalen"
        >
          {signals.map((signal) => (
            <SignalRow key={signal.id} signal={signal} />
          ))}
        </ol>
      ) : null}

      {totalCount > signals.length ? (
        <p className="action-inbox__overflow-note">
          De vijf belangrijkste van {totalCount} signalen worden getoond.
        </p>
      ) : null}
    </section>
  );
}

function SignalRow({ signal }: { signal: OperationalSignal }) {
  const tone =
    signal.severity === "critical"
      ? "critical"
      : signal.severity === "warning"
        ? "warning"
        : "info";
  const severityLabel =
    signal.severity === "critical"
      ? "Kritiek"
      : signal.severity === "warning"
        ? "Aandacht"
        : "Binnenkort";

  return (
    <li className="operational-signal-row" data-severity={signal.severity}>
      <Sheet>
        <SheetTrigger asChild>
          <button className="operational-signal-row__trigger" type="button">
            <span className="operational-signal-row__copy">
              <strong>{signal.label}</strong>
              <small>
                {signal.resource}
                <span aria-hidden="true"> · </span>
                <Clock3 aria-hidden="true" />
                {signal.ageLabel}
              </small>
            </span>
            <StatusPill label={severityLabel} tone={tone} />
          </button>
        </SheetTrigger>
        <SheetContent className="operational-signal-sheet">
          <SheetHeader>
            <StatusPill label={severityLabel} tone={tone} />
            <SheetTitle>{signal.label}</SheetTitle>
            <SheetDescription>
              {signal.resource} · {signal.ageLabel}
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            <dl className="operational-help operational-help--sheet">
              <div>
                <dt>Oorzaak</dt>
                <dd>{signal.cause}</dd>
              </div>
              <div>
                <dt>Effect</dt>
                <dd>{signal.effect}</dd>
              </div>
              <div>
                <dt>Herstel</dt>
                <dd>{signal.recovery}</dd>
              </div>
            </dl>
          </SheetBody>

          <SheetFooter>
            <Button asChild>
              <Link href={signal.href}>
                Open herstelcontext
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <SheetClose asChild>
              <Button variant="secondary">Sluiten</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Button asChild size="sm" variant="ghost">
        <Link
          aria-label={`Open herstelcontext voor ${signal.label}`}
          href={signal.href}
        >
          Open
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}
