"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {Upload} from "lucide-react";

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
      router.push(`/dashboard/sources/twelve/imports/${body.importId}`);
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
        <Button disabled={disabled} variant="secondary"><Upload size={18}/>Twelve importeren</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="product-import-description">
        <DialogHeader>
          <DialogTitle>Producten uit Twelve importeren</DialogTitle>
          <DialogDescription id="product-import-description">
            VeyoCast leest een UTF-8 CSV of normale .xlsx-export. Controleer de kolommen en productregels voordat je de import toepast. Het bestand wordt niet als
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
              <label htmlFor="product-workbook">CSV- of Excel-bestand</label>
              <input
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={disabled || pending}
                id="product-workbook"
                name="file"
                required
                type="file"
              />
              <p className="work-panel__meta">
                CSV maximaal 2 MB, Excel maximaal 8 MB; beide maximaal 10.000 regels en 75 kolommen. Macrobestanden en
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
                {pending ? "Bestand controleren…" : "Bestand controleren"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
