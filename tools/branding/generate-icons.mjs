// Generates every Matchday app icon from the SVG logo defined below.
// Usage: node tools/branding/generate-icons.mjs   (macOS: needs Google Chrome, sips, iconutil)
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const ICONS = join(ROOT, 'apps/web/src/assets/icons');
const REMOTE_FAVICON = join(ROOT, 'apps/remote-control-web/public/favicon.ico');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Night-pitch tile: mowing stripes, halfway line, centre circle, play button
// where the centre spot would be. `radius` rounds the tile; `inset` pads it
// (macOS icon grid); `shadow` adds the drop shadow macOS icons carry.
function logoSvg({ radius = 228, inset = 0, shadow = false } = {}) {
    const scale = (1024 - inset * 2) / 1024;
    const stripes = [0, 256, 512, 768]
        .map((x) => `<rect x="${x}" width="128" height="1024"/>`)
        .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%">
      <stop offset="0" stop-color="#1E7D4F"/>
      <stop offset="0.55" stop-color="#0D4A2F"/>
      <stop offset="1" stop-color="#05200F"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#C8FF4D" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#C8FF4D" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="play" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E6FF7A"/>
      <stop offset="1" stop-color="#A6EE24"/>
    </linearGradient>
    <clipPath id="tile"><rect width="1024" height="1024" rx="${radius}"/></clipPath>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g transform="translate(${inset} ${inset}) scale(${scale})"${shadow ? ' filter="url(#shadow)"' : ''}>
    <g clip-path="url(#tile)">
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <g fill="#FFFFFF" opacity="0.05">${stripes}</g>
      <circle cx="512" cy="512" r="300" fill="url(#glow)"/>
      <g stroke="#F2FFF6" stroke-width="56" fill="none">
        <line x1="512" y1="0" x2="512" y2="272"/>
        <line x1="512" y1="752" x2="512" y2="1024"/>
        <circle cx="512" cy="512" r="240"/>
      </g>
      <path d="M452 392 L672 512 L452 632 Z" fill="url(#play)" stroke="url(#play)"
            stroke-width="44" stroke-linejoin="round"/>
    </g>
  </g>
</svg>
`;
}

const work = mkdtempSync(join(tmpdir(), 'matchday-icons-'));

function render(name, svg) {
    const svgPath = join(work, `${name}.svg`);
    const pngPath = join(work, `${name}.png`);
    writeFileSync(svgPath, svg);
    execFileSync(CHROME, [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        `--user-data-dir=${join(work, 'chrome-profile')}`,
        '--default-background-color=00000000',
        '--window-size=1024,1024',
        `--screenshot=${pngPath}`,
        `file://${svgPath}`,
    ], { stdio: 'ignore' });
    return pngPath;
}

function resize(source, size, out) {
    execFileSync('sips', ['-z', String(size), String(size), source, '--out', out], { stdio: 'ignore' });
    return out;
}

// ICO with PNG-compressed entries (supported since Windows Vista).
function writeIco(source, sizes, out) {
    const images = sizes.map((size) => readFileSync(resize(source, size, join(work, `ico-${size}.png`))));
    const header = Buffer.alloc(6 + sizes.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, i) => {
        const entry = 6 + i * 16;
        header.writeUInt8(size >= 256 ? 0 : size, entry);
        header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(images[i].length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += images[i].length;
    });
    writeFileSync(out, Buffer.concat([header, ...images]));
}

function writeIcns(source, out) {
    const iconset = join(work, 'icon.iconset');
    mkdirSync(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
        resize(source, size, join(iconset, `icon_${size}x${size}.png`));
        resize(source, size * 2, join(iconset, `icon_${size}x${size}@2x.png`));
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out]);
}

try {
    writeFileSync(join(ICONS, 'logo.svg'), logoSvg());
    const tile = render('tile', logoSvg());
    const square = render('square', logoSvg({ radius: 0 }));
    const mac = render('mac', logoSvg({ radius: 185, inset: 100, shadow: true }));

    for (const size of [16, 32, 48, 64, 128]) resize(tile, size, join(ICONS, `icon-${size}.png`));
    for (const name of ['icon.png', 'favicon.png', 'favicon.256x256.png', 'icon-tv-256.png']) {
        resize(tile, 256, join(ICONS, name));
    }
    resize(tile, 512, join(ICONS, 'favicon.512x512.png'));
    resize(tile, 192, join(ICONS, 'android-chrome-192x192.png'));
    resize(tile, 512, join(ICONS, 'android-chrome-512x512.png'));
    resize(square, 192, join(ICONS, 'android-chrome-maskable-192x192.png'));
    resize(square, 512, join(ICONS, 'android-chrome-maskable-512x512.png'));
    resize(square, 180, join(ICONS, 'apple-touch-icon.png'));
    resize(mac, 1024, join(ICONS, 'icon-1024.png'));
    writeIcns(mac, join(ICONS, 'favicon.icns'));
    writeIco(tile, [16, 32, 48, 256], join(ICONS, 'favicon.ico'));
    writeIco(tile, [16, 32], REMOTE_FAVICON);
    console.log('Icons written to', ICONS);
} finally {
    rmSync(work, { recursive: true, force: true });
}
