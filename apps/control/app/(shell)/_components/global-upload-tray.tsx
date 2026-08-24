"use client";

import { StatusPill } from "@veyocast/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type GlobalUploadTrayItem = {
  fileName: string;
  id: string;
  status: string;
  title: string;
};

type GlobalUploadTrayProps = {
  items: GlobalUploadTrayItem[];
};

const queuePreferenceKey = "veyocast:media-upload-queue:open:v1";
const refreshIntervalMilliseconds = 5_000;

export function GlobalUploadTray({ items }: GlobalUploadTrayProps) {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);
  const previousCount = useRef(items.length);
  const [open, setOpen] = useState(items.length > 0);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(queuePreferenceKey);
      if (stored !== null) setOpen(stored === "true");
    } catch {
      // De tray blijft bruikbaar wanneer lokale opslag is afgeschermd.
    }
  }, []);

  useEffect(() => {
    if (items.length > previousCount.current) setOpen(true);
    previousCount.current = items.length;
  }, [items.length]);

  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (items.length === 0) return;

    const interval = window.setInterval(() => {
      router.refresh();
    }, refreshIntervalMilliseconds);

    return () => window.clearInterval(interval);
  }, [items.length, router]);

  if (items.length === 0) return null;

  function updateOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      window.localStorage.setItem(queuePreferenceKey, String(nextOpen));
    } catch {
      // De voorkeur blijft actief voor deze sessie.
    }
  }

  return (
    <aside aria-label="Uploadstatus" className="media-upload-tray">
      <details
        onToggle={(event) => updateOpen(event.currentTarget.open)}
        open={open}
      >
        <summary className="media-upload-tray__summary">
          <span>
            <strong>Uploads</strong>
            <span>{items.length} in verwerking</span>
          </span>
          <StatusPill label="Bezig" tone="info" />
        </summary>
        <div className="media-upload-tray__content">
          <ul className="media-upload-tray__list">
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.fileName}</small>
                </span>
                <StatusPill label={statusLabel(item.status)} tone="warning" />
              </li>
            ))}
          </ul>
        </div>
      </details>
    </aside>
  );
}

function statusLabel(status: string) {
  return {
    processing: "Verwerken",
    queued: "In wachtrij",
    uploaded: "Geüpload",
    uploading: "Uploaden"
  }[status] ?? status;
}
