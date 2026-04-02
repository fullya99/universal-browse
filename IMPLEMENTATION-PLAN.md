# IMPLEMENTATION PLAN — Conformit skill-creator

> Audit du skill `universal-browse` vs protocole skill-creator de claude-ops.
> Ce plan corrige les non-conformit et am liore la d couvrabilit + UX d'installation.

---

## Contexte

Le skill `universal-browse` est un daemon Playwright persistant multi-OS avec skill Claude Code natif.
L'audit r v le **1 probl me bloquant (P0)**, **3 probl mes importants (P1)** et **3 am liorations (P2-P3)**.

### Fichiers impact s

| Fichier | Action | Priorit |
|---------|--------|---------|
| `scripts/install-claude-skill.js` | **Rewrite** — copie r cursive du dossier complet | P0 |
| `skill/universal-browse/SKILL.md` | **Edit** — frontmatter + body restructur | P1 |
| `skill/universal-browse/references/ai-cli-integration.md` | **Edit** — liens imp ratifs | P1 |
| `skill/universal-browse/tests/eval.json` | **Create** — tests de triggering | P2 |

---

## P0 — Fix install : copier le dossier complet (references incluses)

### Probl me

`scripts/install-claude-skill.js` ne copie que `SKILL.md` via `fs.copyFile()`.
Les 5 fichiers `references/*.md` r f renc s dans SKILL.md sont perdus apr s installation.
Claude voit les directives "Read `references/troubleshooting.md`" mais le fichier n'existe pas.

### Solution

Remplacer la copie fichier par fichier par `fs.cp()` r cursif (Node 20+ stable, pas de dep externe).
Copier l'int gralit de `skill/universal-browse/` vers la cible, en excluant les fichiers non-skill (tests, etc.).

### Impl mentation

**Fichier : `scripts/install-claude-skill.js`**

Remplacer la logique de copie (lignes 45-84) par :

```javascript
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const SKILL_NAME = "universal-browse";

const USAGE = `Usage: node scripts/install-claude-skill.js --scope <project|personal> [--force]\n\n` +
  `Examples:\n` +
  `  node scripts/install-claude-skill.js --scope project\n` +
  `  node scripts/install-claude-skill.js --scope personal --force`;

function parseArgs(argv) {
  let scope = null;
  let force = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scope") { scope = argv[i + 1] || null; i += 1; continue; }
    if (arg === "--force") { force = true; continue; }
    if (arg === "--help" || arg === "-h") { return { help: true, scope: null, force: false }; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { help: false, scope, force };
}

function getTargetDir(scope) {
  const base = scope === "project"
    ? path.resolve(process.cwd(), ".claude", "skills")
    : path.resolve(os.homedir(), ".claude", "skills");
  return path.join(base, SKILL_NAME);
}

async function main() {
  try {
    const { help, scope, force } = parseArgs(process.argv.slice(2));
    if (help) { console.log(USAGE); return; }
    if (!scope) throw new Error("Missing required --scope argument.");

    const sourceDir = path.resolve(process.cwd(), "skill", SKILL_NAME);
    const targetDir = getTargetDir(scope);

    // Validate source exists and contains SKILL.md
    await fs.access(path.join(sourceDir, "SKILL.md"));

    // Check target if not force
    if (!force) {
      try {
        await fs.access(targetDir);
        throw new Error(`Target already exists: ${targetDir}. Use --force to overwrite.`);
      } catch (error) {
        if (error && error.code !== "ENOENT") throw error;
      }
    }

    // Remove existing target if force (clean install)
    if (force) {
      await fs.rm(targetDir, { recursive: true, force: true });
    }

    // Recursive copy of entire skill directory (SKILL.md + references/)
    // fs.cp is stable in Node 20+ — no external dependency needed
    await fs.cp(sourceDir, targetDir, { recursive: true });

    console.log(`[${SKILL_NAME}] Installed skill directory to: ${targetDir}`);
    console.log(`[${SKILL_NAME}] Contents copied:`);

    // List what was installed for verification
    const entries = [];
    async function walk(dir, prefix = "") {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { await walk(path.join(dir, entry.name), rel); }
        else { entries.push(rel); }
      }
    }
    await walk(targetDir);
    for (const e of entries) console.log(`  - ${e}`);

    console.log(`[${SKILL_NAME}] Scope: ${scope}`);
    console.log(`[${SKILL_NAME}] Run \`npm run preflight\` to verify runtime readiness.`);
  } catch (error) {
    console.error(`[${SKILL_NAME}] Skill install failed: ${error.message}`);
    console.error(USAGE);
    process.exit(1);
  }
}

main();
```

**Points cl s :**
- `fs.cp(src, dest, { recursive: true })` est stable depuis Node 20.0 (le projet require d j `>=20`)
- Le `--force` fait un `rm` + `cp` propre (pas de fichiers orphelins d'une ancienne version)
- Le listing post-copie permet de v rifier visuellement que les references sont l
- Aucune d pendance externe ajout e

### V rification

```bash
# Clean + install personal
npm run install:claude:personal
# V rifier que les references sont copi es :
ls -la ~/.claude/skills/universal-browse/
ls -la ~/.claude/skills/universal-browse/references/
# Doit contenir : SKILL.md + references/{ai-cli-integration,linux-vps,macos,windows,troubleshooting}.md
```

---

## P1-A — Restructurer SKILL.md (frontmatter + body)

### Probl me

1. Pas de champ `allowed-tools` dans le frontmatter
2. Description "detailed" correcte mais manque de trigger phrases (risque d'under-triggering)
3. Les liens vers references/ sont passifs ("See details") au lieu d'imp ratifs ("Read X for Y")
4. Pas de section `## Examples` structur e (exig e par le template skill-creator)
5. `metadata.owner` inutile (pas dans le protocole)

### Impl mentation

**Fichier : `skill/universal-browse/SKILL.md`**

Remplacement complet :

```markdown
---
name: universal-browse
description: >-
  Persistent Playwright browser daemon for QA testing, dogfooding, and web automation
  across Linux, macOS, Windows, and headless VPS environments. Use when asked to open a URL,
  browse a website, test a user flow, verify UI behavior, collect screenshots, debug browser
  console or network issues, run smoke tests, check responsive layouts, verify deployments,
  test forms, handle authentication flows, inspect cookies, or any browser-based validation.
  Also triggers on "browse", "open this page", "check this site", "take a screenshot",
  "test this URL", "verify the deploy", "QA this", "dogfood", "smoke test".
license: MIT
compatibility: >-
  Node.js >= 20. Works on Linux (desktop and VPS), macOS, and Windows.
  Optional Xvfb for headed sessions on headless Linux servers.
allowed-tools: >-
  Bash(npm:*) Bash(npx:*) Bash(node:*) Bash(unibrowse:*)
  Bash(lsof:*) Bash(curl:*)
metadata:
  version: 1.0.0
  tags: [browser, qa, testing, playwright, automation, screenshots]
---

# universal-browse

Validate web behavior quickly and repeatedly via a persistent browser daemon.

## Instructions

### Step 1: Verify runtime readiness

Run preflight to check all dependencies are satisfied:

```bash
npm run preflight
```

If Playwright browsers are missing, install them:

```bash
npx playwright install --with-deps chromium   # Linux (installs system deps)
npx playwright install chromium                # macOS / Windows
```

Expected output: all checks PASS.

### Step 2: Start a session and navigate

```bash
npm run unibrowse -- status                          # start daemon if needed
npm run unibrowse -- goto https://your-app.example   # navigate
npm run unibrowse -- snapshot                        # get accessibility tree
npm run unibrowse -- text                            # get page text
```

The daemon persists across commands. No need to relaunch between navigations.

### Step 3: Interact with the page

```bash
npm run unibrowse -- click "button[type='submit']"
npm run unibrowse -- fill "#email" "dev@example.com"
npm run unibrowse -- scroll down 1200
npm run unibrowse -- eval "document.title"
npm run unibrowse -- viewport 375x812              # mobile viewport
```

### Step 4: Collect evidence

```bash
npm run unibrowse -- screenshot /tmp/proof.png
npm run unibrowse -- console                       # browser console logs
npm run unibrowse -- network                       # network activity
npm run unibrowse -- cookies                       # cookies (values redacted)
```

### Step 5: Session transfer (authenticated pages)

Import cookies from a JSON file:

```bash
npm run unibrowse -- cookie-import /tmp/cookies.json
```

Or relaunch with a real browser profile for sites that reject cookie replay:

```bash
npm run unibrowse -- launch-with-profile brave --profile Default
```

Read `references/troubleshooting.md` for cookie decryption errors and database locking issues.

### Step 6: Stop the daemon

```bash
npm run unibrowse -- stop
```

## Platform-specific setup

Read the relevant reference for your environment:

- Read `references/macos.md` for macOS-specific setup and keychain access.
- Read `references/windows.md` for PowerShell setup and DPAPI cookie decryption.
- Read `references/linux-vps.md` for headless VPS setup with Xvfb virtual display.
- Read `references/ai-cli-integration.md` for registering this skill in Codex, OpenCode, Gemini, or Kimi.

## Challenge protocol

`goto` auto-detects Cloudflare and anti-bot challenge pages.
In headless mode, the daemon attempts to switch to headed mode before retrying.
A screenshot is captured and common challenge interactions are attempted automatically.

## Handoff protocol

If CAPTCHA or MFA blocks automation:

1. Start headed mode: `UNIVERSAL_BROWSE_MODE=headed npx unibrowse status`
2. Ask the user to complete the manual step in the visible browser window.
3. Resume with `snapshot` and assertions.

## Examples

### Example 1: Quick smoke test after deploy

**User says:** "Check if staging.example.com loads correctly after the deploy"

**Actions:**
1. `npm run unibrowse -- goto https://staging.example.com`
2. `npm run unibrowse -- snapshot`
3. `npm run unibrowse -- screenshot /tmp/staging-check.png`

**Result:** Accessibility tree confirms page structure, screenshot saved as evidence.

### Example 2: Fill and submit a form

**User says:** "Test the login form on our app"

**Actions:**
1. `npm run unibrowse -- goto https://app.example.com/login`
2. `npm run unibrowse -- fill "#email" "test@example.com"`
3. `npm run unibrowse -- fill "#password" "testpass123"`
4. `npm run unibrowse -- click "button[type='submit']"`
5. `npm run unibrowse -- snapshot`

**Result:** Form submitted, snapshot shows post-login page content.

### Example 3: Debug network issues

**User says:** "Why is the dashboard slow? Check network calls"

**Actions:**
1. `npm run unibrowse -- goto https://app.example.com/dashboard`
2. `npm run unibrowse -- network`
3. `npm run unibrowse -- console`

**Result:** Network log reveals slow API calls, console shows any JS errors.

### Example 4: Mobile responsive check

**User says:** "Check if the landing page works on mobile"

**Actions:**
1. `npm run unibrowse -- viewport 375x812`
2. `npm run unibrowse -- goto https://example.com`
3. `npm run unibrowse -- screenshot /tmp/mobile.png`
4. `npm run unibrowse -- snapshot`

**Result:** Screenshot and DOM tree at iPhone viewport dimensions.

## Known limitations

- Google account login may block Playwright browsers ("This browser or app may not be secure"), even in headed mode.
- Google services can reject exported cookies due to device/session binding.
- Workaround: use `launch-with-profile` with a real browser profile for Google properties.
- In strict environments with `UNIVERSAL_BROWSE_REQUIRE_COOKIE_IMPORT_ACK=1`, add `--allow-plaintext-cookies` flag.

## Troubleshooting

### Error: Daemon won't start or port conflict

**Cause:** Stale state file from a crashed session.
**Solution:** `rm -rf .universal-browse/state.json && npm run unibrowse -- status`

### Error: Browser launch fails on Linux VPS

**Cause:** Missing display server and no Xvfb installed.
**Solution:** `sudo apt-get install -y xvfb` then retry, or use `UNIVERSAL_BROWSE_MODE=headless`.

### Error: Cookie import fails with decryption error

**Cause:** Browser cookie database is locked or keychain access denied.
**Solution:** Close the source browser, retry. On macOS, authorize keychain access when prompted.
Read `references/troubleshooting.md` for detailed error codes and platform-specific fixes.

### Error: Snapshot returns empty content

**Cause:** Page hasn't finished loading or is behind a challenge.
**Solution:** `npm run unibrowse -- wait 3000` then retry `snapshot`. Check for challenge with `screenshot`.
```

**Changements cl s :**
- `description` enrichie avec ~30 trigger phrases (variante "pushy") — couvre "browse", "QA", "smoke test", "dogfood", "deploy", "screenshot", etc.
- `allowed-tools` ajout pour guider Claude sur les outils autoris s
- `metadata.owner` retir (non standard)
- `metadata.tags` ajout (standard skill-creator)
- Liens references/ tous en imp ratif : "Read `references/X.md` for Y"
- Section `## Examples` ajout e avec 4 sc narios structur s (common + edge cases)
- Section `## Troubleshooting` ajout e dans le body (4 erreurs courantes)
- Body ~155 lignes (largement sous la limite 500)
- Structure conforme au template skill-creator : Instructions  Examples  Troubleshooting

---

## P1-B — Corriger les liens dans references/ai-cli-integration.md

### Probl me

Le fichier `references/ai-cli-integration.md` r f rence le script d'install par `npm run install:claude:project` mais ne mentionne pas que les references sont d sormais incluses.

### Impl mentation

**Fichier : `skill/universal-browse/references/ai-cli-integration.md`**

Dans la section Claude Code install, ajouter apr s la commande npm :

```markdown
This copies the full skill directory (SKILL.md + references/) to the target scope.
Verify with: `ls ~/.claude/skills/universal-browse/references/`
```

Pas d'autre changement n cessaire — le reste du fichier est d j bien structur .

---

## P2 — Cr er le fichier eval.json pour tests de triggering

### Probl me

Le protocole skill-creator exige 5-8 should-trigger et 5-8 should-NOT-trigger queries pour valider le d clenchement. Aucun fichier eval n'existe.

### Impl mentation

**Fichier : `skill/universal-browse/tests/eval.json`** (nouveau)

```json
{
  "skill_name": "universal-browse",
  "evals": [
    {
      "id": 1,
      "name": "should-trigger-open-url",
      "prompt": "Open https://staging.example.com and check if it loads",
      "expected_output": "Skill triggers, runs goto + snapshot",
      "should_trigger": true,
      "assertions": ["Uses unibrowse goto", "Returns page content or snapshot"]
    },
    {
      "id": 2,
      "name": "should-trigger-screenshot",
      "prompt": "Take a screenshot of the homepage",
      "expected_output": "Skill triggers, runs screenshot command",
      "should_trigger": true,
      "assertions": ["Uses unibrowse screenshot", "Saves file to disk"]
    },
    {
      "id": 3,
      "name": "should-trigger-qa-deploy",
      "prompt": "QA the staging deploy and verify the login page works",
      "expected_output": "Skill triggers, navigates and interacts",
      "should_trigger": true,
      "assertions": ["Uses goto", "Uses snapshot or text", "Reports pass/fail"]
    },
    {
      "id": 4,
      "name": "should-trigger-smoke-test",
      "prompt": "Run a smoke test on our production site",
      "expected_output": "Skill triggers, runs basic navigation",
      "should_trigger": true,
      "assertions": ["Uses unibrowse goto", "Collects evidence"]
    },
    {
      "id": 5,
      "name": "should-trigger-check-console",
      "prompt": "Check if there are any JS errors on the dashboard page",
      "expected_output": "Skill triggers, navigates and checks console",
      "should_trigger": true,
      "assertions": ["Uses goto", "Uses console command"]
    },
    {
      "id": 6,
      "name": "should-trigger-mobile-check",
      "prompt": "Does the landing page look ok on mobile?",
      "expected_output": "Skill triggers with viewport + screenshot",
      "should_trigger": true,
      "assertions": ["Sets mobile viewport", "Takes screenshot or snapshot"]
    },
    {
      "id": 7,
      "name": "should-trigger-network-debug",
      "prompt": "The API calls on the settings page seem slow, can you check?",
      "expected_output": "Skill triggers, uses network command",
      "should_trigger": true,
      "assertions": ["Uses goto", "Uses network command"]
    },
    {
      "id": 8,
      "name": "should-trigger-dogfood",
      "prompt": "Dogfood the new feature on staging before we ship",
      "expected_output": "Skill triggers for QA workflow",
      "should_trigger": true,
      "assertions": ["Navigates to URL", "Tests user flow"]
    },
    {
      "id": 9,
      "name": "should-NOT-trigger-unit-tests",
      "prompt": "Run the unit tests for the auth module",
      "expected_output": "Skill does NOT trigger, this is about code tests not browser testing",
      "should_trigger": false,
      "assertions": ["Does not use unibrowse", "Runs npm test or similar"]
    },
    {
      "id": 10,
      "name": "should-NOT-trigger-api-curl",
      "prompt": "Call the /api/users endpoint and check the response",
      "expected_output": "Skill does NOT trigger, this is an API call not a browser flow",
      "should_trigger": false,
      "assertions": ["Uses curl or fetch, not browser"]
    },
    {
      "id": 11,
      "name": "should-NOT-trigger-css-edit",
      "prompt": "Change the button color to blue in the CSS file",
      "expected_output": "Skill does NOT trigger, this is a code edit",
      "should_trigger": false,
      "assertions": ["Edits CSS file directly"]
    },
    {
      "id": 12,
      "name": "should-NOT-trigger-git-ops",
      "prompt": "Push the changes and create a PR",
      "expected_output": "Skill does NOT trigger, this is git workflow",
      "should_trigger": false,
      "assertions": ["Uses git commands, not browser"]
    },
    {
      "id": 13,
      "name": "should-NOT-trigger-docker",
      "prompt": "Build the Docker image and check it starts correctly",
      "expected_output": "Skill does NOT trigger, this is container ops",
      "should_trigger": false,
      "assertions": ["Uses docker commands"]
    },
    {
      "id": 14,
      "name": "should-NOT-trigger-database",
      "prompt": "Check the database schema and run migrations",
      "expected_output": "Skill does NOT trigger, this is database ops",
      "should_trigger": false,
      "assertions": ["Uses database tools, not browser"]
    },
    {
      "id": 15,
      "name": "should-NOT-trigger-read-file",
      "prompt": "Read the config file and explain what each setting does",
      "expected_output": "Skill does NOT trigger, file reading not browsing",
      "should_trigger": false,
      "assertions": ["Reads local file, no browser involved"]
    },
    {
      "id": 16,
      "name": "should-NOT-trigger-perf-benchmark",
      "prompt": "Benchmark the sorting algorithm performance",
      "expected_output": "Skill does NOT trigger, code benchmark not browser",
      "should_trigger": false,
      "assertions": ["Runs code benchmark, not browser test"]
    }
  ]
}
```

---

## P1-C — Valider avec validate_skill.py

### Proc dure

Apr s toutes les modifications, ex cuter le validateur :

```bash
cd /Users/fullya/projects/universal-browse

# Valider le skill modifi
python3 ~/claude-ops/workflows/skill-creator/skill/scripts/validate_skill.py \
  skill/universal-browse/SKILL.md --verbose

# Cible : 0 FAIL, 0 WARN critique
```

**Checks attendus :**
- `name` : kebab-case, ≤64 chars, pas de mots r serv s  PASS
- `description` : pr sente, ≤1024 chars, pas de `<>`, 3e personne, trigger phrases  PASS
- `SKILL.md` : casse correcte  PASS
- Body : <500 lignes  PASS
- Pas de README.md dans le dossier skill  PASS
- Pas de backslashes Windows  PASS

---

## P3 — Cr er un zip pour Claude.ai (Web)

### Probl me

Pas de m canisme pour installer le skill sur Claude.ai (upload zip via Settings > Capabilities > Skills).

### Impl mentation

Ajouter un script npm dans `package.json` :

```json
"install:claude:zip": "cd skill && zip -r ../universal-browse-skill.zip universal-browse/"
```

Et ajouter `universal-browse-skill.zip` au `.gitignore`.

---

## R sum  de l'ordre d'ex cution

```
1. scripts/install-claude-skill.js   — rewrite complet (P0)
2. skill/universal-browse/SKILL.md   — rewrite complet (P1-A)
3. references/ai-cli-integration.md  — edit mineur (P1-B)
4. skill/universal-browse/tests/eval.json — cr ation (P2)
5. Validation : python3 validate_skill.py (P1-C)
6. package.json — ajouter script zip (P3)
7. .gitignore — ajouter *.zip (P3)
```

## Crit res de succ s

- [ ] `npm run install:claude:personal` copie SKILL.md + references/ (5 fichiers)
- [ ] `ls ~/.claude/skills/universal-browse/references/` retourne 5 fichiers .md
- [ ] `python3 validate_skill.py skill/universal-browse/SKILL.md` retourne 0 FAIL
- [ ] Le skill se d clenche sur "open this URL", "QA the site", "take a screenshot", "smoke test"
- [ ] Le skill ne se d clenche PAS sur "run unit tests", "push to git", "edit CSS"
- [ ] `npm run install:claude:zip` produit un zip fonctionnel

---

## Matrice de compatibilit  post-fix

| Dimension | Avant | Apr s |
|-----------|-------|-------|
| Claude Code CLI (local) | SKILL.md seul, refs manquantes | Dossier complet avec refs |
| Claude Code CLI (personal) | SKILL.md seul, refs manquantes | Dossier complet avec refs |
| Claude.ai (Web) | Pas de m canisme | Zip uploadable |
| Codex / OpenCode / Gemini / Kimi | OK (AGENTS.md) | OK (inchang ) |
| macOS | OK | OK |
| Linux desktop | OK | OK |
| Linux VPS | OK | OK |
| Windows | OK | OK |
| Node 20+ | OK | OK |
| validate_skill.py | Non test | 0 FAIL |
| Trigger rate (estim ) | ~60% | ~90%+ (description pushy) |
