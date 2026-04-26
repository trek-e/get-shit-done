---
name: gsd:feedback
description: File a GitHub issue (bug/feature/question) with auto-collected diagnostics, without leaving your AI session
argument-hint: "[bug|feature|question] [--title \"...\"] [--description \"...\"]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
File a GitHub issue against `gsd-build/get-shit-done` with auto-collected diagnostics, without leaving the current AI session.

**Parameters** (parsed from $ARGUMENTS):
- `type` — one of `bug`, `feature`, or `question` (prompted if omitted)
- `--title "..."` — issue title (prompted if omitted)
- `--description "..."` — issue body / description (prompted if omitted)

**Label mapping:**
- `bug` → `bug`
- `feature` → `enhancement`
- `question` → `question`

**Discoverability:** Invoke `/gsd-feedback` whenever you encounter an error or unexpected GSD behavior, want to request a feature, or have a question about how GSD works.
</objective>

<process>

## Step 0 — Parse Arguments

Parse `$ARGUMENTS`:

1. First positional word (if it is `bug`, `feature`, or `question`): set TYPE
2. `--title "..."`: set TITLE
3. `--description "..."`: set DESCRIPTION

If TYPE is missing: print `Type required: bug | feature | question` and prompt user.
If TITLE is missing: prompt user for a short title.
If DESCRIPTION is missing: prompt user for description.

---

## Step 1 — Collect Diagnostics

Collect the following without asking the user:

**GSD version:**
```bash
node -e "const p=require(process.env.HOME+'/.claude/get-shit-done/package.json'); console.log(p.version);" 2>/dev/null \
  || cat ~/.claude/get-shit-done/package.json 2>/dev/null | grep '"version"' | head -1 \
  || echo "unknown"
```

**Node.js version:**
```bash
node --version 2>/dev/null || echo "unknown"
```

**OS/platform:**
```bash
uname -srm 2>/dev/null || echo "unknown"
```

**Current milestone and phase** (read from `.planning/STATE.md` if it exists in the current directory):
```bash
cat .planning/STATE.md 2>/dev/null | grep -E "^(milestone|phase|current_phase|active_phase):" | head -5 || echo "(no .planning/STATE.md)"
```

**Active workspace/project name** (project directory basename):
```bash
basename "$(pwd)"
```

---

## Step 2 — Build Issue Body

Construct a markdown issue body:

```
<DESCRIPTION>

<details>
<summary>Diagnostic Info</summary>

| Field | Value |
|-------|-------|
| GSD version | <gsd_version> |
| Node.js version | <node_version> |
| OS/platform | <os_platform> |
| Project | <project_name> |
| Current state | <milestone_phase_snippet> |

</details>
```

---

## Step 3 — Try gh CLI

Check if `gh` is available:
```bash
which gh 2>/dev/null || ls /opt/homebrew/bin/gh 2>/dev/null || echo "not_found"
```

If found, resolve the `gh` path (use `/opt/homebrew/bin/gh` if not on PATH).

Write the issue body to a temp file:
```bash
TMPFILE=$(mktemp /tmp/gsd-feedback-XXXXXX.md)
cat > "$TMPFILE" << 'BODY_EOF'
<issue body here>
BODY_EOF
```

Create the issue:
```bash
gh issue create \
  --repo gsd-build/get-shit-done \
  --title "<TITLE>" \
  --label "<LABEL>" \
  --body-file "$TMPFILE"
```

Clean up: `rm -f "$TMPFILE"`

If the `gh` command succeeds: display the returned issue URL and **STOP**.

---

## Step 4 — Fall Back to Browser URL

If `gh` is not found or fails:

URL-encode the title and body (replace spaces with `%20`, newlines with `%0A`, etc. — use Node.js for encoding):

```bash
node -e "
const title = process.argv[1];
const body = process.argv[2];
const label = process.argv[3];
const base = 'https://github.com/gsd-build/get-shit-done/issues/new';
const params = new URLSearchParams({ title, body, labels: label });
console.log(base + '?' + params.toString());
" "<TITLE>" "<BODY>" "<LABEL>"
```

Display the URL:

```
Open this URL to file the issue in your browser:

<URL>
```

If Node.js encoding fails for any reason, fall through to Step 5.

---

## Step 5 — Final Fallback: Print Markdown

If both `gh` and the browser URL fail:

Display:

```
Could not open GitHub automatically. Copy the markdown below and paste it at:
https://github.com/gsd-build/get-shit-done/issues/new

---
**Title:** <TITLE>
**Labels:** <LABEL>

<BODY>
```

</process>

<success_criteria>
- TYPE, TITLE, DESCRIPTION collected (from arguments or prompts)
- All diagnostics collected without asking the user
- Issue body includes a `<details>Diagnostic Info</details>` block
- Attempted `gh issue create` first; fell back gracefully if unavailable
- Issue URL returned (or markdown printed as last resort)
</success_criteria>
