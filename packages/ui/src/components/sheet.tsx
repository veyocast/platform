"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  HTMLAttributes,
  ReactNode
} from "react";
import { forwardRef } from "react";

import { cn } from "../utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetSide = "bottom" | "left" | "right";

export type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
  showClose?: boolean;
  side?: SheetSide;
};

export const SheetContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  {
    children,
    className,
    closeLabel = "Sluiten",
    showClose = true,
    side = "right",
    ...props
  },
  ref
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="vc-overlay vc-sheet__overlay" />
      <DialogPrimitive.Content
        className={cn("vc-sheet__content", `vc-sheet__content--${side}`, className)}
        ref={ref}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="vc-overlay-close vc-sheet__close"
          >
            <span aria-hidden="true">×</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("vc-overlay-header", "vc-sheet__header", className)} {...props} />;
}

export const SheetTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      className={cn("vc-overlay-title", "vc-sheet__title", className)}
      ref={ref}
      {...props}
    />
  );
});

export const SheetDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      className={cn("vc-overlay-description", "vc-sheet__description", className)}
      ref={ref}
      {...props}
    />
  );
});

export type SheetBodyProps = HTMLAttributes<HTMLDivElement>;

export function SheetBody({ className, ...props }: SheetBodyProps) {
  return <div className={cn("vc-overlay-body", "vc-sheet__body", className)} {...props} />;
}

export type SheetFooterProps = HTMLAttributes<HTMLDivElement> & {
  aside?: ReactNode;
};

export function SheetFooter({ aside, children, className, ...props }: SheetFooterProps) {
  return (
    <div className={cn("vc-overlay-footer", "vc-sheet__footer", className)} {...props}>
      {aside ? <div className="vc-overlay-footer__aside">{aside}</div> : null}
      <div className="vc-overlay-footer__actions">{children}</div>
    </div>
  );
}
