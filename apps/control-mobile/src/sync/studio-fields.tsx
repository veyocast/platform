import { AppText, Button, SegmentedControl, SurfaceCard, TextField, mobileSpacing } from "@veyocast/mobile-design-system";
import { syncSlidePageCount, type SyncSlidePresentation } from "@veyocast/contracts";
import { updateSyncStudioDocument, type StudioDocument } from "@veyocast/studio/mobile-v3";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { NativeSitesPhotoPicker } from "../sites/photo-picker";

export function SyncStudioFields({ document, disabled, onChange, onError }: {
  document: StudioDocument; disabled: boolean; onChange: (value: StudioDocument) => void; onError: (value: unknown) => void;
}) {
  const [tab, setTab] = useState("content");
  const [rowPage, setRowPage] = useState(0);
  const [newsPage, setNewsPage] = useState(0);
  const slide = document.syncPresentation;
  if (!slide) return null;
  const seconds = Math.round(document.motion.durationMs / syncSlidePageCount(slide) / 1000);
  function patch(value: Partial<SyncSlidePresentation>, duration = seconds) {
    if (disabled || !slide) return;
    try { onChange(updateSyncStudioDocument(document, { ...slide, ...value }, duration)); }
    catch { onError(new Error("Deze instelling past niet binnen het schermformaat of de invoergrenzen. De laatste geldige invoer blijft behouden; controleer de instelling.")); }
  }
  const text = (key: "name" | "title" | "headline" | "subtitle" | "body" | "topLabel" | "footer" | "footerRight", label: string, multiline = false) => <TextField key={key} editable={!disabled} label={label} value={slide[key]} multiline={multiline} maxLength={key === "body" ? 4000 : key === "name" ? 120 : 400} onChangeText={value => patch({ [key]: value })} />;
  return <View style={{ gap: mobileSpacing.default }}>
    <SegmentedControl accessibilityLabel="Ontwerpstappen" value={tab} onChange={setTab} options={[{ label: "Inhoud", value: "content" }, { label: "Opmaak", value: "design" }, { label: "Formaat", value: "format" }]} />
    <View pointerEvents={disabled ? "none" : "auto"} accessibilityState={{ disabled }} style={{ gap: mobileSpacing.default }}>
      {tab === "content" ? <>
        {text("name", "Ontwerpnaam")}{text("title", "Titel")}{text("headline", "Kop")}{text("body", "Bericht", true)}{text("subtitle", "Ondertitel")}
        {text("topLabel", "Bovenlabel")}{text("footer", "Voetregel")}{text("footerRight", "Voetregel rechts")}
        <TextField editable={!disabled} label="Clubnaam" value={slide.club.name} maxLength={400} onChangeText={name => patch({ club: { ...slide.club, name } })} />
        <TextField editable={!disabled} label="Clubregel" value={slide.club.tagline} maxLength={400} onChangeText={tagline => patch({ club: { ...slide.club, tagline } })} />
        {slide.rows.length ? <>
          <AppText variant="section">Rijen in dit ontwerp</AppText>
          {slide.rows.slice(rowPage * 8, rowPage * 8 + 8).map((row, pageIndex) => { const index = rowPage * 8 + pageIndex; return <SurfaceCard key={index}>
            <AppText variant="label">Rij {index + 1}</AppText>
            {row.map((cell, column) => <TextField key={column} editable={!disabled} label={`Kolom ${column + 1}`} value={cell} maxLength={400} onChangeText={value => patch({ rows: slide.rows.map((current, i) => i === index ? current.map((v, c) => c === column ? value : v) as typeof row : current) })} />)}
          </SurfaceCard>; })}
          <View style={{ flexDirection: "row", gap: mobileSpacing.compact }}><Button variant="secondary" disabled={rowPage === 0} onPress={() => setRowPage(page => page - 1)}>Vorige rijen</Button><Button variant="secondary" disabled={(rowPage + 1) * 8 >= slide.rows.length} onPress={() => setRowPage(page => page + 1)}>Volgende rijen</Button></View>
        </> : null}
        {slide.news.slice(newsPage * 4, newsPage * 4 + 4).map((article, pageIndex) => { const index = newsPage * 4 + pageIndex; return <SurfaceCard key={index}>
          <AppText variant="label">Artikel {index + 1}</AppText>
          <TextField editable={!disabled} label="Artikelkop" value={article.title} maxLength={400} onChangeText={title => patch({ news: slide.news.map((value, i) => i === index ? { ...value, title } : value) })} />
          <TextField editable={!disabled} label="Intro" value={article.intro} multiline maxLength={4000} onChangeText={intro => patch({ news: slide.news.map((value, i) => i === index ? { ...value, intro } : value) })} />
          <AppText muted>{article.url ?? "Geen artikeladres"}</AppText>
        </SurfaceCard>; })}
        {slide.news.length > 4 ? <View style={{ flexDirection: "row", gap: mobileSpacing.compact }}><Button variant="secondary" disabled={newsPage === 0} onPress={() => setNewsPage(page => page - 1)}>Vorige artikelen</Button><Button variant="secondary" disabled={(newsPage + 1) * 4 >= slide.news.length} onPress={() => setNewsPage(page => page + 1)}>Volgende artikelen</Button></View> : null}
      </> : tab === "design" ? <>
        <SegmentedControl accessibilityLabel="Contentthema" value={slide.theme} onChange={theme => patch({ theme })} options={[{ label: "FieldFlow", value: "fieldflow" }, { label: "OnzeTrots TV", value: "onzetrots-tv" }]} />
        <SegmentedControl accessibilityLabel="Tekstuitlijning" value={slide.style.alignment} onChange={alignment => patch({ style: { ...slide.style, alignment } })} options={[{ label: "Links", value: "left" }, { label: "Midden", value: "center" }, { label: "Rechts", value: "right" }]} />
        <AppText muted>Huidig lettertype: {slide.style.font}</AppText>
        <SegmentedControl accessibilityLabel="Lettertype kiezen" value={slide.style.font} onChange={font => patch({ style: { ...slide.style, font, fontChanged: true } })} options={[{ label: "Manrope", value: "Manrope" }, { label: "Inter", value: "Inter" }, { label: "Arial", value: "Arial" }]} />
        <ValidatedInput label="Accentkleur (#RRGGBB)" value={slide.style.accent} disabled={disabled} apply={accent => { if (!/^#[a-f0-9]{6}$/i.test(accent)) throw Error(); patch({ style: { ...slide.style, accent } }); }} onError={onError} />
        <NumberInput label="Tekstgrootte (50–150%)" value={slide.style.scale} disabled={disabled} min={50} max={150} apply={scale => patch({ style: { ...slide.style, scale } })} onError={onError} />
        <NumberInput label="Veilige marge (2–15%)" value={slide.style.safeMargin} disabled={disabled} min={2} max={15} apply={safeMargin => patch({ style: { ...slide.style, safeMargin } })} onError={onError} />
        <AppText variant="label">Achtergrond</AppText>
        <View style={{ gap: mobileSpacing.compact }}>{(["stadium", "gradient", "stripes", "clubmuur", "light"] as const).map((background, index) => <Button key={background} variant={slide.style.background === background ? "primary" : "secondary"} onPress={() => patch({ style: { ...slide.style, background } })}>{["Stadion", "Verloop", "Strepen", "Clubmuur", "Licht"][index]}</Button>)}</View>
        <NativeSitesPhotoPicker onPick={asset => { if (asset.kind === "tenant") patch({ style: { ...slide.style, background: "photo", backgroundAsset: asset } }); else onError(new Error("Kies een eigen, geverifieerde afbeelding uit deze organisatie.")); }} />
        <Button variant="secondary" onPress={() => patch({ style: { ...slide.style, showLogo: !slide.style.showLogo } })}>Logo {slide.style.showLogo ? "zichtbaar" : "verborgen"}</Button>
        <Button variant="secondary" onPress={() => patch({ style: { ...slide.style, showFooter: !slide.style.showFooter } })}>Voetregel {slide.style.showFooter ? "zichtbaar" : "verborgen"}</Button>
        <SegmentedControl accessibilityLabel="Beweging" value={slide.style.motion ?? (document.motion.enabled ? "rustig" : "geen")} onChange={motion => patch({ style: { ...slide.style, motion } })} options={[{ label: "Rustig", value: "rustig" }, { label: "Dynamisch", value: "dynamisch" }, { label: "Geen", value: "geen" }]} />
      </> : <>
        <SegmentedControl accessibilityLabel="Schermformaat" value={slide.orientation} onChange={orientation => patch({ orientation })} options={[{ label: "Liggend · 16:9", value: "landscape" }, { label: "Staand · 9:16", value: "portrait" }]} />
        <NumberInput label="Seconden per pagina (3–120)" value={seconds} disabled={disabled} min={3} max={120} apply={value => patch({}, value)} onError={onError} />
        <NumberInput label="Rijen per pagina (1–8)" value={slide.rowsPerPage} disabled={disabled} min={1} max={8} apply={rowsPerPage => patch({ rowsPerPage })} onError={onError} />
        <AppText>{syncSlidePageCount(slide)} pagina's · {document.motion.durationMs / 1000} seconden totaal</AppText>
      </>}
    </View>
  </View>;
}

function ValidatedInput({ label, value, disabled, apply, onError }: { label: string; value: string; disabled: boolean; apply: (value: string) => void; onError: (value: unknown) => void }) {
  const [input, setInput] = useState(value);
  useEffect(() => setInput(value), [value]);
  return <TextField label={label} value={input} editable={!disabled} onChangeText={setInput} onEndEditing={() => { try { apply(input); } catch { onError(new Error(`Controleer ${label.toLocaleLowerCase("nl-NL")}. De laatste geldige waarde blijft behouden.`)); setInput(value); } }} />;
}
function NumberInput({ value, min, max, apply, ...props }: { label: string; value: number; disabled: boolean; min: number; max: number; apply: (value: number) => void; onError: (value: unknown) => void }) {
  return <ValidatedInput {...props} value={String(value)} apply={input => { const number = Number(input); if (!Number.isInteger(number) || number < min || number > max) throw Error(); apply(number); }} />;
}
