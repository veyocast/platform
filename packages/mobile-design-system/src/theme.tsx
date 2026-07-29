import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren
} from "react";
import { useColorScheme } from "react-native";
import {
  mobilePalette,
  type MobileThemeMode
} from "./tokens";

export type MobileTheme = Readonly<{
  mode: MobileThemeMode;
  colors: Readonly<{
    action: string;
    actionPressed: string;
    canvas: string;
    critical: string;
    criticalSurface: string;
    focus: string;
    infoSurface: string;
    ink: string;
    line: string;
    mutedInk: string;
    raised: string;
    secondaryInk: string;
    strongLine: string;
    surface: string;
    success: string;
    successSurface: string;
    warning: string;
    warningSurface: string;
  }>;
}>;

function createTheme(mode: MobileThemeMode): MobileTheme {
  const base = mobilePalette[mode];
  const statusSurfaces =
    mode === "dark"
      ? {
          critical: "#2A1716",
          info: "#18203D",
          success: "#13261D",
          warning: "#2A2015"
        }
      : {
          critical: mobilePalette.status.criticalSurface,
          info: mobilePalette.status.infoSurface,
          success: mobilePalette.status.successSurface,
          warning: mobilePalette.status.warningSurface
        };
  return {
    mode,
    colors: {
      action: mobilePalette.brand.action,
      actionPressed: mobilePalette.brand.actionPressed,
      canvas: base.canvas,
      critical: mobilePalette.status.critical,
      criticalSurface: statusSurfaces.critical,
      focus: base.focus,
      infoSurface: statusSurfaces.info,
      ink: base.ink,
      line: base.line,
      mutedInk: base.mutedInk,
      raised: base.raised,
      secondaryInk: base.secondaryInk,
      strongLine: base.strongLine,
      surface: base.surface,
      success: mobilePalette.status.success,
      successSurface: statusSurfaces.success,
      warning: mobilePalette.status.warning,
      warningSurface: statusSurfaces.warning
    }
  };
}

const lightTheme = createTheme("light");
const darkTheme = createTheme("dark");
const MobileThemeContext = createContext<MobileTheme>(lightTheme);

export type MobileThemeProviderProps = PropsWithChildren<{
  preference?: MobileThemeMode | "system";
}>;

export function MobileThemeProvider({
  children,
  preference = "system"
}: MobileThemeProviderProps) {
  const systemMode = useColorScheme();
  const mode: MobileThemeMode =
    preference === "system" ? (systemMode === "dark" ? "dark" : "light") : preference;
  const theme = useMemo(() => (mode === "dark" ? darkTheme : lightTheme), [mode]);
  return (
    <MobileThemeContext.Provider value={theme}>
      {children}
    </MobileThemeContext.Provider>
  );
}

export function useMobileTheme() {
  return useContext(MobileThemeContext);
}
