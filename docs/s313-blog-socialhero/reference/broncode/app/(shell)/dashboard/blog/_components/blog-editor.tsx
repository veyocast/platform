"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Braces, CheckSquare, ChevronDown, Code,
  Heading2, Heading3, Image as ImageIcon, Italic, Link, List, ListOrdered,
  Minus, Pilcrow, Quote, Redo2, Strikethrough, Table2, Underline, Undo2, Unlink,
  Video, X,
} from "lucide-react";
import styles from "./blog-editor.module.css";

export type { JSONContent } from "@tiptap/react";

type BlogEditorProps = {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

type InsertType = "link" | "image" | "youtube";

const dialogTitles: Record<InsertType, string> = {
  link: "Link toevoegen of wijzigen",
  image: "Afbeelding invoegen",
  youtube: "YouTube-video invoegen",
};

const alignments = [
  { value: "left", label: "Links uitlijnen", Icon: AlignLeft },
  { value: "center", label: "Centreren", Icon: AlignCenter },
  { value: "right", label: "Rechts uitlijnen", Icon: AlignRight },
] as const;

const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);

function rootPath(value: string) {
  return value.startsWith("/") && !/^\/[\/\\]/.test(value) && !/[\s\\]/.test(value);
}

function absoluteWebUrl(value: string, protocols: string[]) {
  if (!/^[a-z]+:\/\//i.test(value) || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function linkUrl(value: string) {
  const trimmed = value.trim();
  if (rootPath(trimmed) || /^#[^\s]*$/.test(trimmed) || /^(mailto|tel):[^\s]+$/i.test(trimmed)) return trimmed;
  return absoluteWebUrl(trimmed, ["https:", "http:"])?.href ?? "";
}

function imageUrl(value: string) {
  const trimmed = value.trim();
  if (rootPath(trimmed)) return trimmed;
  return absoluteWebUrl(trimmed, ["https:"])?.href ?? "";
}

function videoUrl(value: string) {
  const url = absoluteWebUrl(value.trim(), ["https:"]);
  if (!url || !youtubeHosts.has(url.hostname) || url.port) return "";
  const segments = url.pathname.split("/").filter(Boolean);
  const id = url.hostname === "youtu.be"
    ? segments[0]
    : ["embed", "shorts", "live"].includes(segments[0])
      ? segments[1]
      : url.pathname === "/watch" ? url.searchParams.get("v") : null;
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : "";
}

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: {
      openOnClick: false,
      isAllowedUri: (url) => Boolean(linkUrl(url)),
      HTMLAttributes: { target: null, rel: null },
    },
  }),
  Image.extend({
    parseHTML() {
      return [{ tag: "img[src]", getAttrs: (node) => imageUrl(node.getAttribute("src") ?? "") ? null : false }];
    },
  }).configure({
    allowBase64: false,
    resize: { enabled: true, minWidth: 120, minHeight: 60, alwaysPreserveAspectRatio: true },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true, renderWrapper: true } }),
  TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
  Youtube.extend({
    parseHTML() {
      return [{
        tag: "div[data-youtube-video] iframe",
        getAttrs: (node) => videoUrl(node.getAttribute("src") ?? "") ? null : false,
      }];
    },
  }).configure({ nocookie: true, width: 640, height: 360, HTMLAttributes: { title: "YouTube-video", loading: "lazy" } }),
  Placeholder.configure({ placeholder: "Begin met schrijven of typ / voor blokken…" }),
  CharacterCount,
];

function ToolButton({ children, label, active, disabled, onClick }: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button type="button" className={styles.toolButton} aria-label={label} aria-pressed={active}
    title={label} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
    {children}
  </button>;
}

function InsertDialog({ type, editor, onClose, onUploadImage }: {
  type: InsertType;
  editor: Editor;
  onClose: () => void;
  onUploadImage?: BlogEditorProps["onUploadImage"];
}) {
  const labelId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState(type === "link" ? String(editor.getAttributes("link").href ?? "") : "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function upload(file: File | undefined) {
    if (!file || !onUploadImage) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = imageUrl(await onUploadImage(file));
      if (!uploaded) throw new Error("Onbruikbare media-URL");
      setUrl(uploaded);
    } catch {
      setError("De afbeelding kon niet worden geüpload. Kies een andere afbeelding of gebruik een afbeeldings-URL.");
    } finally {
      setUploading(false);
    }
  }

  function insert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const source = { link: linkUrl, image: imageUrl, youtube: videoUrl }[type](url);
    if (!source) {
      setError(type === "youtube" ? "Vul een geldige YouTube-link in." : "Vul een geldige URL in.");
      return;
    }
    const selection = editor.state.selection;
    if (type === "link") {
      const chain = editor.chain().focus().extendMarkRange("link");
      if (selection.empty && !editor.isActive("link")) {
        chain.insertContent({ type: "text", text: description.trim() || source, marks: [{ type: "link", attrs: { href: source } }] }).run();
      } else {
        chain.setLink({ href: source }).run();
      }
    } else if (type === "image") {
      const alt = description.trim();
      if (!alt) {
        setError("Beschrijf wat op de afbeelding te zien is.");
        return;
      }
      editor.chain().focus().setImage({ src: source, alt }).run();
    } else {
      editor.chain().focus().setYoutubeVideo({ src: source }).run();
    }
    onClose();
  }

  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={labelId} onCancel={(event) => {
    event.preventDefault();
    onClose();
  }}>
    <form onSubmit={insert}>
      <div className={styles.dialogHeading}>
        <h2 id={labelId}>{dialogTitles[type]}</h2>
        <button className={styles.toolButton} type="button" onClick={onClose} aria-label="Sluiten"><X size={18} aria-hidden="true" /></button>
      </div>
      {type === "image" && onUploadImage && <label>
        Afbeeldingsbestand
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void upload(event.currentTarget.files?.[0])} />
      </label>}
      <label>
        {type === "image" ? "Afbeeldings-URL" : type === "youtube" ? "YouTube-link" : "Linkadres"}
        <input autoFocus value={url} required spellCheck={false} onChange={(event) => setUrl(event.currentTarget.value)}
          placeholder={type === "link" ? "https://voorbeeld.nl of /blog" : "https://…"} />
      </label>
      {(type === "image" || (type === "link" && editor.state.selection.empty && !editor.isActive("link"))) && <label>
        {type === "image" ? "Alt-tekst" : "Linktekst"}
        <input value={description} required={type === "image"} maxLength={type === "image" ? 200 : 240}
          onChange={(event) => setDescription(event.currentTarget.value)} />
      </label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button type="button" onClick={onClose}>Annuleren</button>
        <button type="submit" disabled={uploading}>{uploading ? "Uploaden…" : "Invoegen"}</button>
      </div>
    </form>
  </dialog>, document.body);
}

export function BlogEditor({ content, onChange, onUploadImage }: BlogEditorProps) {
  const editorLabel = useId();
  const commandMenuId = useId();
  const contentArea = useRef<HTMLDivElement>(null);
  const slashMenu = useRef<HTMLDivElement>(null);
  const lastContent = useRef(content);
  const [insertType, setInsertType] = useState<InsertType | null>(null);
  const [showTableTools, setShowTableTools] = useState(false);
  const [slashPosition, setSlashPosition] = useState<{ top: number; left: number } | null>(null);
  const [activeCommand, setActiveCommand] = useState(0);

  function trackSlash(instance: Editor) {
    const selection = instance.state.selection;
    const cursor = selection.$from;
    const open = selection.empty && cursor.parent.type.name === "paragraph"
      && cursor.parent.textBetween(0, cursor.parentOffset) === "/";
    const area = contentArea.current?.getBoundingClientRect();
    if (!open || !area) {
      setSlashPosition(null);
      return;
    }
    const caret = instance.view.coordsAtPos(selection.from);
    const fitsAbove = caret.top >= 272 && window.innerHeight - caret.bottom < 272;
    setSlashPosition({
      top: (fitsAbove ? caret.top - 266 : caret.bottom + 6) - area.top,
      left: Math.max(8, Math.min(caret.left - area.left, area.width - 188)),
    });
    setActiveCommand(0);
  }

  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    editorProps: { attributes: { class: styles.document, role: "textbox", "aria-multiline": "true", "aria-labelledby": editorLabel } },
    onUpdate: ({ editor: instance }) => {
      const updated = instance.getJSON();
      lastContent.current = updated;
      onChange(updated);
      trackSlash(instance);
    },
    onSelectionUpdate: ({ editor: instance }) => trackSlash(instance),
    onBlur: () => setSlashPosition(null),
  });

  useEffect(() => {
    if (!editor || content === lastContent.current) return;
    if (JSON.stringify(content) !== JSON.stringify(lastContent.current)) {
      editor.commands.setContent(content, { emitUpdate: false });
      setSlashPosition(null);
    }
    lastContent.current = content;
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const textbox = editor.view.dom;
    if (slashPosition) {
      textbox.setAttribute("aria-controls", commandMenuId);
      textbox.setAttribute("aria-activedescendant", `${commandMenuId}-${activeCommand}`);
      const menu = slashMenu.current;
      const option = menu?.children.item(activeCommand + 1) as HTMLElement | null;
      if (menu && option) {
        const optionBottom = option.offsetTop + option.offsetHeight;
        if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
        else if (optionBottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = optionBottom - menu.clientHeight;
      }
    }
    return () => {
      textbox.removeAttribute("aria-controls");
      textbox.removeAttribute("aria-activedescendant");
    };
  }, [activeCommand, commandMenuId, editor, slashPosition]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => instance && ({
      heading: [2, 3, 4].find((level) => instance.isActive("heading", { level })) ?? 0,
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      strike: instance.isActive("strike"),
      code: instance.isActive("code"),
      codeBlock: instance.isActive("codeBlock"),
      quote: instance.isActive("blockquote"),
      bullet: instance.isActive("bulletList"),
      ordered: instance.isActive("orderedList"),
      task: instance.isActive("taskList"),
      link: instance.isActive("link"),
      table: instance.isActive("table"),
      align: alignments.find(({ value }) => instance.isActive({ textAlign: value }))?.value ?? "left",
      undo: instance.can().undo(),
      redo: instance.can().redo(),
      words: instance.storage.characterCount.words(),
      characters: instance.storage.characterCount.characters(),
    }),
  });

  if (!editor || !state) return <div className={styles.loading} role="status">Editor laden…</div>;

  const chain = () => editor.chain().focus();
  const insertTable = () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  const blockCommands = [
    { label: "Kop 2", Icon: Heading2, run: () => chain().setHeading({ level: 2 }).run() },
    { label: "Kop 3", Icon: Heading3, run: () => chain().setHeading({ level: 3 }).run() },
    { label: "Opsomming", Icon: List, run: () => chain().toggleBulletList().run() },
    { label: "Checklist", Icon: CheckSquare, run: () => chain().toggleTaskList().run() },
    { label: "Citaat", Icon: Quote, run: () => chain().setBlockquote().run() },
    { label: "Codeblok", Icon: Braces, run: () => chain().setCodeBlock().run() },
    { label: "Afbeelding", Icon: ImageIcon, run: () => setInsertType("image") },
    { label: "Tabel", Icon: Table2, run: insertTable },
    { label: "YouTube-video", Icon: Video, run: () => setInsertType("youtube") },
    { label: "Scheidslijn", Icon: Minus, run: () => chain().setHorizontalRule().run() },
  ];

  function runSlash(index: number) {
    if (!editor) return;
    const cursorPosition = editor.state.selection.from;
    editor.commands.deleteRange({ from: cursorPosition - 1, to: cursorPosition });
    setSlashPosition(null);
    blockCommands[index].run();
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!slashPosition || !editor?.view.dom.contains(event.target as Node)) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveCommand((current) => (current + direction + blockCommands.length) % blockCommands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runSlash(activeCommand);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSlashPosition(null);
    }
  }

  return <section className={styles.editor} aria-labelledby={editorLabel}>
    <span id={editorLabel} className={styles.srOnly}>Artikelinhoud</span>
    <div className={styles.toolbar} role="group" aria-label="Tekstopmaak">
      <div className={styles.toolGroup}>
        <ToolButton label="Ongedaan maken" onClick={() => chain().undo().run()} disabled={!state.undo}><Undo2 aria-hidden="true" /></ToolButton>
        <ToolButton label="Opnieuw uitvoeren" onClick={() => chain().redo().run()} disabled={!state.redo}><Redo2 aria-hidden="true" /></ToolButton>
      </div>
      <div className={styles.toolGroup}>
        <label className={styles.blockSelect}>
          <Pilcrow aria-hidden="true" />
          <span className={styles.srOnly}>Tekststijl</span>
          <select value={state.heading} onChange={(event) => {
            const level = Number(event.currentTarget.value);
            if (level === 2 || level === 3 || level === 4) chain().setHeading({ level }).run();
            else chain().setParagraph().run();
          }}>
            <option value="0">Alinea</option><option value="2">Kop 2</option><option value="3">Kop 3</option><option value="4">Kop 4</option>
          </select>
          <ChevronDown aria-hidden="true" />
        </label>
      </div>
      <div className={styles.toolGroup}>
        <ToolButton label="Vet" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold aria-hidden="true" /></ToolButton>
        <ToolButton label="Cursief" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic aria-hidden="true" /></ToolButton>
        <ToolButton label="Onderstrepen" active={state.underline} onClick={() => chain().toggleUnderline().run()}><Underline aria-hidden="true" /></ToolButton>
        <ToolButton label="Doorhalen" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough aria-hidden="true" /></ToolButton>
        <ToolButton label="Code in tekst" active={state.code} onClick={() => chain().toggleCode().run()}><Code aria-hidden="true" /></ToolButton>
      </div>
      <div className={styles.toolGroup}>
        {alignments.map(({ value, label, Icon }) => <ToolButton key={value} label={label} active={state.align === value}
          onClick={() => chain().setTextAlign(value).run()}><Icon aria-hidden="true" /></ToolButton>)}
      </div>
      <div className={styles.toolGroup}>
        <ToolButton label="Opsomming" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List aria-hidden="true" /></ToolButton>
        <ToolButton label="Genummerde lijst" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered aria-hidden="true" /></ToolButton>
        <ToolButton label="Checklist" active={state.task} onClick={() => chain().toggleTaskList().run()}><CheckSquare aria-hidden="true" /></ToolButton>
        <ToolButton label="Citaat" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote aria-hidden="true" /></ToolButton>
        <ToolButton label="Codeblok" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}><Braces aria-hidden="true" /></ToolButton>
      </div>
      <div className={styles.toolGroup}>
        <ToolButton label="Link toevoegen of wijzigen" active={state.link} onClick={() => setInsertType("link")}><Link aria-hidden="true" /></ToolButton>
        <ToolButton label="Link verwijderen" disabled={!state.link} onClick={() => chain().extendMarkRange("link").unsetLink().run()}><Unlink aria-hidden="true" /></ToolButton>
        <ToolButton label="Afbeelding invoegen" onClick={() => setInsertType("image")}><ImageIcon aria-hidden="true" /></ToolButton>
        <ToolButton label="YouTube-video invoegen" onClick={() => setInsertType("youtube")}><Video aria-hidden="true" /></ToolButton>
        <ToolButton label={state.table ? "Tabelopties" : "Tabel invoegen"} active={state.table && showTableTools}
          onClick={() => {
            if (state.table) setShowTableTools((visible) => !visible);
            else if (insertTable()) setShowTableTools(true);
          }}><Table2 aria-hidden="true" /></ToolButton>
        <ToolButton label="Scheidslijn invoegen" onClick={() => chain().setHorizontalRule().run()}><Minus aria-hidden="true" /></ToolButton>
      </div>
    </div>
    {showTableTools && state.table && <div className={styles.tableTools} role="group" aria-label="Tabel bewerken">
      {([
        ["Rij toevoegen", () => chain().addRowAfter().run()],
        ["Kolom toevoegen", () => chain().addColumnAfter().run()],
        ["Rij verwijderen", () => chain().deleteRow().run()],
        ["Kolom verwijderen", () => chain().deleteColumn().run()],
        ["Cellen samenvoegen of splitsen", () => chain().mergeOrSplit().run()],
        ["Koprij aan of uit", () => chain().toggleHeaderRow().run()],
        ["Tabel verwijderen", () => chain().deleteTable().run()],
      ] as const).map(([label, run]) => <button key={label} type="button" onMouseDown={(event) => event.preventDefault()} onClick={run}>{label}</button>)}
    </div>}
    <div className={styles.contentArea} ref={contentArea} onKeyDownCapture={handleKeys}>
      <EditorContent editor={editor} />
      {slashPosition && <div className={styles.slashMenu} ref={slashMenu} id={commandMenuId} style={slashPosition}
        role="listbox" aria-label="Blokken invoegen">
        <p>Blok invoegen</p>
        {blockCommands.map(({ label, Icon }, index) => <button type="button" role="option" aria-selected={index === activeCommand}
          id={`${commandMenuId}-${index}`} tabIndex={-1} key={label}
          onMouseDown={(event) => event.preventDefault()} onClick={() => runSlash(index)}>
          <Icon size={16} aria-hidden="true" />{label}
        </button>)}
      </div>}
    </div>
    <div className={styles.footer}>
      <span>Typ <kbd>/</kbd> voor blokken</span>
      <span>{state.words} {state.words === 1 ? "woord" : "woorden"} · {state.characters} {state.characters === 1 ? "teken" : "tekens"}</span>
    </div>
    {insertType && <InsertDialog key={insertType} type={insertType} editor={editor} onUploadImage={onUploadImage}
      onClose={() => { setInsertType(null); editor.commands.focus(); }} />}
  </section>;
}
