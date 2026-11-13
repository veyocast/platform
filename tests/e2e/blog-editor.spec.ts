import AxeBuilder from "@axe-core/playwright";
import {expect,test,type Page} from "@playwright/test";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";

import {startS313BlogControlFixture} from "../helpers/s313-blog-control-fixture";

const evidence=join(process.cwd(),"docs/s313-blog-socialhero/evidence/browser-control");
const viewports=[{width:1440,height:900},{width:390,height:844},{width:320,height:844}];
const fingerprint=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
let fixture:Awaited<ReturnType<typeof startS313BlogControlFixture>>;
test.describe.configure({mode:"serial"});
test.use({launchOptions:process.env.S313_BROWSER_EXECUTABLE?{executablePath:process.env.S313_BROWSER_EXECUTABLE}:{}});
test.beforeAll(async()=>{fixture=await startS313BlogControlFixture();await mkdir(evidence,{recursive:true});await writeFile(join(evidence,"provenance.json"),JSON.stringify({...fixture.provenance,capturedAtUtc:new Date().toISOString(),fixtureOrigin:fixture.origin},null,2)+"\n");});
test.afterAll(async()=>{if(fixture)await fixture.close();});
test.beforeEach(({page})=>{fixture.reset();page.on("pageerror",error=>console.error("Browserfixture error:",error.message));});

async function settle(page:Page){
  await expect(page.locator("main")).toBeVisible();await expect(page.getByRole("button",{name:"Bewerken",exact:true}).first()).toBeEnabled();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)));});
}
async function measures(page:Page){return page.evaluate(()=>({
  viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  heading:document.querySelector("h1")?.textContent,headings:document.querySelectorAll("h1").length,
  mainFont:getComputedStyle(document.querySelector("main")!).fontFamily,
  navigation:[...document.querySelectorAll<HTMLAnchorElement>(".control-nav a")].map(link=>({text:link.textContent?.trim(),href:link.getAttribute("href")})),
  paragraphs:[...document.querySelectorAll(".tiptap p")].map(node=>node.textContent),
  images:[...document.querySelectorAll<HTMLImageElement>("main img")].map(image=>({alt:image.alt,loaded:image.complete&&image.naturalWidth>0})),
}));}
async function snapshot(page:Page,name:string){const bytes=await page.screenshot({path:join(evidence,name),fullPage:true,animations:"disabled"});return {screenshot:name,sha256:fingerprint(bytes),...await measures(page)};}

test("records the native shell and compares the supplied admin dataset at desktop and two mobile widths",async({page})=>{
  test.setTimeout(90_000);const results=[];
  for(const viewport of viewports){await page.setViewportSize(viewport);
    await page.goto(`${fixture.origin}/?variant=baseline`);await expect(page.getByRole("heading",{name:"Systeem",exact:true})).toBeVisible();
    const baseline=await snapshot(page,`baseline-shell-${viewport.width}.png`);expect(baseline.overflow).toBeLessThanOrEqual(0);
    results.push({variant:"baseline",...baseline});
    let expectedTitles:string[]=[];let expectedParagraphs:Array<string|null>=[];
    for(const variant of ["prototype","candidate"]){
      await page.goto(`${fixture.origin}/?variant=${variant}`);await settle(page);
      const titles=await page.locator("tbody strong").allTextContents();if(variant==="prototype")expectedTitles=titles;else expect(titles).toEqual(expectedTitles);
      const list=await snapshot(page,`${variant}-list-${viewport.width}.png`);expect(list.overflow).toBeLessThanOrEqual(0);expect(list.headings).toBe(1);
      results.push({variant,view:"list",...list});
      await page.getByRole("button",{name:"Bewerken",exact:true}).first().click();await expect(page.getByRole("textbox",{name:"Artikelinhoud",exact:true})).toBeVisible();
      const editor=await snapshot(page,`${variant}-editor-${viewport.width}.png`);expect(editor.overflow).toBeLessThanOrEqual(0);expect(editor.headings).toBe(1);
      results.push({variant,view:"editor",...editor});
      if(variant==="prototype")expectedParagraphs=editor.paragraphs;else expect(editor.paragraphs).toEqual(expectedParagraphs);
      await page.getByRole("textbox",{name:"Artikelinhoud",exact:true}).scrollIntoViewIfNeeded();
      results.push({variant,view:"editor-content",...await snapshot(page,`${variant}-editor-content-${viewport.width}.png`)});
      if(variant==="candidate"){
        expect(editor.navigation.filter(item=>item.href!=="/platform/blog")).toEqual(baseline.navigation);
        const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
        await writeFile(join(evidence,`axe-editor-${viewport.width}.json`),JSON.stringify(axe.violations,null,2)+"\n");expect(axe.violations).toEqual([]);
      }
    }
  }
  await writeFile(join(evidence,"comparison.json"),JSON.stringify(results,null,2)+"\n");
});

test("types real TipTap blocks, uploads through the fixture, saves and reopens the identical document",async({page})=>{
  test.setTimeout(60_000);await page.setViewportSize(viewports[0]!);await page.goto(fixture.origin);await settle(page);
  await page.getByRole("button",{name:"Nieuw artikel",exact:true}).click();
  await page.getByRole("textbox",{name:"Titel",exact:true}).fill("Browseracceptatie redactie");
  await page.getByRole("textbox",{name:"Samenvatting",exact:true}).fill("Expliciete browserfixture voor het echte TipTap-document.");
  const editor=page.getByRole("textbox",{name:"Artikelinhoud",exact:true});await editor.click();
  await page.keyboard.insertText("Inleiding via het toetsenbord.");await page.keyboard.press("Enter");
  await page.getByRole("combobox",{name:"Tekststijl",exact:true}).selectOption("2");await page.keyboard.insertText("Een echte kop");await page.keyboard.press("Enter");
  await page.getByRole("combobox",{name:"Tekststijl",exact:true}).selectOption("0");
  await page.getByRole("button",{name:"Opsomming",exact:true}).click();await page.keyboard.insertText("Eerste punt");await page.keyboard.press("Enter");await page.keyboard.insertText("Tweede punt");await page.keyboard.press("Enter");await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Genummerde lijst",exact:true}).click();await page.keyboard.insertText("Eerste stap");await page.keyboard.press("Enter");await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Checklist",exact:true}).click();await page.keyboard.insertText("Controleren voor publicatie");await page.keyboard.press("Enter");await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Citaat",exact:true}).click();await page.keyboard.insertText("Een herkenbaar citaat.");await page.keyboard.press("Enter");await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Tabel invoegen",exact:true}).click();await page.keyboard.insertText("Kopcel");await page.keyboard.press("Tab");await page.keyboard.insertText("Tweede cel");
  await page.getByRole("button",{name:"Rij toevoegen",exact:true}).click();await page.getByRole("button",{name:"Kolom toevoegen",exact:true}).click();
  await expect(editor.locator("tr")).toHaveCount(4);
  await editor.press("Control+End");await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Afbeelding invoegen",exact:true}).click();const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();const upload=await readFile(join(process.cwd(),"docs/s313-blog-socialhero/reference/broncode/public/fieldflow/photos/FF-PHOTO-04-matchday-live-4x5.webp"));
  await dialog.getByLabel("Afbeeldingsbestand",{exact:true}).setInputFiles({name:"fixture.webp",mimeType:"image/webp",buffer:upload});
  await expect(dialog.getByRole("textbox",{name:"Afbeeldings-URL",exact:true})).toHaveValue(/^\/api\/blog\/media\/[\da-f-]{36}$/u);
  await dialog.getByRole("textbox",{name:"Alt-tekst",exact:true}).fill("Clubkantine voor de expliciete browserfixture");await dialog.getByRole("button",{name:"Invoegen",exact:true}).click();await expect(dialog).not.toBeVisible();
  await expect(editor.locator("img")).toHaveAttribute("alt","Clubkantine voor de expliciete browserfixture");
  await page.getByRole("button",{name:"Ongedaan maken",exact:true}).click();await expect(editor.locator("img")).toHaveCount(0);
  await page.getByRole("button",{name:"Opnieuw uitvoeren",exact:true}).click();await expect(editor.locator("img")).toHaveCount(1);
  await page.getByRole("button",{name:"Concept opslaan",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Concept opgeslagen"})).toBeVisible();
  const save=fixture.calls.findLast(call=>call.path==="/api/platform/blog")!.body as {draft:{content:unknown}};
  const before=await editor.evaluate(node=>node.innerHTML);const doc=save.draft.content as {content:Array<{type:string}>};
  for(const type of ["paragraph","heading","bulletList","orderedList","taskList","blockquote","table","image"])expect(JSON.stringify(doc)).toContain(`"type":"${type}"`);
  await page.getByRole("button",{name:"Blogbeheer",exact:true}).click();await page.getByRole("button",{name:"Bewerken",exact:true}).first().click();
  await expect(editor).toBeVisible();await expect(editor.locator("img")).toHaveCount(1);
  expect(await editor.evaluate(node=>node.innerHTML)).toBe(before);
  await page.getByRole("button",{name:"Concept opslaan",exact:true}).click();await expect.poll(()=>fixture.calls.filter(call=>call.path==="/api/platform/blog").length).toBe(2);
  const reopened=fixture.calls.findLast(call=>call.path==="/api/platform/blog")!.body as {draft:{content:unknown}};expect(reopened.draft.content).toEqual(save.draft.content);
  await writeFile(join(evidence,"saved-document.json"),JSON.stringify({source:"Native TipTap UI over isolated schema-validated fixturetransport",document:save.draft.content,reopenedDocument:reopened.draft.content,upload:fixture.calls.find(call=>call.path.endsWith("/media"))?.body},null,2)+"\n");
  await editor.scrollIntoViewIfNeeded();await snapshot(page,"candidate-edited-document-1440.png");
  await page.goto(`${fixture.origin}/?variant=render`);const rendered=page.getByRole("textbox",{name:"Artikelinhoud",exact:true});await expect(rendered).toHaveAttribute("contenteditable","false");
  const renderText=await rendered.textContent();for(const text of ["Inleiding via het toetsenbord.","Een echte kop","Eerste punt","Eerste stap","Controleren voor publicatie","Een herkenbaar citaat.","Kopcel"])expect(renderText).toContain(text);
  await snapshot(page,"candidate-readonly-document-1440.png");
  const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();await writeFile(join(evidence,"axe-edited-document.json"),JSON.stringify(axe.violations,null,2)+"\n");expect(axe.violations).toEqual([]);
});

test("pastes safe and hostile HTML through TipTap, rejects unsafe dialogs and restores keyboard focus",async({page})=>{
  test.setTimeout(45_000);await page.setViewportSize(viewports[1]!);await page.goto(fixture.origin);await settle(page);await page.getByRole("button",{name:"Nieuw artikel",exact:true}).click();
  const editor=page.getByRole("textbox",{name:"Artikelinhoud",exact:true});await editor.click();
  await editor.evaluate(node=>{const data=new DataTransfer();data.setData("text/html",'<h2>Veilige kop</h2><p><strong>Veilig vet</strong> en <a href="https://veyocast.nl/blog">eigen link</a>.</p><ul><li>Een geplakt punt</li></ul>');data.setData("text/plain","Veilige kop Veilig vet");node.dispatchEvent(new ClipboardEvent("paste",{clipboardData:data,bubbles:true,cancelable:true}));});
  await expect(editor.locator("h2")).toHaveText("Veilige kop");await expect(editor.locator("strong")).toHaveText("Veilig vet");await expect(editor.locator("a")).toHaveAttribute("href","https://veyocast.nl/blog");
  await editor.press("Control+End");await page.keyboard.press("Enter");
  await editor.evaluate(node=>{const data=new DataTransfer();data.setData("text/html",'<p onclick="window.__unsafe=1">Onveilige attributen <a href="javascript:window.__unsafe=2">slechte link</a></p><script>window.__unsafe=3</script><img src="https://tracker.invalid/x" onerror="window.__unsafe=4"><iframe src="https://tracker.invalid"></iframe>');data.setData("text/plain","Onveilige attributen slechte link");node.dispatchEvent(new ClipboardEvent("paste",{clipboardData:data,bubbles:true,cancelable:true}));});
  expect(await editor.locator('script,iframe,img,[onclick],[onerror],a[href^="javascript:"]').count()).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,"__unsafe"))).toBeUndefined();
  await page.getByRole("button",{name:"Link toevoegen of wijzigen",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
  for(let step=0;step<12;step++){await page.keyboard.press("Tab");expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);}
  await dialog.getByRole("textbox",{name:"Linkadres",exact:true}).fill("javascript:alert(1)");await dialog.getByRole("button",{name:"Invoegen",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("veilig linkadres");
  await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(editor).toBeFocused();
  await page.keyboard.press("Enter");await page.keyboard.insertText("/");await expect(page.getByRole("listbox",{name:"Blokken invoegen"})).toBeVisible();
  await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");await page.keyboard.insertText("Kop via slashmenu");await expect(editor.locator("h3")).toHaveText("Kop via slashmenu");
  await page.getByRole("button",{name:"Voorbeeld",exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole("heading",{name:"Conceptvoorbeeld",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Voorbeeld",exact:true})).toBeFocused();
  await writeFile(join(evidence,"paste-and-keyboard.json"),JSON.stringify({source:"Real clipboard events parsed by native shared TipTap schema",editorHtml:await editor.evaluate(node=>node.innerHTML),unsafeCodeExecuted:await page.evaluate(()=>Reflect.get(window,"__unsafe")??false),restoredFocus:await page.getByRole("button",{name:"Voorbeeld",exact:true}).evaluate(node=>node===document.activeElement)},null,2)+"\n");
  await snapshot(page,"candidate-keyboard-paste-390.png");
});

test("keeps the read-only capability view usable without mutation controls",async({page})=>{
  await page.goto(`${fixture.origin}/?variant=readonly`);await expect(page.getByRole("button",{name:"Nieuw artikel",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Bekijken",exact:true}).first().click();await expect(page.getByRole("textbox",{name:"Artikelinhoud",exact:true})).toHaveAttribute("contenteditable","false");
  await expect(page.getByRole("button",{name:"Concept opslaan",exact:true})).toBeDisabled();await expect(page.getByRole("button",{name:"Publiceren",exact:true})).toBeDisabled();expect(fixture.calls).toEqual([]);
});
