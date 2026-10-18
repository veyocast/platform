import { redirect } from "next/navigation";

export default function SportlinkStudioEntry() {
  redirect("/dashboard/studio/new?group=Sport&mode=connected");
}
