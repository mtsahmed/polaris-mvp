// Generates the Polaris favicons from the brand star (src/components/brand-mark.tsx).
// Run from the repo root: node scripts/favicons/make-favicons.mjs
// Uses sharp, which Next.js already installs. Re-run after changing the star or colours.
//
// Light version: the gradient star on a white tile, for light browser themes.
// Dark version: the brighter button gradient on the navy landing colour, for dark themes.
// favicon.ico (src/app), the Apple icon and the app icons (public/icons) use the dark tile, which reads on both.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const STAR =
  "M12 1.5c.4 4.9 2.1 8.6 10.5 10.5-8.4 1.9-10.1 5.6-10.5 10.5-.4-4.9-2.1-8.6-10.5-10.5C9.9 10.1 11.6 6.4 12 1.5Z";

const THEMES = {
  light: { tile: "#ffffff", border: "#f3d3e4", stops: ["#c4006a", "#ff7a3d", "#f5b800"] },
  dark: { tile: "#0b1026", border: "#2a2350", stops: ["#cd2680", "#ff8e5a", "#ffdd26"] },
};

// 64x64 rounded tile; the 24-unit star scaled to 52px and centred. `full` drops the rounding
// and border for the Apple and app icons, which the system masks itself.
function svg(theme, { full = false } = {}) {
  const t = THEMES[theme];
  const r = full ? 0 : 14;
  const border = full ? "" : ` stroke="${t.border}" stroke-width="1.5"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.stops[0]}"/>
      <stop offset="58%" stop-color="${t.stops[1]}"/>
      <stop offset="100%" stop-color="${t.stops[2]}"/>
    </linearGradient>
  </defs>
  <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="${r}" fill="${t.tile}"${border}/>
  <path fill="url(#g)" transform="translate(6 6) scale(2.1667)" d="${STAR}"/>
</svg>
`;
}

const png = (s, size) => sharp(Buffer.from(s), { density: 72 * (size / 64) * 2 }).resize(size, size).png().toBuffer();

// ICO holding PNG images (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

mkdirSync("public/icons", { recursive: true });
for (const theme of ["light", "dark"]) {
  writeFileSync(`public/icons/favicon-${theme}.svg`, svg(theme));
  writeFileSync(`public/icons/favicon-${theme}-32.png`, await png(svg(theme), 32));
}
const dark = svg("dark");
const icoSizes = [16, 32, 48];
writeFileSync("src/app/favicon.ico", ico(await Promise.all(icoSizes.map(async (size) => ({ size, data: await png(dark, size) })))));
writeFileSync("public/icons/apple-icon.png", await png(svg("dark", { full: true }), 180));
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, await png(svg("dark", { full: true }), size));
console.log("Favicons written: public/icons/*, src/app/favicon.ico");
