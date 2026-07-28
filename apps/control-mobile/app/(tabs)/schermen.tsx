import {
  AppShell,
  AppText,
  Button,
  FilterChip,
  PressableSurface,
  ScreenScrollView,
  SearchField,
  Skeleton,
  StateView,
  StatusBadge,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import type { MobileScreenSummary } from "@veyocast/contracts";
import { useRouter } from "expo-router";
import { ChevronRight, Monitor, Plus, WifiOff } from "lucide-react-native";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import { useMobileScreens } from "../../src/query/use-mobile-data";

type Filter = "all" | MobileScreenSummary["status"];

export default function SchermenScreen() {
  const query = useMobileScreens();
  const router = useRouter();
  const theme = useMobileTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("nl-NL");
    return (query.data?.data.items ?? []).filter(
      (screen) =>
        (filter === "all" || screen.status === filter) &&
        (!normalized ||
          screen.name.toLocaleLowerCase("nl-NL").includes(normalized) ||
          screen.location?.toLocaleLowerCase("nl-NL").includes(normalized))
    );
  }, [filter, query.data?.data.items, search]);

  return (
    <AppShell>
      <ScreenScrollView
        refreshControl={
          <RefreshControl
            colors={[theme.colors.action]}
            onRefresh={() => void query.refetch()}
            refreshing={query.isRefetching}
            tintColor={theme.colors.action}
          />
        }
      >
        <PageHeader eyebrow="Fleet" title="Schermen" />
        <Button
          icon={<Plus color="#0A0A0A" size={20} />}
          onPress={() => router.push("/screens/pair")}
        >
          Scherm koppelen
        </Button>
        <SearchField
          onChangeText={setSearch}
          placeholder="Naam of locatie"
          value={search}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
        >
          <View style={styles.filters}>
            {filters.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                onPress={() => setFilter(item.value)}
                selected={filter === item.value}
              />
            ))}
          </View>
        </ScrollView>
        {query.isLoading ? (
          <View style={styles.list}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </View>
        ) : query.error ? (
          <AppError error={query.error} onRetry={() => void query.refetch()} />
        ) : filtered.length ? (
          <View style={styles.list}>
            {filtered.map((screen) => (
              <ScreenRow
                key={screen.id}
                onPress={() => router.push(`/screens/${screen.id}`)}
                screen={screen}
              />
            ))}
          </View>
        ) : (
          <StateView
            {...(search || filter !== "all"
              ? {
                  actionLabel: "Filters wissen",
                  onAction: () => {
                    setSearch("");
                    setFilter("all");
                  }
                }
              : {})}
            description={
              search || filter !== "all"
                ? "Geen scherm voldoet aan deze filters."
                : "Koppel je eerste fysieke Player aan een beheerd scherm."
            }
            icon={
              query.data?.offline ? (
                <WifiOff color={theme.colors.warning} size={34} />
              ) : (
                <Monitor color={theme.colors.secondaryInk} size={34} />
              )
            }
            title="Geen schermen gevonden"
          />
        )}
      </ScreenScrollView>
    </AppShell>
  );
}

function ScreenRow({
  onPress,
  screen
}: {
  onPress: () => void;
  screen: MobileScreenSummary;
}) {
  const theme = useMobileTheme();
  const status = statusPresentation[screen.status];
  return (
    <PressableSurface
      accessibilityHint="Opent schermdetails en veilige beheeracties"
      accessibilityLabel={`${screen.name}, ${status.label}`}
      onPress={onPress}
      style={[
        styles.pressable,
        { backgroundColor: theme.colors.raised }
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.screenIcon,
            { backgroundColor: theme.colors.surface }
          ]}
        >
          <Monitor color={theme.colors.ink} size={22} />
        </View>
        <View style={styles.rowCopy}>
          <AppText variant="cardTitle">{screen.name}</AppText>
          <AppText muted numberOfLines={1}>
            {screen.location ?? "Geen locatie"}
          </AppText>
          <StatusBadge label={status.label} tone={status.tone} />
        </View>
        <ChevronRight color={theme.colors.mutedInk} size={22} />
      </View>
    </PressableSurface>
  );
}

const filters: ReadonlyArray<{ label: string; value: Filter }> = [
  { label: "Alle", value: "all" },
  { label: "Online", value: "online" },
  { label: "Aandacht", value: "attention" },
  { label: "Offline", value: "offline" },
  { label: "Te koppelen", value: "pairing" }
];

const statusPresentation = {
  attention: { label: "Aandacht", tone: "critical" },
  offline: { label: "Offline", tone: "warning" },
  online: { label: "Online", tone: "success" },
  pairing: { label: "Te koppelen", tone: "info" },
  unknown: { label: "Onbekend", tone: "neutral" }
} as const;

const styles = StyleSheet.create({
  filterScroller: { flexGrow: 0 },
  filters: {
    flexDirection: "row",
    gap: mobileSpacing.compact
  },
  list: { gap: mobileSpacing.inline },
  pressable: {
    borderRadius: 16,
    borderWidth: 1
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline,
    minHeight: 96,
    padding: mobileSpacing.default
  },
  rowCopy: {
    flex: 1,
    gap: mobileSpacing.micro
  },
  screenIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    width: 48
  }
});
