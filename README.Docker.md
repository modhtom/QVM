# QVM — Docker Setup

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- A `.env` file in the project root (copy from `.env.example` and fill in your API keys)

## Quick Start

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys

# 2. Build and start
docker compose up --build -d

# 3. Open the app
# http://localhost:3001
```

## Architecture

The Docker setup runs three containers:

| Container   | Description                          |
|-------------|--------------------------------------|
| `qvm-app`   | Node.js server + worker (via PM2)    |
| `qvm-redis` | Redis for job queue and caching      |

The `qvm-app` container includes:
- **FFmpeg** — video rendering
- **yt-dlp** — audio downloading
- **Custom Arabic fonts** — installed system-wide for subtitle rendering
- **Python 3** — for utility scripts

## Data & Volumes

| Volume         | Container Path       | Purpose                     |
|----------------|----------------------|-----------------------------|
| `output_video` | `/app/Output_Video`  | Generated video output      |
| `redis_data`   | `/data`              | Redis persistence           |

Host-mounted (read-only):
- `Data/Font/` → Custom `.ttf` fonts
- `Data/metadata.json` → Quran metadata

## Common Commands

```bash
# View logs
docker compose logs -f qvm

# Check container health
docker compose ps

# Rebuild after code changes
docker compose up --build -d

# Stop everything
docker compose down

# Stop and remove volumes (⚠️ deletes output videos & Redis data)
docker compose down -v

# Verify fonts are installed
docker compose exec qvm fc-list | grep -i tasees

# Check Redis connection
docker compose exec redis redis-cli ping
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Container keeps restarting | Check logs: `docker compose logs qvm` |
| Redis connection refused | Ensure `REDIS_HOST=redis` is in environment (set automatically by compose) |
| Fonts not rendering | Verify fonts exist: `docker compose exec qvm ls /usr/share/fonts/truetype/custom/` |
| Out of memory during render | Increase memory limit in `compose.yaml` under `deploy.resources.limits.memory` |

### References
* [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)
* [Docker Compose docs](https://docs.docker.com/compose/)