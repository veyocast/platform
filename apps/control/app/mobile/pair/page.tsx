import { redirect } from "next/navigation";

export default async function MobilePairPage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: rawCode } = await searchParams;
  const code = rawCode?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  redirect(
    /^[A-Z0-9]{6}$/.test(code)
      ? `/dashboard/screens/new?code=${encodeURIComponent(code)}`
      : "/dashboard/screens/new"
  );
}
