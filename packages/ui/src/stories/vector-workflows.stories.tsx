import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CommandBar,
  Container,
  HealthBadge,
  JourneyShell,
  MultiSelectDropdown,
  ResourcePicker,
  ScreenSnapshot,
  SegmentedControl,
  Stack,
  StickyActionBar,
  TextInput,
  UnifiedFilterDock
} from "../index";

const meta = {
  title: "Vector v2/Workflows",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function MultiSelectExample() {
  const [teams, setTeams] = useState(["jo17-1", "jo19-1"]);
  return (
    <MultiSelectDropdown
      description="Zoek teams, voeg alles toe of verwijder een uitzondering als tag."
      label="Teams voor programma komende week"
      onValueChange={setTeams}
      options={[
        { description: "Actuele competitie", label: "JO17-1", value: "jo17-1" },
        { description: "Actuele competitie", label: "JO19-1", value: "jo19-1" },
        { description: "Actuele competitie", label: "MO17-1", value: "mo17-1" }
      ]}
      searchable
      selectionNoun={{ plural: "teams", singular: "team" }}
      value={teams}
    />
  );
}

const journeySteps = [
  { id: "goal", label: "Wat wil je tonen?" },
  { id: "content", label: "Teams & slides" },
  { id: "context", label: "Competitie & poule" },
  { id: "theme", label: "Thema & weergave" },
  { id: "review", label: "Controleren" }
] as const;

export const JourneyWithPersistentPreview: Story = {
  render: () => (
    <Container size="wide" style={{ paddingBlock: "var(--vc-vector-space-32)" }}>
      <JourneyShell
        actions={<Button variant="ghost">Opslaan en sluiten</Button>}
        aside={
          <Stack>
            <ScreenSnapshot label="Live preview — clubprogramma">
              <div style={{ padding: "var(--vc-vector-space-24)" }}>
                <strong>Programma vandaag</strong>
              </div>
            </ScreenSnapshot>
            <HealthBadge detail="Zojuist bijgewerkt" label="Preview gereed" status="success" />
          </Stack>
        }
        currentStep="content"
        description="Combineer teams en presentaties. Het aantal te maken slides blijft tijdens de hele reis zichtbaar."
        eyebrow="Sportlink"
        steps={journeySteps}
        title="Nieuwe dynamische slides"
      >
        <Stack gap="var(--vc-vector-space-24)">
          <CommandBar
            actions={<Button variant="secondary">Selectie beheren</Button>}
            primary={<TextInput aria-label="Teams zoeken" placeholder="Zoek een team" type="search" />}
            status="6 slides geselecteerd"
          />
          <Card>
            <CardHeader>
              <CardTitle>JO17-1</CardTitle>
              <CardDescription>Kies één of meer presentaties voor dit team.</CardDescription>
            </CardHeader>
            <CardContent>
              <SegmentedControl
                label="Weergave"
                onChange={() => undefined}
                options={[
                  { description: "Compact en scanbaar", label: "Lijst", value: "list" },
                  { description: "Visuele vergelijking", label: "Raster", value: "grid" }
                ]}
                value="grid"
              />
            </CardContent>
          </Card>
          <StickyActionBar aside="Concept automatisch opgeslagen · 6 slides">
            <Button variant="secondary">Terug</Button>
            <Button>Verder naar competitie</Button>
          </StickyActionBar>
        </Stack>
      </JourneyShell>
    </Container>
  )
};

export const UnifiedDiscovery: Story = {
  render: () => (
    <Container size="wide" style={{ paddingBlock: "var(--vc-vector-space-32)" }}>
      <Stack gap="var(--vc-vector-space-24)">
        <UnifiedFilterDock
          activeCount={1}
          clearHref="#"
          primary={<TextInput aria-label="Bibliotheek zoeken" placeholder="Zoek binnen content" type="search" />}
          results="18 bronnen beschikbaar"
        >
          <SegmentedControl
            label="Beschikbaarheid"
            onChange={() => undefined}
            options={[
              { label: "Alles", value: "all" },
              { label: "Gereed", value: "ready" },
              { label: "Aandacht", value: "attention" }
            ]}
            value="ready"
          />
        </UnifiedFilterDock>
        <ResourcePicker
          items={[
            {
              description: "Eigen upload · gereed voor Player",
              id: "welcome",
              kind: "media",
              name: "Welkom in het clubhuis",
              status: { label: "Gereed", tone: "success" }
            },
            {
              description: "Actuele data uit Sportlink",
              id: "schedule",
              kind: "dynamic",
              name: "Programma vandaag",
              status: { label: "Live", tone: "info" }
            },
            {
              description: "Editorial Arena · landschap",
              id: "editorial",
              kind: "template",
              name: "Editorial Arena",
              status: { label: "Beschikbaar", tone: "success" }
            }
          ]}
          onSelect={() => undefined}
        />
      </Stack>
    </Container>
  )
};

export const SharedMultiSelection: Story = {
  render: () => (
    <Container size="reading" style={{ paddingBlock: "var(--vc-vector-space-32)" }}>
      <MultiSelectExample />
    </Container>
  )
};
