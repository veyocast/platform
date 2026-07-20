import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Alert,
  AspectRatio,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Grid,
  IconButton,
  Inspector,
  Link,
  PageHeader,
  Progress,
  ResourceState,
  Skeleton,
  Stack,
  StatusDot,
  Switch,
  TextInput,
  Textarea,
  Toolbar
} from "../index";

const meta = {
  title: "Design System/Primitives",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function SearchIcon() {
  return <span aria-hidden="true">/</span>;
}

export const Gallery: Story = {
  render: () => (
    <Container style={{ paddingBlock: "var(--vc-space-32)" }}>
      <Stack gap="var(--vc-space-24)">
        <Stack direction="horizontal" gap="var(--vc-space-12)">
          <Button>Publish</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Preview</Button>
          <Button variant="destructive">Remove</Button>
          <IconButton aria-label="Search">
            <SearchIcon />
          </IconButton>
        </Stack>

        <Grid minItemWidth="18rem">
          <Card>
            <CardHeader>
              <CardTitle>Control surface</CardTitle>
              <CardDescription>Operational components for repeated dashboard work.</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack direction="horizontal" gap="var(--vc-space-8)">
                <Badge status="success">Online</Badge>
                <Badge status="warning">Syncing</Badge>
                <StatusDot label="Critical issue" status="critical" />
              </Stack>
            </CardContent>
          </Card>

          <Card variant="selected">
            <CardHeader>
              <CardTitle>Player preview</CardTitle>
              <CardDescription>Aspect-ratio frame for screen templates.</CardDescription>
            </CardHeader>
            <CardContent>
              <AspectRatio
                style={{
                  background: "var(--vc-surface-muted)",
                  borderRadius: "var(--vc-radius-md)"
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid minItemWidth="18rem">
          <Field description="Used by screen fleet filters." label="Venue" id="venue">
            {({ controlProps }) => <TextInput placeholder="Main stand" {...controlProps} />}
          </Field>
          <Field error="Use a shorter message." label="Announcement" id="announcement">
            {({ controlProps }) => <Textarea {...controlProps} />}
          </Field>
          <Field description="Immediate preference toggle." label="Auto-refresh" id="auto-refresh">
            {({ controlProps }) => <Switch {...controlProps} />}
          </Field>
        </Grid>

        <Alert status="info" title="Release is preparing">
          Assets are uploading and will move to verification when complete.
        </Alert>
        <Progress label="Release progress" value={64} />

        <Grid minItemWidth="18rem">
          <Skeleton style={{ height: "6rem" }} />
          <EmptyState action={<Button variant="secondary">Add screen</Button>} title="No screens yet">
            Pair a player to start publishing schedules.
          </EmptyState>
          <ErrorState action={<Link href="#">Retry</Link>} title="Could not load media">
            The library request failed. Existing player loops keep running.
          </ErrorState>
        </Grid>
      </Stack>
    </Container>
  )
};

export const LightAndDark: Story = {
  render: () => (
    <Grid columns={2} gap="0">
      {(["light", "dark"] as const).map((theme) => (
        <div data-theme={theme} key={theme} style={{ background: "var(--vc-background)" }}>
          <Container style={{ paddingBlock: "var(--vc-space-32)" }}>
            <Stack>
              <Badge status="info">{theme}</Badge>
              <Button>Primary action</Button>
              <Card>
                <CardHeader>
                  <CardTitle>Surface sample</CardTitle>
                  <CardDescription>Tokens switch through data-theme.</CardDescription>
                </CardHeader>
              </Card>
            </Stack>
          </Container>
        </div>
      ))}
    </Grid>
  )
};

export const ResourcePageContract: Story = {
  render: () => (
    <Container size="wide" style={{ paddingBlock: "var(--vc-space-32)" }}>
      <Stack gap="var(--vc-space-24)">
        <PageHeader
          actions={<Button>Media uploaden</Button>}
          breadcrumbs={[{ href: "#", label: "Content" }, { label: "Media" }]}
          description="Beheer, controleer en hergebruik media binnen de actieve vereniging."
          status={{ label: "Live tenantdata", tone: "success" }}
          title="Media"
        />
        <Toolbar summary="1 van 84 media-items">
          <TextInput aria-label="Media zoeken" placeholder="Zoek op naam" type="search" />
          <Button variant="secondary">Filters</Button>
        </Toolbar>
        <DataTable caption="Media binnen de actieve vereniging.">
          <thead><tr><th scope="col">Naam</th><th scope="col">Status</th><th scope="col">Gebruik</th></tr></thead>
          <tbody><tr><td data-label="Naam">Welkomstscherm</td><td data-label="Status"><Badge status="success">Gereed</Badge></td><td data-label="Gebruik" data-priority="secondary">2 playlists</td></tr></tbody>
        </DataTable>
        <Grid minItemWidth="18rem">
          <Inspector description="Welkomstscherm.png" status={{ label: "Gereed", tone: "success" }} title="Mediadetail">
            <p>Dit bestand wordt gebruikt in twee playlistconcepten.</p>
          </Inspector>
          <Stack>
            <ResourceState kind="empty" title="Geen media gevonden">Pas de filters aan of upload een nieuw bestand.</ResourceState>
            <ResourceState kind="forbidden" title="Geen toegang">Vraag een beheerder om de capability voor mediabeheer.</ResourceState>
            <ResourceState kind="stale" title="Status mogelijk verouderd">Vernieuw om de laatste verwerkingsstatus te laden.</ResourceState>
          </Stack>
        </Grid>
      </Stack>
    </Container>
  )
};
