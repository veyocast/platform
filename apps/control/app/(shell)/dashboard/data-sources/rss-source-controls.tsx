import React from "react";
import Link from "next/link";
import { RefreshCw, Rss } from "lucide-react";
import { Button } from "@veyocast/ui";
import { syncRssSource } from "./actions";

export function RssSourceActions({ sourceId, canDesign, canManage, paused }: {
  sourceId: string; canDesign: boolean; canManage: boolean; paused: boolean;
}) {
  if (paused) return null;
  return <div className="row">
    {canDesign && <Button asChild><Link href={`/dashboard/studio/new?family=rss&mode=connected&source=${sourceId}`}><Rss size={16} />Nieuwsslide maken</Link></Button>}
    {canManage && <form action={syncRssSource}><input name="sourceId" type="hidden" value={sourceId} /><Button type="submit" variant="secondary"><RefreshCw size={16} />Synchroniseren</Button></form>}
  </div>;
}
