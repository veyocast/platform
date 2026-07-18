import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const buttonVariants = cva("vc-button", {
  variants: {
    variant: {
      primary: "vc-button--primary",
      secondary: "vc-button--secondary",
      ghost: "vc-button--ghost",
      destructive: "vc-button--destructive",
      inverse: "vc-button--inverse"
    },
    size: {
      sm: "vc-button--sm",
      md: "vc-button--md",
      lg: "vc-button--lg"
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
