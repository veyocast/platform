"use client";

import { useState, useTransition } from "react";
import { Palette } from "lucide-react";

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

import { upsertStudioBrandKitAction } from "./actions";
import type { StudioBrandKit, StudioMediaAsset } from "./types";

export function BrandKitDialog({
  assets,
  brandKit,
  tenantName
}: {
  assets: readonly StudioMediaAsset[];
  brandKit: StudioBrandKit | null;
  tenantName: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Palette aria-hidden="true" />
          Huisstijl
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Studio-huisstijl</DialogTitle>
          <DialogDescription>
            Beheer het clublogo en de bewerkbare kleuren voor vrije
            Studio-ontwerpen van {tenantName}. Royal Current/Navy Glass voor
            datagedreven slides beheer je centraal bij Thema&apos;s; bestaande
            vrije ontwerpen worden nooit automatisch opnieuw gekleurd.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {assets.length ? (
            <form
              className="playlist-form"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                const formData = new FormData(event.currentTarget);
                startTransition(async () => {
                  const result = await upsertStudioBrandKitAction({
                    expectedRevision: brandKit?.revision ?? 0,
                    idempotencyKey: crypto.randomUUID(),
                    logoMediaAssetId: String(formData.get("logoMediaAssetId")),
                    primaryColor: String(formData.get("primaryColor")),
                    secondaryColor: String(formData.get("secondaryColor"))
                  });
                  if (!result.ok) {
                    setMessage(result.error ?? "De huisstijl is niet opgeslagen.");
                    return;
                  }
                  setOpen(false);
                  window.location.reload();
                });
              }}
            >
              <div className="field">
                <label htmlFor="studio-brand-primary">Primaire kleur</label>
                <input
                  defaultValue={brandKit?.primaryColor ?? "#FF5C20"}
                  id="studio-brand-primary"
                  name="primaryColor"
                  required
                  type="color"
                />
              </div>
              <div className="field">
                <label htmlFor="studio-brand-secondary">Secundaire kleur</label>
                <input
                  defaultValue={brandKit?.secondaryColor ?? "#FFAE72"}
                  id="studio-brand-secondary"
                  name="secondaryColor"
                  required
                  type="color"
                />
              </div>
              <div className="field">
                <label htmlFor="studio-brand-logo">Clublogo</label>
                <select
                  defaultValue={brandKit?.logoMediaAssetId ?? ""}
                  id="studio-brand-logo"
                  name="logoMediaAssetId"
                  required
                >
                  <option disabled value="">
                    Kies een gereedstaande afbeelding
                  </option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title}
                    </option>
                  ))}
                </select>
                <small>
                  Alleen gevalideerde PNG-, JPEG- en WebP-afbeeldingen uit Media
                  zijn beschikbaar.
                </small>
              </div>
              {message ? <p className="notice notice--critical" role="alert">{message}</p> : null}
              <DialogFooter>
                <Button disabled={pending} type="submit">
                  {pending ? "Opslaan…" : "Studio-huisstijl opslaan"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="notice notice--warning" role="status">
              <strong>Nog geen geschikt clublogo.</strong> Upload eerst een
              afbeelding in Media en wacht tot deze gereed is voor Player.
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
