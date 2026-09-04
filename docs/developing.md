### Prerequisites

- Node.js 18+
- Python 3.12+

### Frontend

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` with API calls proxied to `http://localhost:8000/api`.

### Backend

```bash
script/setup
script/run
```

The API server runs on `http://localhost:8000`.

## Building

```bash
npm run build       # Production build to dist/
npm run lint        # Run ESLint
npm run preview     # Preview the production build locally
```

## Docker

```bash
docker build -t lva-portal .
```

The container uses s6-overlay for process supervision. The FastAPI server starts on port 8000 via `script/run`.

Multi-architecture images (amd64/arm64) are automatically built and pushed to GHCR on release via GitHub Actions.

## API Overview

All endpoints are prefixed with `/api`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | SSE stream of CPU, memory, and uptime |
| `GET /api/status` | Service container state |
| `POST /api/service/{start\|stop\|restart}` | Control service lifecycle |
| `GET /api/logs/history` | Last 24h of logs |
| `GET /api/stream/logs` | SSE log stream |
| `GET /api/config/schema` | Configuration schema with current values |
| `POST /api/config/save` | Save configuration |
| `GET /api/system/updates` | Check for updates across all components |
| `GET /api/system/update/stream` | SSE update progress stream |
| `GET /api/network/info` | Network interfaces, IPs, hostname |
| `POST /api/network/hostname` | Set hostname |
| `POST /api/network/ip` | Set IP configuration |
| `GET /api/network/wifi/scan` | Scan for WiFi networks |
| `POST /api/network/wifi/connect` | Connect to WiFi |

The backend communicates with the [lva-supervisor](https://github.com/aryanhasgithub/lva-supervisor) service over a Unix domain socket to manage containers, networking, audio devices, and OS updates.

### Project Structure

```
lva-portal/
├── backend/                # FastAPI backend
│   ├── main.py             # App entrypoint, SPA serving, middleware
│   ├── stats.py            # System stats SSE stream
│   ├── logs.py             # Log streaming and persistence
│   ├── services.py         # Service control (start/stop/restart)
│   ├── config_com.py       # Configuration schema and env management
│   ├── updates.py          # OTA update system
│   ├── network.py          # Network management
│   └── supervisor_client.py# Unix socket client for lva-supervisor
├── src/                    # React frontend
│   ├── main.jsx            # Entry point
│   ├── App.jsx             # Routes and layout
│   ├── index.css           # Tailwind + MD3 color tokens
│   ├── components/
│   │   └── Rail.jsx        # Sidebar navigation
│   └── pages/
│       ├── Dashboard.jsx
│       ├── Logs.jsx
│       ├── Configuration.jsx
│       ├── Updates.jsx
│       └── Network.jsx
├── config/
│   └── config_schema.json  # Configuration schema
├── rootfs/                 # s6-overlay filesystem overlay
├── script/
│   ├── setup               # Python venv + dependency installer
│   └── run                 # Uvicorn launcher
├── Dockerfile
└── package.json
```