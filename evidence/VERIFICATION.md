# FirstStep verification, 15 October 2026

**Technical gates passed. Publication and social posts verified; bounty submitted and IN REVIEW.** The default Search/Agent/Fetch workflow passed its combined two-employer live demo. The repository, LinkedIn, TinyFish Discord showcase and separately approved X post are published. The user approved the completed form and its saved submission was verified after reloading.

## Successful combined live demo

Run `26f6e0ca-5cff-4ae2-a419-a9861ea53b17` began at 06:27:17 UTC and completed at 06:30:46 UTC. The CLI exited **0**. It used seven actual provider-request reservations: wallet, Search, one bounded robots batch, two Agent calls and two source Fetch calls. It reported 16 Agent steps for Affirm and 9 for Cloudflare.

| Employer | Genuine open role | Source-checked facts |
|---|---|---|
| Affirm | Software Engineer Intern (Summer 2027), job 8011590003 | San Francisco, California, United States; hybrid; internship; checked 06:29:08 UTC |
| Cloudflare | Software Engineer Intern (2027), job 8245197 | Lisbon, PT; on-site; internship; checked 06:30:46 UTC |

The run remains **partial** because the demo intentionally checked one candidate per employer. This does not claim every listing or page was checked. Geographic eligibility, posted dates, deadlines and sponsorship stay null where unstated. Remote company marketing does not override the role's arrangement. Both public source pages were also opened independently through read-only web access that day. No Apply action, form submission, account, upload or contact action was used.

TinyFish Search discovered public career hints, Agent navigated the selected employer listings, and Fetch checked robots rules and independently corroborated each returned source. All three required sponsor APIs did meaningful work. SDK `@tiny-fish/sdk` 0.8.0 was confirmed current in the official npm registry on 15 October. The coding-agent and API references were read that day. No endpoint points or sponsor approval are claimed.

## UI and local checks

51 core/CLI tests and five isolated browser tests pass, with zero provider calls. The suite covers public DNS and canonicalized ATS URLs, duplicates, pagination, missing dates, misleading remote labels, geographic context, API failures, wallet and full-step reserves, bounded Fetch batches, saved-job/CSV validation and interrupted status reads. All offline jobs are labeled fixtures; there is no production fixture provider.

The initial development-server UI-test startup timed out before tests ran. The test command now builds first and starts the compiled server, with direct/shared credentials explicitly disabled and a bounded startup timeout. All five browser cases subsequently passed. The historical failure transcript is retained locally under `history/`; it is not presented as a successful test run.

The real combined run was opened in FirstStep. Hybrid retained only Affirm; On-site retained only Cloudflare. The genuine Affirm internship was saved and remained saved after a reload, taking the existing workspace to four real saved snapshots. The actual CSV download contains exactly two jobs and preserves their source URLs and checked times. Desktop 1280px and mobile 390px captures show the real results, partial label and unknown eligibility. The temporary viewport override was reset. No synthetic job was inserted through browser tools. Long source text has a short UI preview; evidence and CSV retain the actual excerpt.

The Cloudflare “Available Locations” / “In-Office” parser and geographic-context fixes contributed to this successful live run. Earlier different-input Agent attempts (`engineer` / `San Francisco`) verified an entry-level Affirm role; the combined run (`software engineer`, no location constraint) returned internships. Maximum pagination at two pages remains offline-tested rather than an exhaustive live claim for all seven catalog employers.

The optional source-refresh utility is typechecked, uses ten-URL batches and the same ledger; its latest edits were not rerun against TinyFish. It is unnecessary for the demonstrated default workflow. A clean archive extraction independently installs locked dependencies with install scripts disabled, checks types, runs all 51 core tests, builds and exercises localhost/security with credentials disabled. `submission/archive-smoke.json` records the exact checked scope; final application bytes are compared to that extraction.

## Bounded credits and explicit limit authority

The user explicitly requested immediate validation and authorized increasing the limit if needed. The local daily allowance changed from 40 to **64**, preserving the 39 requests already used. The successful run brought usage to **46/64**. The default remains 40 and the configurable ceiling is 64. `submission/request-limit-authorization.json` records this authority. The ledger was not reset.

Per-run requests remain 32, employers five, candidates twenty. Agent backend duration remains sixty seconds. Its documented 150-step default per employer is fully reserved at the verified wallet rate before discovery, at most USD 3 each or USD 15 for five plus a buffer. The SDK waits up to 180 seconds for a delayed response; this does not extend execution or paid-step limits. SDK retries are disabled and no workflow fallback occurs. Wallet safety/rate/reserve gates passed at the start of the genuine run. Existing free-credit provenance remains the operator's attestation, not something the wallet API can establish. No purchase, top-up or auto-reload was enabled or invoked.

The beta-only custom step-cap rejection and earlier duration-only workaround rejection are historical. Omitting that beta field uses the official documented default and reserves its full cost. Provider execution, billing and isolation remain trust boundaries; the app does not claim local control of internal Agent clicks or intermediate Fetch redirects.

## Evidence map

| Artifact | Scope |
|---|---|
| `live-demo.json`, `live-agent-combined-2026-10-15.json` | Genuine successful combined Agent demo, original timestamps, two verified open jobs, seven requests |
| `live-combined-desktop-2026-10-15.jpg`, `live-combined-mobile-2026-10-15.jpg` | Actual UI captures of the same run with no inserted jobs |
| `live-jobs-combined-2026-10-15.csv` | Actual two-row UI export |
| `agent-final-partial-2026-10-15.json`, earlier partial/redirect/failure files | Historical failed attempts retained honestly; not the current verdict |
| `agent-candidate-diagnostic.json` | Official SDK metadata; candidate entries are explicitly UNVERIFIED diagnostic data |
| `agent-verified-jobs-2026-10-15.json` | Historical collection across separate runs; not a combined pass |
| `live-browser-rechecked-2026-10-15.json` | Historical two-employer Browser run from 14 October, both sources rechecked through Fetch at 03:51 UTC on 15 October |
| Original Browser screenshots, CSV and wallet receipts | Dated historical proof; wallet delta may include other projects and is not exact app cost |
| Test/build text files, `readiness-checks.json` | Actual local checks and their scope |
| `submission/rules-check.json`, `submission/status.json` | Read-only program observation and local readiness ledger; neither is a saved submission |
| `submission/archive-smoke.json`, `submission/secret-scan.json` | Clean extraction and scoped credential checks; not publication authority |

## Rules, secrets and saved submission

Careers Finder was open before the portal claim required to prepare its form. The exact brief and rulebook were reread; the Student tier is CURRENT. The live form requires a build link plus LinkedIn and X URLs. This corrects the earlier X-optional statement. The actual verified repository and three social links are in `../docs/SUBMISSION.md` and `submission/publication-receipts.json`. The completed review copy is `submission/completed-form.json`. The user later approved the completed form; `submission/portal-receipt.json` records the successful final submission and persisted IN REVIEW status.

The installed secret scanner passed its staged-parent scope with zero findings; those staged files belong to another project and do not cover this untracked app. The release packager separately scans every selected source/evidence byte and actual ZIP member against the configured TinyFish key and selected credential patterns. No matched values are printed. `.env.example` is zero bytes; private environment/history, balances, dependencies, compiled output and unrelated projects are excluded. This is a scoped scan, not a guarantee about unknown secret formats or Git history.

Design triage fixed contrast and the empty-state icon tile. Narrow persisted exceptions retain the intentional Space Grotesk face and a light-surface shadow falsely flagged as dark glow. No contrast rule or whole file is suppressed; no design findings were left standing in the last scoped scan. This is not a full WCAG certification.

Source and approved social posts are published. The bounty was claimed to prepare the completed form. The user separately approved final submission. The portal confirmed Bounty submitted; the saved card retains the approved notes and both screenshots and shows IN REVIEW after reloading. No sponsor approval, points or payout is claimed.

Publication scan: the installed staged text scanner reported zero findings with eight binary assets omitted. A separate byte scan covered all 81 staged files, including those fonts and genuine screenshots, for the configured key and selected credential patterns with zero matches. All 80 manifest inputs matched their reviewed hashes. Unknown credential formats and image OCR are outside that scan.
