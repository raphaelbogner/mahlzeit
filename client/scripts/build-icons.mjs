// Generate PWA icons from one of the SVG drafts.
//   node scripts/build-icons.mjs [a|b|c|d]     (default: a)
// Writes public/icons/icon.svg + PNGs (192, 512, maskable 512, apple 180).
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const draftsDir = join(publicDir, 'icons', 'drafts');
const outDir = join(publicDir, 'icons');

const pick = (process.argv[2] ?? 'a').toLowerCase();
const draft = readdirSync(draftsDir).find((f) => f.startsWith(`${pick}-`) && f.endsWith('.svg'));
if (!draft) {
  console.error(`No draft starting with "${pick}-" in ${draftsDir}`);
  process.exit(1);
}
const src = join(draftsDir, draft);
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'icon.svg'));

const svg = readFileSync(src);
async function png(size, name, padRatio = 0) {
  // Maskable icons need a safe zone: render the artwork smaller on a solid
  // background so OS masks (circle, squircle) do not clip it.
  const inner = Math.round(size * (1 - padRatio));
  const art = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#f97316' },
  })
    .composite([{ input: art, gravity: 'centre' }])
    .png()
    .toFile(join(outDir, name));
  console.log('wrote', name);
}

await png(192, 'icon-192.png');
await png(512, 'icon-512.png');
await png(512, 'icon-maskable-512.png', 0.2);
await png(180, 'apple-touch-icon.png');
console.log('icons built from', draft);
