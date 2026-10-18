import { redirect } from "next/navigation";

export default function RssStudioEntry() {
  redirect("/dashboard/studio/new?family=rss&mode=connected");
}
