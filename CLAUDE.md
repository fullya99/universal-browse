# universal-browse - Guide d'orchestration et d'administration

Ce document est le point d'entree operateur pour orchestrer, administrer, modifier et mettre a jour le skill `universal-browse`.

## Objectif

`universal-browse` fournit:

- un daemon Playwright persistant local
- un client CLI `unibrowse`
- un mode compatible Linux/macOS/Windows/VPS
- un importeur complet de cookies Chromium (JSON + profils navigateur + picker UI)

## Structure du projet

```txt
universal-browse/
├── src/
│   ├── cli.js                    # Client CLI
│   ├── server.js                 # Daemon HTTP local (localhost)
│   ├── browser-manager.js        # Execution des commandes browser
│   ├── display-strategy.js       # Strategie headless/headed/xvfb
│   ├── cookie-import-browser.js  # Import/dechiffrement cookies Chromium
│   ├── cookie-picker-routes.js   # Endpoints /cookie-picker/*
│   └── cookie-picker-ui.js       # UI picker
├── skill/universal-browse/
│   ├── SKILL.md                  # Skill principal
│   └── references/               # Docs operationnelles
├── scripts/
│   ├── preflight.js              # Verification environnement
│   ├── install-claude-skill.js   # Install natif Claude (.claude/skills)
│   ├── setup-linux.sh            # Bootstrap Linux
│   ├── setup-macos.sh            # Bootstrap macOS
│   └── setup-windows.ps1         # Bootstrap Windows
└── .github/workflows/ci.yml      # CI Linux + macOS + Windows
```

## Commandes operateur (quotidien)

Installation et checks:

```bash
npm ci
npx playwright install --with-deps chromium
npm run preflight
```

Windows bootstrap:

```powershell
npm run setup:windows
```

Execution (deterministe en local repo):

```bash
npm run unibrowse -- status
npm run unibrowse -- goto https://example.com
npm run unibrowse -- snapshot
npm run unibrowse -- stop
```

Validation:

```bash
npm test
```

## Orchestration simple

1. Le CLI lit `.universal-browse/state.json`.
2. Si le daemon est absent/stale, le CLI le relance automatiquement.
3. Le daemon lance Chromium via Playwright selon la strategie d'affichage.
4. Les commandes passent via `POST /command` avec bearer token.

## Modes d'execution

- `UNIVERSAL_BROWSE_MODE=headless` (defaut, recommande VPS/CI)
- `UNIVERSAL_BROWSE_MODE=headed` (debug visuel)
- `UNIVERSAL_BROWSE_XVFB=0` pour desactiver l'auto-Xvfb

Exemple VPS headed:

```bash
UNIVERSAL_BROWSE_MODE=headed npm run unibrowse -- status
```

## Administration du cookie importer

Flux supportes:

- Import JSON local:
  - `npm run unibrowse -- cookie-import /tmp/cookies.json`
- Import direct depuis navigateur:
  - `npm run unibrowse -- cookie-import-browser chrome --domain .github.com --profile Default`
- Listing domaines disponibles (mode CLI, sans picker):
  - `npm run unibrowse -- cookie-import-browser chrome --profile Default --list-domains`
- Picker interactif:
  - `npm run unibrowse -- cookie-import-browser chrome`
- Debug picker (API):
  - `GET /cookie-picker/debug?browser=chrome&profile=Default`

Notes:

- macOS: depend de `security` (Keychain)
- Linux v11: depend de `secret-tool`
- DB lockee: fallback sur copie temporaire SQLite
- Windows Chrome/Brave recents (ABE): detection explicite `abe_unsupported` + fallback JSON
- `cookie-import-browser` est strict sur les flags inconnus (erreur immediate)
- les requetes `twitter.com` peuvent etre retentees automatiquement sur alias `x.com`

## Modifier le skill proprement

Quand tu modifies un comportement, mets a jour les 3 zones suivantes:

1. Runtime (`src/*.js`)
2. Skill (`skill/universal-browse/SKILL.md`)
3. Troubleshooting (`skill/universal-browse/references/troubleshooting.md`)

Regle simple: toute nouvelle commande doit etre documentee dans `README.md` et `SKILL.md`.

## Integration native IA CLI (obligatoire)

Le statut "PLUGGED" complet requiert 2 validations:

- `READY-RUNTIME`:
  - `npm run preflight` passe
  - `npm test` passe
  - smoke `status -> goto -> snapshot -> stop` passe
- `READY-NATIVE-SKILL`:
  - integration au bon emplacement natif de l'outil cible
  - preuve de chargement native capturee dans le rapport

Si seul le runtime passe, le statut doit rester `READY-RUNTIME-ONLY`.

Mapping natif par outil:

- Claude Code:
  - standalone natif (recommande): `npm run install:claude:project` ou `npm run install:claude:personal`
  - emplacement skill natif: `.claude/skills/universal-browse/SKILL.md`
- Codex CLI: `AGENTS.md` / `AGENTS.override.md`
- OpenCode: `AGENTS.md` (via `/init`)
- Gemini CLI: `GEMINI.md`
- Kimi Code CLI: `AGENTS.md` (via `/init`)

## Procedure de mise a jour (release courte)

1. `npm run preflight`
2. `npm test`
3. verifier README + SKILL
4. commit avec message clair
5. push `main`

Exemple:

```bash
git add .
git commit -m "feat: improve cookie import reliability on linux"
git push
```

## Securite et bonnes pratiques

- Le daemon doit rester en `127.0.0.1` uniquement.
- Ne jamais logger les tokens bruts.
- Eviter les imports de cookies sans scope de domaine.
- Garder les checks de path sur `cookie-import`.

## Depannage rapide

- Daemon bloque:
  - `npm run unibrowse -- stop`
  - relancer une commande (`status`)
- Headed Linux sans display:
  - installer `xvfb`
- Echec decrypt cookies:
  - verifier Keychain (macOS) ou `secret-tool` (Linux)
- Erreur `abe_unsupported` (Windows):
  - utiliser temporairement `cookie-import <json-file>`
  - verifier si le navigateur source est en chiffrement App-Bound
- Erreur picker "Failed to fetch":
  - consulter `/cookie-picker/debug` et les logs stderr `[cookie-picker]`

## Definition of done pour changements runtime

Un changement est valide si:

- tests passent (`npm test`)
- preflight ne casse pas
- README + SKILL + troubleshooting sont alignes
- le flux `status -> goto -> snapshot` fonctionne

## Runbook incidents (Ops avance)

### Incident P1 - daemon indisponible

Symptomes:

- `npm run unibrowse -- status` echoue
- timeouts repetes sur commandes

Actions immediates:

1. `npm run unibrowse -- stop`
2. `npm run preflight`
3. `DEBUG=pw:browser npm run unibrowse -- status`

Si echec persistant:

- verifier version Node (`node -v`, Node >= 20)
- reinstaller Chromium (`npx playwright install --with-deps chromium`)
- verifier permissions du workspace (ecriture `.universal-browse/`)

### Incident P1 - import cookies casse en production

Symptomes:

- `keychain_denied`, `keychain_timeout`, `db_locked`, `decrypt_failed`, `abe_unsupported`

Actions immediates:

1. basculer temporairement sur `cookie-import <json-file>` pour continuer le service
2. fermer completement le navigateur source (Chrome/Brave/etc.)
3. relancer import direct avec `--domain` et `--profile` explicites
4. lister domaines en texte via `--list-domains` pour valider le profil
5. utiliser `/cookie-picker/debug` si le picker UI remonte un echec reseau

Actions correctives:

- macOS: valider la popup Keychain pour le service "Safe Storage"
- Linux: installer/verifier `secret-tool`, session keyring deverrouillee
- surveiller WAL/SHM lock et relancer import
- Windows ABE: documenter la limitation, conserver fallback JSON pour continuite

### Incident P2 - mode headed VPS ne demarre pas

Symptomes:

- erreur display manquant

Actions:

1. installer Xvfb (`sudo apt-get install -y xvfb`)
2. relancer en `UNIVERSAL_BROWSE_MODE=headed`
3. si non critique, revenir en `headless` pour continuit

## Release management (SemVer)

Convention:

- PATCH `x.y.Z`: bugfix sans changement API commande
- MINOR `x.Y.z`: nouvelle commande/capacite backward-compatible
- MAJOR `X.y.z`: changement breaking (flags, sortie, auth, routes)

Checklist release:

1. `npm run preflight`
2. `npm test`
3. verifier commandes core (`status`, `goto`, `snapshot`, `screenshot`)
4. verifier commandes cookies (`cookie-import`, `cookie-import-browser`)
5. mettre a jour `README.md` + `SKILL.md` + `references/troubleshooting.md`
6. tagger et publier

Exemple:

```bash
git add .
git commit -m "release: v1.1.0"
git tag v1.1.0
git push && git push --tags
```

## Strategy de rollback

### Rollback rapide (code)

1. identifier le dernier tag stable (ex: `v1.0.3`)
2. creer un hotfix branch depuis ce tag
3. publier patch de rollback `v1.0.4`

Exemple:

```bash
git checkout -b hotfix/rollback-v1.0.3 v1.0.3
git cherry-pick <fix-commit-if-needed>
git push -u origin hotfix/rollback-v1.0.3
```

### Rollback runtime (operationnel)

- stopper sessions en cours: `npm run unibrowse -- stop`
- reinstalle dependances propres: `npm ci`
- relancer smoke tests: `npm test` + `npm run unibrowse -- status`

## Gouvernance PR

Avant merge PR runtime:

- verifier template PR rempli
- confirmer impact Linux + macOS + Windows
- confirmer impact cookie importer si fichiers `cookie-*` modifies
- interdire merge si tests rouges

## Backlog technique recommande

- ajouter tests fixtures SQLite pour decrypt v10/v11 en Node (parite gstack)
- ajouter smoke e2e CI pour route `/cookie-picker/imported`
- ajouter changelog versionne (`CHANGELOG.md`) si cadence release augmente
