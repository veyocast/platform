import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";

import { cn } from "../utils";

export type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: "true";
  id: string;
};

export type FieldRenderProps = {
  controlProps: FieldControlProps;
  id: string;
};

export type FieldProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode | ((props: FieldRenderProps) => ReactNode);
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  label: ReactNode;
};

export function Field({
  children,
  className,
  description,
  error,
  id,
  label,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const controlProps: FieldControlProps = {
    "aria-describedby": describedBy,
    "aria-invalid": error ? "true" : undefined,
    id: controlId
  };

  return (
    <div className={cn("vc-field", className)} {...props}>
      <label className="vc-field__label" htmlFor={controlId}>
        {label}
      </label>
      {description ? (
        <div className="vc-field__description" id={descriptionId}>
          {description}
        </div>
      ) : null}
      {typeof children === "function" ? children({ controlProps, id: controlId }) : children}
      {error ? (
        <div className="vc-field__error" id={errorId}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function TextInput({ className, type = "text", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("vc-field-control", className)} type={type} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("vc-field-control", "vc-textarea", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn("vc-field-control", className)} {...props} />;
}

export type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return <input className={cn("vc-checkbox", className)} type="checkbox" {...props} />;
}

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "role" | "type">;

export function Switch({ className, ...props }: SwitchProps) {
  return <input className={cn("vc-switch", className)} role="switch" type="checkbox" {...props} />;
}
