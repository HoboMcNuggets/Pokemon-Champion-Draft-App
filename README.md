# Draft Pokémon (stream)

Application HTML / JavaScript pour animer un draft Pokémon à 8 joueurs (bans et draft en snake, visuel stream).

## Démarrage

1. Ouvrir `index.html` dans le navigateur (double-clic ou serveur local).
2. Le Pokédex se charge via `js/pokemon-pokedex-data.js` (ou `data/pokemon-pokedex.json` si vous utilisez un serveur HTTP).
3. Renommer les joueurs dans la grille (mode **Tableau de bord**), passer en **Stream**, puis **Démarrer le draft**.

## Onglets (mode Tableau de bord)

- **Tableau de bord** : grille des 8 joueurs (noms éditables, équipes modifiables), suivi des bans et picks. À la fin du draft : récapitulatif (types, stats par joueur, durée) puis **Nouveau draft** (avec confirmation).
- **Pokédex** : liste complète (~1300 Pokémon), stats, types, habiletés, BST, recherche et filtres Actif / Inactif. Clic sur une ligne pour afficher le détail (stats + abilities).
- **Configuration** : durée du timer par tour (minutes et secondes, mode Stream), thème de couleur, export / import JSON du draft, réinitialisation du draft.

## Flux bans + draft

1. **Phase bans** (16 bans) : chaque joueur bannit 2 Pokémon. **Tour 1** : J1→J8, **tour 2** : J1→J8 (ordre linéaire, pas de snake).
2. **Phase draft** (64 picks, snake) : 8 tours de 8 picks. Ordre alterné comme les bans (aller / retour).
3. Les Pokémon bannis et draftés disparaissent du pool de recherche (même `speciesKey` pour base / méga).

Le joueur **En cours** est imposé : pas de choix manuel du destinataire.

## JSON Pokédex

Fichier principal : `data/pokemon-pokedex.json`. Modèle réduit : `data/pokemon-pool.example.json`.

Champs obligatoires : `pokedexId`, `id`, `name`, types, stats, `spriteUrl`, `enabled`, `speciesKey`, `isMega`, `abilities`.

- `abilities` : tableau de 1 à 3 objets `{ "name": "Overgrow", "isHidden": false }` (noms anglais, `isHidden: true` pour le talent caché).
- `enabled: true` → éligible au draft (pool Champions).
- `enabled: false` → visible dans le Pokédex, exclu du draft.
- Même `speciesKey` pour base / méga / régional → une sélection retire toute la famille.

### Régénérer le Pokédex

```bash
node scripts/build-pokedex.mjs
```

Après génération du JSON, le fichier embarqué pour `file://` est produit automatiquement.

Pour réappliquer uniquement les noms et le statut actif du pool Champions (sans rappeler PokeAPI) :

```bash
node scripts/patch-pokedex-active.mjs
```

Pour régénérer le JS embarqué seul :

```bash
node scripts/json-to-pokedex-js.mjs
```

Sources : [PokeAPI](https://pokeapi.co/) (stats et habiletés via `/pokemon` + `/ability`), sprites Pokémon Showdown (animés) avec repli artwork PokeAPI. Les Pokémon actifs du fichier `data/pokemon-pool.champions-s1.json` sont marqués `enabled: true`.

## Modes Tableau de bord / Stream

En haut de l'écran, basculez entre **Tableau de bord** (opérateur) et **Stream** (layout OBS). Le choix est mémorisé dans le navigateur.

**Tableau de bord** :

- Onglets Tableau de bord, Pokédex et Configuration
- Grille des joueurs : clic sur un nom pour le renommer, clic sur un emplacement pour choisir ou retirer un Pokémon
- Draft terminé : récapitulatif complet dans le panneau central

**Stream** :

- 4 joueurs à gauche, 4 à droite (zone caméra + grille 8 Pokéballs / sprites en 4 colonnes)
- Centre : Pokémon sélectionné, avec stats en barres et habiletés en dessous
- Bas : liste globale des bannis (toujours visible, y compris à la fin du draft) ; récapitulatif au-dessus lorsque le draft est terminé
- Sous la recherche : **Bannir** (phase bans) ou **Choisir** (phase draft) + retour arrière
- Timer par tour : durée réglable dans l’onglet Configuration (appliquée au prochain tour)

## Raccourcis (mode Stream)

- **Entrée** : bannir ou sélectionner selon la phase active
- **Échap** : désélectionner (ou fermer le sélecteur d'emplacement en Tableau de bord)
- **Ctrl+Z** ou **Retour arrière** : annuler la dernière action

## Tests

```bash
node scripts/test-state.mjs
```

## Persistance

`localStorage` : clé `pokemonDraft.v1` (draft), `pokemonDraft.theme` (thème), `pokemonDraft.timerDurationSec` (durée du timer, 10–600 s), `pokemonDraft.viewMode` (tableau de bord / stream). Le Pokédex complet n'est pas mis en cache (trop volumineux).
