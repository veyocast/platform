import ScreensPage from "../screens-page";

type ScreenLocationsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ScreenLocationsPage({
  searchParams
}: ScreenLocationsPageProps) {
  return ScreensPage({
    searchParams: Promise.resolve({ ...(await searchParams), view: "venue" })
  });
}
