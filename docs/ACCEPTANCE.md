# Careers Finder acceptance checklist

Exact brief read in the signed-in TinyBounties board on 12 October 2026, reverified with its rulebook on 15 October 2026:
https://www.tinybounties.com/crm?view=board → Job Portal / Careers Finder.
This is a transcription of the visible brief, not a recollection. No claim or submission was made.

> Build a TinyFish-powered job and internship finder. Pull live openings from company careers pages and job portals, match them to what the user is looking for (role, location, seniority, visa), and keep the results fresh. You're on careers portals every week anyway, so build the tool you'd actually use.

Submission requirements:
1. Working demo.
2. User can set their own preferences (role, location, keywords).
3. Pulls openings from multiple live careers pages or job portals.
4. Returns structured, deduplicated listings with links to apply.
5. Short explanation of how TinyFish Search, Fetch and Agent are used.

Approval criteria:
1. Uses TinyFish meaningfully to discover and read listings.
2. Uses live web data rather than hardcoded listings.
3. Works across multiple companies or portals.
4. Works for different roles, locations, and inputs.
5. Filters, matches, or ranks results rather than dumping raw pages.

Scoring: 1 endpoint 50 points; 2 endpoints 100; 3+ endpoints 200. Endpoints must contribute meaningfully; padding does not qualify. Individual entries, top 3 builds approved, 18 days from launch (exact launch date not verified).

## Combined acceptance checklist

| Requirement | Evidence / acceptance gate |
|---|---|
| Role keywords, location, remote, employment type, optional employer domains, seniority, visa preferences | Form, input validation, filter tests |
| TinyFish essential; official current SDK | @tiny-fish/sdk 0.8.0 checked against npm and official documentation; no production fixture provider |
| Multiple public employer career pages | Vetted employer catalog; Search discovers source hints; Agent navigates listings by default; Browser is an explicit alternative; Fetch checks individual source text |
| Five employers, twenty jobs per run | Server caps, quotas, no more than two listing pages requested per employer; tests |
| Unknown fields preserved; dates and eligibility not invented | Nullable schema; unknown remains visible, geographic restrictions separate from remote |
| Structured listings with source links and checked timestamps | Normalization; source validation; employer identity bound to catalog |
| Deduplicate canonical URL and employer/title/location | Unit tests |
| Local save, filters, safe CSV | Browser storage validation; formula escaping; tests |
| Keyword explanation with no fit score | Literal evidence matches, UI explanatory text |
| Empty, partial, blocked, expired and failure states | Search state model and UI; injected-provider tests |
| Pagination, duplicates, missing dates, misleading remote, failures tested | Automated suite; all fixtures explicitly labeled |
| Secrets server-side, empty .env.example, redacted logs, SSRF protection | HTTPS/DNS/IP/host/path allowlists; same-origin local API; security tests |
| No applying, résumé upload, accounts, contacting, purchases or top-ups | Fixed read-only goals; no mutation routes; no vault/profile; fail closed on credit configuration |
| Approved free credits only and bounded requests | Explicit operator attestation; wallet auto-reload off; persistent daily request budget; no automatic retries |
| Runnable app, README, tests, demo script, genuine redacted evidence | Local build/UI proof and genuine two-employer TinyFish live evidence |
| Current source-verifiable live jobs in demo | Combined Search/Agent/Fetch demo passed on 15 October at 06:30 UTC: two open source-verified internships at Affirm and Cloudflare, seven requests, CLI exit 0. Partial label retains the one-candidate quota. Historical failures are preserved separately |

## Publication gates

Rulebook requires a working build link, LinkedIn post tagging TinyFish, and Discord #showcase sharing. User explicitly forbids publication, paid deployment, social posts, or bounty submission without approval. These actions are deferred. No social account or bounty state was changed.

The 15 October signed-in rulebook accepts a repository, live demo or cookbook PR for the build link. Individual Students/Ambassadors entries, one submission per person/bounty, 18 days from launch and final submissions are required. The signed-in program overview confirms the Student tier is CURRENT. The exact closing timestamp was not displayed; recheck the open board immediately before submission. The bounty remains unclaimed in the account state reviewed. See `SUBMISSION.md` for the reviewable local package and draft text.

No AGENTS.md or CONTRIBUTING file was found in the workspace or its ancestor directories. Existing unrelated text-the-web files are preserved.

## Implementation verification

Final local verification passed 51 core/integration/CLI tests and 5 browser tests, typecheck and build. Genuine desktop/mobile captures, save/filter behavior and a two-row CSV were verified in the compiled app.

On 14 October the existing shared server-side key was reused with the recorded free-credit approval. A real Search/Browser/Fetch run returned a Together AI engineering internship and an Affirm early-career software role, followed by a genuine Fetch source refresh. Each employer supplied one open source-verified listing; both Browser DELETE requests were confirmed. The run remains partial because more candidate links exist. There are no production fixture jobs. The live JSON, wallet receipt and recorded-search screenshots are in `../evidence`.

The Agent beta step-cap rejection is resolved by the official documented 150-step default, fully reserved before discovery. The combined Search/Agent/Fetch demo passed on 15 October at 06:30 UTC, run `26f6e0ca-5cff-4ae2-a419-a9861ea53b17`, with an Affirm internship in San Francisco (hybrid) and a Cloudflare internship in Lisbon (on-site). It used seven requests and reported 16 and 9 Agent steps. CLI exit 0. Both source pages were independently opened read-only that day. The partial label preserves the deliberate quota of one candidate per employer. The current “Available Locations”/“In-Office” and geographic-context logic contributed to this live run.

Earlier Agent runs with `engineer` / `San Francisco` returned Affirm's entry-level role; the successful combined run used `software engineer` with no location constraint and returned internships. This establishes meaningful different-input behavior alongside offline filter tests. Two-page maximum pagination remains fixture-tested rather than a claim that every employer was exhaustively paginated live.

The user then authorized a bounded daily-limit increase for immediate validation. The ledger preserved 39 used requests and now shows 46 of 64. The default is 40; no per-run, employer, job, Agent step or spending cap changed. No sponsor approval or endpoint points are claimed. No bounty submission or publication occurred.
