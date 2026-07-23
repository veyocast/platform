import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Button,
  CompactStats,
  DataTable,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FilterBar,
  Select,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  TablePreferences,
  TextInput,
  Toolbar
} from "../index";

const meta = {
  title: "Patterns/Control/Calm workspace",
  parameters: {
    layout: "padded"
  }
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const tableColumns = [
  { id: "name", label: "Naam", required: true },
  { id: "status", label: "Status" },
  { id: "playlist", label: "Playlist" },
  { defaultVisible: false, id: "seen", label: "Laatst gezien" }
] as const;

export const WorkspacePatterns: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--vc-space-24)", maxWidth: "72rem" }}>
      <CompactStats
        items={[
          { label: "Actie nodig", tone: "critical", value: 2 },
          { detail: "van 8 schermen", label: "Online", tone: "success", value: 6 },
          { label: "Playlists", value: 12 },
          { detail: "18,4 GB", label: "Opslag", value: "42%" }
        ]}
      />

      <FilterBar
        activeCount={1}
        clearHref="#"
        primary={<TextInput aria-label="Schermen zoeken" placeholder="Zoek scherm" type="search" />}
        results="8 schermen"
      >
        <Field id="status" label="Status">
          {({ controlProps }) => (
            <Select {...controlProps}>
              <option>Alle statussen</option>
              <option>Online</option>
              <option>Offline</option>
            </Select>
          )}
        </Field>
      </FilterBar>

      <Toolbar
        actions={<TablePreferences columns={tableColumns} tableKey="story-screen-fleet" />}
        label="Schermacties"
        summary="6 online · 2 hebben aandacht nodig"
        sticky
      >
        <Button>Scherm koppelen</Button>
      </Toolbar>

      <DataTable caption="Schermen binnen de actieve vereniging" tableKey="story-screen-fleet">
        <thead>
          <tr>
            <th data-column="name" scope="col">Naam</th>
            <th data-column="status" scope="col">Status</th>
            <th data-column="playlist" scope="col">Playlist</th>
            <th data-column="seen" scope="col">Laatst gezien</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-column="name" data-label="Naam">Kantine</td>
            <td data-column="status" data-label="Status">Online</td>
            <td data-column="playlist" data-label="Playlist">Weekprogramma</td>
            <td data-column="seen" data-label="Laatst gezien">1 minuut geleden</td>
          </tr>
        </tbody>
      </DataTable>
    </div>
  )
};

export const DecisionDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Nieuwe playlist</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe playlist maken</DialogTitle>
          <DialogDescription>
            Begin leeg of gebruik een bestaande playlist als veilige kopie.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field id="playlist-name" label="Naam">
            {({ controlProps }) => <TextInput {...controlProps} placeholder="Bijvoorbeeld Kantine" />}
          </Field>
        </DialogBody>
        <DialogFooter aside="Je kunt dit later aanpassen.">
          <DialogClose asChild>
            <Button variant="secondary">Annuleren</Button>
          </DialogClose>
          <Button>Playlist maken</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
};

export const InspectorSheet: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Media bekijken</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Welkomstscherm</SheetTitle>
          <SheetDescription>Afbeelding · Gereed voor Player</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <p>Dit bestand wordt gebruikt in twee playlistconcepten.</p>
        </SheetBody>
        <SheetFooter>
          <Button variant="secondary">Media beheren</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
};

export const LightAndDarkDensity: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))"
      }}
    >
      {(["light", "dark"] as const).map((theme) => (
        <div
          data-theme={theme}
          key={theme}
          style={{
            background: "var(--vc-background)",
            color: "var(--vc-text)",
            display: "grid",
            gap: "var(--vc-space-16)",
            padding: "var(--vc-space-24)"
          }}
        >
          <strong>{theme === "light" ? "Licht thema" : "Donker thema"}</strong>
          <CompactStats
            items={[
              { label: "Actie nodig", tone: "warning", value: 1 },
              { label: "Online", tone: "success", value: 6 }
            ]}
          />
          <Toolbar summary="Persoonlijke weergave">
            <Button variant="secondary">Filters</Button>
          </Toolbar>
        </div>
      ))}
    </div>
  )
};
