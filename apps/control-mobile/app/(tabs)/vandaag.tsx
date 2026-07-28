import {
  AppShell,
  AppText,
  Button,
  InlineAlert,
  ScreenScrollView,
  Skeleton,
  StateView,
  StatusBadge,
  SurfaceCard,
  mobileSpacing,
  useMobileTheme
} from "@veyocast/mobile-design-system";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
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
  const metricWidth = width >= 840 ? "31%" : "47%";
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
        <PageHeader eyebrow="Control" title="Vandaag" />
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
            <View style={styles.metrics}>
              <Metric
                icon={<MonitorCheck color={theme.colors.success} size={22} />}
                label="Schermen online"
                value={String(data.screensOnline)}
                width={metricWidth}
              />
              <Metric
                icon={<AlertTriangle color={theme.colors.warning} size={22} />}
                label="Aandacht nodig"
                value={String(data.screensAttention)}
                width={metricWidth}
              />
              <Metric
                icon={<PackageCheck color={theme.colors.focus} size={22} />}
                label="Publicaties gereed"
                value={String(data.pendingPublications)}
                width={metricWidth}
              />
              <Metric
                icon={<Clock3 color={theme.colors.secondaryInk} size={22} />}
                label="Media verwerkt"
                value={String(data.mediaProcessing)}
                width={metricWidth}
              />
            </View>
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
                  <SurfaceCard key={signal.id} style={styles.signal}>
                    <View style={styles.signalHeader}>
                      {signal.tone === "critical" ? (
                        <AlertTriangle color={theme.colors.critical} size={22} />
                      ) : signal.tone === "warning" ? (
                        <CloudOff color={theme.colors.warning} size={22} />
                      ) : (
                        <Radio color={theme.colors.focus} size={22} />
                      )}
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
                      onPress={() => router.push(signal.actionHref as never)}
                      variant="secondary"
                    >
                      {signal.actionLabel}
                    </Button>
                  </SurfaceCard>
                ))
              ) : (
                <StateView
                  description="Er zijn geen operationele signalen die nu om actie vragen."
                  icon={<MonitorCheck color={theme.colors.success} size={34} />}
                  title="Alles onder controle"
                />
              )}
            </View>
          </>
        ) : null}
      </ScreenScrollView>
    </AppShell>
  );
}

function Metric({
  icon,
  label,
  value,
  width
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  width: number | `${number}%`;
}) {
  return (
    <SurfaceCard style={[styles.metric, { width }]}>
      {icon}
      <AppText variant="display">{value}</AppText>
      <AppText muted variant="label">
        {label}
      </AppText>
    </SurfaceCard>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  metric: {
    flexGrow: 1,
    gap: mobileSpacing.compact,
    minWidth: 148
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.inline
  },
  section: { gap: mobileSpacing.default },
  sectionTitle: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: mobileSpacing.default,
    justifyContent: "space-between"
  },
  signal: { gap: mobileSpacing.default },
  signalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: mobileSpacing.inline
  },
  stack: { gap: mobileSpacing.default },
  titleCopy: { flex: 1, gap: mobileSpacing.micro }
});
