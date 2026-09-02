import ScreensPage from "../screens-page";

type ScreenHealthPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ScreenHealthPage({ searchParams }: ScreenHealthPageProps) {
  return ScreensPage({
    searchParams: Promise.resolve({ ...(await searchParams), view: "health" })
  });
}
