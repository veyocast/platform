"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  IconButton
} from "@veyocast/ui";
import {
  AlignJustify,
  ChevronDown,
  MonitorCog,
  Moon,
  Rows3,
  Sun
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

export type ControlThemePreference = "light" | "dark" | "system";
export type ControlDensityPreference = "comfortable" | "compact";

const themeStorageKey = "veyocast-control-theme";
const densityStorageKey = "veyocast-control-density";
const themeQuery = "(prefers-color-scheme: dark)";

const themeOptions = [
  { icon: Sun, label: "Licht", value: "light" },
  { icon: Moon, label: "Donker", value: "dark" },
  { icon: MonitorCog, label: "Systeem", value: "system" }
] satisfies readonly {
  icon: LucideIcon;
  label: string;
  value: ControlThemePreference;
}[];

const densityOptions = [
  { icon: Rows3, label: "Comfortabel", value: "comfortable" },
  { icon: AlignJustify, label: "Compact", value: "compact" }
] satisfies readonly {
  icon: LucideIcon;
  label: string;
  value: ControlDensityPreference;
}[];

const themeBootstrap = `(() => {
  try {
    const stored = window.localStorage.getItem("${themeStorageKey}");
    const storedDensity = window.localStorage.getItem("${densityStorageKey}");
    const preference = stored === "light" || stored === "dark" ? stored : "system";
    const density = storedDensity === "compact" ? "compact" : "comfortable";
    const resolved = preference === "system" && window.matchMedia("${themeQuery}").matches
      ? "dark"
      : preference === "system" ? "light" : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.density = density;
    document.documentElement.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.dataset.density = "comfortable";
  }
})();`;

export function ControlThemeBootstrap() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />;
}

export function ControlThemeSwitcher() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [preference, setPreference] =
    useState<ControlThemePreference>("system");
  const [density, setDensity] =
    useState<ControlDensityPreference>("comfortable");

  useEffect(() => {
    const stored = readStoredPreference(themeStorageKey);
    const storedDensity = readStoredPreference(densityStorageKey);
    const initialPreference = isThemePreference(stored) ? stored : "system";
    const initialDensity = storedDensity === "compact" ? "compact" : "comfortable";
    setPreference(initialPreference);
    setDensity(initialDensity);
    applyTheme(initialPreference);
    applyDensity(initialDensity);

    const media = window.matchMedia(themeQuery);
    const handleSystemThemeChange = () => {
      if (
        (readStoredPreference(themeStorageKey) ?? "system") === "system"
      ) {
        applyTheme("system");
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) {
        const nextPreference = isThemePreference(event.newValue)
          ? event.newValue
          : "system";
        setPreference(nextPreference);
        applyTheme(nextPreference);
      }
      if (event.key === densityStorageKey) {
        const nextDensity =
          event.newValue === "compact" ? "compact" : "comfortable";
        setDensity(nextDensity);
        applyDensity(nextDensity);
      }
    };
    media.addEventListener("change", handleSystemThemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function selectTheme(nextPreference: ControlThemePreference) {
    storePreference(themeStorageKey, nextPreference);
    setPreference(nextPreference);
    applyTheme(nextPreference);
    setMenuOpen(false);
  }

  function selectDensity(nextDensity: ControlDensityPreference) {
    storePreference(densityStorageKey, nextDensity);
    setDensity(nextDensity);
    applyDensity(nextDensity);
    setMenuOpen(false);
  }

  const activeOption =
    themeOptions.find((option) => option.value === preference) ??
    { icon: MonitorCog, label: "Systeem", value: "system" as const };
  const ActiveIcon = activeOption.icon;

  return (
    <Dialog onOpenChange={setMenuOpen} open={menuOpen}>
      <DialogTrigger asChild>
        <IconButton
          aria-label={`Thema en dichtheid: ${activeOption.label}`}
          className="control-theme-switcher__trigger"
          title={`Thema en dichtheid: ${activeOption.label}`}
        >
          <ActiveIcon aria-hidden="true" />
          <ChevronDown
            aria-hidden="true"
            className="control-theme-switcher__chevron"
          />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="control-theme-switcher__menu">
        <DialogTitle>Weergave aanpassen</DialogTitle>
        <DialogDescription>
          Kies een thema en de informatiedichtheid van Control.
        </DialogDescription>
        <DialogBody>
          <div aria-label="Thema kiezen" role="radiogroup">
            <p className="control-theme-switcher__label">Thema</p>
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  aria-checked={preference === option.value}
                  className="control-theme-switcher__option"
                  key={option.value}
                  onClick={() => selectTheme(option.value)}
                  role="radio"
                  type="button"
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <div
            aria-label="Informatiedichtheid kiezen"
            className="control-theme-switcher__density"
            role="radiogroup"
          >
            <p className="control-theme-switcher__label">Dichtheid</p>
            {densityOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  aria-checked={density === option.value}
                  className="control-theme-switcher__option"
                  key={option.value}
                  onClick={() => selectDensity(option.value)}
                  role="radio"
                  type="button"
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function applyTheme(preference: ControlThemePreference) {
  const resolved =
    preference === "system"
      ? window.matchMedia(themeQuery).matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

function applyDensity(density: ControlDensityPreference) {
  document.documentElement.dataset.density = density;
}

function isThemePreference(
  value: string | null
): value is ControlThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredPreference(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // De voorkeur blijft voor deze sessie actief wanneer opslag is afgeschermd.
  }
}
