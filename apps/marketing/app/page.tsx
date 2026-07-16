import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";

export default function MarketingPage() {
  return (
    <main className="runtime-shell">
      <section className="runtime-panel" aria-labelledby="marketing-title">
        <p className="runtime-kicker">{getLocalUrl("marketing")}</p>
        <h1 className="runtime-title" id="marketing-title">
          {CASTIVO_APPS.marketing.name}
        </h1>
        <p className="runtime-copy">
          Lokale S00-runtime voor de publieke website. De definitieve
          marketingervaring volgt na de productbasis.
        </p>
      </section>
    </main>
  );
}
