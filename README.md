# LVA Portal

Web-based management dashboard for [lva-os](https://github.com/aryanhasgithub/lva-os) (Linux Voice Assistant OS). Monitor system health, view logs, configure settings, manage network connections, and apply OTA updates from your browser.

## Tech Stack

**Frontend** - React 19, React Router, Tailwind CSS 4, Vite 8

**Backend** - Python 3.12, FastAPI, Uvicorn

**Infrastructure** - Docker (Home Assistant base image), s6-overlay, GitHub Actions CI/CD

## Features

- **Dashboard** - Real-time CPU, memory, and uptime stats; LVA service toggle
- **Logs** - Dual-pane live and historical log viewer (LVA + Portal)
- **Configuration** - Edit environment-based settings with live audio device detection
- **Updates** - OTA update manager for portal, core, audio, CLI, supervisor, and OS components
- **Network** - WiFi scanning/connecting, IP configuration (DHCP/static), hostname management

## Development

Details for development are given at [developing.md](docs/developing.md)


## Managed Components

The portal manages updates for six components:

1. **lva-portal** - This dashboard
2. **lva** - LVA Core ([OHF-Voice/linux-voice-assistant](https://github.com/OHF-Voice/linux-voice-assistant))
3. **lva-audio** - Audio service
4. **lva-cli** - CLI tool
5. **lva-supervisor** - Process supervisor
6. **lva-os** - OS-level RAUC A/B updates

## License

Apache License 2.0
