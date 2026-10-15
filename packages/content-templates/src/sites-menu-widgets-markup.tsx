import React, { type CSSProperties } from "react";
import type { SitesPresentation } from "@veyocast/contracts";
import type { SitesAssetResolver } from "./sites-presentation-model";
import { SitesUnifiedV17Markup } from "./sites-unified-v17-markup";

/** Widgets are content inside the original Studio canvas, never a second theme. */
export function SitesMenuWidgetsMarkup({ presentation, resolveAsset, page = 0, width, active=false }: {
  presentation: Extract<SitesPresentation, { kind: "dynamic" }>;
  resolveAsset: SitesAssetResolver;
  page?: number;
  width?: number;
  active?: boolean;
}) {
  const config = presentation.configuration;
  const content = presentation.content;
  const menuPage = content.menuPages?.[page];
  if (!menuPage) return null;
  const background = config.background ? resolveAsset(config.background) : undefined;
  const portrait = config.orientation === "portrait";
  const nativeWidth = portrait ? 1080 : 1920;
  const nativeHeight = portrait ? 1920 : 1080;
  // Six is the wizard's neutral setting; preserve the source's native geometry.
  const inset = Math.max(-(portrait ? 64 : 72), (config.safeArea - 6) * nativeWidth / 100);
  const full = menuPage.widgets.every(widget => widget.column === "full");
  const rows = full ? menuPage.widgets.length : Math.max(1, ...["left", "right"].map(lane => menuPage.widgets.filter(widget => widget.column === lane || widget.column === "full").length));
  const widgetHeight = Math.max(120, ((portrait ? 1530 : 790) - 250 - 2 * inset) / Math.max(1, rows));
  const style = {
    "--vm-accent": config.accent,
    "--vm-accent-ink": accentInk(config.accent),
    "--vm-scale": config.scale / 100,
    "--vm-inset": `${inset}px`,
    "--vm-align": config.align,
    "--vm-widget-height": `${widgetHeight}px`,
    "--vm-image-width": `${(nativeWidth - (portrait ? 184 : 192) - 2 * inset) / (menuPage.columns === 2 ? 2 : 1)}px`
  } as CSSProperties;
  return <div className="vm-frame" style={{ width: width ?? nativeWidth, height: width ? width * nativeHeight / nativeWidth : nativeHeight }}>
    <SitesUnifiedV17Markup active={active} presentation={presentation} resolveAsset={resolveAsset} width={width} canvasClassName={`vm-canvas${config.accent.toLowerCase() === "#03438a" ? "" : " vm-custom-accent"}`} canvasStyle={style} backgroundOverride={background || (config.themeId === "onzetrots-tv" && config.overlay > 0) ? { src: background, fit: background ? config.backgroundFit : "cover", overlay: config.overlay } : undefined}>
      <div className="ucc-body"><div className="ucc-content ucc-canteen ucc-menu-columns vm-menu-panel">
        <div className="vm-products-fit" data-fit-box><div className="vm-content" data-fit-content>
        <div className="ucc-menu-grid vm-widgets" data-columns={menuPage.columns} data-full={full}>
          {menuPage.widgets.map((widget, index) => <section key={widget.id} className={`ucc-menu-category vm-widget vm-${widget.type}`} data-column={widget.column}>
            {(widget.title || widget.subtitle) && <header><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{widget.title}</h2>{widget.subtitle && <p>{widget.subtitle}</p>}</div></header>}
            <div className="vm-widget-content">
              {widget.type === "category" && <div className="vm-products" data-columns={widget.columns}>
                {Array.from({ length: widget.columns }, (_, column) => <div className="vm-product-column" key={column}>
                  {widget.rows.filter(row => row.column === column + 1).map(row => <article key={row.id} className="ucc-menu-item vm-product">
                    {row.image && <img src={resolveAsset(row.image)} alt=""/>}
                    <span><strong>{row.primary}</strong>{row.secondary && <small>{row.secondary}</small>}</span>
                    {config.showPrices && row.value && <b>{row.value}</b>}
                  </article>)}
                </div>)}
              </div>}
              {widget.image && <figure className="vm-widget-image" data-ratio={widget.aspectRatio ?? "16:9"}><img src={resolveAsset(widget.image)} alt={widget.title || "Widgetafbeelding"} style={{ objectFit: widget.fit ?? "contain" }}/></figure>}
            </div>
          </section>)}
        </div>
        </div></div>
        <strong className="vm-menu-slogan">Onze Club. Onze Trots.</strong>
      </div></div>
    </SitesUnifiedV17Markup>
  </div>;
}

function accentInk(color: string) {
  const hex = color.slice(1, 7);
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722 > .179 ? "#142039" : "#ffffff";
}
