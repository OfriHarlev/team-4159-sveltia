# Team 4159 CardinalBotics — Sveltia variant

A competing implementation of the team website, built to compare against the EmDash-based variant (`../team-4159-website`). Same design, same content, different CMS architecture.

**Live:** https://team-4159-sveltia.pages.dev
**EmDash variant:** https://team-4159-website.4159-cardinalbotics-account.workers.dev

---

## Stack

| Piece | This variant (Sveltia) | EmDash variant |
|---|---|---|
| CMS | Sveltia CMS (git-backed) | EmDash (D1-backed) |
| Runtime | Cloudflare Pages (static) | Cloudflare Workers (server) |
| Storage | Markdown/JSON in repo | D1 database |
| Media | R2 (shared with EmDash variant via binding) | R2 |
| Auth | GitHub OAuth | EmDash built-in |
| Build output | 116 static HTML files | SSR worker |
| Deploy | `wrangler pages deploy dist` | `wrangler deploy` |

## What's the same

- Design, theme, typography — cardinal red + warm black + Instrument Serif / DM Sans / JetBrains Mono
- Homepage layout — same editorial hero, mission section, index, news grid, colophon
- All 111 pages + 3 posts (imported from the same EmDash D1)
- Media served from the same R2 bucket (`team-4159-website-bucket`) via a Pages function

## What's different

- **Content is markdown files in `src/content/`**, not a database. `git log` is your change history.
- **Admin lives at `/admin/`** — a single HTML page that loads Sveltia CMS from a CDN. No sandboxed plugins or Dynamic Workers needed.
- **Auth is GitHub OAuth** — students log in with their GitHub account (needs the team GitHub org to add them as editors).
- **Every edit is a commit** — full rollback via git, blame-able changes, PRs possible.
- **Zero external service dependencies** beyond Cloudflare + GitHub.

## Admin walkthrough (for students)

1. Go to https://team-4159-sveltia.pages.dev/admin/
2. Log in with GitHub (first time: accept the app authorization)
3. Edit a page → Save → Sveltia commits to `main` → Pages rebuilds → live in ~30 seconds

## Local development

```bash
pnpm install
pnpm dev                 # Astro dev server at localhost:4321
```

Admin preview (no GitHub auth needed, uses a local proxy):
```bash
# in a second terminal
npx @sveltia/cms-proxy-server
# now /admin/ works against the local filesystem
```

## Exporting content from the EmDash variant

The source of truth was the EmDash D1 database. To re-pull fresh content:

```bash
# Requires wrangler authenticated to the 4159 CardinalBotics account
pnpm node scripts/export-from-emdash.mjs
```

This queries prod D1 and writes:
- `src/content/pages/*.md` — 111 published pages, frontmatter + HTML body
- `src/content/posts/*.md` — 3 published posts
- `src/content/homepage/main.json` — homepage slots

## Deploy

```bash
pnpm build                                      # writes dist/
npx wrangler pages deploy dist --project-name=team-4159-sveltia --branch=main
```

## R2 binding setup (one-time)

The Pages function at `functions/wp-content/uploads/[[path]].ts` needs the `MEDIA` R2 binding. Either:
- Set it in `wrangler.jsonc` (already done) — newer wrangler auto-applies
- Or in Cloudflare dashboard: Pages → team-4159-sveltia → Settings → Functions → R2 bucket bindings → Add: `MEDIA` → `team-4159-website-bucket`

## Known gaps vs EmDash variant

- **No live search** — would need a client-side index (Pagefind is a good fit — static, fast, drop-in)
- **No bylines/comments** — git commit history is the implicit byline; comments would need a third party
- **Content is HTML with markdown frontmatter**, not rich PortableText — most pages are imported WP content so this is actually fine
- **GitHub OAuth setup required** — Sveltia can proxy through Netlify's free OAuth relay, or self-host `sveltia-cms-auth` on a Worker (~50 lines)

## Comparison verdict (short)

**Sveltia wins on simplicity, reliability, and cost.** Every breaking change we hit on the EmDash side would be a no-op here — schema is YAML, content is files, admin loads from a CDN.

**EmDash wins on richness** — PortableText, bylines, comments, live search, widgets, sections — if you actually need those.

For a student robotics team that edits content ~10 times a year, Sveltia is the better fit. See the conversation transcript for the full cost/benefit discussion.
