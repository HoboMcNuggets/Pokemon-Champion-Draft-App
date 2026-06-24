/**
 * Affichage des habiletés avec tooltip d'effet (index PokeAPI embarqué).
 */
(function (global) {
  const INDEX_URL = 'data/pokemon-abilities.json';
  const FALLBACK_EFFECT = 'Effect unavailable';

  let indexByName = null;
  let indexLoadPromise = null;
  let tooltipEl = null;
  let activeChip = null;
  let bound = false;

  function slugifyName(name) {
    return String(name || '')
      .trim()
      .normalize('NFKD')
      .replace(/[\u2018\u2019\u201B'`]/g, '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '-');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeIndex(data) {
    if (!data || typeof data !== 'object') return {};
    if (data.byName && typeof data.byName === 'object') return data.byName;
    return data;
  }

  function getEmbeddedIndex() {
    return normalizeIndex(global.POKEMON_ABILITY_INDEX);
  }

  async function loadIndex() {
    if (indexByName) return indexByName;

    const embedded = getEmbeddedIndex();
    if (embedded && Object.keys(embedded).length > 0) {
      indexByName = embedded;
      return indexByName;
    }

    if (indexLoadPromise) return indexLoadPromise;

    indexLoadPromise = fetch(INDEX_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        indexByName = normalizeIndex(data);
        return indexByName;
      })
      .catch(() => {
        indexByName = {};
        return indexByName;
      });

    return indexLoadPromise;
  }

  function getShortEffect(ability) {
    if (!ability) return '';
    if (typeof ability.shortEffect === 'string' && ability.shortEffect.trim()) {
      return ability.shortEffect.trim();
    }
    const slug = slugifyName(ability.name);
    const entry = indexByName?.[slug];
    if (entry?.shortEffect) return entry.shortEffect;
    return '';
  }

  function renderChip(ability, options) {
    if (!ability?.name) return '';
    const opts = options || {};
    const label = opts.label || ability.name;
    const hiddenClass = opts.hiddenClass || '';
    const chipClass = opts.chipClass || 'ability-chip';
    const slug = slugifyName(ability.name);
    const effect = getShortEffect(ability) || FALLBACK_EFFECT;

    return `<span class="${chipClass}${hiddenClass ? ` ${hiddenClass}` : ''}" data-ability-name="${escapeAttr(ability.name)}" data-ability-slug="${escapeAttr(slug)}" data-ability-effect="${escapeAttr(effect)}" tabindex="0" role="button" aria-label="${escapeAttr(`${label}: ${effect}`)}">${escapeHtml(label)}</span>`;
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ability-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(clientX, clientY) {
    if (!tooltipEl) return;
    const margin = 12;
    const rect = tooltipEl.getBoundingClientRect();
    let x = clientX;
    let y = clientY - margin;

    const halfW = rect.width / 2;
    const maxX = window.innerWidth - margin;
    const minX = margin;
    if (x - halfW < minX) x = minX + halfW;
    if (x + halfW > maxX) x = maxX - halfW;

    if (y - rect.height < margin) {
      y = clientY + margin + 16;
      tooltipEl.classList.add('ability-tooltip--below');
    } else {
      tooltipEl.classList.remove('ability-tooltip--below');
    }

    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function showTooltip(chip, clientX, clientY) {
    const tooltip = ensureTooltip();
    const name = chip.dataset.abilityName || '';
    const effect = chip.dataset.abilityEffect || FALLBACK_EFFECT;

    if (activeChip && activeChip !== chip) {
      activeChip.classList.remove('ability-chip--active');
    }
    activeChip = chip;
    chip.classList.add('ability-chip--active');

    tooltip.innerHTML = `<strong class="ability-tooltip__name">${escapeHtml(name)}</strong><span class="ability-tooltip__effect">${escapeHtml(effect)}</span>`;
    tooltip.classList.add('ability-tooltip--visible');
    tooltip.setAttribute('aria-hidden', 'false');
    positionTooltip(clientX, clientY);
  }

  function hideTooltip() {
    if (activeChip) {
      activeChip.classList.remove('ability-chip--active');
      activeChip = null;
    }
    if (!tooltipEl) return;
    tooltipEl.classList.remove('ability-tooltip--visible', 'ability-tooltip--below');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }

  function isAbilityChip(node) {
    return node?.classList?.contains('ability-chip');
  }

  function bindTooltips(root) {
    if (bound) return;
    bound = true;

    const container = root || document;

    container.addEventListener('mouseover', (event) => {
      const chip = event.target.closest('.ability-chip');
      if (!chip || !container.contains(chip)) return;
      showTooltip(chip, event.clientX, event.clientY);
    });

    container.addEventListener('mousemove', (event) => {
      const chip = event.target.closest('.ability-chip');
      if (!chip || chip !== activeChip) return;
      positionTooltip(event.clientX, event.clientY);
    });

    container.addEventListener('mouseout', (event) => {
      const chip = event.target.closest('.ability-chip');
      if (!chip || chip !== activeChip) return;
      const related = event.relatedTarget;
      if (related && related.closest && related.closest('.ability-chip')) return;
      hideTooltip();
    });

    container.addEventListener('focusin', (event) => {
      const chip = isAbilityChip(event.target) ? event.target : null;
      if (!chip || !container.contains(chip)) return;
      const rect = chip.getBoundingClientRect();
      showTooltip(chip, rect.left + rect.width / 2, rect.top);
    });

    container.addEventListener('focusout', (event) => {
      const chip = isAbilityChip(event.target) ? event.target : null;
      if (!chip || chip !== activeChip) return;
      const related = event.relatedTarget;
      if (related && chip.contains(related)) return;
      hideTooltip();
    });

    container.addEventListener('scroll', hideTooltip, true);
  }

  global.AbilityDisplay = {
    slugifyName,
    loadIndex,
    getShortEffect,
    renderChip,
    ensureTooltip,
    bindTooltips,
    hideTooltip,
  };
})(window);
