import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createEmptyStudioDocument } from "@veyocast/studio";
import { encodeStudioMp4 } from "../src/studio-render-video";
import { ResvgSharpStudioRenderer } from "../src/studio-render-resvg";

describe("Studio encoder failure while a real asynchronous frame is pending", () => {
  it("returns an observed job failure when the encoder executable is unavailable", async () => {
    let encoderFailed!: () => void;
    const failed = new Promise<void>((resolve) => {
      encoderFailed = resolve;
    });
    await expect(
      encodeStudioMp4({
        document: createEmptyStudioDocument(),
        outputPath: "/tmp/s226-never-created.mp4",
        renderer: new ResvgSharpStudioRenderer(),
        spawnProcess: () => {
          const child = spawn("/tmp/s226-deliberately-missing-ffmpeg", [], {
            stdio: ["pipe", "pipe", "pipe"],
          });
          child.once("error", encoderFailed);
          return child;
        },
        renderFrame: async () => {
          await failed;
          await new Promise((resolve) => setTimeout(resolve, 0));
          return new Uint8Array(1920 * 1080 * 4);
        },
      }),
    ).rejects.toMatchObject({ code: "encoding_failed" });
  });
  it("does not remain blocked on backpressure after the encoder closes its input", async () => {
    await expect(
      encodeStudioMp4({
        document: createEmptyStudioDocument(),
        outputPath: "/tmp/s226-never-created.mp4",
        renderer: new ResvgSharpStudioRenderer(),
        spawnProcess: () =>
          spawn(
            process.execPath,
            [
              "-e",
              "process.stdin.destroy();setTimeout(()=>process.exit(23),10)",
            ],
            { stdio: ["pipe", "pipe", "pipe"] },
          ),
        renderFrame: async () => new Uint8Array(1920 * 1080 * 4),
      }),
    ).rejects.toMatchObject({ code: "encoding_failed" });
  });
});
