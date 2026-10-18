"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

/** Source field geometry with an explicit accessible name, independent of select options. */
export function SyncStudioField({
  label,
  hint,
  children,
  controlWrapperClassName,
  adornment,
}: {
  label: string;
  hint?: string;
  controlWrapperClassName?: string;
  adornment?: ReactNode;
  children: ReactElement<{
    id?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }>;
}) {
  const id = useId(),
    labelId = `${id}-label`,
    hintId = `${id}-hint`;
  const control = cloneElement(children, {
    id,
    "aria-labelledby": labelId,
    ...(hint ? { "aria-describedby": hintId } : {}),
  });
  return (
    <label className="field" htmlFor={id}>
      <span id={labelId}>{label}</span>
      {controlWrapperClassName ? <div className={controlWrapperClassName}>{control}{adornment}</div> : control}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}

/** Buttons in Source choice groups have independent names and remain valid label markup. */
export function SyncStudioFieldGroup({label,className,children,separate=false}:{label:string;className:string;children:ReactNode;separate?:boolean}){
  const id=useId();
  if(separate)return <><span className="vc-field-label" id={id}>{label}</span><div role="group" aria-labelledby={id} className={className}>{children}</div></>;
  return <div className="field"><span id={id}>{label}</span><div role="group" aria-labelledby={id} className={className}>{children}</div></div>;
}

export function SyncStudioCheck({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="vc-checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
