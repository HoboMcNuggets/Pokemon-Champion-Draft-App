/**
 * Onglet Pokédex — liste complète et stats JSON.
 */
(function (global) {
  const PLACEHOLDER = 'assets/sprites/placeholder.svg';

  function typeClass(type) {
    return global.TypeDisplay?.typeClass(type) ?? '';
  }

  function renderTypeBadge(type) {
    if (!type || !global.TypeDisplay) return '';
    return global.TypeDisplay.renderBadge(type, { variant: 'badge' });
  }

  function renderAbilitiesCell(pokemon) {
    const abilities = pokemon?.abilities;
    if (!Array.isArray(abilities) || abilities.length === 0) {
      return '<td class="pokedex-table__abilities"><span class="pokedex-table__empty">—</span></td>';
    }
    const lines = abilities
      .map((ability) => {
        const label = global.PokemonSpecies.formatAbilityName(ability);
        if (!label) return '';
        const hiddenClass = ability.isHidden ? ' pokedex-table-ability--hidden' : '';
        return `<span class="pokedex-table-ability${hiddenClass}">${escapeHtml(label)}</span>`;
      })
      .filter(Boolean)
      .join('');
    return `<td class="pokedex-table__abilities"><div class="pokedex-table-abilities">${lines}</div></td>`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function spriteImg(pokemon) {
    return global.SpriteImg.tag(pokemon.spriteUrl || PLACEHOLDER, {
      alt: pokemon.name,
      loading: 'lazy',
    });
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

  function renderTable(container, list, selectedId) {
    const rows = list
      .map((p) => {
        const rowClass = [
          !p.enabled ? 'row-inactif' : '',
          selectedId === p.id ? 'pokedex-row--selected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const bst = global.PokemonSpecies.getBaseTotal(p);
        const statutCol = p.enabled ? 'Actif' : 'Inactif';
        const megaCol = p.isMega ? 'Oui' : '—';
        return `<tr class="${rowClass}" data-pokemon-id="${escapeAttr(p.id)}">
          <td>${escapeHtml(p.pokedexId)}</td>
          <td>${spriteImg(p)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${renderTypeBadge(p.type1)}</td>
          <td>${renderTypeBadge(p.type2 || '')}</td>
          ${renderAbilitiesCell(p)}
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
            <th>Habileté</th>
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

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderDetailPanel(pokemon) {
    if (!pokemon) return '';
    const bst = global.PokemonSpecies.getBaseTotal(pokemon);
    const statRows = [
      { label: 'BST', value: bst },
      { label: 'PV', value: pokemon.hp },
      { label: 'Attaque', value: pokemon.attack },
      { label: 'Défense', value: pokemon.defense },
      { label: 'Atq. Spé.', value: pokemon.spAtk },
      { label: 'Déf. Spé.', value: pokemon.spDef },
      { label: 'Vitesse', value: pokemon.speed },
    ]
      .map(
        (s) =>
          `<div class="pokedex-stats-grid__item"><span class="pokedex-stats-grid__label">${s.label}</span><span class="pokedex-stats-grid__value">${s.value}</span></div>`
      )
      .join('');
    const abilitiesHtml = global.PokemonSpecies.renderAbilitiesList(pokemon, {
      listClass: 'ability-list',
      itemClass: 'ability-list__item',
      hiddenClass: 'ability-list__item--hidden',
    });
    return `
      <div class="pokedex-detail">
        <div class="pokedex-detail__header">
          <div class="pokedex-detail__sprite">${spriteImg(pokemon)}</div>
          <div class="pokedex-detail__title">
            <h3>${escapeHtml(pokemon.name)}</h3>
            <div class="pokedex-detail__dex">${escapeHtml(pokemon.pokedexId)}</div>
            <div class="pokedex-detail__types">
              ${renderTypeBadge(pokemon.type1)}
              ${renderTypeBadge(pokemon.type2 || '')}
            </div>
          </div>
        </div>
        <div class="pokedex-detail__stats">
          <h4>Statistiques</h4>
          <div class="pokedex-stats-grid">${statRows}</div>
        </div>
        <div class="pokedex-detail__abilities">
          <h4>Abilities</h4>
          ${abilitiesHtml || '<p class="pokedex-detail__empty">Aucune habileté.</p>'}
        </div>
      </div>`;
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

    const selectedId = uiState.pokedexSelectedId || null;
    const selectedPokemon = selectedId
      ? list.find((p) => p.id === selectedId) || pool.find((p) => p.id === selectedId)
      : null;

    contentEl.innerHTML = '<div class="pokedex-table-wrap"></div>';
    renderTable(contentEl.querySelector('.pokedex-table-wrap'), list, selectedPokemon?.id || null);

    if (selectedPokemon) {
      contentEl.insertAdjacentHTML('beforeend', renderDetailPanel(selectedPokemon));
    }
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
      if (th) {
        onChange(e, { sortKey: th.dataset.sort });
        return;
      }
      const row = e.target.closest('tr[data-pokemon-id]');
      if (row) {
        onChange(e, { pokemonId: row.dataset.pokemonId });
      }
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
