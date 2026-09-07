# 🔍 Audit — LiquidBrain (dashboard « Fractal AGI Engine »)

**Date :** 2026-09-07 · **Base auditée :** `main` @ `9c9a2ef` (commit unique) · **Branche de travail :** `arena/01a07a15-liquidbrain`
**Périmètre :** 137 fichiers versionnés, ~10 700 lignes TypeScript/TSX, 12 routes API (auxquelles s'ajoutaient 13 doublons fantômes), 6 composants métier, 48 primitives UI.
**Méthode :** lecture exhaustive du code applicatif + `tsc --noEmit` + `eslint .` + `next build` + tests de fumée HTTP réels (serveur de dev + faux moteur FractalBrain sur `:8080` pour vérifier les 6 proxies).

---

## 1. Verdict

Le frontend est soigné, lisible et visuellement cohérent ; la couche « API » est un empilement de
petits proxies copier-coller. Le dépôt, lui, est un **state-dump de génération** : trois arbres en
doublon, trois composants jamais importés, `typecheck` désactivé (33 erreurs cachées), `.env`
pointant vers le disque d'une autre machine, ESLint réduit à l'impuissance, scripts shell codés pour
`/home/z/my-project`, et surtout **le moteur cognitif lui-même (Rust) n'est pas dans le dépôt**.

| Axe | Avant | Après |
|---|---|---|
| Correction (types/lint/build) | 33 erreurs TS masquées, build impossible hors-ligne | 0 erreur TS, build reproductible hors-ligne |
| Robustesse API | timeouts incohérents, erreurs avalées, `BACKEND_URL` codé en dur | client backend unique, timeouts bornés, erreurs typées et affichées |
| Fonctionnalités annoncées | Train / Sequencer / surbrillance fractale inaccessibles | branchés dans l'UI |
| Contexte de conversation | chaque message envoyé isolément, perdu au rechargement | 10 tours rejoués + persistance SQLite (best-effort) |
| Qualité | 0 test, lint muselé, doublons morts | 17 tests node:test, lint propre, doublons supprimés |

Note globale : **4/10 en l'état → 7/10 après correction**. Le point dur restant est structurel : sans
le moteur FractalBrain versionné, le produit reste une coquille d'API (voir §5.1).

---

## 2. Constats

Gravité : 🔴 bloquant · 🟠 majeur · 🟡 moyen · ⚪ mineur. Statut : ✅ corrigé ici · ⚠️ restant.

### 2.1 Code mort & doublons

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🔴 1 | **Arbre de routes fantôme** `src/app/api/api/**` : 13 fichiers *strictement identiques* (`diff -r` = 0), exposant `/api/api/agi/*` et `/api/api` | `diff -r src/app/api/agi src/app/api/api/agi` → aucune différence | ✅ supprimé |
| 🟠 5 | Deux autres doublons du même type : `prisma/prisma/schema.prisma` (identique) et `db/db/custom.db` (même md5) | `md5sum db/custom.db db/db/custom.db` | ✅ supprimés |
| ⚪ 18 | Artefacts de l'agent générateur commités : `tool-results/read_*.txt` (dump de fichier), `download/` (11 captures dont `full-page.png`, `scroll-*.png` identiques à celles de `public/screenshots`) + `download/README.md` = « Here are all the generated files. » | tailles/md5 | ✅ supprimés |
| 🟡 15 | ~120 lignes mortes dans `page.tsx` : `Home()` déstructurait 25 champs du store et redéfinissait chatInput/handleSend/handleKeyDown/refs déjà implémentés dans `ChatPanel` | ancien `src/app/page.tsx:39-135` | ✅ nettoyé |
| 🟡 15 | State de store mort : `showSettings` / `toggleSettings` jamais lus ; `zaiChatCompletion` dupliquée dans la route chat ; `Post`/`User` Prisma jamais requêtés | grep global | ✅ supprimés / consolidés (User/Post ⚠️ laissés, cf. §5.6) |

### 2.2 Chaîne de build & fiabilité

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🔴 2 | `next.config.ts` : `typescript.ignoreBuildErrors: true` → le build passait alors que le dépôt contenait **33 erreurs TS**, dont le champ `AIModel.params: number` déclaré alors que les 29 modèles du registre lui donnent une chaîne (`'550B (55B active)'`) — typage inutilisable côté `ModelSelector` | `npx tsc --noEmit` : 29 × `registry.ts` + 2 × `providers.ts` + 2 × `examples/` | ✅ types corrigés, `ignoreBuildErrors: false` ; vérifié : `next build` exécute « Running TypeScript … » et passe |
| 🔴 2 | Polices chargées via `next/font/google` → **build impossible sans accès à fonts.googleapis.com** (reproduit ici : `Turbopack build failed … Failed to fetch Geist`) ; dépendance réseau et fuite d'IP visiteur vers Google | log de build | ✅ remplacé par `geist` (next/font/local, woff2 dans `node_modules`) |
| 🟠 6 | `const BACKEND_URL = "http://127.0.0.1:8080"` recopié dans **6 routes** : la variable `FRACTALBRAIN_URL` documentée dans le README n'était lue nulle part ; timeouts hétérogènes (3 s / 5 s / 8 s / 10 s / 15 s au petit bonheur) ; `console.log` sur chaque poll | `grep -rn "BACKEND_URL" src/app/api` | ✅ `src/lib/agi/backend.ts` : `normaliseBaseUrl`, `BACKEND_TIMEOUTS`, `callBackend()` typé, `fireAndForget()` ; les 6 proxies font maintenant ~15 lignes et respectent l'env |
| 🟡 17 | `reactStrictMode: false` (masque les doubles invocations), aucun `allowedDevOrigins` (accès via un hôte de preview/diagnostic = blocage dev) | `next.config.ts` | ✅ `allowedDevOrigins` ajouté + `ignoreBuildErrors: false` |
| 🟡 16 | `.zscripts/{build,mini-services-*}.sh` codés en dur sur `/home/z/my-project` (inexistant hors de la machine de génération) + `dev.pid` (PID périmé) versionné alors que `.gitignore` ne l'exclut pas | lignes 12–13 de `build.sh` | ✅ `PROJECT_DIR` dérivé du script (surcharge possible), `*.pid` ignoré, `dev.pid` désindexé |
| ⚪ 20 | Aucun test, aucune CI, aucun conteneur : rien ne protège le registre de modèles (36 entrées maintenu à la main) ni les invariants des routes | `find -name "*.test.*"` → 0 | ✅ 17 tests `node:test` (zéro dépendance ajoutée, `npm test`) ; ⚠️ CI reste à créer (§5.2) |
| ⚪ 19 | `tsconfig.json` typecheckait `examples/` (qui importe `socket.io`, jamais installé) et aucune `exclude` de build ; `noImplicitAny: false` affaiblit `strict` | erreurs TS 1–2 ci-dessus | ✅ `exclude: examples,.next,out` ; `allowImportingTsExtensions` pour les tests |

### 2.3 Configuration & environnement

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🔴 4 | `.env` **versionné** (alors que `.gitignore` contient `.env*` — inopérant sur un fichier déjà suivi) avec `DATABASE_URL=file:/home/z/my-project/db/custom.db` : chemin absolu d'une autre machine → `prisma db push`/client cassés partout ailleurs | `git ls-files \| grep env` | ✅ désindexé (`git rm --cached`), `.env.example` ajouté, `!.env.example` dans `.gitignore`, valeur relative `file:../db/custom.db` (résolue depuis `prisma/`) |
| 🟠 4 | Couche base de données **entièrement morte** : `src/lib/db.ts` importé par personne, `ChatTurn` inexistant, persistance revendiquée par l'UI (« Memory persists across conversation ») alors que le store ne stocke rien | grep `lib/db` → 0 import | ✅ modèle `ChatTurn` + `src/lib/agi/history.ts` + `GET/DELETE /api/agi/history`, repli gracieux vérifié (`{"messages":[],"persisted":false}` sans Prisma généré) |
| 🟡 15 | `new PrismaClient({ log: ['query'] })` : spam de SQL à chaque poll en dev | `src/lib/db.ts` | ✅ `['warn','error']` / `['error']` |
| 🟡 12 | Le SDK `z-ai-web-dev-sdk` lit ses credentials **uniquement** dans `.z-ai-config` (projet, `~`, `/etc`) — ni `ZAI_API_KEY`, ni le champ optionnel promis par le README — et échoue donc par une erreur opaque ; de plus son répertoire courant doit être inscriptible/lu | `node_modules/z-ai-web-dev-sdk/dist/index.js:6-27` | ✅ support `ZAI_BASE_URL`/`ZAI_API_KEY` (même endpoint OpenAI-compatible) + message d'erreur actionnable + section README dédiée |
| ⚪ 21 | `.gitignore` ignorait `prompt`, `test`, `local-*`, `.claude` (restes d'outillage) et ne mentionnait pas `package-lock.json` alors que le projet est verrouillé avec `bun.lock` | `.gitignore` | ✅ locks étrangers + `*.pid` exclus |

### 2.4 Fonctionnalités annoncées mais inatteignables

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🟠 7 | `ControlPanel.tsx` (304 l.), `ReflectionBar.tsx` (144 l.), `Sequencer.tsx` (211 l.) — 659 lignes — **jamais importés** : le README les décrit comme l'UI principale. Consommateur direct : **Train** (`triggerTrain`) et le **Sequencer** (`runSequencerStep`) n'étaient déclenchés par aucun bouton, `/api/agi/train` et le champ `sequencerStep` étaient du code mort | grep `components/agi` → 3 imports seulement | ✅ branchés : panneau « Brain Console » (métriques + Think/Reflect/Sync + Train + résumé de réflexion) et barre de réflexion en pied de page ; `ControlPanel` débarrassé de son chat dupliqué et de son `triggerTrain('save')` aberrant |
| 🟠 8 | `setMostActiveNodes` n'était **appelé nulle part** → `mostActiveNodes` toujours `[]`, donc la surbrillance « active nodes pulse and connect in real-time » (README + `FractalSNN` + `MemoryMap`) ne s'affichait jamais | grep `setMostActiveNodes` → store uniquement | ✅ algorithme d'approximation documenté (`activeNodesFromMemory`) exécuté après think/step de séquence |
| 🟠 9 | Chat **sans contexte** : la route n'envoyait que le message courant (`messages: [system, user]`) — aucun historique, alors que le store appelait l'API « chat » en boucle ; et la réponse `⚠️ Model error` était **affichée comme une réponse légitime de l'assistant** dans le fil (et donc rejouée au modèle au tour suivant) | ancien `chat/route.ts:96-115` | ✅ 10 derniers tours rejoués (tronqués à 600 caractères), erreurs non persistées (502), UI alignée |
| 🟠 10 | Gestion d'erreurs mensongère : `sendChat` affichait « Connection lost. Attempting to reconnect… » (aucune reconnexion implémentée) quel que soit l'échec ; `fetchMemory`/`triggerThink`/`triggerReflect` avalaient tout en `catch {}` ; les clés/erreurs fournisseur n'étaient jamais visibles | `store.ts` (catch vides) | ✅ le client propage `error` du JSON de la route, bandeau d'erreur dédié (`chatError`, `imageError`), statut en ligne seulement si la panne est transport |
| 🟡 13 | Polling permanent : `/state` toutes les 3 s **et** `/memory` toutes les 5 s même moteur éteint (2 requêtes/3 s vers un port fermé, en continu), sans pause onglet caché ; `fetchMemory` marquait `isOnline: true` sur un simple succès du proxy | `page.tsx` effets | ✅ `connect()` au montage, `memory` conditionné à `isOnline`, `visibilityState` respecté, `isOnline` dérivé du `status` réel |
| 🟡 11 | `imageGeneration` / `textToSpeech` / `safetyCheck` ignoraient `model.provider` et forçaient l'endpoint NVIDIA (un modèle `minimax`/`z-ai` dans ces catégories aurait été envoyé chez NVIDIA) ; le fournisseur `minimax` déclaré dans `PROVIDERS` n'est utilisé par **aucun** modèle du registre | `providers.ts:280-310` | ✅ résolution par `apiKeyName` + erreur explicite « not implemented for provider X » ; invariants de registre testés |
| ⚪ 19 | README en décalage : URL de clone `github.com/Liquid2HQ/LiquidBrain` (inexistante), table de modèles fantaisiste (GLM-5.1-Flash, Mixtral, MiniMax-Text-01/abab6.5s — absents du registre), pipeline dans un ordre qui ne correspond pas au code, stack annoncée « Framer Motion, Recharts » sans usage applicatif | README avant | ✅ réaligné sur le registre + nouvelles sections (persistance, env, commandes de dev) |

### 2.5 Qualité logicielle & robustesse

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🟡 14 | ESLint : **27 règles passées à `"off"`**, dont `no-unused-vars`, `no-unreachable`, `no-fallthrough`, `react-hooks/exhaustive-deps` — le lint ne pouvait plus rien signaler ; `eslint.config.mjs` calculait `__dirname` sans s'en servir | `eslint.config.mjs` | ✅ nettoyage (règles vendored isolées dans un override, faux positifs a11y traités à la source par un alias `Image as ImageIcon`) ; `npx eslint .` → 0 problème. Les 27 coupures restent ⚠️ une dette assumée (§5.6) |
| 🟡 14 | `useIsMobile()` écrivait son état dans un `useEffect` (`react-hooks/set-state-in-effect`, 2 erreurs lint) → rendu en cascade sur tous les composants sidebar | `src/hooks/use-mobile.ts` | ✅ réécrit en `useSyncExternalStore` (comportement identique, un seul rendu) |
| ⚪ | `pipeline` triait **en place** le tableau `concepts` renvoyé par le backend (mutation d'une donnée d'appel) et `memory.concepts.sort()` faisait de même dans la sidebar à chaque rendu | `chat/route.ts:53`, `page.tsx` | ✅ copies défensives + test de non-mutation |
| ⚪ | Clés de React par index (`key={i}`) sur la liste de chat, `aria-label` absents des boutons icône, `<img>` sans `alt` dans `ModelSelector` | — | ✅ corrigés |
| 🟡 22 | 42 des 48 primitives `components/ui/**` ne sont importées par aucune ligne applicative ; ~15 dépendances runtime ne sont importées nulle part (`@dnd-kit/*`, `@mdxeditor/editor`, `@tanstack/react-query`, `next-auth`, `next-intl`, `react-markdown`, `react-syntax-highlighter`, `sharp`, `zod`, `uuid`, `framer-motion`, `date-fns`, `@hookform/resolvers`, `@reactuses/core`, `input-otp`…) | script d'analyse d'imports | ⚠️ restant : le retrait casse les primitives vendored qui les importent (cf. §5.6) |
| 🟠 24 | Le moteur **FractalBrain (Rust)** — qui implémente perceive/think/reflect/memory/train, les embeddings complexes, le LSH et la méta-cognition — est un service externe **absent du dépôt** : `mini-services/` ne contient qu'un `.gitkeep`, et aucun contrat (OpenAPI/types) n'est versionné | `ls mini-services` → `.gitkeep` | ⚠️ restant : c'est le principal risque produit (§5.1) |

### 2.6 Sécurité

| # | Constat | Preuve | Statut |
|---|---|---|---|
| 🟠 21 | **Clés API stockées en clair dans `localStorage`** puis relayées dans le *body* de chaque requête (`apiKeys: {…}`) : lisibles par toute XSS, visibles dans le devtools, et susceptibles d'atterrir dans les logs d'un reverse-proxy. Le champ est bien `type="password"` dans l'UI, le stockage ne l'est pas. | `store.ts` (`setApiKey` → `localStorage`), `api.ts` (`chat()` envoie `apiKeys`) | ⚠️ restant — mitigations proposées en §5.3 (variables serveur prioritaires, session signée, non-réémission au client) |
| 🟡 21 | Une clé enregistrée depuis l'UI ne pouvait **jamais être retirée** : `handleSaveKeys` ignorait les champs vides (`if (value.trim())`), donc effacer le champ puis « Save Keys » laissait la clé en place. | `ModelSelector.tsx` (`handleSaveKeys`) | ✅ le champ vide supprime la clé (store **et** `localStorage`) + mention explicite du stockage sous le bouton |
| 🟡 21 | Aucune authentification ni rate-limit : `/api/agi/chat` (et image / tts / safety / vision) sont des **proxys ouverts** vers les fournisseurs — quiconque atteint le déploiement consomme les clés du serveur ; le `console.error` du message d'erreur upstream peut fuiter des fragments de réponse dans les logs. | routes `chat`/`image`/`tts`/`safety`/`vision` (aucun garde-fou) | ⚠️ restant (§5.3) |
| 🟡 21 | `AbortSignal.timeout` absent de l'appel « fire-and-forget » de think ; les GET `/state` et `/memory` laissaient le cache de données de Next s'appliquer. | anciens `state/route.ts`, `chat/route.ts` | ✅ timeout borné (5 s), fetch sortant `cache: "no-store"`, `dynamic = "force-dynamic"` + `revalidate = 0` sur les proxies en lecture |
| ⚪ 21 | Aucun `Content-Security-Policy`, `X-Frame-Options` ni en-tête de sécurité dans `next.config.ts` ; `robots.txt` présent mais aucune politique de non-indexation de l'API. | `next.config.ts`, `public/robots.txt` | ⚠️ restant (§5.3) |
| ⚪ 21 | `.env` était versionné (§2.3) : dans un dépôt public, tout secret futur y atterrirait par inadvertance. | `git show HEAD --stat` listait `.env` | ✅ corrigé (`git rm --cached` + `.env.example`) |

---

## 3. Ce qui a été livré

**Nouvelle couche serveur partagée**
- `src/lib/agi/backend.ts` — `FRACTALBRAIN_URL` (défaut `http://127.0.0.1:8080`), normalisation, timeouts par endpoint, `callBackend()` (résultat typé `ok | {status, error}`), `fireAndForget()`.
- `src/lib/agi/pipeline.ts` — PERCEIVE → RECALL → STATE réutilisable, tri non-mutant, `formatConcepts()`.
- `src/lib/agi/history.ts` + `prisma/schema.prisma::ChatTurn` + `src/app/api/agi/history/route.ts` — persistance best-effort (client Prisma **lazy**, donc jamais de crash si `prisma generate` n'a pas tourné).
- `src/lib/agi/types.ts` — contrat backend partagé, sortie hors du module `'use client'`.

**Routes** — `state`, `memory`, `perceive`, `think`, `reflect`, `train` réécrites sur `callBackend` (+ validation 400, bornage `cycles` 1–50) ; `chat` refactorée (contexte rejoué, 502 explicite, persistance, pas de fausse réponse « poetry mode ») ; `image`, `tts`, `safety`, `vision` cohérentes ; `models` inchangée.

**Fournisseurs** — `providers.ts` : résolution de clé par `apiKeyName`, erreurs typées par provider, normalisation unique des réponses (`normalise`), chemin Z-AI env + SDK avec message actionnable.

**UI** — `page.tsx` réorganisé (colonnes contenu/console, barre de réflexion, `Esc` ferme la couche active, bouton de fermeture visible sur mobile dans la vue fractale, bandeaux d'erreur, bouton *Clear*, indicateur de persistance, poll conditionné) ; `ControlPanel` recentré sur la console du cerveau ; `Sequencer`/`ReflectionBar` rendus atteignables ; `store.ts` réécrit (sélecteurs, `connect()`, `chatError`, `clearChat`, surbrillance des nœuds, nettoyage des clés vides, choix de modèle mémorisé) ; `use-mobile.ts` en `useSyncExternalStore` ; alias `Image as ImageIcon`.

**Qualité** — `src/lib/models/registry.test.ts` (9 tests d'invariants de données), `src/lib/agi/backend.test.ts` (3), `src/lib/agi/pipeline.test.ts` (4) ; `scripts/ts-resolve-hooks.mjs` pour exécuter le TS du src tel quel sous `node --test` ; scripts `typecheck` / `test` / `check` / `postinstall` (non-bloquant) ; ESLint et `tsconfig` resserrés ; `next.config.ts` sans `ignoreBuildErrors` ; polices auto-hébergées.

**Scripts** — `dev` bind désormais `0.0.0.0` (les conteneurs/hôtes de preview étaient injoignables
avec le bind par défaut) et `start` utilise `node` au lieu de `bun` (le runtime `bun` n'est pas garanti
sur une machine cible ; `server.js` de Next standalone est du Node standard).

**Nettoyage** — `src/app/api/api/**`, `prisma/prisma/**`, `db/db/**`, `tool-results/**`, `download/**`, `.zscripts/dev.pid` supprimés ; `.zscripts/*.sh` rendus portables ; `.env` désindexé + `.env.example` ; README réaligné.

---

## 4. Preuves de validation

```
npx tsc --noEmit      33 erreurs  →  0
npx eslint .          2 err + 4 warn  →  0 problème
npx next build        échec (Google Fonts) + typecheck désactivé
                      →  succès en 7.8 s, « Running TypeScript » inclus,
                         16 entrées de routes dont 13 /api/agi/* (plus aucune /api/api/*)
npm test              17/17 tests passés
```

Tests de fumée HTTP (serveur de dev + faux moteur FractalBrain sur `:8080`) :

| Appel | Résultat attendu & observé |
|---|---|
| `GET /api/agi/state` | `200` `{"status":"online",…,"coherence":0.72}` (proxy + env OK) |
| `GET /api/agi/memory` | `200` concepts propagés, ordre d'origine préservé |
| `POST /api/agi/think {"cycles":3}` | `200` `{"cycles_run":3,…}` (bornage appliqué) |
| `POST /api/agi/reflect` / `train` | `200` (payload du moteur propagé) |
| `POST /api/agi/train {"text":"  "}` | `400` `{"loss":-1,"error":"Training text is required"}` |
| `POST /api/agi/chat {"message":"   "}` | `400` `{"error":"A non-empty message is required"}` |
| `POST /api/agi/chat {"message":"hello brain"}` | `502` `Model error (GLM-5.1): … create .z-ai-config …` **avec** `coherence: 0.72, memory_size: 2` → pipeline PERCEIVE/RECALL/STATE prouvé exécuté |
| `GET /api/agi/history` | `200` `{"messages":[],"persisted":false}` → repli sans Prisma vérifié |
| `FRACTALBRAIN_URL=http://127.0.0.1:8099` + build standalone | `GET /api/agi/state` renvoie le moteur de `:8099` (`model: BrainOn8099`) → la variable d'environnement est bien honorée en production |
| `GET /` | `200`, rendu serveur contenant « Brain Console », « Fractal View », « Message LiquidBrain », « Ephemeral session » |

---

## 5. Reste à faire (priorisé)

1. **Versionner le moteur FractalBrain** (ou au minimum son contrat) : sans lui, Think/Reflect/Train/Memory/vue fractale restent décoratifs. Options : dossier `engine/` (Rust), ou `contracts/fractalbrain.openapi.json` + un mock TypeScript dans `mini-services/brain-mock/` (le stub utilisé pour cet audit peut servir de base) + tests de contrat.
2. **CI GitHub Actions** : `npm ci → typecheck → lint → test → build`, avec un job `prisma generate && prisma db push` sur une base temporaire (ici le téléchargement des moteurs Prisma est bloqué par le réseau : `binaries.prisma.sh` injoignable — à vérifier côté runners).
3. **Sécurité des clés** : préférer les variables serveur, ne plus renvoyer `apiKeys` depuis le client, masquer en affichage, ajouter rate-limit + auth (next-auth est déjà dans `package.json`) dès qu'un déploiement est public, et durcir les en-têtes (`CSP`, `X-Frame-Options`).
4. **Streaming** des réponses LLM (`z-ai-web-dev-sdk` accepte `stream: true`) + bouton Stop, plutôt qu'un spinner de 30 s.
5. **Tests d'intégration UI** (Testing Library/Vitest) sur les parcours chat + console, et tests HTTP des routes avec un mock du moteur.
6. **Sortir le dépôt du template** : supprimer les ~15 dépendances runtime et les 42 primitives UI non utilisées (en bloc, avec les imports), retirer `User`/`Post` si l'auth n'arrive pas, réactiver progressivement les règles ESLint (`no-unused-vars` d'abord), trancher `next-intl` (installé, 0 usage) ou documenter l'intention FR/EN.
7. **Qualité de la persistance** : conversations multi-threads, purge automatique (`DELETE /api/agi/history?before=`), et migration propre plutôt que `db push`.
8. **Lockfile** : `bun.lock` livré ne contient pas `geist` (ajouté lors du passage des polices en
   auto-hébergé). `bun install` n'a pas pu être rejoué ici (le bac à sable rejette les certificats TLS
   du registre : `UNKNOWN_CERTIFICATE_VERIFICATION_ERROR`), donc la régénération reste à faire sur une
   machine avec `bun` fonctionnel — sinon `npm install` reste supporté.
9. **Doublons de captures** : `public/screenshots` ne garde que les 5 visuels cités par le README ; envisager un script de régénération.

---

## 6. Comment revérifier

```bash
npm install          # ou bun install
npm run check        # typecheck + lint + tests
npx next dev -p 3000 # dashboard

# sans moteur FractalBrain : /api/agi/state → 503 « Backend unreachable » (mode LLM-only)
# avec un moteur sur :8080 (ou FRACTALBRAIN_URL) : state/memory/think/reflect/train → 200
```
