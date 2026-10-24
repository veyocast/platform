"use client";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Monitor, Package, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buildSitesMenuPresentation } from "@veyocast/content-templates/sites-dynamic-projector";
import { SitesPresentationView, sitesPresentationPages } from "@veyocast/content-templates/sites-presentation";
import { type MenuDocumentV2, type MenuStudioCommand, type SitesDynamicConfiguration } from "@veyocast/contracts";
import { Button, StatusPill } from "@veyocast/ui";
import { createSitesSourceDesign, updateSitesSourceDesign } from "../../studio/sportlink/new/sites-source-design";
import { SitesSourceDesignControls } from "../../studio/sportlink/new/sites-source-design-controls";
import { createMenuStudioDraft, saveMenuStudioCommand, setMenuStudioOrientation, publishMenuStudio } from "./actions";
import type { MenuStudioMediaOption, MenuStudioProductOption } from "./menu-studio-editor";
import { buildMenuWidgetDocument, menuLinkedIds, prepareMenuWidgets } from "./menu-widget-document";
import { MenuWidgetEditor } from "./menu-widget-editor";
import { SitesSourceDestinationPicker, SitesSourceDestinationAfterSave } from "../../studio/sportlink/new/sites-source-destination";
import { emptySitesSourceDestinationOptions, initialSitesSourceDestination, validSitesSourceDestination, type SitesSourceDestinationOptions } from "../../studio/sportlink/new/sites-source-destination-model";
import styles from "./sites-menu.module.css";

export function SitesMenuWizard({ initialDocument, initialOrientation, media, products, sourceId, templateVersionIds, slideId, initialName, clubName, destinationOptions = emptySitesSourceDestinationOptions }: { initialDocument: MenuDocumentV2; initialOrientation: "landscape" | "portrait"; media: MenuStudioMediaOption[]; products: MenuStudioProductOption[]; sourceId: string; templateVersionIds: Partial<Record<"landscape" | "portrait", string>>; slideId?: string; initialName?: string; clubName?: string; destinationOptions?: SitesSourceDestinationOptions }) {
  const [destination, setDestination] = useState(initialSitesSourceDestination);
  const [menuPublished, setMenuPublished] = useState(false);
  const [document, setDocument] = useState(() => prepareMenuWidgets(initialDocument));
  const [design, setDesign] = useState<SitesDynamicConfiguration>(() => ({ ...(initialDocument.sitesConfiguration ?? createSitesSourceDesign("menu", initialDocument.title || "Onze menukaart", initialOrientation)), themeId: initialDocument.sitesConfiguration?.themeId ?? (initialDocument.theme.themeId === "onzetrots-tv" ? "onzetrots-tv" : "fieldflow"), accent: initialDocument.sitesConfiguration?.accent ?? (initialDocument.theme.themeId === "onzetrots-tv" ? "#03438a" : initialDocument.theme.brand.accent), menuWidgets: true, onzeTrotsStyle: initialDocument.sitesConfiguration?.onzeTrotsStyle ?? "v9-marker-light" }));
  const [pageIndex, setPageIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [storedOrientation, setStoredOrientation] = useState(initialOrientation);
  const [step, setStep] = useState(0); const [name, setName] = useState(initialName ?? initialDocument.title ?? "Onze menukaart");
  const [savedId, setSavedId] = useState(slideId ?? ""); const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  const saveAttempt = useRef<{ signature: string; contentId: string; orientationId: string; orientationRevision: number; contentRevision?: number } | null>(null);
  const selectedIds = menuLinkedIds(document);
  const missing = selectedIds.some(id => !products.some(product => product.id === id));
  const selected = products.filter(product => selectedIds.includes(product.id));
  const built = useMemo(() => { try { return {draft:buildMenuWidgetDocument(document, products, design, media),error:null}; } catch (error) { return {draft:null,error:error instanceof Error&&error.name!=="ZodError"?error.message:"Een widget heeft onvolledige of te lange invoer. Controleer de titel, tekst en afbeelding voordat je opslaat."}; } }, [document, products, design, media]);
  const draft = built.draft;
  const presentation = useMemo(()=>draft ? buildSitesMenuPresentation(draft, design, clubName) : null,[draft,design,clubName]);
  const pages = presentation ? sitesPresentationPages(presentation) : 1;
  useEffect(()=>{if(presentation?.kind!=="dynamic")return;const id=document.pages[pageIndex]?.id;const target=presentation.content.menuPages?.findIndex(page=>page.id.startsWith(`${id}:`))??0;setPreviewIndex(Math.max(0,target));},[pageIndex,document.pages,presentation]);
  const hasContent = document.pages.some(page => page.blocks.some(block => block.type !== "category" || block.productNodes.length > 0));
  function patch(value: Partial<SitesDynamicConfiguration>) { setDesign(current => updateSitesSourceDesign(current, {...value, ...(value.themeId && value.themeId !== current.themeId ? {accent:value.themeId === "onzetrots-tv" ? "#03438a" : "#09554e"} : {})})); setSaved(false); }
  function save() {
    if (!draft || missing || !hasContent || name.trim().length < 2 || pending || !validSitesSourceDestination(destination, destinationOptions)) return;
    setError(null);
    const signature = JSON.stringify({ sourceId, savedId, name: name.trim(), draft });
    if (saveAttempt.current?.signature !== signature) saveAttempt.current = { signature, contentId: crypto.randomUUID(), orientationId: crypto.randomUUID(), orientationRevision: document.revision };
    const attempt = saveAttempt.current;
    startTransition(async () => {
     try {
      let current = document;
      if (savedId && design.orientation !== storedOrientation) {
        const template = templateVersionIds[design.orientation];
        if (!template) { setError("Dit schermformaat is nog niet beschikbaar. Je menu is niet opgeslagen. Kies een beschikbaar formaat."); return; }
        const oriented = await setMenuStudioOrientation({ slideId: savedId, expectedRevision: attempt.orientationRevision, operationId: attempt.orientationId, orientation: design.orientation, templateVersionId: template });
        if (!oriented.ok) { setError(`${oriented.message} Je menu blijft behouden. Vernieuw de pagina en probeer opnieuw.`); return; }
        current = oriented.document; setDocument(current); setStoredOrientation(design.orientation);
      }
      const next = { ...draft, revision: current.revision };
      attempt.contentRevision ??= current.revision;
      const command: MenuStudioCommand = { baseRevision: attempt.contentRevision, operationId: attempt.contentId, operation: { kind: "restore-content", assets: next.assets, pages: next.pages, providerSnapshot: next.providerSnapshot ?? null, theme: next.theme, title: next.title ?? null, sitesConfiguration: next.sitesConfiguration } };
      const template = templateVersionIds[design.orientation];
      const result = savedId ? await saveMenuStudioCommand({ slideId: savedId, command }) : template ? await createMenuStudioDraft({ dataSourceId: sourceId, document: next, name: name.trim(), operationId: attempt.contentId, templateVersionId: template }) : null;
      if (!result?.ok) { setError(`${result && !result.ok ? result.message : "Dit schermformaat is nog niet beschikbaar."} Je menu is niet opgeslagen. Controleer je keuze en probeer opnieuw.`); return; }
      setMenuPublished(false); setSavedId(result.slideId); setDocument(result.document); setSaved(true);
      const prepared=await publishMenuStudio({slideId:result.slideId,expectedRevision:result.document.revision,operationId:attempt.contentId});
      if(prepared.ok)setMenuPublished(true);else setError(`${prepared.message} Je menu is opgeslagen. Gebruik opnieuw voorbereiden om dezelfde versie gereed te maken.`);
     } catch { setError("De verbinding werd onderbroken. Je keuzes blijven behouden. Probeer opnieuw met dezelfde keuzes; dezelfde sleutel voorkomt een dubbel ontwerp. Open een bestaand menu opnieuw om de opgeslagen versie te controleren."); }
    });
  }
  return <div className={styles.page}><div className={styles.titleBar}><Link className={styles.back} href="/dashboard/slides/menu-studio"><ArrowLeft size={17} />Menu Studio</Link><span><StatusPill label="Menu Studio" tone="warning" /></span></div><div className={styles.wizardHeading}><div><span className={styles.eyebrow}>Van assortiment naar scherm</span><h1 className="sr-only">Menu Studio</h1><h2>Jouw menukaart, in vier stappen.</h2><p>Kies je producten, maak het eigen en bepaal waar je menu thuishoort.</p></div><Button asChild variant="secondary"><Link href="/dashboard/integrations/twelve-products"><Package size={17} />Producten beheren</Link></Button></div><nav className={styles.steps} aria-label="Stappen Menu Studio">{["Producten", "Vormgeving", "Opslaan", "Controleren"].map((label, index) => <button type="button" key={label} disabled={pending || saved || (index > 0 && !hasContent)} aria-current={index === step ? "step" : undefined} className={index === step ? styles.currentStep : index < step ? styles.doneStep : ""} onClick={() => setStep(index)}><span>{index < step ? <Check size={15} /> : index + 1}</span>{label}</button>)}</nav>
  {error && <p className={styles.error} role="alert">{error}</p>}{missing && <p className={styles.error} role="alert">Een gekozen product is niet meer beschikbaar in je bron. Het menu is nog niet opgeslagen. Verwijder het product uit de widget of kies een beschikbaar product.</p>}
  {built.error && <p className={styles.error} role="status">{built.error} Je keuzes blijven behouden.</p>}
  <div className={styles.wizardGrid}><section className={styles.panel}>
  <fieldset disabled={pending || saved} style={{border:0,padding:0,margin:0,minWidth:0}}>
  {step === 0 && <><div className={styles.sectionHeading}><span>01 · Inhoud</span><h2>Bouw je menukaart met widgets.</h2><p>Voeg categorieën, producten, beelden en deals toe. Kies zelf de kolommen en maak extra pagina’s.</p></div><div className={styles.selectedHeading}><h3>Producten en subproducten</h3><span>{selectedIds.length}/100</span></div><MenuWidgetEditor document={document} onChange={next => {setDocument(next);setSaved(false);}} products={products} media={media} orientation={design.orientation} pageIndex={pageIndex} onPage={setPageIndex}/></>}
  {step === 1 && <><div className={styles.sectionHeading}><span>02 · Vormgeving</span><h2>Geef je kaart clubgevoel.</h2><p>Een eigen foto en rustige indeling maken het verschil.</p></div>{design.themeId === "onzetrots-tv" && <label className="demo-field"><span>Weergave</span><select value={design.onzeTrotsStyle ?? "v9-marker-light"} onChange={event=>patch({onzeTrotsStyle:event.target.value as "v9-marker-light"|"v9-marker-dark"})}><option value="v9-marker-light">Licht</option><option value="v9-marker-dark">Donker</option></select></label>}<SitesSourceDesignControls design={design} onChange={patch} showLayout={false} media={media.filter(item => item.kind === "image").map(item => ({ id: item.id, name: item.name, checksumSha256: item.sha256, url: item.url }))} /></>}
  {step === 2 && <><div className={styles.sectionHeading}><span>03 · Bestemming</span><h2>Je menu opslaan</h2><p>Je menu komt in de slidebibliotheek. Je kiest de playlist en schermen daarna op één plek: Playlists.</p></div><SitesSourceDestinationPicker options={destinationOptions} value={destination} onChange={setDestination} /></>}
  {step === 3 && <><div className={styles.sectionHeading}><span>04 · Controleren</span><h2>{saved ? "Je menu staat klaar." : "Klaar om op te slaan?"}</h2><p>{saved ? "Je vindt dit menu terug in Menu Studio en in de slidebibliotheek van je playlist." : "Controleer het voorbeeld en geef je ontwerp een herkenbare naam."}</p></div><label className="demo-field"><span>Naam van dit ontwerp</span><input value={name} readOnly={Boolean(slideId)} maxLength={120} onChange={event => { setName(event.target.value); setSaved(false); }} /></label><div className={styles.review}><div><span>Producten</span><strong>{selected.length}</strong></div><div><span>Thema</span><strong>{design.themeId === "onzetrots-tv" ? "OnzeTrots TV" : "FieldFlow"}</strong></div><div><span>Formaat</span><strong>{design.orientation === "portrait" ? "Staand · 9:16" : "Liggend · 16:9"}</strong></div><div><span>Duur per pagina</span><strong>{design.seconds} seconden</strong></div></div><p className={styles.hint}>Prijzen komen uit je opgeslagen productbron. Je widgets, kolommen en subregels blijven behouden wanneer die bron wordt bijgewerkt.</p>{saved && <div className={styles.success}><CheckCircle2 size={22} /><div><strong>Ontwerp opgeslagen</strong><p>Voeg het menu aan een playlist toe en bepaal de afspeelvolgorde.</p>{menuPublished&&<Button asChild variant="primary"><Link href={`/dashboard/playlists?design=${savedId}`}>Toevoegen aan playlist<ArrowRight size={16} /></Link></Button>}<Button asChild variant="secondary"><Link href={`/dashboard/slides/menu-studio/${savedId}`}>Opgeslagen ontwerp openen</Link></Button></div></div>}</>}
  </fieldset>
  {saved && !menuPublished && <Button type="button" variant="primary" disabled={pending} onClick={() => startTransition(async () => { try { const result = await publishMenuStudio({slideId:savedId,expectedRevision:document.revision,operationId:saveAttempt.current?.contentId}); if(result.ok)setMenuPublished(true);else setError(`${result.message} Je opgeslagen concept blijft behouden.`); } catch { setError("De menuversie kon niet worden bevestigd. Je opgeslagen concept blijft behouden; controleer de status en probeer opnieuw."); } })}>{destination.mode==="publish"?"Opnieuw voorbereiden":"Opnieuw voorbereiden"}</Button>}
  {saved && menuPublished && <SitesSourceDestinationAfterSave destination={destination} designs={[{slideId:savedId,menuRevision:document.revision,durationSeconds:Math.max(5,design.seconds*pages)}]} />}
  <div className={styles.wizardActions}><Button variant="secondary" disabled={pending} onClick={() => step === 0 ? window.location.assign("/dashboard/slides/menu-studio") : setStep(step - 1)}><ArrowLeft size={16} />{step === 0 ? "Menu Studio" : "Vorige"}</Button>{step < 3 ? <Button variant="primary" disabled={!hasContent || missing || pending || (step === 2 && !validSitesSourceDestination(destination, destinationOptions))} onClick={() => setStep(step + 1)}>Volgende<ArrowRight size={16} /></Button> : <Button variant="primary" disabled={!hasContent || missing || !draft || name.trim().length < 2 || saved || pending || !validSitesSourceDestination(destination, destinationOptions)} onClick={save}><Save size={17} />{pending ? "Opslaan…" : saved ? "Opgeslagen" : "Ontwerp opslaan"}</Button>}</div>
  </section><aside className={styles.previewPanel}><div className={styles.previewHeader}><span><Monitor size={17} />Schermvoorbeeld</span><StatusPill tone="neutral" label={design.orientation === "portrait" ? "9:16" : "16:9"} /></div>{presentation ? <SitesPresentationView page={Math.min(previewIndex,pages-1)} presentation={presentation} resolveAsset={ref => ref.kind === "system" ? ref.path : media.find(item => item.id === ref.mediaAssetId && item.sha256 === ref.checksumSha256)?.url} /> : <p>Voeg een widget toe om je schermvoorbeeld te bekijken.</p>}<nav className={styles.previewFooter} aria-label="Voorbeeldpagina’s"><Button variant="secondary" size="sm" disabled={previewIndex===0} onClick={()=>setPreviewIndex(current=>Math.max(0,current-1))}>Vorige pagina</Button><span>{Math.min(previewIndex+1,pages)} / {pages}</span><Button variant="secondary" size="sm" disabled={previewIndex>=pages-1} onClick={()=>setPreviewIndex(current=>Math.min(pages-1,current+1))}>Volgende pagina</Button></nav><div className={styles.previewFooter}><span>{selected.length} producten</span><span>{design.seconds} seconden</span></div><p>Je ziet direct hoe je keuzes op het scherm uitpakken. Dit voorbeeld gebruikt de producten uit je opgeslagen bron.</p></aside></div></div>;
}
