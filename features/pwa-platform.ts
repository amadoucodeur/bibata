export type InstallPlatform = "ios" | "android" | "desktop" | "unknown";

export interface InstallInviteCopy {
  title: string;
  action: string;
}

export interface ManualInstallGuide {
  eyebrow: string;
  title: string;
  description: string;
  steps: string[];
}

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

export function getInstallInviteCopy(platform: InstallPlatform, canInstall: boolean): InstallInviteCopy {
  if (platform === "ios") return { title: "Garde Bibata sur ton écran", action: "Voir comment" };
  if (canInstall) return { title: platform === "android" ? "Installe Bibata en un geste" : "Ouvre Bibata comme une vraie app", action: "Installer" };
  if (platform === "android") return { title: "Garde Bibata à portée de main", action: "Voir comment" };
  return { title: "Ouvre Bibata comme une vraie app", action: "Voir comment" };
}

export function getManualInstallGuide(platform: InstallPlatform): ManualInstallGuide {
  if (platform === "ios") return {
    eyebrow: "Sur iPhone et iPad",
    title: "Garde Bibata à portée de main",
    description: "Apple ne montre pas toujours un bouton d’installation. Trois gestes suffisent :",
    steps: ["Ouvre le menu Partager de ton navigateur.", "Choisis Sur l’écran d’accueil.", "Appuie sur Ajouter."],
  };
  if (platform === "android") return {
    eyebrow: "Sur Android",
    title: "Installe Bibata en quelques secondes",
    description: "Si le bouton automatique n’apparaît pas, utilise simplement le menu du navigateur :",
    steps: ["Ouvre le menu ⋮ de ton navigateur.", "Choisis Installer l’application ou Ajouter à l’écran d’accueil.", "Confirme avec Installer."],
  };
  return {
    eyebrow: "Sur cet appareil",
    title: "Ouvre Bibata comme une vraie app",
    description: "Ton navigateur peut placer Bibata dans sa propre fenêtre et dans tes applications :",
    steps: ["Ouvre le menu principal de ton navigateur.", "Choisis Installer Bibata ou Installer cette application.", "Confirme l’installation."],
  };
}
