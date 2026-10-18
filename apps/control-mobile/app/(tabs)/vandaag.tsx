import {
  AppShell, AppText, Button, InlineAlert, PressableSurface, ScreenScrollView,
  SectionHeader, Skeleton, StatusBadge, SurfaceCard, mobileSpacing, useMobileTheme,
} from "@veyocast/mobile-design-system";
import type { MobileScreenSummary } from "@veyocast/contracts";
import { useRouter } from "expo-router";
import { Camera, ChevronRight, Monitor } from "lucide-react-native";
import { RefreshControl, StyleSheet, View } from "react-native";

import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import { useMobileCockpit, useMobileScreens } from "../../src/query/use-mobile-data";
import { useTenant } from "../../src/tenant/tenant-provider";

export default function VandaagScreen() {
  const cockpit = useMobileCockpit();
  const screens = useMobileScreens();
  const { session } = useTenant();
  const router = useRouter();
  const theme = useMobileTheme();
  const data = screens.data?.data;
  const items = data?.items ?? [];
  const offline = Boolean(screens.data?.offline || cockpit.data?.offline);
  const refetch = () => { void screens.refetch(); void cockpit.refetch(); };
  const firstName = session?.userName.trim().split(/\s+/)[0];

  return (
    <AppShell>
      <ScreenScrollView refreshControl={<RefreshControl colors={[theme.colors.action]} onRefresh={refetch} refreshing={screens.isRefetching || cockpit.isRefetching} tintColor={theme.colors.action} />}>
        <PageHeader eyebrow={firstName ? `Hallo, ${firstName}` : "Je club, onderweg"} title="Alles in beeld." />
        {offline ? <InlineAlert title="Laatste opgeslagen overzicht" description={`De verbinding ontbreekt. Deze status is bewaard${screens.data?.storedAt ? ` op ${formatTimestamp(screens.data.storedAt)}` : " op dit apparaat"}. Vernieuw de gegevens voordat je een beheeractie uitvoert.`} tone="warning" /> : null}
        {screens.isLoading ? <Skeleton height={180} /> : screens.error ? <AppError error={screens.error} onRetry={refetch} /> : data ? <>
          <AppText muted variant="caption">{items.length === data.total ? "Je schermen" : `${items.length} van ${data.total} schermen in dit overzicht`} · {screens.data?.offline ? "laatst bekende status" : "actuele status"}</AppText>
          <View style={styles.metrics}>
            {([
              ["online", "Online", "success"],
              ["offline", "Offline", "warning"],
              ["unknown", "Onbekend", "neutral"],
            ] as const).map(([status, label, tone]) => <SurfaceCard key={status} style={styles.metric}>
              <AppText variant="pageTitle">{items.filter(screen => screen.status === status).length}</AppText>
              <StatusBadge label={label} tone={tone} />
            </SurfaceCard>)}
          </View>
          {items.some(screen => screen.status === "attention" || screen.status === "pairing") ? <AppText muted>{items.filter(screen => screen.status === "attention").length} met aandacht · {items.filter(screen => screen.status === "pairing").length} wachten op koppeling</AppText> : null}
          <SectionHeader title="Je schermen" action={<Button size="compact" variant="ghost" onPress={() => router.push("/(tabs)/schermen")}>Alle schermen</Button>} />
          {items.length ? items.map(screen => <CockpitScreen key={screen.id} screen={screen} onPress={() => router.push(`/screens/${screen.id}`)} />) : <SurfaceCard><AppText variant="cardTitle">Hier begint je uitzending</AppText><AppText muted>Koppel een Player om de status van je eerste scherm te zien.</AppText><Button variant="secondary" onPress={() => router.push("/screens/pair")}>Scherm koppelen</Button></SurfaceCard>}
        </> : null}
        <SurfaceCard style={[styles.callout, { backgroundColor: theme.colors.infoSurface }]}>
          <Camera color={theme.colors.ink} size={27} />
          <AppText variant="section">Een moment om te delen?</AppText>
          <AppText>Maak clubnieuws direct vanaf je telefoon.</AppText>
          <Button onPress={() => router.push("/(tabs)/maken")}>Afbeelding kiezen of maken</Button>
        </SurfaceCard>
        {cockpit.error ? <AppError error={cockpit.error} onRetry={() => void cockpit.refetch()} /> : cockpit.data?.data.signals.length ? <>
          <SectionHeader title="Aandacht voor vandaag" description="Herstelacties uit je eigen organisatie." />
          {cockpit.data.data.signals.map(signal => <SurfaceCard key={signal.id} style={styles.callout}>
            <StatusBadge label={signal.title} tone={signal.tone} />
            <AppText>{signal.message}</AppText>
            <AppText muted variant="caption">{signal.occurredAt ? formatTimestamp(signal.occurredAt) : "Tijdstip onbekend"}</AppText>
            <Button disabled={offline} variant="secondary" onPress={() => router.push(signal.actionHref as never)}>{signal.actionLabel}</Button>
          </SurfaceCard>)}
        </> : null}
      </ScreenScrollView>
    </AppShell>
  );
}

function CockpitScreen({ screen, onPress }: { screen: MobileScreenSummary; onPress: () => void }) {
  const theme = useMobileTheme();
  const status = {
    online: { label: "Online", tone: "success" }, offline: { label: "Offline", tone: "warning" },
    unknown: { label: "Onbekend", tone: "neutral" }, attention: { label: "Aandacht nodig", tone: "warning" },
    pairing: { label: "Wacht op koppeling", tone: "info" },
  } as const;
  return <PressableSurface accessibilityLabel={`Open ${screen.name}, ${status[screen.status].label}`} onPress={onPress}>
    <SurfaceCard style={styles.screen}>
      <Monitor color={theme.colors.secondaryInk} size={20} />
      <View style={styles.copy}>
        <AppText variant="cardTitle">{screen.name}</AppText>
        <AppText muted variant="caption">{screen.location ?? "Locatie niet ingevuld"}</AppText>
        <AppText muted variant="caption">Contact: {screen.lastSeenAt ? formatTimestamp(screen.lastSeenAt) : "nog niet ontvangen"}</AppText>
        <AppText muted variant="caption">Actief: {screen.activeReleaseLabel ?? "nog niet bekend"}</AppText>
        <StatusBadge {...status[screen.status]} />
      </View>
      <ChevronRight color={theme.colors.secondaryInk} size={18} />
    </SurfaceCard>
  </PressableSurface>;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "onbekend" : new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(date);
}
const styles = StyleSheet.create({
  metrics: { flexDirection: "row", gap: mobileSpacing.compact, flexWrap: "wrap" },
  metric: { flex: 1, minWidth: 88, gap: mobileSpacing.compact, padding: mobileSpacing.inline },
  callout: { gap: mobileSpacing.default },
  screen: { alignItems: "center", flexDirection: "row", gap: mobileSpacing.compact },
  copy: { flex: 1, minWidth: 0, gap: mobileSpacing.micro },
});
