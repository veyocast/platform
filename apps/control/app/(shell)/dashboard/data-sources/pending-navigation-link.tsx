"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@veyocast/ui";

import styles from "./pending-navigation-link.module.css";

export function PendingNavigationLink({
  children,
  href,
  icon
}: {
  children: ReactNode;
  href: string;
  icon: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigationStarted = useRef(false);

  useEffect(() => {
    if (!pending) navigationStarted.current = false;
  }, [pending]);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    startTransition(() => router.push(href));
  }

  return (
    <Button asChild variant="secondary">
      <Link
        aria-busy={pending}
        aria-disabled={pending}
        className={styles.link}
        href={href}
        onClick={navigate}
      >
        <span aria-hidden="true" className={styles.iconSlot}>
          {pending ? <LoaderCircle className={styles.spinner} /> : icon}
        </span>
        {children}
        {pending ? <span className="vc-visually-hidden" role="status">LED Scores wordt geopend</span> : null}
      </Link>
    </Button>
  );
}
