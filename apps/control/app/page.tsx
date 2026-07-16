import { CASTIVO_APPS, getLocalUrl } from "@castivo/config";

export default function ControlPage() {
  return (
    <main className="runtime-shell">
      <section className="runtime-panel" aria-labelledby="control-title">
        <p className="runtime-kicker">{getLocalUrl("control")}</p>
        <h1 className="runtime-title" id="control-title">
          {CASTIVO_APPS.control.name}
        </h1>
        <p className="runtime-copy">
          Lokale S00-runtime voor het beheeroppervlak. Domeinflows starten na de
          foundation en RLS-basis.
        </p>
      </section>
    </main>
  );
}
