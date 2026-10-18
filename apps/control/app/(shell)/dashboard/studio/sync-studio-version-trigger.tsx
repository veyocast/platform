"use client";

import {ChevronRight,Clock3} from "lucide-react";
import {forwardRef,type ComponentPropsWithoutRef} from "react";

/** Source presentation, with the count supplied by the authorized revision read. */
export const SyncStudioVersionTrigger=forwardRef<HTMLButtonElement,ComponentPropsWithoutRef<"button">&{count:number}>(function SyncStudioVersionTrigger({count,className,...props},ref){
 return <button {...props} ref={ref} type="button" className={["vc-settings-link",className].filter(Boolean).join(" ")}>
  <Clock3 size={18}/>
  <span><strong>Versiegeschiedenis</strong><small>{count} opgeslagen versies</small></span>
  <ChevronRight size={16}/>
 </button>;
});
