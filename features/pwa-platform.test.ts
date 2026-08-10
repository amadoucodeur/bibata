import { describe, expect, test } from "bun:test";
import { detectInstallPlatform, getInstallInviteCopy, getManualInstallGuide } from "./pwa-platform";

describe("PWA install platform", () => {
  test("detects iPhone and iPad desktop mode", () => {
    expect(detectInstallPlatform({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", platform: "iPhone", maxTouchPoints: 5 })).toBe("ios");
    expect(detectInstallPlatform({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
  });

  test("distinguishes Android and desktop browsers", () => {
    expect(detectInstallPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 15)", platform: "Linux armv8l", maxTouchPoints: 5 })).toBe("android");
    expect(detectInstallPlatform({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", platform: "Win32", maxTouchPoints: 0 })).toBe("desktop");
  });

  test("provides an actionable install invitation on every supported platform", () => {
    expect(getInstallInviteCopy("ios", false)).toEqual({ title: "Garde Bibata sur ton écran", action: "Voir comment" });
    expect(getInstallInviteCopy("android", true).action).toBe("Installer");
    expect(getInstallInviteCopy("desktop", false).action).toBe("Voir comment");
  });

  test("provides manual fallback steps when the native prompt is unavailable", () => {
    expect(getManualInstallGuide("ios").steps).toHaveLength(3);
    expect(getManualInstallGuide("android").steps.join(" ")).toContain("écran d’accueil");
    expect(getManualInstallGuide("desktop").title).toContain("vraie app");
  });
});
