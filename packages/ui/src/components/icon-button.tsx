import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const iconButtonVariants = cva("cv-icon-button", {
  variants: {
    variant: {
      default: "",
      destructive: "cv-icon-button--destructive"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export type IconButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    asChild?: boolean;
  };

export function IconButton({
  asChild = false,
  className,
  type,
  variant,
  ...props
}: IconButtonProps) {
  const hasAccessibleName = Boolean(props["aria-label"] || props["aria-labelledby"]);

  if (process.env.NODE_ENV !== "production" && !hasAccessibleName) {
    throw new Error("IconButton requires aria-label or aria-labelledby.");
  }

  const Component = asChild ? Slot : "button";
  const buttonProps = asChild ? props : { type: type ?? "button", ...props };

  return <Component className={cn(iconButtonVariants({ variant }), className)} {...buttonProps} />;
}
