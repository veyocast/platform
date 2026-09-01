"use client";

import { useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@veyocast/ui";

import { ImageUploadForm } from "../../media/image-upload-form";
import { VideoUploadForm } from "../../media/video-upload-form";

export function CanvasMediaUploadDialog({
  anonKey,
  canUpload,
  onOpenChange,
  open,
  supabaseUrl
}: {
  anonKey: string;
  canUpload: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  supabaseUrl: string;
}) {
  const [kind, setKind] = useState<"image" | "video">("image");
  return <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent closeLabel="Uploadvenster sluiten">
      <DialogHeader>
        <DialogTitle>Canvasmedia uploaden</DialogTitle>
        <DialogDescription>
          Voeg een afbeelding of video toe aan de afgeschermde tenantbibliotheek.
          Zodra de controle gereed is, verschijnt het medium in de canvasbibliotheek.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div aria-label="Mediatype kiezen" className="media-upload-dialog__segments" role="tablist">
          <Button aria-selected={kind === "image"} onClick={() => setKind("image")} role="tab" size="sm" type="button" variant={kind === "image" ? "secondary" : "ghost"}>
            <ImageIcon aria-hidden="true" />Afbeelding
          </Button>
          <Button aria-selected={kind === "video"} onClick={() => setKind("video")} role="tab" size="sm" type="button" variant={kind === "video" ? "secondary" : "ghost"}>
            <Video aria-hidden="true" />Video
          </Button>
        </div>
        {kind === "image" ? <section className="media-upload-dialog__panel" role="tabpanel">
          <div><h3>Afbeelding</h3><p>Gebruik JPEG, PNG of WebP als eigen achtergrond, clubbeeld of vaste beeldlaag.</p></div>
          <ImageUploadForm canUpload={canUpload} canvasCompatibleOnly />
        </section> : <section className="media-upload-dialog__panel" role="tabpanel">
          <div><h3>Videoachtergrond</h3><p>De Player gebruikt uitsluitend de gevalideerde, gemute player-variant.</p></div>
          <VideoUploadForm anonKey={anonKey} canUpload={canUpload} supabaseUrl={supabaseUrl} />
        </section>}
      </DialogBody>
    </DialogContent>
  </Dialog>;
}
