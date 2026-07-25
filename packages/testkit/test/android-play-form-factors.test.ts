import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const androidRoot = join(repositoryRoot, "apps", "android-tv");
const canonicalApplicationId = ["nl", "veyocast", "player"].join(".");
const forbiddenSecondApplicationId = [canonicalApplicationId, "tv"].join(".");

async function source(path: string): Promise<string> {
  return readFile(join(repositoryRoot, path), "utf8");
}

async function pngDimensions(path: string): Promise<{
  height: number;
  width: number;
}> {
  const bytes = await readFile(join(repositoryRoot, path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16)
  };
}

describe("one multi-form-factor Google Play app", () => {
  it("uses one application ID and one shared Android player implementation", async () => {
    const [generalGradle, tvGradle] = await Promise.all([
      source("apps/android-tv/app/build.gradle.kts"),
      source("apps/android-tv/tv/build.gradle.kts")
    ]);

    expect(generalGradle).toContain(`applicationId = "${canonicalApplicationId}"`);
    expect(tvGradle).toContain(`applicationId = "${canonicalApplicationId}"`);
    expect(generalGradle).not.toContain(forbiddenSecondApplicationId);
    expect(tvGradle).not.toContain(forbiddenSecondApplicationId);
    expect(tvGradle).toContain('kotlin.srcDirs("../app/src/main/java")');
    expect(tvGradle).toContain('res.srcDirs("../app/src/main/res")');
    expect(tvGradle).toContain('kotlin.srcDirs("../app/src/test/java")');
    expect(tvGradle).not.toContain('java.srcDirs("../app/src/main/java")');
    expect(tvGradle).not.toContain('java.srcDirs("../app/src/test/java")');
    expect(generalGradle).toContain("https://player.veyocast.nl");
    expect(tvGradle).toContain("https://player.veyocast.nl");
  });

  it("keeps general and TV version codes in collision-proof ranges", async () => {
    const [generalGradle, tvGradle, generalWorkflow, tvWorkflow] =
      await Promise.all([
        source("apps/android-tv/app/build.gradle.kts"),
        source("apps/android-tv/tv/build.gradle.kts"),
        source(".github/workflows/android-tv-play-internal.yml"),
        source(".github/workflows/android-google-tv-play-internal.yml")
      ]);

    expect(generalGradle).toContain("100_000_000..199_999_999");
    expect(tvGradle).toContain("200_000_000..299_999_999");
    expect(generalWorkflow).toContain(
      "version_code=$((100000000 + release_sequence))"
    );
    expect(tvWorkflow).toContain(
      "version_code=$((200000000 + release_sequence))"
    );
    expect(generalWorkflow).toContain("GITHUB_RUN_ATTEMPT > 99");
    expect(tvWorkflow).toContain("GITHUB_RUN_ATTEMPT > 99");
  });

  it("makes the TV artifact TV-only without a mobile launcher", async () => {
    const manifest = await source("apps/android-tv/tv/src/main/AndroidManifest.xml");
    const permissions = [...manifest.matchAll(
      /<uses-permission android:name="([^"]+)" \/>/gu
    )].map((match) => match[1]);

    expect(manifest).toMatch(
      /android:name="android\.software\.leanback"\s+android:required="true"/u
    );
    expect(manifest).toMatch(
      /android:name="android\.hardware\.touchscreen"\s+android:required="false"/u
    );
    expect(manifest).toContain("android.intent.category.LEANBACK_LAUNCHER");
    expect(manifest).toContain(
      'android:name="nl.veyocast.player.MainActivity"'
    );
    expect(manifest).toContain('android:enabled="true"');
    expect(manifest).toContain('android:exported="true"');
    expect(manifest).not.toMatch(
      /android:name="android\.intent\.category\.LAUNCHER"/u
    );
    expect(manifest).toContain('android:screenOrientation="landscape"');
    expect(permissions).toEqual([
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.RECEIVE_BOOT_COMPLETED"
    ]);
  });

  it("keeps the general artifact available to phones and tablets", async () => {
    const manifest = await source("apps/android-tv/app/src/main/AndroidManifest.xml");

    expect(manifest).toContain("android.intent.category.LAUNCHER");
    expect(manifest).toMatch(
      /android:name="android\.software\.leanback"\s+android:required="false"/u
    );
    expect(manifest).toMatch(
      /android:name="android\.hardware\.touchscreen"\s+android:required="false"/u
    );
  });

  it("reuses signing identity and isolates mobile and TV Play tracks", async () => {
    const [generalWorkflow, tvWorkflow] = await Promise.all([
      source(".github/workflows/android-tv-play-internal.yml"),
      source(".github/workflows/android-google-tv-play-internal.yml")
    ]);
    const sharedSecrets = [
      "ANDROID_TV_UPLOAD_KEYSTORE_BASE64",
      "ANDROID_TV_UPLOAD_KEYSTORE_PASSWORD",
      "ANDROID_TV_UPLOAD_KEY_ALIAS",
      "ANDROID_TV_UPLOAD_KEY_PASSWORD",
      "GOOGLE_WORKLOAD_IDENTITY_PROVIDER",
      "GOOGLE_PLAY_SERVICE_ACCOUNT"
    ];

    for (const name of sharedSecrets) {
      expect(generalWorkflow).toContain(name);
      expect(tvWorkflow).toContain(name);
    }

    expect(generalWorkflow).toContain("environment: android-tv-internal");
    expect(tvWorkflow).toContain("environment: android-tv-internal");
    expect(generalWorkflow).toContain(`packageName: ${canonicalApplicationId}`);
    expect(tvWorkflow).toContain(`packageName: ${canonicalApplicationId}`);
    expect(generalWorkflow).toMatch(/\n\s+tracks: internal\s*$/mu);
    expect(generalWorkflow).not.toContain("tracks: tv:internal");
    expect(tvWorkflow).toMatch(/\n\s+tracks: tv:internal\s*$/mu);
    expect(tvWorkflow).not.toMatch(/\n\s+tracks: (?:internal|production)\s*$/mu);
    expect(tvWorkflow).toContain(":tv:bundleProductionRelease");
    expect(tvWorkflow).toContain("scripts/validate-tv-bundle.sh");
    expect(tvWorkflow).toContain(
      "scripts/validate-tv-launcher-on-device.sh"
    );
    expect(tvWorkflow).toContain("api-level: 34");
    expect(tvWorkflow).toContain("target: android-tv");
    expect(tvWorkflow).toContain("disk-size: 2G");
    expect(tvWorkflow).toContain("pre-emulator-launch-script:");
    expect(tvWorkflow).toContain(
      "sed -i '/^disk\\.dataPartition\\.size=/d'"
    );
    expect(tvWorkflow).not.toContain(
      'avd_config="${ANDROID_AVD_HOME}/test.avd/config.ini"'
    );
    expect(tvWorkflow.indexOf("Preserve signed Google TV artifact")).toBeLessThan(
      tvWorkflow.indexOf("Publish to Google Play internal testing")
    );
    expect(tvWorkflow).not.toContain(forbiddenSecondApplicationId);
    expect(tvWorkflow).not.toContain("ANDROID_GOOGLE_TV_");
    expect(tvWorkflow).not.toContain("GOOGLE_TV_PLAY_");
  });

  it("keeps one store listing and separate TV screenshots only", async () => {
    await expect(
      access(join(androidRoot, "play", "listing", "nl-NL", "title.txt"))
    ).resolves.toBeUndefined();
    await expect(
      access(
        join(
          androidRoot,
          "play-tv",
          "graphics",
          "tv-screenshots",
          "01-koppelen-1920x1080.png"
        )
      )
    ).resolves.toBeUndefined();
    for (const file of [
      "title.txt",
      "short-description.txt",
      "full-description.txt"
    ]) {
      await expect(
        access(join(androidRoot, "play-tv", "listing", "nl-NL", file))
      ).rejects.toMatchObject({ code: "ENOENT" });
    }

    await expect(
      pngDimensions(
        "apps/android-tv/app/src/main/res/drawable-nodpi/veyocast_tv_banner.png"
      )
    ).resolves.toEqual({ height: 180, width: 320 });

    for (const file of [
      "01-koppelen-1920x1080.png",
      "02-fullscreen-content-1920x1080.png",
      "03-offline-doorgaan-1920x1080.png"
    ]) {
      await expect(
        pngDimensions(
          `apps/android-tv/play-tv/graphics/tv-screenshots/${file}`
        )
      ).resolves.toEqual({ height: 1080, width: 1920 });
    }
  });
});
