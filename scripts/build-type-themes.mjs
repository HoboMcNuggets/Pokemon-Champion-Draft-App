/**
 * Génère css/type-themes.css — couleurs Pokédex + icônes de type.
 * Icônes : https://github.com/partywhale/pokemon-type-icons (dossier icons/)
 * Téléchargement : node scripts/build-type-themes.mjs
 * Hors ligne (SVG déjà dans assets/type-icons/) : node scripts/build-type-themes.mjs --offline
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'assets', 'type-icons');
const PARTYWHALE_ICONS_BASE =
  'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons';
const PARTYWHALE_LICENSE_URL =
  'https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/LICENSE';

/** Pastille thème Centre Pokémon (défaut) — Poké Ball, style partywhale */
const POKEMON_CENTER_SVG = fs.readFileSync(
  path.join(__dirname, '..', 'assets', 'type-icons', 'pokemon-center.svg'),
  'utf8',
);

/** Pas d’icône officielle « stellar » dans le dépôt — pastille locale, style identique */
const STELLAR_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <circle fill="#6ec8ff" cx="128" cy="128" r="128"/>
  <path fill="#fff" d="M128,52 L138,108 H196 L150,142 L168,204 L128,172 L88,204 L106,142 L60,108 H118 Z"/>
</svg>`;

const ORIGINAL_STREAM_GRID = `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='%230a0c12'/%3E%3Cpath d='M0 30h60M30 0v60' stroke='%23121828' stroke-width='1'/%3E%3C/svg%3E")`;
const THEME_MOSAIC_SYMBOL = '#eef1f8';
const DEFAULT_ACCENT = '#5b8def';
/** Grille mosaïque stream (identique pour tous les thèmes) */
const MOSAIC_STREAM_OPTS = { cols: 4, cell: 200, iconPx: 64, opacity: 0.1 };

const types = [
  { id: 'normal', fr: 'Normal', accent: '#a8a878', bg: '#141410', card: '#1e1e18', elevated: '#282820', border: '#454538', streamBg: '#121210', panel: 'rgba(30,30,24,0.92)', cyan: '#c8c8a0' },
  { id: 'fire', fr: 'Feu', accent: '#ee8130', bg: '#1a100c', card: '#241610', elevated: '#301c14', border: '#503028', streamBg: '#1a100c', panel: 'rgba(36,22,16,0.92)', cyan: '#ff6b4a' },
  { id: 'water', fr: 'Eau', accent: '#4592c4', bg: '#0a1420', card: '#0f1c2c', elevated: '#142438', border: '#2a4560', streamBg: '#0a1420', panel: 'rgba(15,28,44,0.92)', cyan: '#4592c4' },
  { id: 'electric', fr: 'Électrik', accent: '#f8d030', bg: '#18140a', card: '#221c0f', elevated: '#2c2614', border: '#4a4228', streamBg: '#18140a', panel: 'rgba(34,28,15,0.92)', cyan: '#ffe566' },
  { id: 'grass', fr: 'Plante', accent: '#5cbd2e', bg: '#0e1810', card: '#142018', elevated: '#1a2820', border: '#2d4838', streamBg: '#0e1810', panel: 'rgba(20,32,24,0.92)', cyan: '#5cbd2e' },
  { id: 'ice', fr: 'Glace', accent: '#98d8d8', bg: '#101818', card: '#142020', elevated: '#1a2828', border: '#304848', streamBg: '#101818', panel: 'rgba(20,32,32,0.92)', cyan: '#b8ecec' },
  { id: 'fighting', fr: 'Combat', accent: '#c03028', bg: '#180c0c', card: '#221010', elevated: '#2c1414', border: '#502828', streamBg: '#180c0c', panel: 'rgba(40,16,16,0.92)', cyan: '#e06050' },
  { id: 'poison', fr: 'Poison', accent: '#a33ea1', bg: '#180a18', card: '#221022', elevated: '#2c142c', border: '#502850', streamBg: '#140814', panel: 'rgba(34,16,34,0.92)', cyan: '#c860c0' },
  { id: 'ground', fr: 'Sol', accent: '#e2bf65', bg: '#18140c', card: '#221c10', elevated: '#2c2414', border: '#504830', streamBg: '#16120c', panel: 'rgba(36,30,18,0.92)', cyan: '#f0d890' },
  { id: 'flying', fr: 'Vol', accent: '#a8c8e8', bg: '#101418', card: '#141c24', elevated: '#1a2430', border: '#304058', streamBg: '#0e1218', panel: 'rgba(18,26,36,0.92)', cyan: '#c8e0f8' },
  { id: 'psychic', fr: 'Psy', accent: '#f85888', bg: '#180c12', card: '#221018', elevated: '#2c1420', border: '#502840', streamBg: '#140810', panel: 'rgba(40,16,28,0.92)', cyan: '#ff88b0' },
  { id: 'bug', fr: 'Insecte', accent: '#91a119', bg: '#14180a', card: '#1c2010', elevated: '#242814', border: '#404828', streamBg: '#12160a', panel: 'rgba(28,32,16,0.92)', cyan: '#b0c040' },
  { id: 'rock', fr: 'Roche', accent: '#b6a136', bg: '#16140c', card: '#201c10', elevated: '#2a2414', border: '#484028', streamBg: '#14120c', panel: 'rgba(32,28,16,0.92)', cyan: '#d4c060' },
  { id: 'ghost', fr: 'Spectre', accent: '#705898', bg: '#140e18', card: '#1c1424', elevated: '#241a2c', border: '#403058', streamBg: '#100c14', panel: 'rgba(28,20,36,0.92)', cyan: '#9888b8' },
  { id: 'dragon', fr: 'Dragon', accent: '#5060e1', bg: '#0c0e1a', card: '#101428', elevated: '#161c34', border: '#283060', streamBg: '#0a0c18', panel: 'rgba(16,20,40,0.92)', cyan: '#7088f0' },
  { id: 'dark', fr: 'Ténèbres', accent: '#504538', bg: '#100e0c', card: '#181410', elevated: '#201c18', border: '#383028', streamBg: '#0c0a08', panel: 'rgba(24,20,16,0.92)', cyan: '#706050' },
  { id: 'steel', fr: 'Acier', accent: '#b8b8d0', bg: '#14141a', card: '#1a1a22', elevated: '#22222c', border: '#38384a', streamBg: '#121218', panel: 'rgba(26,26,34,0.92)', cyan: '#d8d8f0' },
  { id: 'fairy', fr: 'Fée', accent: '#ee99ac', bg: '#181014', card: '#22181c', elevated: '#2c2024', border: '#503840', streamBg: '#140f12', panel: 'rgba(36,24,30,0.92)', cyan: '#ffc0d0' },
  { id: 'stellar', fr: 'Stellaire', accent: '#6ec8ff', bg: '#0c1218', card: '#101820', elevated: '#162028', border: '#284058', streamBg: '#0a1018', panel: 'rgba(14,24,36,0.92)', cyan: '#a0e0ff' },
];

const hexRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const glow = (h) => {
  const [r, g, b] = hexRgb(h);
  return `rgba(${r}, ${g}, ${b}, 0.42)`;
};

const gridLine = (h) => {
  const [r, g, b] = hexRgb(h);
  return `rgba(${r}, ${g}, ${b}, 0.22)`;
};

function normalizeSvg(svg) {
  return svg.replace(/<\?xml[^?]*\?>\s*/gi, '').trim();
}

function svgInner(svg) {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1].trim() : svg;
}

function toDataUrl(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(normalizeSvg(svg))}")`;
}

function btnBackground(svgRaw) {
  const inner = svgInner(normalizeSvg(svgRaw));
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${inner}</svg>`;
  return `transparent ${toDataUrl(wrapped)} center / 92% no-repeat`;
}

/** Icône en deux tons (accent du thème + texte clair) */
function recolorSvgForThemeMosaic(svgRaw, circleFill, symbolFill) {
  let inner = svgInner(normalizeSvg(svgRaw));
  inner = inner.replace(/<defs>[\s\S]*?<\/defs>\s*/gi, '');
  inner = inner.replace(/\s*class="cls-\d+"/gi, '');
  inner = inner.replace(/\s*fill="[^"]*"/gi, '');
  inner = inner.replace(/<circle\b/gi, `<circle fill="${circleFill}"`);
  inner = inner.replace(/<path\b/gi, `<path fill="${symbolFill}"`);
  return inner;
}

/** Complète la grille : duplique des types pour remplir la dernière ligne incomplète */
function fillMosaicIds(ids, cols) {
  if (!ids.length) return [];
  const rows = Math.ceil(ids.length / cols);
  const totalCells = cols * rows;
  const filled = [...ids];
  let dup = 0;
  while (filled.length < totalCells) {
    filled.push(ids[dup % ids.length]);
    dup += 1;
  }
  return filled;
}

/** Mosaïque stream : tous les types, espacement régulier, palette du thème */
function buildAllTypesMosaic(svgById, ids, options = {}) {
  const {
    cols = 4,
    cell = 200,
    iconPx = 64,
    opacity = 0.1,
    circleFill = DEFAULT_ACCENT,
    symbolFill = THEME_MOSAIC_SYMBOL,
  } = options;
  const iconScale = iconPx / 256;
  const pad = (cell - iconPx) / 2;
  const layoutIds = fillMosaicIds(ids, cols);
  const rows = Math.ceil(layoutIds.length / cols);
  const width = cols * cell;
  const height = rows * cell;
  let groups = '';
  layoutIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cell + pad;
    const y = row * cell + pad;
    const inner = recolorSvgForThemeMosaic(svgById[id], circleFill, symbolFill);
    groups += `<g transform="translate(${x} ${y}) scale(${iconScale})" opacity="${opacity}">${inner}</g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${groups}</svg>`;
  return { svg, width, height };
}

async function loadPartywhaleIcon(id) {
  const localPath = path.join(iconsDir, `${id}.svg`);
  if (process.argv.includes('--offline')) {
    if (!fs.existsSync(localPath)) throw new Error(`Manquant : ${localPath}`);
    return fs.readFileSync(localPath, 'utf8');
  }
  const url = `${PARTYWHALE_ICONS_BASE}/${id}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(localPath, text);
  return text;
}

async function ensureLicense() {
  const licensePath = path.join(iconsDir, 'LICENSE');
  if (process.argv.includes('--offline')) {
    if (fs.existsSync(licensePath)) return;
    throw new Error('Manquant : assets/type-icons/LICENSE (relancer sans --offline)');
  }
  const res = await fetch(PARTYWHALE_LICENSE_URL);
  if (!res.ok) throw new Error(`LICENSE → ${res.status}`);
  fs.writeFileSync(licensePath, await res.text());
}

async function loadIconForType(t) {
  if (t.id === 'stellar') {
    const localPath = path.join(iconsDir, 'stellar.svg');
    if (!process.argv.includes('--offline')) {
      fs.writeFileSync(localPath, STELLAR_SVG);
    } else if (!fs.existsSync(localPath)) {
      fs.writeFileSync(localPath, STELLAR_SVG);
    }
    return fs.readFileSync(localPath, 'utf8');
  }
  return loadPartywhaleIcon(t.id);
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  await ensureLicense();

  /** @type {Record<string, string>} */
  const svgById = {};

  for (const t of types) {
    const svg = await loadIconForType(t);
    svgById[t.id] = svg;
    const src = t.id === 'stellar' ? 'local (stellaire)' : 'partywhale/pokemon-type-icons';
    console.log(`  ${t.id}.svg ← ${src}`);
  }

  let css = `/* Thèmes par type Pokémon — couleurs pokedex.css
 * Icônes : https://github.com/partywhale/pokemon-type-icons/tree/main/icons (voir assets/type-icons/LICENSE)
 * Stellaire : pastille locale (absent du dépôt upstream)
 * Régénérer : node scripts/build-type-themes.mjs
 */

`;

  const typeIds = types.map((t) => t.id);
  const defaultMosaic = buildAllTypesMosaic(svgById, typeIds, {
    ...MOSAIC_STREAM_OPTS,
    circleFill: DEFAULT_ACCENT,
    symbolFill: THEME_MOSAIC_SYMBOL,
  });
  const mosaicByThemeId = { default: defaultMosaic };
  for (const t of types) {
    mosaicByThemeId[t.id] = buildAllTypesMosaic(svgById, typeIds, {
      ...MOSAIC_STREAM_OPTS,
      circleFill: t.accent,
      symbolFill: THEME_MOSAIC_SYMBOL,
    });
  }
  fs.writeFileSync(path.join(iconsDir, 'default-stream-mosaic.svg'), defaultMosaic.svg);

  css += `/* Stream — thème Centre Pokémon (défaut, sans data-theme sur html) */\n`;
  css += `.stream-mode {\n`;
  css += `  --stream-bg: #0a0c12;\n`;
  css += `  --stream-bg-pattern: ${toDataUrl(defaultMosaic.svg)};\n`;
  css += `  --stream-pattern-size: ${defaultMosaic.width}px ${defaultMosaic.height}px;\n`;
  css += `  --stream-pattern-repeat: repeat;\n`;
  css += `  --stream-grid-line: rgba(18, 24, 40, 0.45);\n`;
  css += `  --stream-grid-size: 30px;\n`;
  css += `}\n\n`;

  css += `.stream-mode .stream-layout__main::before {\n`;
  css += `  background-color: var(--stream-bg);\n`;
  css += `  background-image: var(--stream-bg-pattern), ${ORIGINAL_STREAM_GRID};\n`;
  css += `  background-size: var(--stream-pattern-size), auto;\n`;
  css += `  background-repeat: repeat, repeat;\n`;
  css += `  background-position: 0 0;\n`;
  css += `}\n\n`;

  css += `.theme-btn[data-theme-id="default"]::before {\n`;
  css += `  background: ${btnBackground(POKEMON_CENTER_SVG)};\n}\n\n`;

  for (const t of types) {
    css += `[data-theme="${t.id}"] {\n`;
    css += `  --bg: ${t.bg};\n  --bg-card: ${t.card};\n  --bg-elevated: ${t.elevated};\n  --border: ${t.border};\n`;
    css += `  --accent: ${t.accent};\n  --accent-glow: ${glow(t.accent)};\n`;
    css += `  --text: #eef1f8;\n  --text-muted: #9aa3b8;\n  --view-mode-switch-bg: rgba(15, 17, 23, 0.92);\n}\n\n`;
  }

  for (const t of types) {
    css += `.theme-btn[data-theme-id="${t.id}"]::before {\n  background: ${btnBackground(svgById[t.id])};\n}\n\n`;
  }

  for (const t of types) {
    const mosaic = mosaicByThemeId[t.id];
    css += `[data-theme="${t.id}"] .stream-mode {\n`;
    css += `  --stream-grid-size: 30px;\n`;
    css += `  --stream-pattern-size: ${mosaic.width}px ${mosaic.height}px;\n`;
    css += `  --stream-pattern-repeat: repeat;\n`;
    css += `  --stream-grid-line: ${gridLine(t.accent)};\n`;
    css += `  --stream-gold: ${t.accent};\n  --stream-cyan: ${t.cyan};\n`;
    css += `  --stream-bg: ${t.streamBg};\n  --stream-panel: ${t.panel};\n`;
    css += `  --stream-bg-pattern: ${toDataUrl(mosaic.svg)};\n}\n\n`;
  }

  const layoutSel = types
    .map((t) => `[data-theme="${t.id}"] .stream-mode .stream-layout__main::before`)
    .join(',\n');

  css += `${layoutSel} {\n`;
  css += `  background-color: var(--stream-bg);\n`;
  css += `  background-image: var(--stream-bg-pattern), linear-gradient(var(--stream-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--stream-grid-line) 1px, transparent 1px);\n`;
  css += `  background-size: var(--stream-pattern-size), var(--stream-grid-size) var(--stream-grid-size), var(--stream-grid-size) var(--stream-grid-size);\n`;
  css += `  background-repeat: repeat, repeat, repeat;\n`;
  css += `  background-position: 0 0;\n}\n`;

  fs.writeFileSync(path.join(root, 'css', 'type-themes.css'), css);
  console.log(`\nGénéré css/type-themes.css (${types.length} types + défaut stream).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
