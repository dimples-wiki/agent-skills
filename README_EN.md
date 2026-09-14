# Agent Skills

English | [简体中文](./README.md)

dimples-wiki's AI agent skills collection, hosted on [skills.sh](https://skills.sh/dimples-wiki/agent-skills).

## Available Skills

### dev-log

AI debugging collaboration solution. Collects runtime logs via HTTP requests, allowing AI to automatically analyze logs after user operations - no screenshots or console copying needed.

**Supports 13 Languages:** JavaScript, TypeScript, Python, Go, PHP, Ruby, Java, C++, C#, Rust, Swift, Kotlin, Dart

**Problem Solved:**

Traditional debugging requires developers to open the console, take screenshots, or copy output to send to AI - inefficient. dev-log collects logs via HTTP service, allowing AI to **read logs directly** without manual user intervention.

**Use Cases:**
- Debug/verify code
- Trace async flows (fetch, Promise, async/await)
- Validate logic (form validation, state updates, conditions)
- View variable values (especially dynamic or user input)

**Features:**
- One CLI command generates log code for 13 languages (`npx dev-log gen`)
- Fixed-port HTTP server (7331) — no random ports or port files
- Optional tunnel for HTTPS pages / remote access
- Session isolation (sessionId filtering), shared multi-session server
- Auto-injected `__ready__` connectivity probe and timestamps

**Typical Workflow:**

1. **Start server** - `npx dev-log start`
2. **Instrument** - `npx dev-log gen --lang js --type state --data '{...}'`; AI inserts the printed snippet at key points
3. **Wait for Action** - AI says "Logs added, please operate"
4. **Complete Action** - User says "I've completed the operation"
5. **Auto Analysis** - `npx dev-log logs --session sess_xxx`; AI reads and analyzes

No screenshots or log copying needed - AI handles debugging autonomously.

**Install:**
```bash
npx skills add dimples-wiki/agent-skills -s dev-log -y
```

> The dev-log CLI is also published to npm and works standalone: `npx @dev-log/cli start`

### llm-wiki

Turn your LLM into a Wiki maintainer. The LLM incrementally builds and maintains a persistent, interconnected Markdown knowledge base. Knowledge is compiled once and continuously updated, rather than re-derived each time.

**Inspired by:**
- [Karpathy - LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — Incremental knowledge base architecture
- [Compound Engineering Plugin](https://github.com/EveryInc/compound-engineering-plugin) — Knowledge compounding

**5 Operations:**

| Operation | Purpose |
|-----------|---------|
| `init` | Initialize knowledge base directory and templates |
| `ingest` | Ingest new materials, extract knowledge into the Wiki |
| `compound` | Document problem-solving experiences (Bug Track / Knowledge Track) |
| `query` | Answer questions based on Wiki content, archive valuable answers as topic pages |
| `lint` | Health check: contradictions, orphan pages, missing concepts, etc. |

**Use Cases:**
- Academic research, reading notes, competitive analysis
- Engineering practice documentation (bug fixes, best practices)
- Long-term topic research with knowledge accumulation

**Typical Workflow:**

1. **Initialize** - "Help me create a wiki" → AI creates directory structure and templates
2. **Ingest Materials** - User provides articles/papers/links → AI extracts knowledge, creates entity pages, concept pages, source summaries
3. **Compound Experience** - Say "Fixed it" after solving a problem → AI auto-documents as Bug Track or Knowledge Track
4. **Query Knowledge** - "What's the difference between X and Y?" → AI synthesizes from multiple pages, archives valuable answers as topic pages
5. **Health Check** - "Check the wiki" → AI detects contradictions, orphan pages, missing concepts, suggests fixes

**Install:**
```bash
npx skills add dimples-wiki/agent-skills -s llm-wiki-en -y
```

### aha

Turn any complex concept into a **standalone, visually rich HTML explainer page** — layered from a one-liner through intuition to the real mechanism and its boundaries. Goal: a correct mental model, not the feeling of understanding.

**Core mechanics:**

| Mechanism | What it does |
|---|---|
| 7-layer skeleton | one-liner → why it exists → intuition (analogy **with explicit limits**) → real mechanism → commonly-confused neighbors → boundaries & failure modes → "Remember" |
| Entry calibration | L1/L2/L3 starting depth inferred from the user's phrasing; adjusts entry point and analogy choice, never deletes layers |
| Shipped assets | design tokens (3 presets × dark/light), a full reference page, a step-simulator scaffold, snippet library |
| 11 quality gates | `aha check`: single h1 / heading order / head meta / img alt / tokens inlined & canonical-matched / no color literals outside tokens / class registry / script syntax / no questioner references / consistent failure tags / localized simulator labels |
| Honest receipt | never claim visual verification that wasn't performed |

**Workflow:** `/aha Transformer attention` → agent calibrates entry level → writes `~/.aha/<slug>.html` (self-contained, with theme/preset/share toolbar) → `aha check` (11 gates) → `aha start` (idempotent background daemon; receipt links the page + the shelf) → `aha serve` (local index of all generated pages) or `aha share` (free Cloudflare quick tunnel, no account needed).

**Install:**
```bash
npx skills add dimples-wiki/agent-skills -s aha -y
```

> CLI: `npx @dimples/aha check|serve|share` once published; until then run `node packages/aha-cli/src/cli.mjs <command>` from the repo.

## Installation

**Install all skills:**

```bash
npx skills add dimples-wiki/agent-skills -s '*' -y
```

**Install individual skills by language:**

```bash
# Chinese version
npx skills add dimples-wiki/agent-skills -s dev-log -y
npx skills add dimples-wiki/agent-skills -s llm-wiki -y
npx skills add dimples-wiki/agent-skills -s aha -y

# English
npx skills add dimples-wiki/agent-skills -s llm-wiki-en -y
```

## Links

- [Skills Directory](https://skills.sh/dimples-wiki/agent-skills)
- [Agent Skills Specification](https://agentskills.io/specification)
- [Vercel Skills CLI](https://github.com/vercel-labs/skills)

## License

ISC
