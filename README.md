# FirstStep — Careers Finder

A local careers finder for developer internships and entry-level roles. The exact signed-in TinyBounties brief was read before implementation; see [the acceptance checklist](docs/ACCEPTANCE.md). Existing parent workspace code is preserved.

The interface follows the user's custom-design guide, with locally bundled Manrope and Space Grotesk fonts, an authored source-workflow diagram, responsive 40px-plus controls, short state feedback and reduced-motion handling. Font licenses and provenance are included in `public/fonts`. It preserves the native HTML/TypeScript stack and the existing palette.

**Status, 15 October 2026:** the combined live demo passed with two open, source-verified internships from Affirm and Cloudflare using TinyFish Search, Agent and Fetch. It used seven provider requests and retains a partial label because it checked one candidate per employer. The app passes 51 core/CLI tests and five browser tests. Source evidence, CSV, screenshots, historical failures and actual timestamps are included. The source is public and the LinkedIn, TinyFish Discord showcase and additionally approved X posts are verified. The completed bounty form awaits the user's separate final approval. See [submission status and verified links](docs/SUBMISSION.md).

## Run locally

Node 22.13+ (Node 24 recommended; built-in SQLite may emit an experimental warning on Node 22). Run these commands from the application folder containing this README and `package.json`.

```sh
npm ci
test -e .env || cp .env.example .env
npm run dev
```

Open http://127.0.0.1:4317. The UI works without a key and shows an honest setup state. The current local workspace opts into the existing shared key; no secret has been duplicated. `.env.example` is deliberately empty. Add the following **names with your own values to the private .env**, never to client code, chat, Git, or recordings:

| Variable | Meaning |
|---|---|
| `TINYFISH_API_KEY` | Existing account API key; server only |
| `TINYFISH_WORKFLOW` | Optional `agent` (default) or `browser`; Agent uses the documented 150-step default with a full credit reserve |
| `USE_SHARED_TINYFISH_KEY` | Optional `true`: read an already configured key from `~/.config/tinyfish/credentials.env`; local environment values take precedence |
| `FREE_CREDITS_APPROVED` | Set to `true` only after verifying that the wallet holds approved existing free credits, not purchased funds, and auto-reload is off |
| `MAX_DAILY_REQUESTS` | Optional integer 1–64; default 40, persistent across restarts. The local validation limit is 64 after explicit user approval on 15 October |
| `PORT` | Optional; default 4317 |

Restart after configuration changes. The app reads the wallet and refuses zero/unknown balance, unknown/enabled auto-reload, an active top-up, or unverified prices. The wallet API cannot attest free-versus-purchased provenance; `FREE_CREDITS_APPROVED` is the operator's explicit attestation that existing funds are approved free credits. No purchase, top-up, payment, employer account creation, posting, application, upload or messaging endpoint exists in this app.

Agent uses the official API's documented **150-step default per employer**, with a sixty-second backend duration. Custom `max_steps` is beta-only and rejected this account's earlier ten-step request. The current implementation omits that beta field and reserves all 150 steps at the observed wallet rate before any discovery. Accepted Agent pricing is at most USD 0.02 per step: the maximum reserve is USD 3 per employer or USD 15 for five. A two-employer demo requires up to USD 6 plus a USD 0.01 buffer. The UI shows this bound. The wallet must cover the whole reserve; insufficient funds stop the run without a top-up. This reserve is an upper bound under the documented contract, not an estimated bill based on duration. Returned step counts above 150 stop further work. Provider step enforcement and billing remain trust boundaries.

Optional Browser mode requires pricing at or below USD 0.002 per minute and reserves four minutes per employer, USD 0.04 for five. It retains a sixty-second watchdog, explicit documented DELETE and a thirty-second inactivity fallback. Startup/connection failures preserve their phase and cleanup outcome. Unconfirmed cleanup stops further sessions. Neither workflow automatically retries a provider request or switches to the other. Search and Fetch must be priced at zero. No key is copied into the UI or evidence.

```sh
npm run check
npm test
npm run build
npm start
```

Local `?run=<uuid>` links reopen a retained run without spending credits. The last ten completed runs are validated and saved privately in `.data/runs.json`; restored UI views say “Recorded search” and retain actual checked timestamps. Run only one server process for this workspace. Running searches are in memory; completed history persists for up to ten runs. Provider work never resumes automatically after restart. The daily request ledger persists in `.data/budget.sqlite` using the Asia/Kolkata calendar day. Saved jobs persist only in this browser’s local storage (200 maximum); clearing browser data removes them. This is a local single-user MVP, not an internet-facing authenticated service.

## How TinyFish is essential

Official SDK `@tiny-fish/sdk` **0.8.0**, verified against npm during implementation; the [official coding-agent docs](https://docs.tinyfish.ai/for-coding-agents) and Browser reference were re-read on 15 October 2026. No invented URLs:

1. `client.search.query`: discovers official career entry URLs within the selected reviewed employer domains. Reviewed starting URLs are used if discovery has no suitable entry; search transport failure is reported as partial, never concealed.
2. `client.agent.run`: default workflow. It reads the selected employer's public listings and a bounded candidate set with a sixty-second duration and the API's documented 150-step default. It uses lite mode, no proxy, no profile and no vault. Goals treat website content and user preferences as untrusted data, forbid applications/forms/uploads/accounts/contact and limit listing pagination to two pages. The structured schema constrains each job enum and sets `maxItems` to the actual per-employer quota. The server validates sources, truncates over-budget output and reports partial scope; internal Agent navigation is a provider trust boundary.

   Optional `client.browser.sessions.create` mode uses a blank isolated browser with proxies disabled. Server-side Playwright CDP installs GET-only public-DNS guards before navigation. It mechanically limits two listing pages and four detail pages per employer. Session IDs and CDP URLs stay server-side. Termination uses the [documented official DELETE endpoint](https://docs.tinyfish.ai/browser-api/reference); failure reports retain cleanup status. This mode is explicit, never an automatic fallback.
3. `client.fetch.getContents`: reads robots rules in bounded batches of at most ten URLs and independently corroborates each candidate’s title and claimed optional fields from its source. Source text supplies missing fields and corrects role-specific arrangement/seniority in both workflows. Geographic restrictions require an explicit eligibility context in the source; a country in a location header or sponsorship question is insufficient. Unsupported optional enum labels stay unknown until verified source text supplies a supported value. Missing or contradicted evidence removes a claim or excludes the candidate. Fetch requests use `ttl: 0`; TinyFish may still honor upstream cache-control or its pinned-domain cache policy. “Last checked” means checked through TinyFish at that time, not a guarantee the origin was fetched in that second.

No external scraping or LLM substitutes for this pipeline. SDK routes are owned by the SDK. Browser/API contract tests use explicitly marked offline fixtures; they are not live TinyFish evidence.

Public starting pages were checked through read-only web access. Stripe now uses [careers/search](https://stripe.com/careers/search) and [careers/listing](https://stripe.com/careers/listing/ai-engineer/8144196); the catalog was updated from the redirecting `/jobs` path. Cloudflare and Stripe robots rules allow their public career paths as observed on 12 October 2026; the app still rechecks robots through TinyFish for every run. These checks are **source-path evidence only**, not TinyFish extraction evidence or sample jobs for the app.

## Search behavior

Keywords, location, arrangement, employment, seniority and visa preferences are user editable. Optional employer domains narrow a catalog of Cloudflare, Stripe, Atlassian, Datadog, HubSpot, Together AI and Affirm. Unchecked searches the first five; select up to five domains to narrow or change the set. Arbitrary domains are refused: to add a company, review its public access policy, career hosts, ATS ownership and URL paths in `src/catalog.ts`, then update browser link validation.

Each run visits at most five employers and considers at most twenty candidates, with at most four detail pages per employer in Browser mode. Browser navigation loops mechanically enforce two listing pages and the detail quota. The app also rejects any provider output claiming more than two listing pages. Default Agent mode uses a fixed goal for pagination; its internal clicks remain a provider trust boundary. No fallback expands the budget. Provider request reservations are capped at 32 per run, daily default 40 (configurable up to 64). Browser creation and DELETE are both reserved atomically before starting a session. CDP website GET requests have a separate limit of 300 per employer; images, fonts, media, WebSockets, downloads, service workers and non-GET requests are blocked. Robots and source failures can use quota without producing jobs. Missing fields remain “not stated.” Unknown fields are retained even under a preference; known conflicts are excluded. “Known fields only” removes unknown arrangement/seniority.

Remote arrangement never implies India eligibility. Exact geographic and visa restrictions are displayed separately. Explicit sponsorship filtering excludes unknown and denied sponsorship. Literal whole-word keyword matches are explained; no fit score is invented. Deduplication uses canonical URLs without tracking fragments plus employer/title/location identity. Posted and deadline text is copied, not inferred; past exact ISO deadlines and observed closed notices label expired. Old saved snapshots show a freshness notice; rerunning a search updates only rechecked jobs. A job absent from a bounded search is **not** marked closed.

Cards show a short source preview; the underlying evidence and CSV retain the original excerpt. CSV exports visible filtered jobs with all fields, source and checked timestamp; cells are quoted and formula-leading characters neutralized. Unknowns are “not stated.” Source links open the employer page; **you** choose any subsequent action. The application never applies on your behalf.

## Security and permitted access

Server binds only 127.0.0.1. Host, Origin, POST session-header, JSON body-size and schema checks prevent accidental cross-origin requests and DNS-rebinding of the local API. CSP forbids inline scripts and third-party assets. The exact public-asset allowlist includes the UI files and two local WOFF2 fonts, with no directory-serving route. Site output is text-only (`textContent`), including excerpts; no returned HTML is executed. Logs contain only fixed startup/status text; raw SDK errors, URLs and keys are never printed.

Known Greenhouse job-detail aliases normalize to its current hostname and matching job identifier; the target hostname, employer path and public DNS are checked before retrieval. Other returned source redirects are rejected. The server validates retrieval and returned source URLs using HTTPS, host/path allowlists, no credentials/unexpected ports/sensitive query keys, public-only DNS answers including IPv6 and mapped IPs, and returned source redirect validation. The browser additionally guards rendered links against unknown hosts, non-HTTPS URLs and embedded credentials; it cannot pin remote DNS or prevent a clicked employer site from redirecting. Robots checks fail closed on unavailable/unparseable rules. Login walls, CAPTCHA and restrictions instruct extraction to stop; no stealth/proxy, credentials, profile or vault is attached. This can leave blocked employers rather than bypassing restrictions.

**Provider trust boundary:** DNS prevalidation and per-request Browser interception cannot pin TinyFish’s remote resolver. Browser navigation and returned Fetch sources are validated, but TinyFish Fetch intermediate redirects and Agent internal clicks rely on provider isolation. Website JavaScript is untrusted: it runs in the isolated provider browser with GET-only resource guards, not in the product UI. Prompt instructions are not a network or mutation boundary. TinyFish must enforce its own resolver/private-network/redirect isolation; do not expose this app publicly or enable arbitrary URL targets based on these local checks.

## Tests and evidence

```sh
npm test                 # core + pipeline + CSV/storage fixtures; zero provider calls
npm run test:ui          # browser suite; its server explicitly clears provider credentials
```

If Chromium is missing, `npx playwright install chromium` installs the free browser test runtime. UI tests cover real setup state, server security gates, mobile overflow, and test-only intercepted cards/filters/save/reload/export/empty/blocked states. All intercepted jobs are visibly prefixed `[TEST FIXTURE]`. They are not production data.

With the local server running:

```sh
npm run demo
# Optional bounded live preference argument:
npm run demo -- '{"keywords":"software engineer","location":"","domains":["affirm.com","cloudflare.com"],"maxJobs":2}'
```

Without credentials this writes `evidence/demo-preflight.json` and exits 2. Local polling uses fresh connections and up to three status-read attempts. A POST is never automatically repeated. An interrupted demo saves `evidence/demo-interruption.json`; use `npm run demo -- --resume <run-id>` to read the same run without new provider work. Resumed evidence retains the actual completion/source-check times. The optional API/demo `maxJobs` value (1–20, at least the selected employer count) narrows the candidate budget; the UI defaults to 20. With approved credits the script runs one real search and writes `evidence/live-demo.json` containing only public job facts and fixed status codes. A demo succeeds only with source-verified listings from at least two employers. **Do not represent preflight or fixture test evidence as a working live demo.** `evidence/VERIFICATION.md` records checks actually executed and remaining gates.

## Two-minute demo script

1. Before recording, verify free credit provenance, auto-reload off, server environment and remaining daily requests. Hide terminals containing secrets.
2. Open Discover. Set internship/entry-level keywords and the intended location. Pick two reviewed employers; explain the five-employer/twenty-candidate limit.
3. Find live roles. Show stage updates and employer reports; discuss any partial or blocked result honestly.
4. Open one result’s source and confirm title, employer, geography and status on the employer website **at recording time**. Repeat for another employer. Unknown dates and geography remain unknown.
5. Show literal keyword matches, filter results, save a job, reload Saved jobs and export CSV. Do not click Apply or upload anything.
6. Run `npm run demo` only if you intend another bounded run; otherwise record the UI run’s source pages and public facts. Preserve the redacted evidence file; never record the key or session header.

The exact bounty asks for Search, Fetch and Agent. The combined run `26f6e0ca-5cff-4ae2-a419-a9861ea53b17` passed at 06:30 UTC on 15 October: Affirm's Software Engineer Intern (Summer 2027) in San Francisco, hybrid, and Cloudflare's Software Engineer Intern (2027) in Lisbon, on-site. Unknown eligibility, posted dates, deadlines and sponsorship remain null. It reported 16 and 9 Agent steps and seven provider requests; the CLI exited 0. The partial label preserves the deliberate one-candidate-per-employer scope. Earlier failures remain historical evidence.

The user explicitly authorized increasing the local daily request limit from 40 to 64 for immediate validation. The 39 already used were retained; the successful run brought usage to 46. The default stays 40, with configuration capped at 64. No spending ceiling, backend duration, step reservation or per-run cap was increased. SDK replies may take up to 180 seconds, while Agent execution remains capped at sixty seconds. No purchases or top-ups were made.

The user approved publishing this repository and the LinkedIn/Discord posts, then approved the additional X post required by the live form. The bounty was claimed to prepare its form; the completed form remains unsubmitted pending separate final approval. No purchases, top-ups or paid deployment occurred. `RELEASE-MANIFEST.json` records the original reviewed source payload at commit `4ee5d3ef093d3c0f58045a43b2f4d18cfe10def0`; later documentation records publication receipts.

## Local source package

[Submission copy, social drafts and open gates](docs/SUBMISSION.md) and [demo/reproduction steps](docs/DEMO.md) are included. The current rulebook allows a repository link as the working build; a public paid deployment is unnecessary. The signed-in program overview confirms the Student tier is current. The bounty was open when checked on 15 October; its exact closing timestamp was not displayed, so recheck open status before final submission. Search, Agent and Fetch are implemented; current live evidence and any remaining execution gate are stated above.

```sh
python3 scripts/package-release.py
```

This creates an allowlisted ZIP, SHA-256 checksum and file manifest in `release/`. It makes no network calls and publishes nothing. Required evidence must exist before packaging. It excludes the private environment, saved history, dependencies, compiled files and unrelated projects; checks the actual configured key bytes and selected credential patterns; and verifies archive member bytes. This is a scoped secret check, not proof against every possible secret format. The empty `.env.example` is included. After extraction, use the local setup steps above; no evidence is automatically loaded into production as live jobs.
