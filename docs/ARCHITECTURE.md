# Multi Web Manager — Architecture

Navigateur multi-instance pour Windows 10/11 : jusqu'à 20 pages web isolées sur un mur
(écran 1) et une console d'administration (écran 2).

## 1. Vue d'ensemble

```text
┌──────────────────────────── Processus principal (Node) ────────────────────────────┐
│ Application ── ordre de démarrage : config → instances/profils/URLs → grille → mur │
│                                                                                     │
│ ConfigManager      config.json, validation zod, écriture atomique différée          │
│ SessionManager     1 profil = 1 dossier profiles/<id>/ = 1 Session Electron          │
│ InstanceManager    crée/détruit les BrowserInstance, regroupe les états (100 ms)     │
│   └ BrowserInstance  1 WebContentsView sandboxée + son état (statut, URL, zoom…)    │
│ WallController     taille fenêtre → grille (shared/layout) → place les vues          │
│ WindowManager      fenêtres mur et admin, placement, plein écran, bascule F2         │
│ IpcRouter          canaux autorisés, expéditeur vérifié, charge utile validée (zod)  │
│ DisplayManager     écrans et branchements ; mur → principal, admin → autre écran     │
│ InputController    souris : case source → coordonnées relatives → autres cases       │
│ ShortcutManager    (P5) raccourcis configurables                                     │
└───────────────┬─────────────────────────────────────────────────┬──────────────────┘
                │ IPC (preload + contextBridge)                   │ WebContentsView
┌───────────────┴──────────────┐                    ┌─────────────┴──────────────────┐
│ Interfaces React (sandbox)   │                    │ Pages web (sandbox, sans        │
│  wall.html : cadres, en-têtes│                    │ preload, sans Node, session     │
│  admin.html : dashboard      │                    │ propre à chaque instance)       │
└──────────────────────────────┘                    └────────────────────────────────┘
```

Principe clé : **le processus principal fait autorité**. Il calcule la grille, possède les
vues natives et l'état des instances ; les interfaces React n'affichent qu'un miroir
(store zustand) mis à jour par des patchs groupés.

## 2. Arborescence

`✓` = présent, `P2…P5` = phase où le fichier arrive.

```text
MultiWebManager/
├── electron.vite.config.ts        ✓ trois builds : main, preload, renderer (multi-pages)
├── tsconfig.json / .node / .web   ✓ deux projets TS : Node (main+preload) et DOM (renderer)
├── docs/ARCHITECTURE.md           ✓
├── tests/                         ✓ vitest : fonctions pures (grille, URL, écrans, coordonnées, molette)
└── src/
    ├── shared/                    code sans dépendance Electron, importable partout
    │   ├── constants.ts           ✓ MAX_INSTANCES, préréglages, dimensions du mur
    │   ├── types.ts               ✓ InstanceConfig, InstanceState, GridConfig, WallLayout…
    │   ├── layout.ts              ✓ grille automatique / manuelle, au pixel près
    │   ├── url.ts                 ✓ saisie utilisateur → URL http(s) ou recherche
    │   ├── ipc.ts                 ✓ contrat IPC typé (canaux, requêtes, événements)
    │   └── input.ts               ✓ coordonnées relatives, boutons maintenus, conversion de la molette
    ├── preload/
    │   ├── index.ts               ✓ expose window.mwm (invoke/on) limité à la liste blanche
    │   └── api.d.ts               ✓ typage de window.mwm
    ├── main/
    │   ├── index.ts               ✓ verrou d'instance unique, cycle de vie
    │   ├── Application.ts         ✓ assemblage des services, handlers IPC
    │   ├── config/                ✓ ConfigManager, schema (zod), defaults
    │   ├── sessions/              ✓ SessionManager, SessionCookieStore (cookies de session gardés) ;
    │   │                            P4 : ProfileService (créer, renommer, reset, supprimer)
    │   ├── instances/             ✓ BrowserInstance, InstanceManager (créer, supprimer, démarrer, arrêter,
    │   │                            redémarrer, nombre, même site/zoom pour toutes), HistoryStore, ids ;
    │   │                            P5 : pause = gel de page
    │   ├── storage/               ✓ secureFile (JSON chiffré DPAPI, écriture atomique)
    │   ├── wall/                  ✓ WallController (n'envoie la géométrie que si elle change)
    │   ├── windows/               ✓ appWindow (fabrique sécurisée), WindowManager (mur, admin, placement, F2)
    │   ├── displays/              ✓ DisplayManager (branchements), placement (choix des écrans, pur)
    │   ├── input/                 ✓ InputController (souris), wheelSettings ; P4 : clavier, modes Individual/Group
    │   ├── shortcuts/             ✓ appShortcuts (F2) ; P5 : ShortcutManager configurable
    │   ├── logging/               P5 Logger (fichier tournant)
    │   ├── ipc/                   ✓ IpcRouter, schemas
    │   ├── security/              ✓ hardening (webview interdit partout)
    │   └── dev/                   ✓ auto-diagnostic (npm run selftest) : selfTest, selfTestMouse,
    │                                selfTestPersistence, probeServer (site de test), osMouse
    └── renderer/
        ├── wall.html              ✓
        ├── wall/                  ✓ WallView, CellFrame, AddressBar
        ├── admin.html             ✓
        ├── admin/                 ✓ AdminView, TopBar, BroadcastPanel (toutes les instances), InstanceList,
        │                            InstanceDetails, GridSettings, DisplaySettings ; P4 : Monitoring, ProfilesPanel
        └── common/                ✓ store, ui (boutons, champs, confirmation), format, theme.css, StatusDot, icons
```

Données utilisateur (`%APPDATA%\Multi Web Manager\`) :

```text
config.json                          nombre et ordre des cases, nom, URL, zoom, active/arrêtée,
                                     grille, écrans, synchro souris, case sélectionnée
profiles/profile-01/                 cookies, localStorage, IndexedDB, cache, service workers
profiles/profile-01/mwm-session-cookies.bin   cookies de session (chiffré)
profiles/profile-02/ …
state/instance-01.bin                historique précédent/suivant + état des pages (chiffré)
```

### Reprise à l'identique après fermeture

Fermer le mur ou l'admin (ou quitter) sauvegarde tout ; au lancement suivant, chaque case
rouvre sa page, avec son historique, sa position de défilement et ses connexions.

| Élément | Mécanisme |
|---|---|
| Nombre de cases, URL, zoom, réglages | `config.json`, réécrit 0,5 s après chaque changement et à la fermeture |
| Comptes « rester connecté » | cookies persistants de Chromium, dans le dossier du profil |
| Comptes à cookie de session | Chromium les jette à la fermeture : copie chiffrée tenue à jour (`SessionCookieStore`) et remise avant la 1re requête, comme « Reprendre là où vous en étiez » de Chrome |
| Historique, défilement, formulaires | `navigationHistory.getAllEntries()` / `restore()` (50 entrées max par case) |
| localStorage, IndexedDB | dossier du profil, vidé sur disque à la fermeture |

Chiffrement : DPAPI de Windows via `safeStorage`, lié au compte Windows (même protection que
la base de cookies de Chromium). Si une case a reçu une autre adresse pendant qu'elle était
arrêtée, c'est cette adresse qui s'ouvre (historique non restauré).
Prouvé par `npm run selftest` lancé deux fois : relance avec 6 cases, case 3 connectée par
cookie de session (renvoyé au site dès la 1re requête, absent des autres cases), historique
de 4 entrées, synchro souris, zoom, sélection et grille retrouvés.

## 3. Dépendances (versions figées)

| Paquet | Version | Rôle |
|---|---|---|
| electron | 44.7.0 | Chromium + Node ; WebContentsView, Session.fromPath, sendInputEvent |
| electron-vite | 5.0.0 | build/dev des trois cibles (main, preload, renderer) |
| vite | 7.3.7 | bundler (electron-vite 5 ne supporte pas encore Vite 8) |
| react / react-dom | 19.3.0 | interfaces mur et admin |
| zustand | 5.0.15 | store avec sélecteurs fins : une instance change → une cellule redessinée |
| zod | 4.6.5 | validation de config.json et de chaque message IPC (processus principal seulement) |
| tailwindcss + @tailwindcss/vite | 4.3.3 | styles, thème sombre par variables |
| typescript | 7.0.2 | typage strict, `npm run typecheck` |
| vitest | 5.0.3 | tests unitaires |
| electron-builder | — | P5 : installateur Windows (NSIS) |
| @dnd-kit | — | P4/P5 : glisser-déposer dans l'admin |

## 4. Choix techniques

- **WebContentsView** (et non `<webview>` ni BrowserView, dépréciée) : une vue native par
  instance, posée par le processus principal dans la fenêtre du mur. Pas de recréation lors
  d'un redimensionnement : seul `setBounds` est rappelé, et seulement si la géométrie change.
- **Session.fromPath** : chaque profil vit dans `profiles/<id>/` (ce que demande la spec),
  au lieu des partitions `persist:` rangées dans `Partitions/`. Un profil est indépendant de
  l'instance qui l'utilise : on pourra réaffecter un profil à une autre case.
- **Grille calculée côté principal** (`shared/layout.ts`, fonction pure testée) : la même
  géométrie sert à placer les vues natives et à dessiner les cadres React, sans aller-retour
  de mesures DOM. Mode auto : forme dont les cellules approchent 16:10 (20 instances en
  1920×1080 → 5×4) ; mode manuel : colonnes × lignes imposées (4×5 de la spec).
- **Patchs d'état groupés** toutes les 100 ms : 20 pages qui chargent en même temps ne
  déclenchent pas des centaines de rendus React.
- **Sécurité** : `contextIsolation`, `sandbox`, `nodeIntegration: false` partout ; les pages
  web n'ont aucun preload ; les interfaces n'accèdent qu'à `window.mwm.invoke/on` sur une
  liste blanche ; le principal revérifie l'expéditeur (fenêtre de l'app, cadre principal, URL
  de l'app) puis la charge utile (zod). Navigation limitée à http(s). Permissions refusées par
  défaut (caméra, micro, position, notifications). Aucun script injecté dans les pages.
- **Liens et popups** : `target=_blank` s'ouvre dans la même instance ; une popup avec
  dimensions (OAuth, paiement) s'ouvre en vraie fenêtre qui hérite de la session.
- **Zoom par instance** : Chromium mémorise le zoom par origine ; il est réappliqué à chaque
  navigation pour rester celui de l'instance.
- **Instance arrêtée ≠ instance supprimée** : arrêtée, elle garde sa case (statut « Arrêtée »,
  bouton Démarrer) mais n'a plus de page ni de processus ; supprimée, elle quitte la grille.
  Dans les deux cas le profil reste sur le disque. Un numéro libéré est réutilisé avec son
  profil : passer de 20 à 4 puis revenir à 20 retrouve les connexions des cases 5 à 20.
- **Écrans** : mur sur l'écran principal, admin sur un autre ; choix modifiable dans l'admin
  et mémorisé par identifiant d'écran. Un écran débranché fait retomber sur ce qui existe ;
  avec un seul écran, les deux fenêtres le partagent et F2 bascule de l'une à l'autre.

### Synchronisation souris (case à cocher « Répliquer la souris sur toutes les instances »)

Pas de maître à désigner : **la source est la case sous la souris**, les cibles sont toutes
les autres cases actives.

```text
vraie souris ─▶ case source ─ before-mouse-event ─┐
vraie molette ─▶ WM_MOUSEWHEEL (hookWindowMessage du mur) ─┤
                                                           ▼
InputController  1. relatif     rx = x / largeurSource, ry = y / hauteurSource
                 2. cibles      toutes les cases actives sauf la source
                 3. convertir   x = round(rx × largeurCible), y = round(ry × hauteurCible)
                 4. envoyer     sendInputEvent(…) ; boutons maintenus ajoutés aux mouvements ;
                                mouvements regroupés à la fréquence de l'écran du mur,
                                vidés avant chaque appui/relâchement/molette (ordre exact)
```

Ce qui fonde ces choix (mesuré avec Electron 44.7, scripts d'essai hors projet) :

| Question | Mesure | Choix |
|---|---|---|
| Un événement injecté redéclenche-t-il `before-mouse-event` ? | oui, **pendant** l'appel (50/50, 0 après) | drapeau `dispatching` : anti-boucle exact, sans délai |
| Injection vers une fenêtre sans focus ? | fonctionne (clic reçu) | pas de vol de focus |
| Coordonnées avec zoom 150 % | x=150 injecté → clientX 100 | coordonnées de vue, indépendantes du zoom |
| Champs d'un vrai événement | type, x, y, bouton, clickCount, position écran ; pas de modificateurs | boutons suivis par l'application |
| Glisser sans `leftbuttondown` | aucun mousemove bouton enfoncé côté page | modificateurs de boutons ajoutés |
| Molette | aucun `before-mouse-event`, `input-event` sans delta | lecture du message Windows |
| Vrai cran de molette dans une WebContentsView | 2 événements de 100 px (200 px), 3 essais sur 3 ; injection : 1 × 100 px | 2 événements par cran vers les cibles |
| Coût de `sendInputEvent` | 9,2 µs ; la page ne traite qu'un mouvement par image | regroupement à la fréquence de l'écran |

Prouvé de bout en bout par `npm run selftest` (messages Windows postés au mur, journal tenu
par la page de test elle-même) : clic, double-clic, clic droit, glisser et molette reproduits
dans les 4 cases, au même endroit relatif à ±1 px à 125 %, exactement une fois par case
(aucune boucle) ; synchro décochée → seule la case visée réagit.

- Aucune tentative de masquer l'origine des actions ni de contourner un anti-bot.
- Le clavier et les modes Individual / Group viendront ensuite (même contrôleur).

## 5. Limitations Electron / Chromium

**Établies** (documentation Electron 44 ou mesure) :

1. **Les vues natives passent au-dessus du HTML.** Rien de l'interface React ne peut
   recouvrir une page : libellés et statuts vivent dans l'en-tête de cellule ; le
   glisser-déposer pour réordonner se fera dans l'admin (ou dans un mode édition qui masque
   les vues et affiche des captures `capturePage`).
2. **`sendInputEvent` et le focus** : la doc Electron exige une fenêtre focalisée, mais la
   mesure montre que la souris injectée fonctionne sans (clic reçu fenêtre inactive). Le
   clavier reste à mesurer.
3. **Mémoire** — mesuré (`npm run selftest`, page DuckDuckGo) :

   | | processus de rendu | mémoire de rendu | total |
   |---|---|---|---|
   | 4 instances (phase 1) | 5 | 545 Mo | 812 Mo |
   | 20 instances (2 mesures) | 22 (20 pages + mur + admin) | 3,10 – 3,12 Go | 3,51 – 3,52 Go |

   Soit ≈ 150 Mo par page légère. Un site lourd (webmail, réseau social) coûte 300 à 500 Mo :
   20 sites lourds demandent 8 à 10 Go. Les 16 pages ajoutées pour passer de 4 à 20 sont
   chargées en 3,1 s (profils neufs) puis 0,9 s (cache rempli).
4. **Caches séparés = téléchargements répétés.** L'isolation exigée interdit de partager le
   cache HTTP entre profils : une ressource commune est téléchargée par chaque profil. Le
   levier de performance est la pause/l'arrêt des instances inactives, pas le partage.
5. **Widevine absent** : les sites à DRM (Netflix, Disney+, Spotify web) ne lisent pas.
6. **Molette deux fois plus rapide que Chrome** dans les cases : un cran fait défiler 200 px
   (Chrome : 100 px), car Electron livre deux fois chaque cran à une WebContentsView. Les
   cibles reproduisent la même distance que la source. Le test optionnel
   `npm run selftest -- --mwm-selftest-real-wheel` (curseur déplacé ~0,2 s) le vérifie avec
   un vrai cran et échouera si une version d'Electron change ce comportement.
7. **Non reproduit par la synchro souris** : Maj/Ctrl + clic (les événements souris
   d'Electron ne portent pas les touches enfoncées ; viendra avec le clavier), défilement
   d'un pavé tactile de précision (il n'émet pas de WM_MOUSEWHEEL), mouvements relatifs des
   jeux en pointeur verrouillé.
8. **Non restauré après relance** : `sessionStorage` (propre à un onglet, Electron ne le
   restaure pas) ; un site qui expire la session côté serveur redemande la connexion.

**À vérifier par mesure dans la phase concernée :**

9. Les **éléments natifs** ne reçoivent pas les événements réinjectés : listes `<select>`
   ouvertes, sélecteurs de date, `alert/confirm`, sélecteur de fichiers, authentification
   HTTP, menus contextuels.
10. La synchro par coordonnées suppose des **pages identiques** : bannière de cookies,
   compte différent, publicité ou zoom différent → le clic tombe ailleurs. Mêmes tailles de
   cellules (garanties par la grille) et même zoom recommandés.
11. **Clavier vers une page non focalisée** et **touches mortes / AltGr** (clavier suisse
   romand : ^ ¨ ´ `, @ # sur AltGr) : comportement à mesurer en phase 4 ; repli prévu sur
   `insertText` pour le texte.
12. Certains fournisseurs (Google notamment) **refusent la connexion depuis un navigateur
   intégré**. Pas de déguisement de l'agent utilisateur prévu.
13. **Suppression d'un profil en cours d'usage** : Windows verrouille les fichiers d'une
    session ouverte ; la suppression sera différée au prochain démarrage.
14. **Écrans à échelles différentes** (100 % / 150 %) : tout est en pixels indépendants
    (DIP), avec recalcul à chaque changement d'écran. Testé sur deux écrans à 100 %
    (1920×1080 + 1920×1200) ; le cas d'échelles différentes reste à vérifier sur une telle
    configuration.
15. **Raccourcis en conflit avec les pages** : Ctrl+A (tout sélectionner) et Échap (fermer
    une modale) servent aussi aux pages. Proposition : ces deux raccourcis agissent quand le
    focus est dans l'admin ; dans une page, ils restent ceux de la page. F2 (bascule mur ⇄
    admin) est déjà intercepté partout : les pages ne le reçoivent plus. Éviter Ctrl+Alt
    (= AltGr sur clavier suisse) dans les futurs raccourcis.
16. **Mur caché par l'admin (un seul écran)** : Chromium détecte les fenêtres masquées et
    ralentit leurs pages (minuteries, animations). Comportement normal d'économie, à mesurer.

## 6. Phases

| Phase | Contenu | État |
|---|---|---|
| 1 | Electron + React + TS, fenêtre mur, 4 instances, grille dynamique, URL par instance, sessions séparées et persistantes | ✓ |
| 2 | 20 instances, mur/admin sur deux fenêtres, détection du 2e écran, bascule mono-écran, mesure mémoire à 20 | ✓ |
| 3 | InputController, souris synchronisée (clic, double-clic, droit, glisser, molette), coordonnées relatives, mode « toutes » ; même site et même zoom pour toutes ; reprise à l'identique après fermeture | ✓ (modes Individual/Group à venir) |
| 4 | Clavier, molette, glisser, monitoring complet, gestion des profils | |
| 5 | Raccourcis, optimisation (pause = gel de page), journaux, erreurs, installateur Windows | |
