# make.fun front end

A fast, read-only front end for [make.fun](https://make.fun), built for the
“Build the best make.fun frontend” bounty. No framework, no build step: plain
static files under `app/` that read only the public make.fun API.

## Surfaces

- `#/` — the bounty board: live pot, entry fee, time left and entries for
  every bounty, with filter, sort and search.
- `#/bounty/<slug>` — a bounty's page: live rewards table, description and
  rules, dates and status.
- `#/bounty/<slug>/leaderboard` — that bounty's leaderboard, paginated
  50 rows at a time, with overall/performance views where the API offers them.
- `#/u/<handle>` — an account's public profile: record, prize money, entries.

## Performance notes

- API answers are cached in memory and revalidated with `ETag` /
  `If-None-Match` (the API's tags turn over once a minute), so repeat visits
  cost no request and later ones cost a 304 at most.
- Long lists render in pages of 50; countdowns tick by rewriting only the
  time-left texts, never the whole page.
- First load is `index.html` + one stylesheet + four small ES modules, system
  fonts only — no framework, no font downloads.

## Run it

```sh
node serve.ts          # serves app/ at http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory and
writes `dossier.json` with the kit's vendored `vendor/makefun-frontend.ts`.
`screenshots/` holds three real renders of the app on live data; the first
by name is the cover. See `shots.json` for which route each shot shows.

## License

MIT — see `LICENSE`.
