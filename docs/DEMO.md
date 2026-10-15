# FirstStep demonstration

Use Node 22.13 or newer (Node 24 recommended). From the extracted application folder:

```sh
npm ci
test -e .env || cp .env.example .env
npm run check
npm test
npm run build
npm start
```

Open http://127.0.0.1:4317. The archive has an empty `.env.example`, no key and no private run history. Configure your existing server-side TinyFish key and approved free-credit attestation as described in the README. No job fixtures are loaded into production. Never purchase credits, enable auto-reload or reset the request ledger to make a demo pass.

The isolated browser tests disable credentials and make no provider requests:

```sh
npm run test:ui
```

Test listings are explicitly labeled offline fixtures. Install the free test runtime with `npx playwright install chromium` if required.

## Live walkthrough, about two minutes after extraction finishes

1. Check existing free-credit provenance, auto-reload off and remaining daily requests. Agent reserves all 150 documented default steps per employer: at most USD 3 each or USD 15 for five. Actual charges may be lower. Keep private settings and terminals off screen.
2. In Discover, choose role keywords, location, arrangement, type, seniority and visa preferences. Pick Cloudflare and Affirm for the current two-employer case. Explain the five-employer/twenty-candidate maximum and that the CLI example narrows this to one candidate each.
3. Start one search and show stages and employer reports. Search discovers pages, Agent navigates them and Fetch verifies public source text. A partial, blocked or timed-out result stays labeled; do not automatically repeat the search.
4. Open each returned source and compare its title, requirements, arrangement and geography. Remote never implies India eligibility. Unknowns stay visible. Do not click Apply, submit forms, upload a resume, create an account or contact anyone.
5. Filter results, save a job, reload Saved jobs and export CSV. Show source URLs and original last-checked timestamps.
6. Report the actual result and bounded scope. Two verified employers are required for the CLI demo to pass; no bounty score or sponsor approval is claimed.

Run the live CLI only when enough approved existing credits and daily request reservations remain:

```sh
npm run demo
npm run demo -- '{"keywords":"software","location":"","domains":["affirm.com","cloudflare.com"],"seniority":"early-career","maxJobs":2}'
```

This starts exactly one search. The script exits nonzero unless source-verified open jobs come from at least two employers. It saves genuine results to `evidence/live-demo.json`, including failures. Before another run preserve that file. An interrupted status read never repeats the POST; recover with `npm run demo -- --resume <run-id>`, which reads the same run without new TinyFish work. Resumed evidence retains the actual completion and source timestamps.

## Actual recorded results

The combined Agent demo **passed**, run `26f6e0ca-5cff-4ae2-a419-a9861ea53b17`, completed on 15 October at 06:30:46 UTC. It returned two open, Fetch-corroborated listings: Affirm Software Engineer Intern (Summer 2027), San Francisco, hybrid; and Cloudflare Software Engineer Intern (2027), Lisbon, on-site. The CLI exited 0. It used seven provider-request reservations and reported 16 / 9 Agent steps. The run stays partial because it deliberately checked only one candidate per employer. All unstated dates, sponsorship and geographic eligibility stay unknown.

The existing workspace can reopen it at `http://127.0.0.1:4317/?run=26f6e0ca-5cff-4ae2-a419-a9861ea53b17` without new TinyFish work. A clean extraction does not include private history. `live-agent-combined-2026-10-15.json` preserves the successful run; `live-demo.json` is the CLI's latest result. Actual two-row CSV and desktop/mobile captures are included. Reading recorded evidence performs no live search and never seeds production.

The user authorized increasing the local daily allowance from 40 to 64 for immediate validation. Usage was preserved at 39 and reached 46 after the successful run. The default remains 40, the configurable ceiling is 64, and all run/job/employer/spending caps are retained. Do not reset the ledger. SDK response waiting is 180 seconds; Agent's backend duration remains sixty seconds.

Earlier attempts, including the `061a910a-7a37-4aad-8fdc-e9948483520c` Affirm timeout, are historical failures. The earlier `b7fbff1a-2d8f-41d6-89b7-d8d5629d5dd8` source-verified entry-level Affirm role and the new internship results demonstrate different inputs. The original 14 October Browser run and 15 October Fetch recheck remain separately dated evidence.

The auxiliary source-refresh helper is typechecked and respects ten-URL batches and the same ledger; its latest edits have not been run live. It is optional and unnecessary for the demonstrated default Search/Agent/Fetch workflow. The UI test command builds its isolated server first and explicitly disables direct and shared provider credentials. Nothing was published, posted, claimed or submitted.
