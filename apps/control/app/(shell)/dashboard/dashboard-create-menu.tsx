"use client";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";
import {
  CalendarPlus,
  CloudUpload,
  FilePlus2,
  LifeBuoy,
  ListPlus,
  MonitorUp,
  Plus
} from "lucide-react";
import Link from "next/link";

type DashboardCreateMenuProps = {
  canCreateMedia: boolean;
  canCreatePlaylist: boolean;
  canCreateStudio: boolean;
  canManageScreens: boolean;
  canWriteSupport: boolean;
};

export function DashboardCreateMenu({
  canCreateMedia,
  canCreatePlaylist,
  canCreateStudio,
  canManageScreens,
  canWriteSupport
}: DashboardCreateMenuProps) {
  const actions = [
    canCreateStudio
      ? {
          description: "Maak een nieuw visueel ontwerp.",
          href: "/dashboard/studio/new",
          icon: FilePlus2,
          label: "Ontwerp"
        }
      : null,
    canCreateMedia
      ? {
          description: "Voeg een afbeelding of video toe.",
          href: "/dashboard/media?upload=1",
          icon: CloudUpload,
          label: "Media-upload"
        }
      : null,
    canCreatePlaylist
      ? {
          description: "Start een nieuw publicatieconcept.",
          href: "/dashboard/playlists?nieuw=1",
          icon: ListPlus,
          label: "Playlist"
        }
      : null,
    canManageScreens
      ? {
          description: "Voeg een Player aan de vloot toe.",
          href: "/dashboard/screens/new",
          icon: MonitorUp,
          label: "Scherm"
        }
      : null,
    canCreatePlaylist
      ? {
          description: "Plan content voor een tijdvenster.",
          href: "/dashboard/planning?nieuw=1",
          icon: CalendarPlus,
          label: "Planning"
        }
      : null,
    canWriteSupport
      ? {
          description: "Stel een vraag aan het supportteam.",
          href: "/dashboard/support?nieuw=1",
          icon: LifeBuoy,
          label: "Supportticket"
        }
      : null
  ].filter((action): action is NonNullable<typeof action> => action !== null);

  if (!actions.length) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Nieuw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuw maken</DialogTitle>
          <DialogDescription>
            Kies wat je binnen de actieve vereniging wilt toevoegen.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <nav aria-label="Nieuwe resource kiezen" className="dashboard-create-menu">
            {actions.map(({ description, href, icon: Icon, label }) => (
              <Link href={href} key={href}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </Link>
            ))}
          </nav>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
