/* eslint-disable @next/next/no-img-element */
import { Button, StatusPill } from "@veyocast/ui";
import { Building2, MapPin, Monitor, Plus, ScanLine } from "lucide-react";
import Link from "next/link";

import type { ScreenFleetData } from "./screen-types";
import {
  createVenue,
  createVenueZone,
  saveVenueScreenPlacement
} from "./venue-actions";
import { VenueFloorplanForm } from "./venue-floorplan-form";
import styles from "./venue-view.module.css";

export function VenueView({ canManage, data }: { canManage: boolean; data: ScreenFleetData }) {
  if (!data.features.venueTwin) {
    return (
      <section className={styles.gated} aria-labelledby="venue-gated-title">
        <Building2 aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>Gecontroleerde productuitrol</p>
          <h2 id="venue-gated-title">Venue Twin staat voor deze organisatie uit</h2>
          <p>De ruimtelijke weergave gebruikt echte opgeslagen locaties en schermposities. Alleen een platformbeheerder kan een tenant na AAL2-controle aan de pilot toevoegen; de vlag verleent nooit schermrechten.</p>
        </div>
        <StatusPill label="Niet vrijgegeven" tone="warning" />
      </section>
    );
  }

  const venue = data.venues[0] ?? null;
  if (!venue) {
    return (
      <section className={styles.setup} aria-labelledby="venue-setup-title">
        <div className={styles.setupVisual}><ScanLine aria-hidden="true" /></div>
        <div>
          <p className={styles.eyebrow}>Venue Twin · stap 1</p>
          <h2 id="venue-setup-title">Leg eerst de echte venue vast</h2>
          <p>Begin met een herkenbare locatie. Daarna voeg je een plattegrond, zones en genormaliseerde schermposities toe. Zonder plattegrond blijft de gelijkwaardige lijstweergave bruikbaar.</p>
          {canManage ? (
            <form action={createVenue} className={styles.inlineForm}>
              <label><span>Naam venue</span><input maxLength={120} name="name" placeholder="Bijv. Sportpark De Horizon" required /></label>
              <label><span>Locatie-aanduiding</span><input maxLength={240} name="addressLabel" placeholder="Bijv. Hoofdlocatie" /></label>
              <Button type="submit"><Plus aria-hidden="true" /> Venue toevoegen</Button>
            </form>
          ) : <p className={styles.readOnly}>Je kunt Venue Twin bekijken, maar niet inrichten.</p>}
        </div>
      </section>
    );
  }

  const floorplan = data.floorplans.find((item) => item.venueId === venue.id) ?? null;
  const zones = data.zones.filter((zone) => zone.venueId === venue.id);
  const placements = data.venuePlacements.filter((placement) => placement.venueId === venue.id);
  const placedIds = new Set(placements.map((placement) => placement.screenId));
  const unplacedScreens = data.screens.filter((screen) => !placedIds.has(screen.id));
  const screenById = new Map(data.screens.map((screen) => [screen.id, screen]));
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

  return (
    <div className={styles.workspace}>
      <section className={styles.hero} aria-labelledby="venue-title">
        <div>
          <p className={styles.eyebrow}>Venue Twin</p>
          <h2 id="venue-title">{venue.name}</h2>
          <p>{venue.addressLabel ?? "Geen gevoelige adresdetails opgeslagen"}</p>
        </div>
        <div className={styles.heroStats}>
          <span><strong>{zones.length}</strong> zones</span>
          <span><strong>{placements.length}</strong> geplaatst</span>
          <span><strong>{unplacedScreens.length}</strong> nog te plaatsen</span>
        </div>
      </section>

      <div className={styles.layout}>
        <section className={styles.mapPanel} aria-labelledby="floorplan-title">
          <div className={styles.panelHeading}>
            <div><h3 id="floorplan-title">{floorplan?.name ?? "Logische venueweergave"}</h3><p>{floorplan ? `Revisie ${floorplan.revision} · ${floorplan.width} × ${floorplan.height}` : "Nog geen plattegrondasset; posities blijven tekstueel beheersbaar."}</p></div>
            <StatusPill label={floorplan ? "Plattegrond actief" : "Lijstfallback"} tone={floorplan ? "success" : "info"} />
          </div>
          <div className={styles.map} data-has-floorplan={Boolean(floorplan)}>
            {floorplan?.previewUrl ? <img alt="" className={styles.mapImage} src={floorplan.previewUrl} /> : null}
            <div className={styles.mapGrid} aria-hidden="true" />
            {placements.map((placement) => {
              const screen = screenById.get(placement.screenId);
              if (!screen) return null;
              return (
                <Link
                  aria-label={`${screen.name} openen, ${zoneById.get(placement.zoneId ?? "")?.name ?? "zonder zone"}`}
                  className={styles.marker}
                  href={`/dashboard/screens/${screen.id}`}
                  key={placement.id}
                  style={{ left: `${placement.xNormalized * 100}%`, top: `${placement.yNormalized * 100}%` }}
                >
                  <Monitor aria-hidden="true" />
                  <span>{screen.name}</span>
                </Link>
              );
            })}
            {!placements.length ? <p className={styles.mapEmpty}>Plaats een bestaand scherm met de configuratie ernaast.</p> : null}
          </div>
        </section>

        <aside className={styles.config} aria-label="Venue Twin configuratie">
          <h3>Inrichting</h3>
          {!canManage ? <p className={styles.readOnly}>Alleen lezen. Een schermbeheerder kan zones en posities aanpassen.</p> : (
            <>
              {!floorplan ? <VenueFloorplanForm assets={data.floorplanAssets} venueId={venue.id} /> : null}
              <ZoneForm floorplanId={floorplan?.id ?? null} venueId={venue.id} />
              {data.screens.length ? <PlacementForm data={data} floorplanId={floorplan?.id ?? null} venueId={venue.id} zones={zones} /> : (
                <Button asChild variant="secondary"><Link href="/dashboard/screens/new">Eerste scherm toevoegen</Link></Button>
              )}
            </>
          )}
        </aside>
      </div>

      <section className={styles.fallback} aria-labelledby="venue-list-title">
        <div className={styles.panelHeading}><div><h3 id="venue-list-title">Toegankelijke lijstweergave</h3><p>Dezelfde relaties zonder plattegrond, drag-and-drop of motion.</p></div></div>
        <ul>
          {data.screens.map((screen) => {
            const placement = placements.find((item) => item.screenId === screen.id);
            const zone = placement ? zoneById.get(placement.zoneId ?? "") : null;
            return (
              <li key={screen.id}>
                <span className={styles.listIcon}><Monitor aria-hidden="true" /></span>
                <span><strong>{screen.name}</strong><small>{zone?.name ?? screen.location ?? "Nog niet geplaatst"}</small></span>
                <span>{placement ? `${Math.round(placement.xNormalized * 100)}% × ${Math.round(placement.yNormalized * 100)}% · r${placement.revision}` : "Geen positie"}</span>
                <Link href={`/dashboard/screens/${screen.id}`}>Screen 360</Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ZoneForm({ floorplanId, venueId }: { floorplanId: string | null; venueId: string }) {
  return <details><summary>Zone toevoegen</summary><form action={createVenueZone} className={styles.stackForm}><input name="venueId" type="hidden" value={venueId} />{floorplanId ? <input name="floorplanId" type="hidden" value={floorplanId} /> : null}<label><span>Naam zone</span><input maxLength={120} name="name" placeholder="Kantine" required /></label><label><span>Omschrijving</span><textarea maxLength={500} name="description" placeholder="Publieke ontvangstruimte" /></label><Button type="submit">Zone toevoegen</Button></form></details>;
}

function PlacementForm({ data, floorplanId, venueId, zones }: { data: ScreenFleetData; floorplanId: string | null; venueId: string; zones: ScreenFleetData["zones"] }) {
  return <details open><summary>Scherm plaatsen</summary><form action={saveVenueScreenPlacement} className={styles.stackForm}><input name="venueId" type="hidden" value={venueId} />{floorplanId ? <input name="floorplanId" type="hidden" value={floorplanId} /> : null}<label><span>Scherm</span><select name="screenId" required>{data.screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name}</option>)}</select></label><label><span>Zone</span><select name="zoneId"><option value="">Geen zone</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label><label><span>Oriëntatie</span><select name="orientation"><option value="landscape">Liggend</option><option value="portrait">Staand</option></select></label><div className={styles.formRow}><label><span>X (0–1)</span><input defaultValue="0.5" max="1" min="0" name="xNormalized" required step="0.01" type="number" /></label><label><span>Y (0–1)</span><input defaultValue="0.5" max="1" min="0" name="yNormalized" required step="0.01" type="number" /></label></div><label><span>Wandhoek (optioneel)</span><input max="180" min="-180" name="wallAngleDegrees" step="0.5" type="number" /></label><Button type="submit"><MapPin aria-hidden="true" /> Positie opslaan</Button></form></details>;
}
