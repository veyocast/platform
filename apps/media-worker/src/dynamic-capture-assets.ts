import {createHash} from 'node:crypto';
import sharp from 'sharp';
import type {PlayerDynamicTemplateAsset} from '@veyocast/contracts';
import type {StudioSvgAssetSources} from './studio-render-svg';

/** Checksum-bound images signed by this installation's private Storage. Source
 * and historical renderers retain their own reference authority and failures. */
export async function loadVerifiedDynamicCaptureAssets(
 references:readonly {mediaAssetId:string;checksumSha256:string}[],assets:Record<string,PlayerDynamicTemplateAsset>,storageOrigin:string|undefined,
 unavailable:()=>Error,signal?:AbortSignal,fetcher:typeof fetch=fetch,
):Promise<StudioSvgAssetSources>{
    const batch = AbortSignal.timeout(60000);
    const batchSignal = signal ? AbortSignal.any([signal, batch]) : batch;
    const result: Record<string, string> = {}, verified = new Map<string, string>();
    let total = 0;
    for (const reference of references) {
        batchSignal.throwIfAborted();
        const asset = assets[reference.mediaAssetId];
        if (!asset || asset.checksumSha256 !== reference.checksumSha256 || !asset.mimeType.startsWith("image/") || asset.bytes <= 0 || asset.bytes > 24 * 1024 * 1024)
            throw unavailable();
        const cached = verified.get(asset.checksumSha256);
        if (cached) {
            result[reference.mediaAssetId] = cached;
            continue;
        }
        let url: URL;
        try {
            url = new URL(asset.url);
        }
        catch {
            throw unavailable();
        }
        if (!storageOrigin || url.origin !== new URL(storageOrigin).origin || url.username || url.password || url.hash || !/^\/storage\/v1\/object\/sign\/(?:tenant-media|provider-assets)\//.test(url.pathname))
            throw unavailable();
        const deadline = AbortSignal.timeout(20000);
        const requestSignal = AbortSignal.any([batchSignal, deadline]);
        const response = await fetcher(url, { signal: requestSignal, redirect: "error", cache: "no-store" });
        if (!response.ok || !response.body || Number(response.headers.get("content-length")) > asset.bytes) {
            await response.body?.cancel();
            throw unavailable();
        }
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
            for (;;) {
                const chunk = await reader.read();
                if (chunk.done)
                    break;
                bytes += chunk.value.byteLength;
                total += chunk.value.byteLength;
                if (bytes > asset.bytes || total > 96 * 1024 * 1024)
                    throw unavailable();
                chunks.push(chunk.value);
            }
        }
        catch (error) {
            await reader.cancel().catch(() => undefined);
            throw error;
        }
        finally {
            reader.releaseLock();
        }
        const original = Buffer.concat(chunks);
        if (bytes !== asset.bytes || createHash("sha256").update(original).digest("hex") !== asset.checksumSha256)
            throw unavailable();
        const png = asset.mimeType === "image/svg+xml" ? await sharp(original, { limitInputPixels: 40000000 }).resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer() : original;
        const mime = asset.mimeType === "image/svg+xml" ? "image/png" : asset.mimeType;
        if (!["image/png", "image/jpeg", "image/webp"].includes(mime))
            throw unavailable();
        const source = `data:${mime};base64,${png.toString("base64")}`;
        verified.set(asset.checksumSha256, source);
        result[reference.mediaAssetId] = source;
    }
    return result;
}
