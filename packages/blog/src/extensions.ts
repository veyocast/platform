import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { blogAssetPattern, blogYoutubeUrl, safeBlogUrl } from "./urls";

// The editor, server validator and public document contract share this schema.
export function getBlogExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: false }),
    Link.extend({
      addAttributes() {
        return { ...this.parent?.(),
          target: { default: null, parseHTML: () => null },
          rel: { default: null, parseHTML: () => null },
          class: { default: null, parseHTML: () => null }
        };
      }
    }).configure({
      openOnClick: false, isAllowedUri: (url) => Boolean(safeBlogUrl(url)),
      HTMLAttributes: { target: null, rel: null }
    }),
    Image.extend({
      addAttributes() {
        return { ...this.parent?.(), assetId: {
          default: null,
          parseHTML: (element) => blogAssetPattern.exec(element.getAttribute("src") ?? "")?.[1] ?? null,
          renderHTML: () => ({})
        } };
      },
      parseHTML() { return [{ tag: "img[src]", getAttrs: (node) => safeBlogUrl(node.getAttribute("src"), "image") ? null : false }]; }
    }).configure({ allowBase64: false, resize: { enabled: true, minWidth: 120, minHeight: 60, alwaysPreserveAspectRatio: true } }),
    TaskList, TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true, renderWrapper: true } }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
    Youtube.extend({ parseHTML() { return [{ tag: "div[data-youtube-video] iframe", getAttrs: (node) => {
      const src = blogYoutubeUrl(node.getAttribute("src"));
      return src ? { src, start: 0, width: 640, height: 360 } : false;
    } }]; } })
      .configure({ nocookie: true, width: 640, height: 360, HTMLAttributes: { title: "YouTube-video", loading: "lazy" } }),
    Placeholder.configure({ placeholder: "Begin met schrijven of typ / voor blokken…" }), CharacterCount
  ];
}
