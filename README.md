# Clarity · API manufacturing RCA

A complete local quality investigation workspace with a React/TypeScript frontend, Express API, durable records, PDF/text/email intake, guided 5 Whys, contributing factors, evidence review, and CAPA tracking. Built specifically for active pharmaceutical ingredient manufacturing investigations.

## Run locally

Requires Node.js **22.18+** and npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run build
npm start
```

Open **http://127.0.0.1:3000**. The server provides the frontend and API on the same origin. Eight clearly illustrative investigations are added on first launch. All edits are persisted in `data/investigations.json`; restarting preserves them.

```powershell
npm run check
npm test
npm run build
npm start
```

`npm start` serves the built production frontend; run `npm run build` first. For development with hot reload, use `npm run dev` on a host that permits Vite to launch its esbuild subprocess. `PORT`, `HOST`, and `DATA_DIR` are configurable in `.env`. The default host is loopback. The data directory must be writable. Back it up before upgrades. Do not run multiple server processes against the same JSON file.

## AI configuration

Without an API key, **rule-based mode** is enabled. It extracts explicitly labeled fields and supplies transparent investigation templates. It is not a live model and does not infer an incident’s cause. The entire workflow works without an external service.

To enable live AI, edit `.env` and restart:

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-4.1-mini
```

Live mode uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs) with JSON output and server-side Zod validation, a timeout and request throttling. Model access depends on your account; change `OPENAI_MODEL` to an accessible JSON-output-capable model if needed. Keys are never sent to the browser. Requests set `store: false`. Model requests send incident and evidence text to OpenAI; ensure your organization authorizes that processing before entering confidential information. The integration is implemented and contract tested; a live provider call requires your own key.

## Workflow

1. Choose **New investigation**. Upload a text-based PDF, TXT or EML, paste incident text/email, or enter the details manually. Review extracted fields before saving. Labeled inputs such as `Subject:`, `Product:`, `Batch:`, `Date: YYYY-MM-DD`, and `Containment:` work best in rule-based mode.
2. Complete **Incident details** and save. Set the product, batch, category, priority, owner, due date and immediate containment.
3. Add **Evidence**: observations, interviews, controlled document references or extracted document text. The original uploaded file is parsed in memory and is not retained; use your controlled document system for originals. Source intake text remains available in the incident details step. Files are limited to 10 MB, source text to 40,000 characters, and PDF parsing to 50 pages. Scanned/image-only PDFs need external OCR; encrypted or malformed PDFs produce a recoverable error.
4. Use **5 Whys** and **Causes & factors**. Write your own content or request suggestions. Preview suggestions before adding them. Existing Why answers are preserved. No cause is automatically confirmed. Editing a confirmed answer or cause clears its confirmation. Add evidence before confirming each answer and cause.
5. In **CAPA & review**, edit proposed actions, assign owners and due dates, define effectiveness checks, and record progress. Confirm reviewed actions. Save drafts at any point. Reopen records from the searchable, filterable, paginated investigation list.
6. Closure requires complete incident details, reviewed imports, evidence, confirmed Whys with evidence, at least one confirmed evidenced cause, completed and confirmed CAPAs with owners/dates/effectiveness checks, a conclusion and a reviewer name. Only a human can set the record status. The application neither approves batches nor makes quality decisions.

Navigation includes an overview, CAPA tracker, evidence library, reports based on saved records, notifications, settings and an investigation guide. JSON exports include the investigation and activity history. An editor warns before discarding unsaved changes. Save is explicit; there is no automatic save.

## Architecture and safeguards

- `src/`: accessible responsive React interface; native modal dialogs and labeled form controls.
- `server/index.js`: same-origin REST API, payload validation, file limits, optional shared access token, and AI request throttling.
- `server/schema.js`: record schema and server-enforced closure conditions.
- `server/store.js`: queued mutations, atomic file replacement, server-owned IDs/revisions/activity events and optimistic concurrency. Conflicting edits return HTTP 409 and leave the newer version intact.
- `server/ai.js`: live and transparent rule-based assistant modes; untrusted source text is isolated from model instructions. Output is validated before being returned. Generation never writes a record.
- `tests/api.test.js`: real HTTP integration tests for persistence, conflicts, concurrency, closure gates, extraction including a real text PDF, and non-mutating suggestions.
- `scripts/browser-check.mjs`: end-to-end browser check and desktop/mobile screenshots. Run while the app is serving with `npm run test:browser`.

## Before organizational deployment

This is a production-minded **single-process implementation**, not a validated GxP system. The demonstration user and typed reviewer names are self-reported, not electronic signatures. Activity events record revisions and changed fields but are not an immutable regulatory audit trail. Seeded examples must not be used as actual investigation evidence.

For optional single-workspace access protection, set `APP_ACCESS_TOKEN` to a long random secret on the server, restart, then enter it under Settings in the browser. It is stored only in browser session storage. This is a shared access gate, not individual identity or role-based authorization.

Before handling regulated records: integrate organizational SSO and role-based authorization, use TLS and a managed database with transaction and backup/restore policies, implement authenticated signatures and immutable before/after audit history with reason for change, establish retention/access policies for original evidence, assess provider data processing, perform security and AI evaluation, and complete computerized-system validation under your organization’s procedures. The app makes no regulatory compliance claim.

## Environment note

Dependencies were installed from locally cached packages. The checked-in lockfile supports ordinary `npm ci` on a normal development machine. This host blocked Vite's development dependency scanner; the production build and server work here, so use the build/start commands above.

Browser QA rendered the initial compiled interface, but normal browser networking and screenshot capture were blocked by Windows host process restrictions. Full browser automation remains unverified here. Run `npm run test:browser` on an unrestricted host with Chrome installed, using the default rule-based mode. The 15 API/provider integration tests, TypeScript checks, production build and production HTTP startup were verified locally. Live AI was tested with mocked provider responses; an external provider call remains unverified.


## New reviewable RCA copilot

The investigation editor now includes a persistent indigo copilot panel. Paste reports or prompts, or attach a text PDF. Proposals show current/proposed values, source, rationale and confidence. Select replacements explicitly; newer manual changes invalidate stale proposals. Apply, dismiss and undo events are retained in `copilotHistory` and persisted with the investigation. Saving is not approval. Manufacturing stage, equipment and AI review markers are persisted too.

Start the separate Python service (local only):

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r copilot/requirements.txt
$env:GROQ_API_KEY='your-key'
$env:GROQ_MODEL='llama-3.3-70b-versatile'
.venv/Scripts/python -m uvicorn copilot.main:app --host 127.0.0.1 --port 8001
```

In a second terminal run `npm run build` then `npm start`. Express forwards `/api/ai/intake`, `/api/ai/analyze` and PDF intake to the local FastAPI service (`COPILOT_URL`, default http://127.0.0.1:8001). LangGraph orchestrates the Groq request; Python and Node validate responses. No uploaded binary is written or publicly served. Missing service/key returns a visible setup error; this new workflow has no canned AI fallback. Existing legacy intake/analysis behavior remains available.

Outstanding assignment requirements: this repository originally used React local state, Express, and JSON-file persistence. Redux and PostgreSQL/MySQL migration have NOT been implemented. The new Python dependencies could not be installed in the restricted execution environment, so live Groq, Python HTTP integration, and full interactive browser verification remain unverified. Python syntax, frontend type checking, and focused Node proposal validation tests can run independently. This is a partial implementation of the requested stack, not a completed stack migration.


## Fixing the copilot connection error (Windows)

1. Create a Groq API key at https://console.groq.com/keys.
2. Edit `C:\work\assignment\.env`. Set `GROQ_API_KEY=your-key`, `GROQ_MODEL=llama-3.3-70b-versatile`, and `COPILOT_URL=http://127.0.0.1:8001`. Python loads this file automatically; restart Python after editing it. Do not put the key in React code or use a `VITE_` prefix.
3. In PowerShell at the repository root, run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r copilot\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn copilot.main:app --host 127.0.0.1 --port 8001
```

4. Leave Python running. In another terminal run `npm run build` and `npm start`. Open http://127.0.0.1:3000.
5. Visit http://127.0.0.1:8001/health. `configured: true` means a key is loaded, not that Groq has validated it. Send a fictional incident to test provider access.

Send pasted incident text with the Send button, review and apply the proposed title and incident fields, then request analysis or save. A title of at least three characters is required only when saving. Analysis shortcuts need an incident description first.

If pip says no matching distribution in a terminal with `PIP_NO_INDEX=1`, the terminal is configured for offline installation. Install the requirements in your ordinary internet-enabled PowerShell session. This agent environment cannot supply a Groq account key or verify live provider access without one.
