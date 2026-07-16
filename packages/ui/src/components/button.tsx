import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const buttonVariants = cva("cv-button", {
  variants: {
    variant: {
      primary: "cv-button--primary",
      secondary: "cv-button--secondary",
      ghost: "cv-button--ghost",
      destructive: "cv-button--destructive",
      inverse: "cv-button--inverse"
    },
    size: {
      sm: "cv-button--sm",
      md: "cv-button--md",
      lg: "cv-button--lg"
    }
  },
  defaultVariants: {
    variant: "primary",
    size: "md"
  }
});

export type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild = false,
  className,
  size,
  type,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const buttonProps = asChild ? props : { type: type ?? "button", ...props };

  return (
    <Component className={cn(buttonVariants({ size, variant }), className)} {...buttonProps} />
  );
}
