# Pehape Frontend (TypeScript)

Minimal TypeScript scaffold for the Pehape project. This folder contains a small example project and build scripts to compile TypeScript into `dist/`.

Prerequisites
- Node.js (LTS) and npm installed. Use nvm / nvm-windows to manage versions if needed.

Quick start (PowerShell)

```powershell
cd frontend
npm install
npm run build
# Run the compiled example
node .\dist\index.js
```

Scripts
- `npm run build` — compile TypeScript into `frontend/dist`
- `npm run dev` — run tsc in watch mode (development)
- `npm start` — run `node ./dist/index.js` after build

Notes
- This scaffold is intentionally minimal. If you plan to add a web UI (React/Vite/Electron) we can extend this repository with bundlers, dev servers and lint/test config.
- If you need to use Node globals in TypeScript (e.g., `require`, `module`), install `@types/node` as a dev dependency: `npm i -D @types/node`.
