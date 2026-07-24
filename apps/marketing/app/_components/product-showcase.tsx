import {
  Check,
  CloudOff,
  RefreshCw,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import Image from "next/image";

import { marketingImages, type MarketingImageId } from "../_content/images";
import { FloatStage } from "./motion";

export function HeroProductStage() {
  const desktop = marketingImages["product-publisher-desktop"];
  const mobile = marketingImages["product-publisher-mobile"];

  return (
    <div className="hero-product-stage" aria-label="VeyoCast-productweergave">
      <div aria-hidden className="hero-product-stage__glow" />
      <FloatStage className="device-monitor">
        <div className="device-monitor__bezel">
          <div className="device-monitor__screen">
            <Image
              alt={desktop.alt}
              fill
              priority
              sizes="(max-width: 900px) 88vw, 56vw"
              src={desktop.src}
            />
          </div>
        </div>
        <div aria-hidden className="device-monitor__stand" />
      </FloatStage>

      <FloatStage className="device-phone">
        <div className="device-phone__screen">
          <Image
            alt={mobile.alt}
            fill
            priority
            sizes="(max-width: 700px) 32vw, 13vw"
            src={mobile.src}
          />
        </div>
      </FloatStage>

      <div className="clubtv-card" aria-label="Voorbeeld van ClubTV-content">
        <span>19:30 · vandaag</span>
        <strong>Welkom bij de club.</strong>
        <div>
          <span>Volgende wedstrijd</span>
          <b>Thuis — Uit</b>
        </div>
      </div>
    </div>
  );
}

export function ProductScreenshotFrame({
  imageId,
  label
}: {
  imageId: MarketingImageId;
  label?: string;
}) {
  const image = marketingImages[imageId];

  return (
    <figure className="product-screenshot">
      <div className="product-screenshot__chrome" aria-hidden>
        <span />
        <span />
        <span />
        <b>{label ?? "VeyoCast Publisher"}</b>
      </div>
      <Image
        alt={image.alt}
        className="product-screenshot__image"
        placeholder="blur"
        sizes="(max-width: 768px) 92vw, 62vw"
        src={image.src}
      />
    </figure>
  );
}

export function DeviceShowcase() {
  const desktop = marketingImages["product-screen-status"];

  return (
    <div className="platform-showcase">
      <ProductScreenshotFrame imageId={desktop.id} label="Schermvloot" />
      <div className="platform-showcase__statuses">
        <div>
          <Check aria-hidden size={20} />
          <span>Schermen gekoppeld</span>
        </div>
        <div>
          <RefreshCw aria-hidden size={20} />
          <span>Release gecontroleerd</span>
        </div>
        <div>
          <CloudOff aria-hidden size={20} />
          <span>Lokale cache actief</span>
        </div>
      </div>
    </div>
  );
}

export function ReliabilityDiagram() {
  const nodes = [
    { icon: Smartphone, label: "Publisher", text: "Nieuwe release" },
    { icon: ShieldCheck, label: "Verifiëren", text: "Alle assets compleet" },
    { icon: CloudOff, label: "Player", text: "Lokale playback" }
  ] as const;

  return (
    <ol className="reliability-diagram">
      {nodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <li key={node.label}>
            <span className="reliability-diagram__index">0{index + 1}</span>
            <Icon aria-hidden size={24} />
            <strong>{node.label}</strong>
            <p>{node.text}</p>
          </li>
        );
      })}
    </ol>
  );
}
