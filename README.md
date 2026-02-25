# React + Golang Electron Desktop App

A sample desktop app built with `Electron` + `React` + `TypeScript` + a `Go` sidecar.

In this project:
- The UI runs with React + Vite.
- Backend-like logic runs inside a Go sidecar binary.
- Electron and Go communicate via JSON over `stdin/stdout`.

## Features

- Handshake between Electron and the sidecar using `SET_PID`
- Mock NFC scanning using `SCAN_NFC`
- Mock login flow and token generation using `LOGIN`
- Simple UI for connection status, NFC scan, and login

## Prerequisites

- macOS (currently only `darwin-arm64` and `darwin-x64` sidecar binaries are built)
- Node.js (LTS recommended)
- npm
- Go `1.21+`

## Installation

```bash
npm install
```

## Run in Development

```bash
npm run dev
```

This command:
1. Starts the Vite dev server at `http://localhost:5173`
2. Builds the Go sidecar for your host architecture (`build:sidecar:host`)
3. Launches Electron

## Build

### Full build (Renderer + Electron + all sidecar binaries)

```bash
npm run build
```

### Build macOS app (Universal)

```bash
npm run dist:mac
```

Final packaged output is generated in `release/`.

## Run Renderer Only (Optional)

```bash
npm run dev:renderer
```

In this mode, Electron is not running, so `window.electronAPI` is unavailable and sidecar communication will not work.

## Project Structure

```text
.
├── backend/
│   ├── main.go                # Sidecar logic (SET_PID / SCAN_NFC / LOGIN)
│   └── bin/                   # Generated Go binaries
├── electron/
│   ├── main.ts                # App window, lifecycle, and IPC
│   └── preload.ts             # Safe API bridge exposed to renderer
├── scripts/
│   └── build-sidecar.mjs      # Go sidecar build script
└── src/
    ├── App.tsx                # UI
    └── types/electron-api.d.ts
```

## Sidecar Protocol (JSON)

Requests are sent as line-delimited JSON to stdin, and responses are read from stdout.

Example request:

```json
{"id":"<uuid>","type":"SCAN_NFC"}
```

Example response:

```json
{"id":"<uuid>","ok":true,"data":{"id":"a1b2c3d4"}}
```

## Development Notes

- In development, the sidecar binary is loaded from `backend/bin/`.
- In packaged builds, the sidecar binary is loaded from `resources/bin/`.
- Sidecar request timeout in Electron is set to 5 seconds.

## Quick Troubleshooting

- If the app does not start, run `npm run build:sidecar:host` separately first.
- If you get a Go toolchain error, check your version with `go version`.
- If port 5173 is already in use, stop the existing Vite process and rerun `npm run dev`.

## License

No license file is defined yet. Add a `LICENSE` file if needed.
