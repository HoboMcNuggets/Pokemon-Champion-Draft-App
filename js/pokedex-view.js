/**
 * Onglet Pokédex — liste complète et stats JSON.
 */
(function (global) {
  const PLACEHOLDER = 'assets/sprites/placeholder.svg';

  function typeClass(type) {
    if (!type) return '';
    return 'type-' + String(type).toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e');
  }

  function renderTypeBadge(type) {
    if (!type) return '';
    const cls = typeClass(type);
    return `<span class="type-badge ${cls}">${escapeHtml(type)}</span>`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function spriteImg(pokemon) {
    const src = pokemon.spriteUrl || PLACEHOLDER;
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(pokemon.name)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">`;
  }

  function filterList(pool, filters) {
    let list = [...pool];
    list = global.PokemonSpecies.searchPokemon(list, filters.search);

    const enabledFilter = filters.enabledFilter || 'all';
    if (enabledFilter === 'active') {
      list = list.filter((p) => p.enabled === true);
    } else if (enabledFilter === 'inactive') {
      list = list.filter((p) => p.enabled === false);
    }

    const sortKey = filters.sortKey || 'name';
    const sortDir = filters.sortDir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      let va;
      let vb;
      if (sortKey === 'name') {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      }
      if (sortKey === 'baseTotal') {
        va = global.PokemonSpecies.getBaseTotal(a);
        vb = global.PokemonSpecies.getBaseTotal(b);
      } else if (sortKey === 'pokedexId') {
        va = a.pokedexId;
        vb = b.pokedexId;
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      } else {
        va = a[sortKey] ?? 0;
        vb = b[sortKey] ?? 0;
      }
      return (va - vb) * sortDir;
    });

    return list;
  }

  function renderTable(container, list) {
    const rows = list
      .map((p) => {
        const rowClass = !p.enabled ? 'row-inactif' : '';
        const bst = global.PokemonSpecies.getBaseTotal(p);
        const statutCol = p.enabled ? 'Actif' : 'Inactif';
        const megaCol = p.isMega ? 'Oui' : '—';
        return `<tr class="${rowClass}">
          <td>${escapeHtml(p.pokedexId)}</td>
          <td>${spriteImg(p)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${renderTypeBadge(p.type1)}</td>
          <td>${renderTypeBadge(p.type2 || '')}</td>
          <td><strong>${bst}</strong></td>
          <td>${p.hp}</td>
          <td>${p.attack}</td>
          <td>${p.defense}</td>
          <td>${p.spAtk}</td>
          <td>${p.spDef}</td>
          <td>${p.speed}</td>
          <td>${statutCol}</td>
          <td>${megaCol}</td>
        </tr>`;
      })
      .join('');

    container.innerHTML = `
      <table class="pokedex-table">
        <thead>
          <tr>
            <th class="sortable" data-sort="pokedexId"># Pokédex</th>
            <th>Sprite</th>
            <th class="sortable" data-sort="name">Pokémon</th>
            <th>Type 1</th>
            <th>Type 2</th>
            <th class="sortable" data-sort="baseTotal">BST</th>
            <th class="sortable" data-sort="hp">PV</th>
            <th class="sortable" data-sort="attack">Attaque</th>
            <th class="sortable" data-sort="defense">Défense</th>
            <th class="sortable" data-sort="spAtk">Atq. Spé.</th>
            <th class="sortable" data-sort="spDef">Déf. Spé.</th>
            <th class="sortable" data-sort="speed">Vitesse</th>
            <th>Statut</th>
            <th>Méga</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderHeader(headerEl, poolData, filters, list) {
    const league = poolData?.leagueName || 'Pokédex';
    const label = poolData?.poolLabel ? ` — ${poolData.poolLabel}` : '';
    const total = poolData?.pokemon?.length || 0;
    const shown = list.length;
    const enabledFilter = filters.enabledFilter || 'all';
    const countLine =
      shown === total
        ? `${total} Pokémon dans le Pokédex`
        : `${shown} affichés sur ${total} Pokémon`;

    headerEl.innerHTML = `
      <div class="pokedex-header__top">
        <div class="pokedex-header__title">
          <h2>${escapeHtml(league)}${escapeHtml(label)}</h2>
          <p>${countLine}</p>
        </div>
        <div class="pokedex-header__actions">
          <input type="search" id="pokedex-search" placeholder="Nom ou # Pokédex…" value="${escapeHtml(filters.search || '')}">
          <select id="pokedex-enabled-filter" aria-label="Filtrer par statut">
            <option value="all"${enabledFilter === 'all' ? ' selected' : ''}>Tous</option>
            <option value="active"${enabledFilter === 'active' ? ' selected' : ''}>Actif</option>
            <option value="inactive"${enabledFilter === 'inactive' ? ' selected' : ''}>Inactif</option>
          </select>
        </div>
      </div>`;
  }

  function render(root, poolData, uiState) {
    if (!root) return;
    const pool = poolData?.pokemon || [];
    const headerEl = root.querySelector('.pokedex-header');
    const contentEl = root.querySelector('.pokedex-content');

    const filters = uiState.pokedexFilters || {
      search: '',
      sortKey: 'name',
      sortDir: 'asc',
      enabledFilter: 'all',
    };

    if (!pool.length) {
      if (headerEl) {
        headerEl.innerHTML = `
          <div class="pokedex-header__top">
            <div class="pokedex-header__title">
              <h2>Pokédex</h2>
              <p>Chargement du Pokédex…</p>
            </div>
          </div>`;
      }
      if (contentEl) {
        contentEl.innerHTML = '<div class="pokedex-empty">Aucun Pokémon dans le Pokédex.</div>';
      }
      return;
    }

    const list = filterList(pool, filters);

    if (headerEl) renderHeader(headerEl, poolData, filters, list);

    const searchInput = root.querySelector('#pokedex-search');
    if (searchInput && searchInput !== document.activeElement) {
      searchInput.value = filters.search;
    }

    const filterSelect = root.querySelector('#pokedex-enabled-filter');
    if (filterSelect && filterSelect !== document.activeElement) {
      filterSelect.value = filters.enabledFilter || 'all';
    }

    if (!contentEl) return;

    if (list.length === 0) {
      contentEl.innerHTML = '<div class="pokedex-empty">Aucun résultat pour cette recherche.</div>';
      return;
    }

    contentEl.innerHTML = '<div class="pokedex-table-wrap"></div>';
    renderTable(contentEl.firstElementChild, list);
  }

  function bindFilters(root, onChange) {
    root.addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'pokedex-search') onChange(e);
    });
    root.addEventListener('change', (e) => {
      if (e.target.id === 'pokedex-enabled-filter') onChange(e);
    });
    root.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (th) onChange(e, { sortKey: th.dataset.sort });
    });
  }

  global.PokedexView = {
    PLACEHOLDER,
    typeClass,
    render,
    bindFilters,
    filterList,
  };
})(typeof window !== 'undefined' ? window : globalThis);
