import { redirect } from "next/navigation";

export default function LegacyNewSlidePage() {
  redirect("/dashboard/slides/menu-studio/new");
}
