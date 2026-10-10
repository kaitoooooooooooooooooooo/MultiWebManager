# Multi Web Manager

Navigateur multi-instance pour Windows 10/11 : jusqu'à **20 pages web indépendantes**
affichées en grille sur un écran (le « mur »), pilotées depuis une console d'administration
sur un second écran.

Chaque case est un vrai navigateur isolé — cookies, stockage, cache, historique et session
séparés — ce qui permet d'être connecté à 20 comptes différents en même temps, dans une
seule application.

```text
ÉCRAN 1 — le mur                          ÉCRAN 2 — l'admin
┌────┬────┬────┬────┬────┐                ┌──────────────────────────────────────┐
│ 01 │ 02 │ 03 │ 04 │ 05 │                │ MULTI WEB MANAGER     20 instances   │
├────┼────┼────┼────┼────┤                ├───────────┬──────────────────────────┤
│ 06 │ 07 │ 08 │ 09 │ 10 │                │ ● WEB 01  │ Toutes les instances     │
├────┼────┼────┼────┼────┤                │ ● WEB 02  │  même site · même zoom   │
│ 11 │ 12 │ 13 │ 14 │ 15 │                │ ● WEB 03  │  ☑ répliquer la souris   │
├────┼────┼────┼────┼────┤                │ …         │ Instance sélectionnée    │
│ 16 │ 17 │ 18 │ 19 │ 20 │                │ ● WEB 20  │ Grille · Écrans          │
└────┴────┴────┴────┴────┘                └───────────┴──────────────────────────┘
```

## Fonctionnalités

- **1 à 20 instances** en grille, automatique (cases proches du 16:10) ou colonnes × lignes
  au choix ; la grille suit la taille de la fenêtre au pixel près.
- **Isolation complète** : un profil par case (`profiles/profile-01/` …). Une action dans une
  case ne touche jamais les cookies ou la session d'une autre.
- **Souris répliquée** : une case à cocher, et tout ce que la souris fait dans la case
  survolée est reproduit au même endroit relatif dans toutes les autres — clic, double-clic,
  clic droit, glisser, molette. Pas de case « maître » à désigner.
- **Actions groupées** : ouvrir la même adresse partout, recharger tout, même zoom pour toutes.
- **Reprise à l'identique** : à la réouverture, le même nombre de cases rouvre les mêmes
  pages, connectées aux mêmes comptes, avec leur historique, leur défilement, leur zoom et
  tous les réglages.
- **Deux écrans détectés** : mur sur l'écran principal, admin sur l'autre (modifiable,
  inversable, mur en plein écran). Avec un seul écran, `F2` bascule de l'un à l'autre.
- **Gestion des instances** : ajouter, supprimer, renommer, arrêter (libère la mémoire, la
  case reste), démarrer, redémarrer, outils de développement par instance.

## Installation

Il n'y a pas encore d'installateur : l'application se lance depuis les sources.
Prérequis : Windows 10/11, [Node.js](https://nodejs.org) 22.12 ou plus récent, Git.

```bash
git clone https://github.com/kaitoooooooooooooooooooo/MultiWebManager.git
cd MultiWebManager
npm install
npm run dev
```

Le binaire d'Electron (~100 Mo) se télécharge au premier lancement.

| Commande | Effet |
|---|---|
| `npm run dev` | lance l'application, avec rechargement à chaud de l'interface |
| `npm run build` | vérifie les types puis compile dans `out/` |
| `npm run preview` | lance la version compilée |
| `npm test` | tests unitaires (grille, URL, écrans, coordonnées, molette) |
| `npm run typecheck` | TypeScript strict |
| `npm run selftest` | auto-diagnostic sur l'application réelle (voir plus bas) |

## Utilisation

### Le mur

Chaque case a un en-tête : statut (● vert connecté, ambre en chargement, rouge en erreur,
gris arrêtée), nom, précédent / suivant / recharger, et l'adresse.

- Cliquer sur l'adresse pour la modifier : URL complète, domaine nu (`wikipedia.org`) ou
  texte libre, qui lance une recherche. `Entrée` charge, `Échap` annule.
- Cliquer sur l'en-tête sélectionne la case (cadre bleu) ; l'admin affiche alors ses détails.
- Quand la souris est répliquée, tous les cadres passent à l'ambre.

### L'admin

- **Toutes les instances** — une adresse ouverte dans toutes les cases, « Recharger
  toutes », zoom commun, et la case **« Répliquer la souris sur toutes les instances »**.
  Un badge ambré en haut rappelle que la synchro est active ; un clic dessus la coupe.
- **Instances** (à gauche) — statut, nom et titre de chaque case ; « Ajouter une instance ».
- **Instance sélectionnée** — nom (cliquer pour renommer), adresse, navigation, dernier
  chargement, taille, zoom, profil, dernière erreur ; Recharger, Redémarrer, Arrêter,
  DevTools, Supprimer (avec confirmation — le profil est conservé).
- **Grille** — nombre d'instances (1, 2, 4, 6, 9, 12, 16, 20), disposition automatique ou
  manuelle, espacement, affichage des libellés et du statut.
- **Écrans** — écran du mur, écran de l'admin, inversion, mur en plein écran.

### Raccourcis

| Touche | Effet |
|---|---|
| `F2` | bascule entre le mur et l'admin |
| `F12` | outils de développement de l'interface (en mode `dev` uniquement) |

### Bien utiliser la souris répliquée

La réplication se fait par **position relative** : un clic à 30 % de la largeur et 40 % de
la hauteur d'une case est rejoué à 30 % / 40 % dans les autres. Pour qu'il tombe sur le même
bouton partout, les pages doivent être identiques : même site, **même zoom**, même état
(une bannière de cookies ou une publicité présente dans une seule case décale tout).

## Ce qui est conservé à la fermeture

Fermer le mur ou l'admin quitte l'application et sauvegarde tout dans
`%APPDATA%\Multi Web Manager\` :

| Fichier | Contenu |
|---|---|
| `config.json` | nombre et ordre des cases, nom, adresse, zoom, active ou arrêtée, grille, écrans, synchro souris, case sélectionnée |
| `profiles/profile-NN/` | cookies, localStorage, IndexedDB, cache — le profil Chromium de la case |
| `profiles/profile-NN/mwm-session-cookies.bin` | cookies de session (ceux que Chromium efface à la fermeture), chiffrés |
| `state/instance-NN.bin` | historique précédent/suivant, défilement et formulaires, chiffré |

Les deux fichiers chiffrés le sont par Windows (DPAPI) : ils ne sont lisibles que depuis le
même compte Windows, comme la base de cookies de Chrome.

Supprimer une case garde son profil : la recréer avec le même numéro retrouve ses
connexions. Pour repartir de zéro, fermer l'application et supprimer le dossier ci-dessus.

## Comment ça marche

Application [Electron](https://www.electronjs.org) 44 en TypeScript. Le processus principal
fait autorité : il possède les pages (une `WebContentsView` par case), calcule la grille et
tient l'état ; les deux interfaces React n'en affichent qu'un miroir.

```text
src/
├── shared/     types, calcul de la grille, coordonnées, contrat IPC (sans dépendance Electron)
├── preload/    seul pont entre les interfaces et le processus principal
├── main/       config, sessions, instances, mur, fenêtres, écrans, souris, IPC, sécurité, selftest
└── renderer/   wall (le mur) · admin (la console) · common (store, composants)
tests/          tests unitaires des fonctions pures
docs/           ARCHITECTURE.md
```

| Brique | Rôle |
|---|---|
| Electron 44, `WebContentsView`, `session.fromPath` | une page native et un profil sur disque par case |
| React 19, zustand, Tailwind 4 | interfaces ; une case qui change ne redessine qu'elle |
| zod | validation de `config.json` et de chaque message IPC |
| electron-vite 5, TypeScript 7, vitest | build, typage strict, tests |

Le détail — choix techniques, mesures qui les fondent, limitations — est dans
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Sécurité

- `contextIsolation`, `sandbox` et pas d'accès à Node dans toutes les pages.
- Les pages web n'ont aucun preload et aucun script n'y est injecté.
- Les interfaces n'ont accès qu'à une liste fermée de canaux IPC ; le processus principal
  revérifie l'expéditeur puis le contenu de chaque message.
- Seules les adresses `http(s)` se chargent (`javascript:`, `file:`… refusées).
- Caméra, micro, position et notifications refusés par défaut.

## Auto-diagnostic

```bash
npm run selftest
```

Lance l'application réelle dans un dossier temporaire (rien de vos données n'est touché),
vérifie 37 points et imprime un rapport JSON. Les fenêtres s'affichent environ une minute et
demie, avec un passage en plein écran. Ce qui est vérifié :

- un dossier de profil par case, et chaque case ne voit que ses propres cookies ;
- passage de 4 à 20 instances sans recréer les pages existantes ; mémoire mesurée à 20 ;
- arrêter, démarrer, redémarrer, supprimer, ajouter ; grille manuelle ; plein écran ;
- les pages web n'ont accès ni à l'application ni à Node ; requêtes IPC invalides refusées ;
- **souris répliquée de bout en bout** : de vrais messages souris Windows sont postés au mur
  (le curseur ne bouge pas) et chaque page de test rapporte ce qu'elle a reçu — exactement
  un clic par case, au même endroit à ±1 px, y compris double-clic, clic droit, glisser et
  molette ;
- **reprise** : chaque lancement laisse un état connu que le suivant doit retrouver (nombre
  de cases, réglages, une case connectée par cookie de session, son historique). Lancer la
  commande **deux fois** pour vérifier la reprise.

Options : `npm run selftest -- --mwm-selftest-fresh` repart d'un dossier vierge ;
`-- --mwm-selftest-real-wheel` ajoute un vrai cran de molette (le curseur est déplacé
environ 0,2 s au-dessus du mur : ne pas toucher la souris). Le site de test écoute sur
`127.0.0.1:47913`.

## Limites connues

- **Mémoire** : mesuré à 3,5 Go pour 20 pages légères (≈ 150 Mo par page). Des sites lourds
  (webmail, réseaux sociaux) demandent 300 à 500 Mo chacun, soit 8 à 10 Go pour 20.
- **Molette** : dans les cases, un cran fait défiler 200 px, contre 100 px dans Chrome
  (Electron livre chaque cran deux fois à ce type de vue). Les cases répliquées défilent de
  la même distance que la case source.
- **Pas encore répliqués** : le clavier, Maj/Ctrl + clic, le défilement des pavés tactiles
  de précision, les listes déroulantes natives une fois ouvertes.
- **Clic du milieu** : l'appui et le relâchement sont reproduits, mais pas l'événement
  `auxclick` ; un lien ouvert au clic du milieu ne s'ouvre donc que dans la case survolée.
- **Non restauré** à la réouverture : le `sessionStorage` ; une session expirée par le site
  lui-même redemande la connexion.
- Certains fournisseurs (Google notamment) refusent la connexion depuis un navigateur
  intégré ; les sites à DRM (Netflix, Spotify web) ne lisent pas.
- Testé sur deux écrans à 100 % ; le mélange d'échelles (100 % et 150 %) reste à vérifier.

## Feuille de route

- [x] Grille dynamique, sessions isolées et persistantes
- [x] 20 instances, fenêtre admin, détection des écrans
- [x] Souris répliquée, même site et même zoom pour toutes, reprise à l'identique
- [ ] Clavier répliqué ; modes « une seule case » et « groupe de cases »
- [ ] Aperçu en direct dans l'admin, gestion des profils (créer, renommer, réinitialiser)
- [ ] Raccourcis configurables, pause des cases inactives, journaux, installateur Windows

## Usage

L'application rejoue fidèlement les actions de l'utilisateur ; elle ne cherche ni à les
rendre indétectables ni à contourner les protections anti-robot. L'utilisation de plusieurs
comptes reste soumise aux conditions de chaque site.
