"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import type {
  ScreenAutomationException,
  ScreenAutomationPeriod,
  ScreenAutomationSettingsInput
} from "@veyocast/contracts";
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  Switch,
  TextInput
} from "@veyocast/ui";
import { CalendarPlus, Copy, Plus, Trash2 } from "lucide-react";

import { saveScreenAutomation } from "./automation-actions";
import { isoToZonedLocal, zonedLocalToIso } from "./automation-time";
import styles from "./screen-automation.module.css";

const weekdays = [
  [1, "Maandag"],
  [2, "Dinsdag"],
  [3, "Woensdag"],
  [4, "Donderdag"],
  [5, "Vrijdag"],
  [6, "Zaterdag"],
  [7, "Zondag"]
] as const;

type ScreenAutomationFormProps = {
  canManage: boolean;
  disclaimerAcceptedAt: string | null;
  initial: ScreenAutomationSettingsInput;
  revision: number;
  screenId: string;
};

export function ScreenAutomationForm({
  canManage,
  disclaimerAcceptedAt,
  initial,
  revision,
  screenId
}: ScreenAutomationFormProps) {
  const [settings, setSettings] = useState(() => withDefaultPeriods(initial));
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [acceptedForSave, setAcceptedForSave] = useState(false);
  const settingsJson = useMemo(() => JSON.stringify(settings), [settings]);
  const setBoolean = (key: BooleanSetting, value: boolean) => {
    setSettings((current) => {
      if (key === "startupEnabled" && !value) {
        return {
          ...current,
          hdmiCecEnabled: false,
          localWakeEnabled: false,
          startupEnabled: false
        };
      }
      if (key === "localWakeEnabled" && !value) {
        return {
          ...current,
          hdmiCecEnabled: false,
          localWakeEnabled: false
        };
      }
      return { ...current, [key]: value };
    });
  };

  function requestHdmiCec(value: boolean) {
    if (!value) {
      setBoolean("hdmiCecEnabled", false);
      return;
    }
    if (!disclaimerAcceptedAt && !acceptedForSave) {
      setDisclaimerOpen(true);
      return;
    }
    setBoolean("hdmiCecEnabled", true);
  }

  function acceptHdmiCec() {
    setAcceptedForSave(true);
    setSettings((current) => ({
      ...current,
      hdmiCecEnabled: true,
      localWakeEnabled: true,
      startupEnabled: true
    }));
    setDisclaimerOpen(false);
  }

  return (
    <>
      <form action={saveScreenAutomation} className={styles.form}>
        <input name="screenId" type="hidden" value={screenId} />
        <input name="expectedRevision" type="hidden" value={revision} />
        <input name="settingsJson" type="hidden" value={settingsJson} />
        <input
          name="acceptHdmiCecDisclaimer"
          type="hidden"
          value={acceptedForSave ? "yes" : "no"}
        />

        <AutomationSetting
          checked={settings.enabled}
          disabled={!canManage}
          description="Gebruik het lokale weekschema voor startpogingen en keep-awakegedrag."
          label="Automatisering"
          onChange={(value) => setBoolean("enabled", value)}
        />

        <section className={styles.section} aria-labelledby="operating-schedule-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="operating-schedule-title">Bedrijfstijden</h3>
              <p>
                Lokale tijden in <strong>{settings.timezone}</strong>. Een periode
                mag over middernacht lopen.
              </p>
            </div>
            <Select
              aria-label="Schematype"
              disabled={!canManage || !settings.enabled}
              onChange={(event) => setSettings((current) => ({
                ...current,
                scheduleMode: event.target.value === "always" ? "always" : "weekly"
              }))}
              value={settings.scheduleMode}
            >
              <option value="always">Altijd actief</option>
              <option value="weekly">Weekschema</option>
            </Select>
          </div>
          {settings.scheduleMode === "weekly" ? (
            <div className={styles.week}>
              <div className={styles.weekToolbar}>
                <span>Meerdere perioden per dag zijn mogelijk.</span>
                <Button
                  disabled={!canManage || !settings.enabled}
                  onClick={() => copyMondayToWeek(setSettings)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Copy aria-hidden="true" size={15} />
                  Maandag kopiëren
                </Button>
              </div>
              {weekdays.map(([weekday, label]) => (
                <DaySchedule
                  canManage={canManage && settings.enabled}
                  key={weekday}
                  label={label}
                  onChange={setSettings}
                  periods={settings.periods.filter((period) => period.weekday === weekday)}
                  weekday={weekday}
                />
              ))}
            </div>
          ) : (
            <p className="notice">
              <strong>Altijd actief.</strong> De Player blijft actief zolang
              automatisering is ingeschakeld, behalve op expliciete sluitingsdagen.
            </p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="startup-settings-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="startup-settings-title">Automatisch starten</h3>
              <p>
                Start de Player best effort vóór het venster. Android kan inexacte
                alarmen door energiebesparing uitstellen.
              </p>
            </div>
          </div>
          <div className={styles.settingStack}>
            <AutomationSetting
              checked={settings.startupEnabled}
              disabled={!canManage || !settings.enabled}
              description="Start VeyoCast volgens het ingestelde schema, ook wanneer niemand de app handmatig opent."
              label="Automatisch starten"
              onChange={(value) => setBoolean("startupEnabled", value)}
            />
            <AutomationSetting
              checked={settings.localWakeEnabled}
              disabled={!canManage || !settings.enabled || !settings.startupEnabled}
              description="Plan op ondersteunde Android-apparaten een lokale startpoging."
              label="Lokale startpoging"
              onChange={(value) => setBoolean("localWakeEnabled", value)}
            />
            <div className={styles.compactField}>
              <label htmlFor="automation-lead-time">Starttijd voorbereiden</label>
              <div>
                <TextInput
                  disabled={!canManage || !settings.enabled || !settings.localWakeEnabled}
                  id="automation-lead-time"
                  max={60}
                  min={0}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    wakeLeadMinutes: Math.max(0, Math.min(60, Number(event.target.value)))
                  }))}
                  type="number"
                  value={settings.wakeLeadMinutes}
                />
                <span>minuten vóór bedrijfstijd</span>
              </div>
            </div>
            <AutomationSetting
              checked={settings.restoreAfterReboot}
              disabled={!canManage || !settings.enabled}
              description="Herplan het laatste geldige schema na reboot, app-update, klok- of tijdzonewijziging."
              label="Schema herstellen na reboot"
              onChange={(value) => setBoolean("restoreAfterReboot", value)}
            />
            <AutomationSetting
              checked={settings.offlineExecutionEnabled}
              disabled={!canManage || !settings.enabled}
              description="Gebruik maximaal zeven dagen de laatst gevalideerde configuratie wanneer Control onbereikbaar is."
              label="Tijdelijk offline uitvoeren"
              onChange={(value) => setBoolean("offlineExecutionEnabled", value)}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="display-behaviour-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="display-behaviour-title">Scherm en televisie</h3>
              <p>Ondersteunde lifecycle-opties, zonder een fysieke TV-status te beloven.</p>
            </div>
          </div>
          <div className={styles.settingStack}>
            <AutomationSetting
              checked={settings.keepAwakeEnabled}
              disabled={!canManage || !settings.enabled}
              description="Voorkomt waar mogelijk slaapstand, schermbeveiliging of ambient mode tijdens een actief venster."
              label="Scherm actief houden tijdens afspelen"
              onChange={(value) => setBoolean("keepAwakeEnabled", value)}
            />
            <AutomationSetting
              checked={settings.hdmiCecEnabled}
              disabled={!canManage || !settings.enabled || !settings.localWakeEnabled}
              description="Werkt alleen op geschikte apparaten met correct ingestelde HDMI-CEC."
              label="TV inschakelen via HDMI-CEC"
              onChange={requestHdmiCec}
            />
          </div>
          {disclaimerAcceptedAt ? (
            <p className={styles.accepted}>
              Compatibiliteitsverklaring geaccepteerd op{" "}
              {new Intl.DateTimeFormat("nl-NL", {
                dateStyle: "medium",
                timeStyle: "short"
              }).format(new Date(disclaimerAcceptedAt))}.
            </p>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="exceptions-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="exceptions-title">Datumuitzonderingen</h3>
              <p>Een sluitingsdag of tijdelijke opening gaat vóór override en weekschema.</p>
            </div>
            <Button
              disabled={!canManage || !settings.enabled}
              onClick={() => addException(setSettings)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <CalendarPlus aria-hidden="true" size={15} />
              Uitzondering
            </Button>
          </div>
          {settings.exceptions.length ? (
            <div className={styles.exceptionList}>
              {settings.exceptions.map((exception, index) => (
                <ExceptionRow
                  canManage={canManage && settings.enabled}
                  exception={exception}
                  index={index}
                  key={exception.id ?? `${exception.date}-${index}`}
                  onChange={setSettings}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>Geen datumuitzonderingen ingesteld.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="temporary-override-title">
          <div className={styles.sectionHeader}>
            <div>
              <h3 id="temporary-override-title">Tijdelijke override</h3>
              <p>
                Gaat na datumuitzonderingen vóór het weekschema en verloopt
                automatisch. Tijdzone: <strong>{settings.timezone}</strong>.
              </p>
            </div>
          </div>
          <div className={styles.overrideFields}>
            <label>
              <span>Gedrag</span>
              <Select
                disabled={!canManage || !settings.enabled}
                onChange={(event) => {
                  const temporaryOverride =
                    event.target.value === "active" ||
                    event.target.value === "paused"
                      ? event.target.value
                      : "none";
                  setSettings((current) => ({
                    ...current,
                    temporaryOverride,
                    temporaryOverrideUntil: temporaryOverride === "none"
                      ? null
                      : current.temporaryOverrideUntil ??
                        new Date(Date.now() + 86_400_000).toISOString()
                  }));
                }}
                value={settings.temporaryOverride}
              >
                <option value="none">Geen override</option>
                <option value="active">Tijdelijk actief</option>
                <option value="paused">Tijdelijk gepauzeerd</option>
              </Select>
            </label>
            <label>
              <span>Geldig tot</span>
              <TextInput
                disabled={
                  !canManage ||
                  !settings.enabled ||
                  settings.temporaryOverride === "none"
                }
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  temporaryOverrideUntil: event.target.value
                    ? zonedLocalToIso(event.target.value, current.timezone)
                    : null
                }))}
                type="datetime-local"
                value={settings.temporaryOverrideUntil
                  ? isoToZonedLocal(
                      settings.temporaryOverrideUntil,
                      settings.timezone
                    )
                  : ""}
              />
            </label>
          </div>
        </section>

        <div className={styles.saveBar}>
          <div>
            <strong>Revisie {revision || "nieuw"}</strong>
            <span>Wijzigingen worden bij de volgende heartbeat gesynchroniseerd.</span>
          </div>
          <Button disabled={!canManage} type="submit">
            Automatisering opslaan
          </Button>
        </div>
      </form>

      <Dialog onOpenChange={setDisclaimerOpen} open={disclaimerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>HDMI-CEC compatibiliteit bevestigen</DialogTitle>
            <DialogDescription>
              VeyoCast kan een startpoging rapporteren, maar niet zelfstandig
              vaststellen of het televisiepaneel beeld toont.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.disclaimer}>
              <strong>Compatibiliteit</strong>
              <p>
                Automatisch inschakelen gebruikt functies van het gekoppelde
                afspeelapparaat en HDMI-CEC. De werking verschilt per televisie,
                mediaspeler, HDMI-poort en fabrikantinstelling. De televisie moet
                in stand-by staan, HDMI-CEC moet zijn ingeschakeld en het
                afspeelapparaat moet permanent van stroom worden voorzien.
                VeyoCast kan de werking op ieder apparaat niet garanderen.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Annuleren</Button>
            </DialogClose>
            <Button onClick={acceptHdmiCec} type="button">
              Ik begrijp dit, inschakelen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type BooleanSetting =
  | "enabled"
  | "hdmiCecEnabled"
  | "keepAwakeEnabled"
  | "localWakeEnabled"
  | "offlineExecutionEnabled"
  | "restoreAfterReboot"
  | "startupEnabled";

function AutomationSetting({
  checked,
  description,
  disabled,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const id = `automation-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={styles.setting}>
      <div>
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function DaySchedule({
  canManage,
  label,
  onChange,
  periods,
  weekday
}: {
  canManage: boolean;
  label: string;
  onChange: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>;
  periods: ScreenAutomationPeriod[];
  weekday: number;
}) {
  return (
    <div className={styles.day}>
      <div className={styles.dayLabel}>
        <strong>{label}</strong>
        <Button
          aria-label={`Periode toevoegen aan ${label}`}
          disabled={!canManage || periods.length >= 4}
          onClick={() => onChange((current) => ({
            ...current,
            periods: [
              ...current.periods,
              {
                enabled: true,
                endLocalTime: "17:00",
                startLocalTime: "13:00",
                weekday
              }
            ]
          }))}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" size={15} />
          Periode
        </Button>
      </div>
      {periods.length ? periods.map((period) => (
          <div
            className={styles.period}
            key={period.id ?? `${weekday}-${period.startLocalTime}-${period.endLocalTime}`}
          >
            <Switch
              aria-label={`${label} ${period.startLocalTime} actief`}
              checked={period.enabled}
              disabled={!canManage}
              onChange={(event) => updatePeriod(onChange, period, {
                enabled: event.target.checked
              })}
            />
            <TextInput
              aria-label={`${label} starttijd`}
              disabled={!canManage || !period.enabled}
              onChange={(event) => updatePeriod(onChange, period, {
                startLocalTime: event.target.value
              })}
              type="time"
              value={period.startLocalTime}
            />
            <span aria-hidden="true">–</span>
            <TextInput
              aria-label={`${label} eindtijd`}
              disabled={!canManage || !period.enabled}
              onChange={(event) => updatePeriod(onChange, period, {
                endLocalTime: event.target.value
              })}
              type="time"
              value={period.endLocalTime}
            />
            <Button
              aria-label={`Periode verwijderen van ${label}`}
              disabled={!canManage}
              onClick={() => removePeriod(onChange, period)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" size={15} />
            </Button>
          </div>
      )) : (
        <p className={styles.dayClosed}>Uitgeschakeld</p>
      )}
    </div>
  );
}

function ExceptionRow({
  canManage,
  exception,
  index,
  onChange
}: {
  canManage: boolean;
  exception: ScreenAutomationException;
  index: number;
  onChange: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>;
}) {
  const update = (patch: Partial<ScreenAutomationException>) => {
    onChange((current) => ({
      ...current,
      exceptions: current.exceptions.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, ...patch } : candidate
      )
    }));
  };
  return (
    <div className={styles.exception}>
      <TextInput
        aria-label="Datum uitzondering"
        disabled={!canManage}
        onChange={(event) => update({ date: event.target.value })}
        type="date"
        value={exception.date}
      />
      <Select
        aria-label="Soort uitzondering"
        disabled={!canManage}
        onChange={(event) => update(event.target.value === "open"
          ? {
              endLocalTime: exception.endLocalTime ?? "17:00",
              mode: "open",
              startLocalTime: exception.startLocalTime ?? "09:00"
            }
          : { endLocalTime: null, mode: "closed", startLocalTime: null })}
        value={exception.mode}
      >
        <option value="closed">Gesloten</option>
        <option value="open">Extra geopend</option>
      </Select>
      {exception.mode === "open" ? (
        <div className={styles.exceptionTimes}>
          <TextInput
            aria-label="Starttijd uitzondering"
            disabled={!canManage}
            onChange={(event) => update({ startLocalTime: event.target.value })}
            type="time"
            value={exception.startLocalTime ?? ""}
          />
          <span>–</span>
          <TextInput
            aria-label="Eindtijd uitzondering"
            disabled={!canManage}
            onChange={(event) => update({ endLocalTime: event.target.value })}
            type="time"
            value={exception.endLocalTime ?? ""}
          />
        </div>
      ) : null}
      <TextInput
        aria-label="Reden uitzondering"
        disabled={!canManage}
        maxLength={160}
        onChange={(event) => update({ reason: event.target.value || null })}
        placeholder="Optionele reden"
        value={exception.reason ?? ""}
      />
      <Button
        aria-label="Uitzondering verwijderen"
        disabled={!canManage}
        onClick={() => onChange((current) => ({
          ...current,
          exceptions: current.exceptions.filter((_, candidateIndex) => candidateIndex !== index)
        }))}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" size={15} />
      </Button>
    </div>
  );
}

function withDefaultPeriods(
  input: ScreenAutomationSettingsInput
): ScreenAutomationSettingsInput {
  if (input.periods.length) return input;
  return {
    ...input,
    periods: weekdays.map(([weekday]) => ({
      enabled: weekday <= 5,
      endLocalTime: weekday <= 5 ? "23:00" : "22:00",
      startLocalTime: weekday <= 5 ? "07:30" : "08:00",
      weekday
    }))
  };
}

function updatePeriod(
  setter: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>,
  period: ScreenAutomationPeriod,
  patch: Partial<ScreenAutomationPeriod>
) {
  setter((current) => ({
    ...current,
    periods: current.periods.map((candidate) =>
      candidate === period ? { ...candidate, ...patch } : candidate
    )
  }));
}

function removePeriod(
  setter: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>,
  period: ScreenAutomationPeriod
) {
  setter((current) => ({
    ...current,
    periods: current.periods.filter((candidate) => candidate !== period)
  }));
}

function copyMondayToWeek(
  setter: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>
) {
  setter((current) => {
    const monday = current.periods.filter((period) => period.weekday === 1);
    return {
      ...current,
      periods: weekdays.flatMap(([weekday]) =>
        monday.map((period) => ({
          ...period,
          id: undefined,
          weekday
        }))
      )
    };
  });
}

function addException(
  setter: Dispatch<SetStateAction<ScreenAutomationSettingsInput>>
) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  setter((current) => ({
    ...current,
    exceptions: [
      ...current.exceptions,
      {
        date: tomorrow,
        endLocalTime: null,
        mode: "closed",
        reason: null,
        startLocalTime: null
      }
    ]
  }));
}
