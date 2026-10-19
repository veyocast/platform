"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  HTMLAttributes,
  ReactNode
} from "react";
import { createContext, forwardRef, useContext } from "react";

import { cn } from "../utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const PortalContainer = createContext<HTMLElement | null>(null);

/** Keep an application's overlays inside its own theme and CSS scope. */
export function DialogPortalProvider({ container, children }: { container: HTMLElement | null; children: ReactNode }) {
  return <PortalContainer.Provider value={container}>{children}</PortalContainer.Provider>;
}

/** Shared portal scope, configured through DialogPortalProvider. */
export function useDialogPortalContainer() {
  return useContext(PortalContainer);
}

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  closeLabel?: string;
  size?: "standard" | "wide" | "editor" | "fullscreen";
  showClose?: boolean;
};

export const DialogContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { children, className, closeLabel = "Sluiten", size = "standard", showClose = true, ...props },
  ref
) {
  const container = useDialogPortalContainer();
  return (
    <DialogPrimitive.Portal container={container ?? undefined}>
      <DialogPrimitive.Overlay className="vc-overlay vc-dialog__overlay" />
      <DialogPrimitive.Content
        className={cn("vc-dialog__content", `vc-dialog__content--${size}`, className)}
        data-dialog-size={size}
        ref={ref}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="vc-overlay-close vc-dialog__close"
          >
            <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("vc-overlay-header", "vc-dialog__header", className)} {...props} />;
}

export const DialogTitle = forwardRef<
  ComponentRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      className={cn("vc-overlay-title", "vc-dialog__title", className)}
      ref={ref}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      className={cn("vc-overlay-description", "vc-dialog__description", className)}
      ref={ref}
      {...props}
    />
  );
});

export type DialogBodyProps = HTMLAttributes<HTMLDivElement>;

export function DialogBody({ className, ...props }: DialogBodyProps) {
  return <div className={cn("vc-overlay-body", "vc-dialog__body", className)} {...props} />;
}

export type DialogFooterProps = HTMLAttributes<HTMLDivElement> & {
  aside?: ReactNode;
};

export function DialogFooter({ aside, children, className, ...props }: DialogFooterProps) {
  return (
    <div className={cn("vc-overlay-footer", "vc-dialog__footer", className)} {...props}>
      {aside ? <div className="vc-overlay-footer__aside">{aside}</div> : null}
      <div className="vc-overlay-footer__actions">{children}</div>
    </div>
  );
}
