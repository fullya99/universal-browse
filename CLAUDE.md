# universal-browse — Operations & orchestration

Tu es le Chief Dev de ce projet. Ce document est ta reference pour orchestrer, modifier, deployer et depanner `universal-browse`.

## Ce que c'est

Daemon Playwright persistant + CLI `unibrowse`. Multi-OS (Linux/macOS/Windows/VPS). Import cookies Chromium (JSON, profils natifs, picker UI).

## Structure

```
universal-browse/
├── src/
│   ├── cli.js                    # Client CLI
│   ├── server.js                 # Daemon HTTP (127.0.0.1)
│   ├── browser-manager.js        # Execution commandes browser
│   ├── config.js                 # Configuration runtime
│   ├── display-strategy.js       # Strategie headless/headed/xvfb
│   ├── http-helpers.js           # Helpers HTTP (parseBody, sendJson, auth)
│   ├── cookie-import-browser.js  # Dechiffrement cookies Chromium
│   ├── cookie-picker-routes.js   # Endpoints /cookie-picker/*
│   └── cookie-picker-ui.js       # UI picker
├── test/                         # Tests unitaires (node --test)
├── skill/universal-browse/
│   ├── SKILL.md                  # Skill Claude/OpenClaw (AgentSkills format)
│   ├── references/               # 5 docs operationnelles (.md)
│   └── tests/eval.json           # 16 evals triggering (8 yes / 8 no)
├── scripts/
│   ├── preflight.js              # Verification environnement
│   ├── install-claude-skill.js   # Install skill (copie recursive dossier complet)
│   ├── setup-linux.sh            # Bootstrap Linux
│   ├── setup-macos.sh            # Bootstrap macOS
│   └── setup-windows.ps1         # Bootstrap Windows
├── eslint.config.js              # ESLint flat config (ESM)
├── .husky/pre-commit             # Pre-commit hook (lint-staged)
└── .github/workflows/ci.yml     # CI: lint + test (Linux/macOS/Windows) + coverage
```

## Commandes quotidiennes

```bash
# Install
npm ci && npx playwright install --with-deps chromium && npm run preflight

# Runtime
npm run unibrowse -- status
npm run unibrowse -- goto https://example.com
npm run unibrowse -- snapshot
npm run unibrowse -- screenshot /tmp/proof.png
npm run unibrowse -- stop

# Cookies
npm run unibrowse -- cookie-import /tmp/cookies.json
npm run unibrowse -- launch-with-profile brave --profile Default

# Validation
npm test
npm run lint
npm run test:coverage
```

## Scripts npm (tous)

| Script | Action |
|--------|--------|
| `start` | Lance le daemon directement |
| `unibrowse` | CLI client |
| `test` | `node --test` |
| `lint` | ESLint |
| `test:coverage` | c8 (seuils: 30% lines, 60% branches) |
| `preflight` | Verification environnement |
| `install:claude:project` | Install skill scope projet (`.claude/skills/`) |
| `install:claude:personal` | Install skill scope personnel (`~/.claude/skills/`) |
| `install:claude:zip` | Zip pour upload Claude.ai web |
| `setup:linux` | Bootstrap Linux |
| `setup:macos` | Bootstrap macOS |
| `setup:windows` | Bootstrap Windows |

## Orchestration daemon

1. Le CLI lit `.universal-browse/state.json`
2. Si daemon absent/stale → relance automatique
3. Le mode (`headed`/`headless`) est persiste et reutilise
4. Daemon lance Chromium via Playwright selon la strategie d'affichage
5. Commandes via `POST /command` avec bearer token
6. `/health` remonte: `pageAvailable`, `pageClosed`, `contextClosed`, `browserConnected`

Variables d'environnement:

- `UNIVERSAL_BROWSE_MODE=headless|headed` (defaut: headless)
- `UNIVERSAL_BROWSE_XVFB=0|1`
- `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1` (mode strict cookies)

## Modifier le projet — regles

Quand tu modifies un comportement runtime:

1. Code source (`src/*.js`)
2. Tests (`test/*.js`)
3. Skill (`skill/universal-browse/SKILL.md`)
4. Troubleshooting (`skill/universal-browse/references/troubleshooting.md`)
5. README si nouvelle commande ou changement d'API

Definition of done:

- `npm test` passe
- `npm run lint` passe
- `npm run test:coverage` passe
- `npm run preflight` ne casse pas
- README + SKILL + troubleshooting alignes
- Smoke flow `status → goto → snapshot → stop` fonctionne

## Distribution du skill

Le skill `SKILL.md` est au format AgentSkills (compatible Claude Code + OpenClaw).

L'install copie recursivement le dossier complet (SKILL.md + references/ + tests/).

| Cible | Commande |
|-------|----------|
| Claude Code (projet) | `npm run install:claude:project` |
| Claude Code (personnel) | `npm run install:claude:personal` |
| Claude.ai (web) | `npm run install:claude:zip` → upload zip |
| OpenClaw (workspace) | `cp -r skill/universal-browse <workspace>/skills/` |
| OpenClaw (global) | `cp -r skill/universal-browse ~/.openclaw/skills/` |
| Codex / OpenCode / Kimi | Copier instruction block dans `AGENTS.md` |
| Gemini CLI | Copier instruction block dans `GEMINI.md` |

Detail complet: `skill/universal-browse/references/ai-cli-integration.md`

Validation skill-creator:

```bash
python3 ~/claude-ops/workflows/skill-creator/skill/scripts/validate_skill.py skill/universal-browse/SKILL.md --verbose
```

## Cookie importer — notes operateur

- `cookie-import-browser` est retire → utiliser `launch-with-profile`
- macOS: depend de `security` (Keychain)
- Linux v11: depend de `secret-tool`
- DB lockee: fallback copie temporaire SQLite + `busy_timeout` 5s
- Windows ABE: detection `abe_unsupported` + fallback JSON
- `twitter.com` → retry auto sur alias `x.com`
- `sameSite` normalise (`no_restriction` → `None`, invalide → `Lax`)
- Endpoint `/cookie-picker/import`: rate limit 2s (429)

## Securite

- Daemon bind `127.0.0.1` uniquement
- Ne jamais logger tokens bruts
- Ne jamais exposer messages d'erreur internes en HTTP 500 (retourner `"Command failed"`)
- `goto` valide le protocole (http/https uniquement)
- `cookies` masque les valeurs par defaut
- Handlers `uncaughtException`/`unhandledRejection` loggent avant shutdown

## Depannage rapide

| Symptome | Action |
|----------|--------|
| Daemon bloque | `npm run unibrowse -- stop` puis `status` |
| Headed Linux sans display | Installer `xvfb` |
| Decrypt cookies echoue | Verifier Keychain (macOS) ou `secret-tool` (Linux) |
| `abe_unsupported` (Windows) | Utiliser `cookie-import <json>` |
| Picker "Failed to fetch" | `/cookie-picker/debug` + logs stderr |
| Snapshot instable headed | `stop` → `status` → `goto` → `snapshot` |
| Google login bloque | Login navigateur standard → exporter cookies → `cookie-import` |

## Runbook incidents

### P1 — daemon indisponible

```bash
npm run unibrowse -- stop
npm run preflight
DEBUG=pw:browser npm run unibrowse -- status
```

Si persistant: verifier Node >= 20, reinstaller Chromium (`npx playwright install --with-deps chromium`), verifier permissions `.universal-browse/`.

### P1 — cookie import casse

1. Basculer sur `cookie-import <json-file>` pour continuer
2. Fermer le navigateur source
3. Relancer avec `--domain` et `--profile` explicites
4. Verifier avec `/cookie-picker/debug`

Correctifs: macOS → popup Keychain. Linux → `secret-tool` + keyring. Windows → fallback JSON.

### P2 — headed VPS sans display

```bash
sudo apt-get install -y xvfb
UNIVERSAL_BROWSE_MODE=headed npm run unibrowse -- status
```

## Release (SemVer)

- PATCH: bugfix sans changement API
- MINOR: nouvelle commande/capacite backward-compatible
- MAJOR: breaking (flags, sortie, auth, routes)

Checklist:

1. `npm run preflight`
2. `npm test && npm run lint && npm run test:coverage`
3. Verifier commandes core + cookies
4. Aligner README + SKILL + troubleshooting
5. Commit, tag, push

```bash
git add -A
git commit -m "release: v1.1.0"
git tag v1.1.0
git push && git push --tags
```

## Rollback

### Code

```bash
git checkout -b hotfix/rollback-v1.0.3 v1.0.3
git cherry-pick <fix-commit-if-needed>
git push -u origin hotfix/rollback-v1.0.3
```

### Runtime

```bash
npm run unibrowse -- stop
npm ci
npm test
npm run unibrowse -- status
```

## Gouvernance PR

- Impact Linux + macOS + Windows verifie
- Impact cookie importer si fichiers `cookie-*` modifies
- Tests verts + lint passe = prerequis merge

## Backlog technique

- Smoke e2e CI pour `/cookie-picker/imported`
- Changelog versionne (`CHANGELOG.md`)
- Augmenter seuils coverage (actuellement 30% lines, 60% branches)
