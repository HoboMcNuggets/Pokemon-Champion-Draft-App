/**
 * Correspondance pool Champions ↔ entrées PokeAPI (noms, alias).
 */
export const MATCH_ALIASES = [
  ['manectric', 'manetric'],
  ['mega manectric', 'mega manetric'],
  ['tauros (paldean combat)', 'tauros (paldean - combat)'],
  ['tauros (paldean blaze)', 'tauros (paldean - blaze)'],
  ['tauros (paldean aqua)', 'tauros (paldean - aqua)'],
  ['palafin (zero)', 'palafin'],
];

/** Noms actifs forcés même si enabled:false dans champions-s1 (historique). */
export const FORCE_ACTIVE_NAMES = ['palafin'];

export function normalizeKey(name) {
  let k = String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [a, b] of MATCH_ALIASES) {
    if (k === a) k = b;
    if (k === b) k = b;
  }
  return k;
}

export function findChampionsMatch(pokemon, old) {
  const oldKey = normalizeKey(old.name);
  const idx = pokemon.findIndex((p) => {
    if (p.id === old.id) return true;
    if (normalizeKey(p.name) === oldKey) return true;
    if (
      p.pokedexId === old.pokedexId &&
      normalizeKey(p.name) === oldKey
    ) {
      return true;
    }
    if (
      old.speciesKey &&
      p.speciesKey === old.speciesKey &&
      normalizeKey(p.name) === oldKey
    ) {
      return true;
    }
    return false;
  });
  return idx;
}

export function applyChampionsOverlay(entry, old) {
  entry.enabled = true;
  entry.name = old.name;
  entry.id = old.id;
  entry.pokedexId = old.pokedexId;
  entry.speciesKey = old.speciesKey;
  entry.isMega = old.isMega;
  if (old.type1) entry.type1 = old.type1;
  if (old.type2 !== undefined) entry.type2 = old.type2;
  if (old.spriteUrl) entry.spriteUrl = old.spriteUrl;
  if (old.baseTotal != null) entry.baseTotal = old.baseTotal;
  for (const k of ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed']) {
    if (old[k] != null) entry[k] = old[k];
  }
  return entry;
}

export function getChampionsActiveEntries(oldPool) {
  const list = oldPool.pokemon.filter((p) => p.enabled);
  for (const name of FORCE_ACTIVE_NAMES) {
    const extra = oldPool.pokemon.find((p) => normalizeKey(p.name) === normalizeKey(name));
    if (extra && !list.some((p) => p.id === extra.id)) {
      list.push({ ...extra, enabled: true });
    }
  }
  return list;
}
