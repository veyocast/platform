"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";

export function ProductImportDialog({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/products/import", {
        body: formData,
        method: "POST"
      });
      const body = await response.json() as { error?: string; importId?: string };
      if (!response.ok || !body.importId) {
        setMessage(body.error ?? "De productimport kon niet worden voorbereid.");
        return;
      }
      formRef.current?.reset();
      router.push(`/dashboard/products/imports/${body.importId}`);
      router.refresh();
    } catch {
      setMessage(
        "De upload werd onderbroken. Het bestand is niet geïmporteerd; probeer opnieuw."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Excel importeren</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="product-import-description">
        <DialogHeader>
          <DialogTitle>Producten uit Twelve importeren</DialogTitle>
          <DialogDescription id="product-import-description">
            VeyoCast leest een normale .xlsx-export. Het bestand wordt niet als
            live Twelve-koppeling bewaard en formules worden nooit uitgevoerd.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={submit}
            className="playlist-form"
            encType="multipart/form-data"
            ref={formRef}
          >
            <div className="field">
              <label htmlFor="product-workbook">Excel-bestand</label>
              <input
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={disabled || pending}
                id="product-workbook"
                name="file"
                required
                type="file"
              />
              <p className="work-panel__meta">
                Maximaal 8 MB, 10.000 regels en 75 kolommen. Macrobestanden en
                oude .xls-bestanden worden geweigerd.
              </p>
            </div>
            {message ? (
              <p className="notice notice--critical" role="alert">
                <strong>Import niet gestart.</strong> {message}
              </p>
            ) : null}
            <DialogFooter>
              <Button disabled={disabled || pending} type="submit">
                {pending ? "Werkmap controleren…" : "Werkmap controleren"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
