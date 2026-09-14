# @dimples/aha

CLI companion for the [aha agent skill](../) — quality gates, local server, and
free public sharing for generated explainer HTML pages.

```
aha start [dir] [--port N] background daemon (refreshes if already running; log <pages-dir>/.serve.log) + stop
aha check <file.html>      11 static quality gates + honest receipt (exit 1 on any failure)
aha serve [dir] [--port N] local server (default dir ~/.aha, port 7332); index page lists all generated pages
aha share [dir] [--port N] serve + Cloudflare quick tunnel (free https://*.trycloudflare.com link, no account)
```

- Zero runtime dependencies (Node ≥ 18, `node:*` built-ins only)
- Storage layout: the `~/.aha` root always exists (holds `config.json`,
  `bin/cloudflared`, daemon pid/log); the HTML pages directory is whatever
  `config.json` says. On Windows, `aha new` guides the choice exactly once —
  first run suggests a non-C drive (D:…Z:, writable, ≥1 GiB free), existing
  users get `aha config "D:\aha" --migrate` (moves pages) or
  `aha config --keep-c` (stay, never asked again). `AHA_HOME` env overrides
  everything for CI/tests
- Pages are single-file self-contained HTML; `check` enforces that contract
  (single h1, heading order, head meta, img alt, inlined design tokens,
  no color literals outside tokens, class registry, script syntax)
- Share API is local-only: session-token auth + Cloudflare-edge (`cf-ray`)
  requests are rejected, so public visitors can never trigger installs/tunnels

Auto-install: `share` installs cloudflared via Homebrew on macOS (or the
official GitHub-release binary to `~/.aha/bin` on Linux / brew-less macOS;
version-pinned). Windows: install cloudflared manually
(`winget install --id Cloudflare.cloudflared`), sharing then works the same.

Development: `npm test` (node:test, no build step).
