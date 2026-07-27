"use client";

import { createPortal } from "react-dom";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from "react";

import styles from "./floating-panel.module.css";

const viewportMargin = 12;
const panelGap = 6;
const minimumUsefulHeight = 120;

type FloatingPanelPosition = {
  left: number;
  maxHeight: number;
  placement: "bottom" | "top";
  ready: boolean;
  top: number;
};

type FloatingPanelProps = {
  align?: "end" | "start";
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  contentClassName?: string;
  contentLabel: string;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  role?: "dialog" | "group" | "menu";
  side?: "auto" | "bottom" | "top";
  trigger: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  triggerTitle?: string;
};

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function initialPosition(): FloatingPanelPosition {
  return {
    left: viewportMargin,
    maxHeight: minimumUsefulHeight,
    placement: "bottom",
    ready: false,
    top: viewportMargin
  };
}

export function FloatingPanel({
  align = "end",
  children,
  className,
  contentClassName,
  contentLabel,
  disabled = false,
  onOpenChange,
  open: controlledOpen,
  role = "dialog",
  side = "auto",
  trigger,
  triggerAriaLabel,
  triggerClassName,
  triggerTitle
}: FloatingPanelProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<FloatingPanelPosition>(
    initialPosition
  );
  const open = controlledOpen ?? internalOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setPosition(initialPosition());
      }
    },
    [controlledOpen, onOpenChange]
  );

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelWidth = Math.min(
      panel.scrollWidth,
      document.documentElement.clientWidth - viewportMargin * 2
    );
    const desiredHeight = panel.scrollHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const availableBelow =
      viewportHeight - anchorRect.bottom - panelGap - viewportMargin;
    const availableAbove =
      anchorRect.top - panelGap - viewportMargin;
    const placement =
      side === "auto"
        ? availableBelow >= Math.min(desiredHeight, minimumUsefulHeight) ||
          availableBelow >= availableAbove
          ? "bottom"
          : "top"
        : side;
    const availableHeight =
      placement === "bottom" ? availableBelow : availableAbove;
    const maxHeight = Math.max(
      1,
      Math.min(availableHeight, viewportHeight - viewportMargin * 2)
    );
    const unclampedLeft =
      align === "start"
        ? anchorRect.left
        : anchorRect.right - panelWidth;
    const left = Math.min(
      Math.max(unclampedLeft, viewportMargin),
      Math.max(viewportMargin, viewportWidth - viewportMargin - panelWidth)
    );
    const visibleHeight = Math.min(desiredHeight, maxHeight);
    const top =
      placement === "bottom"
        ? anchorRect.bottom + panelGap
        : anchorRect.top - panelGap - visibleHeight;

    setPosition({
      left,
      maxHeight,
      placement,
      ready: true,
      top: Math.max(viewportMargin, top)
    });
  }, [align, side]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;

    const frame = window.requestAnimationFrame(updatePosition);
    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        anchorRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      anchorRef.current?.focus();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(handleViewportChange);

    if (anchorRef.current) resizeObserver?.observe(anchorRef.current);
    if (panelRef.current) resizeObserver?.observe(panelRef.current);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [mounted, open, setOpen, updatePosition]);

  useEffect(() => {
    if (!open || !position.ready) return;
    const focusTarget = panelRef.current?.querySelector<HTMLElement>(
      "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
    );
    focusTarget?.focus({ preventScroll: true });
  }, [open, position.ready]);

  const panelStyle = {
    left: `${position.left}px`,
    maxHeight: `${position.maxHeight}px`,
    top: `${position.top}px`
  } satisfies CSSProperties;
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <div className={classNames(styles.anchor, className)} data-open={open}>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup={role === "menu" ? "menu" : "dialog"}
        aria-label={triggerAriaLabel}
        className={classNames(styles.trigger, triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        ref={anchorRef}
        title={triggerTitle}
        type="button"
      >
        {trigger}
      </button>
      {open && mounted
        ? createPortal(
            <div
              aria-label={contentLabel}
              className={classNames(styles.panel, contentClassName)}
              data-floating-panel=""
              data-placement={position.placement}
              data-ready={position.ready}
              id={panelId}
              ref={panelRef}
              role={role}
              style={panelStyle}
            >
              {typeof children === "function" ? children(close) : children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
