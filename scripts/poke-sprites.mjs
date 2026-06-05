/**
 * Utilitaires sprites Showdown partagés (build-pool, build-pokedex).
 */
export const SHOWDOWN_SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites/ani/';
export const SHOWDOWN_INDEX_URL = SHOWDOWN_SPRITE_BASE;
export const SHOWDOWN_GEN5_BASE = 'https://play.pokemonshowdown.com/sprites/gen5/';
export const SHOWDOWN_GEN5_INDEX_URL = SHOWDOWN_GEN5_BASE;
export const PLACEHOLDER = 'assets/sprites/placeholder.svg';

export const NAME_ALIASES = {
  Manetric: 'manectric',
  'Mega Manetric': 'manectric-mega',
  'Mega Meowstic': 'meowstic-mmega',
  'Mr. Rime': 'mrrime',
  'Tauros (Paldean - Combat)': 'tauros-paldeacombat',
  'Tauros (Paldean - Blaze)': 'tauros-paldeablaze',
  'Tauros (Paldean - Aqua)': 'tauros-paldeaaqua',
};

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-|-$/g, '');
}

export function baseSpeciesName(name) {
  return name.replace(/\s*\([^)]*\)\s*/g, '').replace(/^Mega\s+/i, '').trim();
}

export function speciesKeyFromPokedexId(pokedexId) {
  return '#' + String(pokedexId).replace(/-M$/i, '').replace(/^#?/, '').padStart(4, '0');
}

export function dexNumber(pokedexId) {
  return String(pokedexId).replace(/-M$/i, '').replace(/^#?/, '').padStart(4, '0');
}

export function buildId(pokedexId, name, counters) {
  const num = dexNumber(pokedexId);
  const isMega = String(pokedexId).endsWith('-M');

  if (/mega charizard y/i.test(name)) return `${num}-m-y`;
  if (/mega charizard x/i.test(name)) return `${num}-m-x`;
  if (isMega) return `${num}-m`;

  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const form = paren[1].toLowerCase();
    if (form.includes('alolan')) return `${num}-alola`;
    if (form.includes('galarian')) return `${num}-galar`;
    if (form.includes('hisuian')) return `${num}-hisui`;
    if (form.includes('paldean')) {
      if (form.includes('combat')) return `${num}-p-combat`;
      if (form.includes('blaze')) return `${num}-p-blaze`;
      if (form.includes('aqua')) return `${num}-p-aqua`;
      return `${num}-paldea`;
    }
    if (form.includes('female')) return `${num}-female`;
    if (/\bmale\b/.test(form) || form === 'male') return `${num}-male`;
    if (form.includes('wash')) return `${num}-wash`;
    if (form.includes('heat')) return `${num}-heat`;
    if (form.includes('mow')) return `${num}-mow`;
    if (form.includes('fan')) return `${num}-fan`;
    if (form.includes('frost')) return `${num}-frost`;
    if (form.includes('midnight')) return `${num}-midnight`;
    if (form.includes('midday')) return `${num}-midday`;
    if (form.includes('dusk')) return `${num}-dusk`;
    if (form.includes('small')) return `${num}-small`;
    if (form.includes('medium')) return `${num}-medium`;
    if (form.includes('large')) return `${num}-large`;
    if (form.includes('jumbo')) return `${num}-jumbo`;
    if (form.includes('eternal')) return `${num}-eternal`;
    const slug = slugify(form);
    return `${num}-${slug}`;
  }

  const key = num;
  counters[key] = (counters[key] || 0) + 1;
  if (counters[key] > 1) return `${num}-${counters[key]}`;
  return num;
}

export function guessShowdownSpriteIds(name, isMega, apiSlug) {
  const candidates = [];
  if (apiSlug) candidates.push(apiSlug);

  const alias = NAME_ALIASES[name];
  if (alias) candidates.push(alias);

  if (/mega charizard y/i.test(name)) candidates.push('charizard-megay');
  else if (/mega charizard x/i.test(name)) candidates.push('charizard-megax');
  else if (isMega) {
    const base = slugify(baseSpeciesName(name));
    if (base === 'meowstic') candidates.push('meowstic-mmega', 'meowstic-fmega');
    candidates.push(`${base}-mega`);
  }

  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const form = paren[1].toLowerCase();
    const base = slugify(baseSpeciesName(name));
    if (form.includes('alolan')) candidates.push(`${base}-alola`);
    else if (form.includes('galarian')) candidates.push(`${base}-galar`);
    else if (form.includes('hisuian')) candidates.push(`${base}-hisui`);
    else if (form.includes('paldean')) {
      if (form.includes('combat')) candidates.push(`${base}-paldeacombat`);
      else if (form.includes('blaze')) candidates.push(`${base}-paldeablaze`);
      else if (form.includes('aqua')) candidates.push(`${base}-paldeaaqua`);
    } else if (form.includes('female')) {
      if (base === 'basculegion') candidates.push('basculegion-f');
      else if (base === 'meowstic') candidates.push('meowstic-f');
      else candidates.push(`${base}-f`, `${base}-female`);
    } else if (/\bmale\b/.test(form) || form === 'male') {
      if (base === 'basculegion') candidates.push('basculegion');
      else if (base === 'meowstic') candidates.push('meowstic');
      else candidates.push(base, `${base}-male`);
    } else if (form.includes('midday')) candidates.push(base);
    else if (form.includes('midnight')) candidates.push(`${base}-midnight`);
    else if (form.includes('dusk')) candidates.push(`${base}-dusk`);
    else if (form.includes('small')) candidates.push(`${base}-small`);
    else if (form.includes('medium')) candidates.push(base, `${base}-medium`);
    else if (form.includes('large')) candidates.push(`${base}-large`);
    else if (form.includes('jumbo')) candidates.push(`${base}-super`);
    else if (form.includes('eternal')) candidates.push(`${base}-eternal`);
    else if (form.includes('wash')) candidates.push(`${base}-wash`);
    else if (form.includes('heat')) candidates.push(`${base}-heat`);
    else if (form.includes('mow')) candidates.push(`${base}-mow`);
    else if (form.includes('fan')) candidates.push(`${base}-fan`);
    else if (form.includes('frost')) candidates.push(`${base}-frost`);
    else candidates.push(`${base}-${slugify(form.replace(/\s*-\s*/g, ' '))}`);
  }

  if (!isMega && !paren) {
    candidates.push(slugify(baseSpeciesName(name)));
    if (apiSlug) candidates.push(slugify(apiSlug.replace(/-/g, ' ')));
  }

  return [...new Set(candidates.filter(Boolean))];
}

function resolveInAni(candidates, aniIndex) {
  for (const id of candidates) {
    if (aniIndex.has(id)) {
      return { id, url: SHOWDOWN_SPRITE_BASE + id + '.gif', source: 'ani' };
    }
  }
  return null;
}

function resolveInGen5(candidates, gen5Index) {
  for (const id of candidates) {
    if (gen5Index.has(id)) {
      return { id, url: SHOWDOWN_GEN5_BASE + id + '.png', source: 'gen5' };
    }
  }
  return null;
}

/**
 * Résolution Showdown : ani (GIF) puis gen5 (PNG statique), avec repli forme de base.
 */
export function resolveShowdownSpriteFull(name, isMega, aniIndex, gen5Index, apiSlug) {
  const candidates = guessShowdownSpriteIds(name, isMega, apiSlug);

  let sprite = resolveInAni(candidates, aniIndex);
  if (sprite) return sprite;

  sprite = resolveInGen5(candidates, gen5Index);
  if (sprite) return sprite;

  if (isMega) {
    const baseCandidates = guessShowdownSpriteIds(baseSpeciesName(name), false, apiSlug);
    sprite = resolveInAni(baseCandidates, aniIndex);
    if (sprite) return { ...sprite, fallback: 'base', requestedMega: true };
    sprite = resolveInGen5(baseCandidates, gen5Index);
    if (sprite) return { ...sprite, fallback: 'base', requestedMega: true };
  }

  if (!isMega && name.includes('(')) {
    const baseCandidates = guessShowdownSpriteIds(baseSpeciesName(name), false, apiSlug);
    sprite = resolveInAni(baseCandidates, aniIndex);
    if (sprite) return { ...sprite, fallback: 'forme' };
    sprite = resolveInGen5(baseCandidates, gen5Index);
    if (sprite) return { ...sprite, fallback: 'forme' };
  }

  return null;
}

/** @deprecated Préférer resolveShowdownSpriteFull avec index ani + gen5. */
export function resolveShowdownSprite(name, isMega, spriteIndex, apiSlug) {
  const emptyGen5 = new Set();
  return resolveShowdownSpriteFull(name, isMega, spriteIndex, emptyGen5, apiSlug);
}

export async function loadShowdownSpriteIndex() {
  const html = await (await fetch(SHOWDOWN_INDEX_URL)).text();
  const ids = new Set();
  for (const m of html.matchAll(/href="\.\/([a-z0-9-]+)\.gif"/gi)) {
    ids.add(m[1].toLowerCase());
  }
  return ids;
}

export async function loadShowdownGen5Index() {
  const html = await (await fetch(SHOWDOWN_GEN5_INDEX_URL)).text();
  const ids = new Set();
  for (const m of html.matchAll(/href="\.\/([a-z0-9-]+)\.png"/gi)) {
    ids.add(m[1].toLowerCase());
  }
  return ids;
}
