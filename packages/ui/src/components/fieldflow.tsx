"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "../utils";
import { Badge, type BadgeStatus } from "./badge";
import { FilterBar, type FilterBarProps } from "./filter-bar";

export type FieldflowProviderProps = ComponentPropsWithoutRef<"div"> & {
  contrast?: "high" | "standard";
  density?: "comfortable" | "compact";
  reducedMotion?: boolean;
  theme?: "dark" | "light";
};

export function FieldflowProvider({
  children,
  className,
  contrast = "standard",
  density = "comfortable",
  reducedMotion = false,
  theme = "light",
  ...props
}: FieldflowProviderProps) {
  return (
    <div
      className={cn("vc-fieldflow", className)}
      data-contrast={contrast}
      data-density={density}
      data-fieldflow="v3"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-theme={theme}
      {...props}
    >
      {children}
    </div>
  );
}

type FieldflowShellKind =
  | "app"
  | "immersive-editor"
  | "marketing"
  | "platform"
  | "tv";

export type FieldflowShellProps = ComponentPropsWithoutRef<"div"> & {
  kind?: FieldflowShellKind;
};

export function FieldflowShell({
  children,
  className,
  kind = "app",
  ...props
}: FieldflowShellProps) {
  return (
    <div className={cn("vc-fieldflow-shell", className)} data-shell={kind} {...props}>
      {children}
    </div>
  );
}

export function AppShell(props: Omit<FieldflowShellProps, "kind">) {
  return <FieldflowShell kind="app" {...props} />;
}

export function MarketingShell(props: Omit<FieldflowShellProps, "kind">) {
  return <FieldflowShell kind="marketing" {...props} />;
}

export function ImmersiveEditorShell(props: Omit<FieldflowShellProps, "kind">) {
  return <FieldflowShell kind="immersive-editor" {...props} />;
}

export function PlatformShell(props: Omit<FieldflowShellProps, "kind">) {
  return <FieldflowShell kind="platform" {...props} />;
}

export function TVShell(props: Omit<FieldflowShellProps, "kind">) {
  return <FieldflowShell kind="tv" {...props} />;
}

export type CommandBarProps = Omit<ComponentPropsWithoutRef<"form">, "aria-label"> & {
  actions?: ReactNode;
  label?: string;
  primary: ReactNode;
  status?: ReactNode;
};

export function CommandBar({
  actions,
  className,
  label = "Opdrachten en zoeken",
  primary,
  status,
  ...props
}: CommandBarProps) {
  return (
    <form aria-label={label} className={cn("vc-command-bar", className)} {...props}>
      <div className="vc-command-bar__primary">{primary}</div>
      {status ? (
        <div aria-live="polite" className="vc-command-bar__status">
          {status}
        </div>
      ) : null}
      {actions ? <div className="vc-command-bar__actions">{actions}</div> : null}
    </form>
  );
}

export type SegmentedControlOption<T extends string> = Readonly<{
  description?: string;
  disabled?: boolean;
  label: string;
  value: T;
}>;

export type SegmentedControlProps<T extends string> = Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange"
> & {
  label: string;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
};

export function SegmentedControl<T extends string>({
  className,
  label,
  onChange,
  options,
  value,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      aria-label={label}
      className={cn("vc-segmented-control", className)}
      role="radiogroup"
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-checked={selected}
            className="vc-segmented-control__option"
            data-selected={selected ? "true" : undefined}
            disabled={option.disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            <span className="vc-segmented-control__label">{option.label}</span>
            {option.description ? (
              <span className="vc-segmented-control__description">{option.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type JourneyStep = Readonly<{
  id: string;
  label: string;
  optional?: boolean;
}>;

export type JourneyShellProps = ComponentPropsWithoutRef<"section"> & {
  actions?: ReactNode;
  aside?: ReactNode;
  currentStep: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  steps: readonly JourneyStep[];
  title: ReactNode;
};

export function JourneyShell({
  actions,
  aside,
  children,
  className,
  currentStep,
  description,
  eyebrow,
  steps,
  style,
  title,
  ...props
}: JourneyShellProps) {
  const stepsRef = useRef<HTMLElement>(null);
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentStep)
  );

  const journeyStyle = {
    ...style,
    "--vc-journey-step-count": steps.length
  } as CSSProperties;

  useEffect(() => {
    const stepsElement = stepsRef.current;
    const currentElement = stepsElement?.querySelector<HTMLElement>(
      '[aria-current="step"]'
    );
    if (!stepsElement || !currentElement || stepsElement.scrollWidth <= stepsElement.clientWidth) {
      return;
    }

    const stepsRect = stepsElement.getBoundingClientRect();
    const currentRect = currentElement.getBoundingClientRect();
    const currentCenter =
      currentRect.left - stepsRect.left + stepsElement.scrollLeft + currentRect.width / 2;
    const targetLeft = Math.max(0, currentCenter - stepsElement.clientWidth / 2);

    stepsElement.scrollTo({
      behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      left: targetLeft
    });
  }, [currentStep, steps.length]);

  return (
    <section className={cn("vc-journey-shell", className)} style={journeyStyle} {...props}>
      <header className="vc-journey-shell__header">
        <div>
          {eyebrow ? <div className="vc-journey-shell__eyebrow">{eyebrow}</div> : null}
          <h1 className="vc-journey-shell__title">{title}</h1>
          {description ? (
            <p className="vc-journey-shell__description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="vc-journey-shell__header-actions">{actions}</div> : null}
      </header>
      <nav aria-label="Voortgang" className="vc-journey-shell__steps" ref={stepsRef} tabIndex={0}>
        <ol>
          {steps.map((step, index) => {
            const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
            return (
              <li aria-current={state === "current" ? "step" : undefined} data-state={state} key={step.id}>
                <span aria-hidden="true" className="vc-journey-shell__step-index">
                  {state === "complete" ? "✓" : index + 1}
                </span>
                <span>{step.label}</span>
                {step.optional ? <span className="vc-journey-shell__optional">Optioneel</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className={cn("vc-journey-shell__layout", aside && "vc-journey-shell__layout--with-aside")}>
        <div className="vc-journey-shell__content">{children}</div>
        {aside ? <aside className="vc-journey-shell__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}

export type StickyActionBarProps = ComponentPropsWithoutRef<"footer"> & {
  aside?: ReactNode;
};

export function StickyActionBar({ aside, children, className, ...props }: StickyActionBarProps) {
  return (
    <footer className={cn("vc-sticky-action-bar", className)} {...props}>
      {aside ? <div className="vc-sticky-action-bar__aside">{aside}</div> : null}
      <div className="vc-sticky-action-bar__actions">{children}</div>
    </footer>
  );
}

export type HealthBadgeProps = ComponentPropsWithoutRef<"span"> & {
  detail?: string;
  label: string;
  status: BadgeStatus;
};

export function HealthBadge({ className, detail, label, status, ...props }: HealthBadgeProps) {
  return (
    <span className={cn("vc-health-badge", className)} {...props}>
      <Badge status={status}>{label}</Badge>
      {detail ? <span className="vc-health-badge__detail">{detail}</span> : null}
    </span>
  );
}

export type ScreenSnapshotProps = ComponentPropsWithoutRef<"figure"> & {
  emptyLabel?: string;
  label: string;
  orientation?: "landscape" | "portrait";
};

export function ScreenSnapshot({
  children,
  className,
  emptyLabel = "Nog geen schermbeeld beschikbaar",
  label,
  orientation = "landscape",
  ...props
}: ScreenSnapshotProps) {
  return (
    <figure className={cn("vc-screen-snapshot", className)} {...props}>
      <div
        aria-label={label}
        className="vc-screen-snapshot__viewport"
        data-orientation={orientation}
        role="img"
      >
        {children ?? <span className="vc-screen-snapshot__empty">{emptyLabel}</span>}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function UnifiedFilterDock(props: FilterBarProps) {
  return <FilterBar {...props} />;
}
