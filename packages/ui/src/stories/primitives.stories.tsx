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
  EmptyState,
  ErrorState,
  Field,
  Grid,
  IconButton,
  Link,
  Progress,
  Skeleton,
  Stack,
  StatusDot,
  Switch,
  TextInput,
  Textarea
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
