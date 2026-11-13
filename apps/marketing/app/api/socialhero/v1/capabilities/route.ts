import { resolveBlogConfig } from "@veyocast/blog";
import { authorizeBlogToken, blogCommand, blogFailure, blogJson, blogMediaLimit } from "@veyocast/blog/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const token = await authorizeBlogToken(request, "capabilities:read");
    const configured = await blogCommand("capabilities", { tokenHash: token.hash });
    const config = resolveBlogConfig();
    return blogJson({ ...configured.body, publicOrigin: config.publicOrigin, canonicalOrigin: config.publicOrigin,
      contentTypes: ["blog", "article"], locales: ["nl-NL"], contentFormats: ["markdown", "tiptap"],
      actions: ["status", "media", "draft", "publish"],
      permissions: { media: token.scopes.includes("media:write"), drafts: token.scopes.includes("posts:write"), publish: token.scopes.includes("posts:publish") },
      authors: [{ id: "redactie", name: "VeyoCast" }],
      categories: [{ id: "clubtv", name: "ClubTV" }, { id: "sponsoring", name: "Sponsoring" }, { id: "schermen", name: "Schermen & opstelling" }, { id: "narrowcasting", name: "Narrowcasting" }],
      media: { formats: ["image/jpeg", "image/png", "image/webp"], maxBytes: blogMediaLimit, maxWidth: 10000, maxHeight: 10000, maxPixels: 40_000_000, presets: ["portrait-hero", "landscape-social"] }
    });
  } catch (error) { return blogFailure(error); }
}
