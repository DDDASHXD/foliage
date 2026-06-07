# @foliage/relay

Reverse-tunnel relay for Foliage live share. Hosts register an outbound tunnel; guests reach the host through a public URL.

## Hosted default

Production default relay URL: `https://foliage.skxv.dev`

Desktop app settings allow overriding this for self-hosted relays.

## Run a relay

```bash
foliage-relay --port 8788 --public-base https://relay.example.com
```

Environment:

| Variable | Purpose |
|----------|---------|
| `FOLIAGE_RELAY_PUBLIC_BASE` | Public URL shown to users (e.g. `https://foliage.skxv.dev`) |
| `FOLIAGE_RELAY_SESSION_TTL_MS` | Session lifetime (default 24h) |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Relay health |
| `/sessions` | POST | Create session, returns `{ sessionId, publicUrl }` |
| `/sessions/:id` | DELETE | Tear down session |
| `/tunnel/:sessionId` | WS | Host outbound tunnel |
| `/p/:sessionId/*` | * | Guest proxy to host |

## Host tunnel client

After creating a session, the host runs:

```bash
foliage-relay-client \
  --relay-url https://foliage.skxv.dev \
  --session-id <sessionId> \
  --local-port 3000
```

The Tauri desktop app starts this automatically when you choose **File → Start live share**.

## Self-hosted

Deploy the same `foliage-relay` binary behind your domain (Coolify, Docker, systemd). Point desktop **Relay URL** to your instance.

```bash
docker run -p 8788:8788 \
  -e FOLIAGE_RELAY_PUBLIC_BASE=https://relay.my.domain \
  node:20 node packages/foliage-relay/bin/foliage-relay.mjs --port 8788
```
