export type InstallPlatform = "ios" | "android" | "desktop" | "unknown";

export function detectInstallPlatform({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): InstallPlatform {
  const ipadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || ipadDesktopMode) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) return "desktop";
  return "unknown";
}

