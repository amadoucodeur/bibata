import sharp from "sharp";

const renderIcon = async (size, destination, safeArea = false) => {
  const inset = safeArea ? Math.round(size * 0.16) : Math.round(size * 0.08);
  const tileSize = size - inset * 2;
  const radius = Math.round(tileSize * 0.28);
  const fontSize = Math.round(tileSize * 0.64);
  const dotSize = Math.round(tileSize * 0.055);
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#1d5548"/>
    <rect x="${inset}" y="${inset}" width="${tileSize}" height="${tileSize}" rx="${radius}" fill="#bdebd8"/>
    <circle cx="${inset + tileSize * 0.82}" cy="${inset + tileSize * 0.18}" r="${dotSize}" fill="#ee8d69"/>
    <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#17362f">b</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(destination);
};

await renderIcon(192, "public/icon-192.png");
await renderIcon(512, "public/icon-512.png");
await renderIcon(512, "public/icon-maskable-512.png", true);
await renderIcon(180, "public/apple-touch-icon.png");
