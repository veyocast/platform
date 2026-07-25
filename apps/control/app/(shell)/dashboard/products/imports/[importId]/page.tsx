import { redirect } from "next/navigation";

type LegacyProductImportPageProps = Readonly<{
  params: Promise<{ importId: string }>;
}>;

export default async function LegacyProductImportPage({
  params
}: LegacyProductImportPageProps) {
  const { importId } = await params;
  redirect(`/dashboard/integrations/twelve-products/imports/${importId}`);
}
