# openmd

A local-first markdown workspace with an Obsidian-style launcher, multi-pane Monaco editor, and real-time collaboration. Run it as a desktop app, from the terminal, or as a headless server that remote clients connect to.

## Features

- **Project launcher** — create a new project, open a folder, pick from recents, or connect to a remote server
- **File tree** — browse, create, rename, move, and delete files and folders in your workspace
- **Multi-pane editor** — split editors by dragging tabs to pane edges; Monaco for text, viewers for PDF and images
- **Collaboration** — Yjs + WebSockets for shared editing when multiple people are in the same workspace
- **Live share** — tunnel a local workspace through a relay so guests can connect without port forwarding
- **Export & Leafmark** — export markdown and run Leafmark from the menubar
- **Native desktop shell** — Tauri app with macOS menubar, folder pickers, and an embedded API server

## Install

### Desktop app (recommended)

Download the installer for your platform from [GitHub Releases](https://github.com/DDDASHXD/openmd/releases).

| Platform | Asset |
|----------|-------|
| macOS (Apple Silicon) | `openmd_*_aarch64.dmg` |
| macOS (Intel) | `openmd_*_x64.dmg` |
| Windows | `openmd_*_x64-setup.exe` |
| Linux | `.deb` or `.AppImage` |

**macOS note:** Release builds are ad-hoc signed, not notarized. If macOS says the app is damaged:

```bash
xattr -cr /Applications/openmd.app
```

Or right-click **openmd.app** → **Open** → **Open** again.

### CLI (no install)

Run the full UI + server from npm without cloning the repo:

```bash
pnpx openmd
```

Open a specific workspace:

```bash
pnpx openmd --workspace /path/to/project
```

The server starts on port 3000 by default and opens the launcher at `http://127.0.0.1:3000/launcher`.

## Development

### Prerequisites

- **Node.js** >= 20
- **pnpm** 9 (see `packageManager` in root `package.json`)
- **Rust** >= 1.88 via [rustup](https://rustup.rs/) (for desktop builds only)

### Setup

```bash
git clone https://github.com/DDDASHXD/openmd.git
cd openmd
pnpm install
```

### Web app + server

From `apps/web`, dev mode runs `openmd-server` with the Next.js UI:

```bash
pnpm --filter web dev
```

Or from the repo root:

```bash
pnpm dev
```

Adjust the default workspace path in `apps/web/package.json` (`dev` script) or pass `--workspace` consistently when starting the server.

### Desktop app

One-time Rust setup:

```bash
pnpm --filter desktop setup:rust
```

Start Tauri dev (spawns the server on port 3000, then opens the desktop window):

```bash
pnpm desktop:dev
```

If a previous dev server left a stale lock:

```bash
pnpm --filter desktop dev:stop
pnpm desktop:dev
```

Build a production desktop bundle locally:

```bash
pnpm desktop:build
```

Output lands under `apps/desktop/src-tauri/target/release/bundle/`.

### Headless server

Run API + collaboration WebSockets without the Next.js UI. Useful for VPS or LAN deployments where clients use **Connect to server** in the launcher.

```bash
pnpm server:headless
```

Default: workspace `./test-workspace`, port `8787`, bind `0.0.0.0`.

Direct invocation:

```bash
openmd-server \
  --headless \
  --workspace /path/to/project \
  --port 8787 \
  --hostname 0.0.0.0
```

Health check:

```bash
curl http://127.0.0.1:8787/api/health
```

### Live share relay

The relay lets a host share a local workspace through a public URL. Default hosted relay: `https://openmd.skxv.dev`.

Run your own:

```bash
pnpm --filter @openmd/relay dev
```

Or:

```bash
openmd-relay --port 8788 --public-base https://relay.example.com
```

In the desktop app, use **File → Start live share**. The Tauri shell starts `openmd-relay-client` automatically to tunnel your local server to the relay.

See `packages/openmd-relay/README.md` for API details and self-hosting.

## How it fits together

```
┌─────────────────────────────────────────────────────────┐
│  Desktop (Tauri)                                        │
│  Static UI (launcher + editor) + embedded Node server  │
└──────────────────────────┬──────────────────────────────┘
                           │ http://127.0.0.1:<port>
┌──────────────────────────▼──────────────────────────────┐
│  @openmd/server                                         │
│  Workspace API · Yjs WS · optional Next.js (dev/CLI)    │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   Local filesystem   Collaborators    Relay (live share)
```

| Entry point | What it runs |
|-------------|--------------|
| `pnpx openmd` | Full mode: Next.js UI + server |
| Desktop app (release) | Static exported UI + headless server |
| `openmd-server --headless` | API + WebSockets only |
| `openmd-relay` + `openmd-relay-client` | Public tunnel for live share |

## Repository layout

| Path | Role |
|------|------|
| `apps/web/` | Next.js UI — launcher, editor, components, stores |
| `apps/desktop/` | Tauri shell — native menus, folder dialogs, server lifecycle |
| `packages/openmd-server/` | Workspace runtime — filesystem API, collaboration, headless mode |
| `packages/openmd-relay/` | Live share relay + tunnel client |
| `packages/ui/` | Shared UI components (`@workspace/ui`, shadcn-style) |
| `bin/openmd.mjs` | CLI entry for `pnpx openmd` |

Contributor-oriented internals are documented in `AGENTS.md`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev tasks via Turborepo |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript check across workspaces |
| `pnpm lint` / `pnpm format` | Lint and format via Turbo |
| `pnpm desktop:dev` | Tauri dev shell |
| `pnpm desktop:build` | Production desktop bundle |
| `pnpm server:headless` | Headless server on port 8787 |

## Releasing the desktop app

Push a version tag to trigger the GitHub Actions workflow:

```bash
git tag v0.0.3
git push origin v0.0.3
```

Before tagging, bump `version` in `apps/desktop/src-tauri/tauri.conf.json` (and `Cargo.toml` if needed). The workflow builds macOS (arm64 + Intel), Windows, and Linux artifacts and attaches them to the release.

Workflow file: `.github/workflows/release-desktop.yml`

## UI components

This monorepo uses [shadcn/ui](https://ui.shadcn.com/) components in `packages/ui`. Add a component:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import in the web app:

```tsx
import { Button } from '@workspace/ui/components/button'
```

## Further reading

- `apps/desktop/README.md` — desktop dev, build, and Tauri commands
- `packages/openmd-server/README.md` — server modes, API, Docker example
- `packages/openmd-relay/README.md` — relay API and self-hosting
- `AGENTS.md` — architecture notes for contributors and agents
