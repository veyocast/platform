import Link from "next/link";
import { notFound } from "next/navigation";
import { loadMediaFrameEditor } from "../../media-frames/media-frame-data.server";
import { MediaFrameEditor } from "../../media-frames/media-frame-editor";

export default async function MediaFramePage({ params }: { params: Promise<{ frameId: string }> }) {
  const { frameId } = await params;
  const result = await loadMediaFrameEditor({ frameId });
  if (!result.ok) {
    if (result.missing) notFound();
    return <div className="px-pages"><h1>Media-ontwerp niet beschikbaar</h1><p role="alert">{result.message}</p><Link href="/dashboard/content">Terug naar Content</Link></div>;
  }
  return <>{result.archived && <p role="status">Dit media-ontwerp is gearchiveerd. Herstel het vanuit het Contentarchief om het te wijzigen.</p>}<MediaFrameEditor key={`${result.props.actorScope}:${result.props.frameId}`} {...result.props} /></>;
}
