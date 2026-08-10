import sharp from "sharp";
import { readFile } from "node:fs/promises";

const logo = await readFile("public/brand/bibata-logo-d.png");

const renderIcon = async (size, destination, safeArea = false) => {
  const markSize = Math.round(size * (safeArea ? 0.58 : 0.72));
  const offset = Math.round((size - markSize) / 2);
  const mark = await sharp(logo).resize({
    width: markSize,
    height: markSize,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#f8f1e8",
    },
  }).composite([{ input: mark, left: offset, top: offset }]).png().toFile(destination);
};

await renderIcon(192, "public/icon-192.png");
await renderIcon(512, "public/icon-512.png");
await renderIcon(512, "public/icon-maskable-512.png", true);
await renderIcon(180, "public/apple-touch-icon.png");
