import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  SectionHeader,
  Skeleton,
  StatusBadge,
  SurfaceCard,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  CloudOff,
  MonitorCheck,
  PackageCheck,
  Radio
} from "lucide-react-native";
import { RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";

import { AppError } from "../../src/components/app-error";
import { PageHeader } from "../../src/components/page-header";
import { useMobileCockpit } from "../../src/query/use-mobile-data";

export default function VandaagScreen() {
  const query = useMobileCockpit();
  const router = useRouter();
  const theme = useMobileTheme();
  const { width } = useWindowDimensions();
  const metricColumns = width >= 768 ? 4 : 2;
  const data = query.data?.data;

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
        <PageHeader eyebrow={formatDayLabel(new Date())} title="Vandaag" />
        {query.data?.offline ? (
          <InlineAlert
            description={`Je ziet de laatst opgeslagen status${
              query.data.storedAt
                ? ` van ${formatTimestamp(query.data.storedAt)}`
                : ""
            }. Acties worden pas uitgevoerd wanneer de API bereikbaar is.`}
            title="Offline overzicht"
            tone="warning"
          />
        ) : null}
        {query.isLoading ? (
          <View style={styles.stack}>
            <Skeleton height={132} />
            <Skeleton height={220} />
          </View>
        ) : query.error ? (
          <AppError error={query.error} onRetry={() => void query.refetch()} />
        ) : data ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionTitle}>
                <View style={styles.titleCopy}>
                  <AppText accessibilityRole="header" variant="section">
                    Acties voor vandaag
                  </AppText>
                  <AppText muted>
                    Operationele signalen uit je eigen organisatie.
                  </AppText>
                </View>
                <StatusBadge
                  label={`${data.signals.length} open`}
                  tone={data.signals.length ? "warning" : "success"}
                />
              </View>
              {data.signals.length ? (
                data.signals.map((signal) => (
                  <SurfaceCard
                    key={signal.id}
                    style={[
                      styles.signal,
                      {
                        borderLeftColor:
                          signal.tone === "critical"
                            ? theme.colors.critical
                            : signal.tone === "warning"
                              ? theme.colors.warning
                              : theme.colors.focus
                      }
                    ]}
                  >
                    <View style={styles.signalHeader}>
                      <View
                        style={[
                          styles.signalIcon,
                          {
                            backgroundColor:
                              signal.tone === "critical"
                                ? theme.colors.criticalSurface
                                : signal.tone === "warning"
                                  ? theme.colors.warningSurface
                                  : theme.colors.infoSurface
                          }
                        ]}
                      >
                        {signal.tone === "critical" ? (
                          <AlertTriangle color={theme.colors.critical} size={19} />
                        ) : signal.tone === "warning" ? (
                          <CloudOff color={theme.colors.warning} size={19} />
                        ) : (
                          <Radio color={theme.colors.focus} size={19} />
                        )}
                      </View>
                      <View style={styles.titleCopy}>
                        <AppText variant="cardTitle">{signal.title}</AppText>
                        <AppText muted variant="caption">
                          {signal.occurredAt
                            ? formatTimestamp(signal.occurredAt)
                            : "Tijdstip onbekend"}
                        </AppText>
                      </View>
                    </View>
                    <AppText>{signal.message}</AppText>
                    <Button
                      disabled={query.data?.offline}
                      icon={
                        <ArrowRight color={theme.colors.ink} size={17} />
                      }
                      onPress={() => router.push(signal.actionHref as never)}
                      size="compact"
                      style={styles.signalAction}
                      variant="secondary"
                    >
                      {signal.actionLabel}
                    </Button>
                  </SurfaceCard>
                ))
              ) : (
                <SurfaceCard style={styles.clearState}>
                  <View
                    style={[
                      styles.signalIcon,
                      { backgroundColor: theme.colors.successSurface }
                    ]}
                  >
                    <MonitorCheck color={theme.colors.success} size={19} />
                  </View>
                  <View style={styles.titleCopy}>
                    <AppText variant="cardTitle">Alles onder controle</AppText>
                    <AppText muted>
                      Er zijn nu geen signalen die om actie vragen.
                    </AppText>
                  </View>
                </SurfaceCard>
              )}
            </View>
            <View style={styles.section}>
              <SectionHeader
                description="De actuele stand van je organisatie."
                title="Status vandaag"
              />
              <SurfaceCard style={styles.summary}>
                <Metric
                  columns={metricColumns}
                  icon={<MonitorCheck color={theme.colors.success} size={18} />}
                  index={0}
                  label="Schermen online"
                  surface={theme.colors.successSurface}
                  value={String(data.screensOnline)}
                />
                <Metric
                  columns={metricColumns}
                  icon={<AlertTriangle color={theme.colors.warning} size={18} />}
                  index={1}
                  label="Aandacht nodig"
                  surface={theme.colors.warningSurface}
                  value={String(data.screensAttention)}
                />
                <Metric
                  columns={metricColumns}
                  icon={<PackageCheck color={theme.colors.focus} size={18} />}
                  index={2}
                  label="Publicaties gereed"
                  surface={theme.colors.infoSurface}
                  value={String(data.pendingPublications)}
                />
                <Metric
                  columns={metricColumns}
                  icon={
                    <Clock3 color={theme.colors.secondaryInk} size={18} />
                  }
                  index={3}
                  label="Media verwerkt"
                  surface={theme.colors.surface}
                  value={String(data.mediaProcessing)}
                />
              </SurfaceCard>
            </View>
          </>
        ) : null}
      </ScreenScrollView>
    </AppShell>
  );
}

function Metric({
  columns,
  icon,
  index,
  label,
  surface,
  value,
}: {
  columns: number;
  icon: React.ReactNode;
  index: number;
  label: string;
  surface: string;
  value: string;
}) {
  const theme = useMobileTheme();
  const row = Math.floor(index / columns);
  const lastRow = Math.floor(3 / columns);
  const lastColumn = index % columns === columns - 1;
  return (
    <View
      style={[
        styles.metric,
        {
          borderBottomColor: theme.colors.line,
          borderBottomWidth: row < lastRow ? 1 : 0,
          borderRightColor: theme.colors.line,
          borderRightWidth: lastColumn ? 0 : 1,
          flexBasis: `${100 / columns}%`
        }
      ]}
    >
      <View style={styles.metricTopline}>
        <View style={[styles.metricIcon, { backgroundColor: surface }]}>
          {icon}
        </View>
        <AppText variant="display">{value}</AppText>
      </View>
      <AppText muted variant="label">
        {label}
      </AppText>
    </View>
  );
}

function formatDayLabel(value: Date) {
  const label = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    weekday: "long"
  }).format(value);
  return label.slice(0, 1).toLocaleUpperCase("nl-NL") + label.slice(1);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  clearState: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  metric: {
    gap: 6,
    minWidth: 0,
    padding: mobileSpacing.inline
  },
  metricIcon: {
    alignItems: "center",
    borderRadius: 7,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  metricTopline: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.compact
  },
  section: { gap: mobileSpacing.inline },
  sectionTitle: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: mobileSpacing.inline,
    justifyContent: "space-between"
  },
  signal: {
    borderLeftWidth: 3,
    gap: mobileSpacing.inline,
    paddingLeft: mobileSpacing.inline
  },
  signalAction: {
    alignSelf: "flex-start"
  },
  signalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  signalIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  stack: { gap: mobileSpacing.default },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    padding: 0
  },
  titleCopy: { flex: 1, gap: mobileSpacing.micro }
});
