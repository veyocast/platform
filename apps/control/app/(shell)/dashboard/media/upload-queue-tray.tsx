"use client";

import { useEffect, useRef, useState } from "react";

import { StatusPill } from "@veyocast/ui";

type UploadQueueTrayItem = {
  fileName: string;
  id: string;
  status: string;
  title: string;
};

type UploadQueueTrayProps = {
  items: UploadQueueTrayItem[];
};

const queuePreferenceKey = "veyocast:media-upload-queue:open:v1";

export function UploadQueueTray({ items }: UploadQueueTrayProps) {
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
            <span>{items.length > 0 ? `${items.length} in verwerking` : "Geen actieve uploads"}</span>
          </span>
          <StatusPill
            label={items.length > 0 ? "Bezig" : "Gereed"}
            tone={items.length > 0 ? "info" : "success"}
          />
        </summary>
        <div className="media-upload-tray__content">
          {items.length > 0 ? (
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
          ) : (
            <p>Nieuwe uploads en verwerkingsstatussen blijven hier zichtbaar.</p>
          )}
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
