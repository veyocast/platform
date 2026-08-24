"use client";

import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Monitor,
  Plus,
  Trophy,
  UtensilsCrossed
} from "lucide-react";
import { useMemo, useState } from "react";

import { calculateMonthlyScreenPriceGrossCents } from "@veyocast/domain";

import { continueWithSetup } from "../_actions/setup-intent-actions";
import type {
  SetupBranch,
  SetupGoal,
  SetupModule,
  SetupZone,
  SetupZoneId
} from "../_lib/setup-intent";

const branchOptions = [
  {
    description: "Clubhuis, entree, sponsorwand en wedstrijdinformatie.",
    icon: Trophy,
    label: "Sportvereniging",
    value: "sportclub"
  },
  {
    description: "Entree, menu, wachtruimte en sfeercommunicatie.",
    icon: UtensilsCrossed,
    label: "Horeca & sportlocatie",
    value: "hospitality"
  },
  {
    description: "Ontvangst, interne informatie en meerdere zones.",
    icon: Building2,
    label: "Organisatie",
    value: "organization"
  }
] as const satisfies ReadonlyArray<{
  description: string;
  icon: typeof Trophy;
  label: string;
  value: SetupBranch;
}>;

const zoneLabels: Record<SetupZoneId, string> = {
  boardroom: "Team- of bestuursruimte",
  clubhouse: "Kantine & ontmoetingsplek",
  entrance: "Entree & ontvangst",
  main: "Hoofdruimte & tribune"
};

const goalLabels: Record<SetupGoal, string> = {
  internal: "Interne informatie",
  "live-info": "Actuele programma- en clubinformatie",
  menu: "Menu en aanbod",
  sponsors: "Sponsors en partners",
  welcome: "Welkom en wegwijzen"
};

const moduleOptions = [
  {
    description: "Teams, programma, uitslagen en standen wanneer data beschikbaar is.",
    label: "Sportlink",
    status: "Beschikbaar",
    value: "sportlink"
  },
  {
    description: "Gecontroleerde normale .xlsx-import met mapping en preview.",
    label: "Twelve XLSX",
    status: "Import",
    value: "twelve"
  },
  {
    description: "Nieuwsfeeds met bronstatus, stale-indicatie en fallback.",
    label: "RSS & nieuws",
    status: "Beschikbaar",
    value: "rss"
  },
  {
    description: "Eigen afbeeldingen en video uit de VeyoCast-mediabibliotheek.",
    label: "Eigen media",
    status: "Beschikbaar",
    value: "own-media"
  },
  {
    description: "Sponsorcampagnes, plaatsingen en gecontroleerde rotatie.",
    label: "Sponsors",
    status: "Beschikbaar",
    value: "sponsors"
  }
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  status: string;
  value: SetupModule;
}>;

const proposedModules = [
  {
    description: "Officiële online-only playback en fallback worden nog gevalideerd.",
    label: "YouTube",
    status: "In voorbereiding"
  },
  {
    description: "Publieke polls en stemacties volgen pas na privacy- en abusegates.",
    label: "Engage",
    status: "In voorbereiding"
  }
] as const;

const initialZones: SetupZone[] = [
  { count: 1, goal: "welcome", id: "entrance" },
  { count: 0, goal: "menu", id: "clubhouse" },
  { count: 0, goal: "live-info", id: "main" },
  { count: 0, goal: "internal", id: "boardroom" }
];

function formatGrossCents(cents: number) {
  const euros = Math.floor(cents / 100).toLocaleString("nl-NL");
  const remainder = String(cents % 100).padStart(2, "0");
  return `€ ${euros},${remainder}`;
}

export function VenueSetupBuilder() {
  const [mobileStep, setMobileStep] = useState(0);
  const [branch, setBranch] = useState<SetupBranch>("sportclub");
  const [modules, setModules] = useState<SetupModule[]>([
    "sportlink",
    "own-media",
    "sponsors"
  ]);
  const [zones, setZones] = useState<SetupZone[]>(initialZones);
  const screenCount = zones.reduce((total, zone) => total + zone.count, 0);
  const grossMonthlyCents = calculateMonthlyScreenPriceGrossCents(screenCount);
  const selectedZones = zones.filter((zone) => zone.count > 0);
  const setupJson = useMemo(
    () => JSON.stringify({ branch, modules, zones }),
    [branch, modules, zones]
  );

  function updateZone(id: SetupZoneId, patch: Partial<Pick<SetupZone, "count" | "goal">>) {
    setZones((current) =>
      current.map((zone) =>
        zone.id === id
          ? {
              ...zone,
              ...patch,
              count: Math.max(0, Math.min(20, patch.count ?? zone.count))
            }
          : zone
      )
    );
  }

  function toggleModule(value: SetupModule) {
    setModules((current) =>
      current.includes(value)
        ? current.filter((module) => module !== value)
        : [...current, value]
    );
  }

  function chooseBranch(value: SetupBranch) {
    setBranch(value);
    setModules((current) => {
      if (value === "sportclub") {
        return current.includes("sportlink") ? current : ["sportlink", ...current];
      }
      return current.filter((module) => module !== "sportlink");
    });
  }

  return (
    <section className="setup-builder marketing-section" id="opstelling" aria-labelledby="setup-builder-title">
      <div className="marketing-container">
        <header className="setup-builder__heading">
          <div>
            <p className="eyebrow">Jouw locatie, direct in beeld</p>
            <h2 id="setup-builder-title">Bouw je VeyoCast-opstelling.</h2>
          </div>
          <p>
            Plaats schermen per zone, kies wat mensen daar nodig hebben en zie
            direct de maandprijs na de gratis proefperiode.
          </p>
        </header>

        <div className="setup-builder__shell">
          <div className="setup-builder__workspace">
            <nav className="setup-builder__stepper" aria-label="Stappen van de setup builder">
              {["Locatie", "Schermen", "Bronnen"].map((label, index) => (
                <button
                  aria-current={mobileStep === index ? "step" : undefined}
                  key={label}
                  onClick={() => setMobileStep(index)}
                  type="button"
                >
                  <span>{index + 1}</span>{label}
                </button>
              ))}
            </nav>
            <fieldset className="setup-builder__branches" data-active={mobileStep === 0} data-builder-step="0">
              <legend>1. Wat voor locatie beheer je?</legend>
              <div>
                {branchOptions.map(({ description, icon: Icon, label, value }) => (
                  <button
                    aria-pressed={branch === value}
                    key={value}
                    onClick={() => chooseBranch(value)}
                    type="button"
                  >
                    <Icon aria-hidden size={21} />
                    <span><strong>{label}</strong><small>{description}</small></span>
                    {branch === value ? <Check aria-hidden size={18} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="setup-builder__venue" data-active={mobileStep === 1} data-builder-step="1">
              <legend>2. Plaats schermen in je locatie</legend>
              <div className="setup-builder__venue-map" aria-hidden="true">
                {zones.map((zone) => (
                  <span data-active={zone.count > 0 ? "true" : undefined} data-zone={zone.id} key={zone.id}>
                    <Monitor size={18} /> {zone.count}
                  </span>
                ))}
                <strong>Jouw locatie</strong>
              </div>
              <div className="setup-builder__zone-list" aria-label="Schermen per zone">
                {zones.map((zone) => (
                  <article key={zone.id}>
                    <div>
                      <strong>{zoneLabels[zone.id]}</strong>
                      <small>{zone.count === 0 ? "Nog geen scherm" : `${zone.count} ${zone.count === 1 ? "scherm" : "schermen"}`}</small>
                    </div>
                    <div className="setup-builder__counter">
                      <button
                        aria-label={`Scherm verwijderen uit ${zoneLabels[zone.id]}`}
                        disabled={zone.count === 0 || screenCount === 1}
                        onClick={() => updateZone(zone.id, { count: zone.count - 1 })}
                        type="button"
                      >
                        <Minus aria-hidden size={16} />
                      </button>
                      <output aria-live="polite">{zone.count}</output>
                      <button
                        aria-label={`Scherm toevoegen aan ${zoneLabels[zone.id]}`}
                        disabled={screenCount >= 50}
                        onClick={() => updateZone(zone.id, { count: zone.count + 1 })}
                        type="button"
                      >
                        <Plus aria-hidden size={16} />
                      </button>
                    </div>
                    {zone.count > 0 ? (
                      <label>
                        <span>Doel in deze zone</span>
                        <select
                          onChange={(event) => updateZone(zone.id, { goal: event.target.value as SetupGoal })}
                          value={zone.goal}
                        >
                          {Object.entries(goalLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </article>
                ))}
              </div>
            </fieldset>

            <fieldset className="setup-builder__modules" data-active={mobileStep === 2} data-builder-step="2">
              <legend>3. Welke bronnen wil je gebruiken?</legend>
              <div className="setup-builder__module-grid">
                {moduleOptions.map((module) => {
                  const unavailableForBranch = module.value === "sportlink" && branch !== "sportclub";
                  const selected = modules.includes(module.value);
                  return (
                    <button
                      aria-pressed={selected}
                      disabled={unavailableForBranch}
                      key={module.value}
                      onClick={() => toggleModule(module.value)}
                      type="button"
                    >
                      <span><strong>{module.label}</strong><small>{module.description}</small></span>
                      <em>{unavailableForBranch ? "Alleen sport" : module.status}</em>
                      {selected ? <Check aria-hidden size={18} /> : null}
                    </button>
                  );
                })}
                {proposedModules.map((module) => (
                  <button disabled key={module.label} type="button">
                    <span><strong>{module.label}</strong><small>{module.description}</small></span>
                    <em>{module.status}</em>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="setup-builder__mobile-actions">
              <button
                className="button button--secondary"
                disabled={mobileStep === 0}
                onClick={() => setMobileStep((current) => Math.max(0, current - 1))}
                type="button"
              ><ChevronLeft aria-hidden size={18} /> Vorige</button>
              <button
                className="button button--primary"
                disabled={mobileStep === 2}
                onClick={() => setMobileStep((current) => Math.min(2, current + 1))}
                type="button"
              >Volgende <ChevronRight aria-hidden size={18} /></button>
            </div>
          </div>

          <aside className="setup-builder__summary" aria-label="Samenvatting van je opstelling">
            <p className="eyebrow">Jouw opstelling</p>
            <h3>{screenCount} {screenCount === 1 ? "scherm" : "schermen"}</h3>
            <dl>
              <div><dt>Zones</dt><dd>{selectedZones.length}</dd></div>
              <div><dt>Bronnen</dt><dd>{modules.length}</dd></div>
              <div><dt>Gratis proberen</dt><dd>14 dagen</dd></div>
            </dl>
            <div className="setup-builder__price">
              <span>Daarna per maand</span>
              <strong>{formatGrossCents(grossMonthlyCents)}</strong>
              <small>incl. btw · {formatGrossCents(595)} per actief scherm</small>
            </div>
            <ul>
              {selectedZones.map((zone) => (
                <li key={zone.id}>
                  <Check aria-hidden size={15} />
                  <span>{zoneLabels[zone.id]}<small>{goalLabels[zone.goal]}</small></span>
                </li>
              ))}
            </ul>
            <form action={continueWithSetup}>
              <input name="setup" type="hidden" value={setupJson} />
              <button className="button button--primary button--full" type="submit">
                Neem deze opstelling mee
                <ChevronRight aria-hidden size={18} />
              </button>
            </form>
            <p className="setup-builder__fineprint">
              Geen betaalverplichting in deze stap. Bestaande schermen worden
              nooit door deze berekening gewijzigd.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
