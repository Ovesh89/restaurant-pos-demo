# Demo Repository Synchronization Guide

This guide documents the automated synchronization mechanism between the main codebase (`restaurant-pos-backend-mern`) and the public/deployed demo repository (`restaurant-pos-demo`).

---

## 1. Overview & Objectives

The goal of the synchronization tool is to ensure that improvements, bug fixes, and features in `restaurant-pos-backend-mern` automatically propagate to `restaurant-pos-demo` **without overwriting** environment configurations, Azure deployment configurations, pure-veg demo menu data, or demo-specific branding.

---

## 2. Protected Files (Strict Exclusions)

The following categories of files are strictly excluded from synchronization:

1. **Environment Configurations (`.env*`)**:
   - `apps/backend/.env`
   - `apps/backend/.env.example`
   - `apps/web/.env`
   - `apps/web/.env.example`
   - `apps/web/.env.production`
   - Any `.env*` or `*.env` files across the monorepo.

2. **Configuration Directories & Files (`*config*`)**:
   - `apps/backend/src/config/**` (`database.js`, `env.js`, `openapi.js`, `permissions.js`)
   - `apps/web/src/config/**` (`appConfig.js`)
   - `apps/web/vite.config.js`
   - `apps/web/tailwind.config.js`
   - `apps/web/postcss.config.js`
   - `apps/web/staticwebapp.config.json`
   - `apps/web/public/staticwebapp.config.json`

3. **CI/CD & Cloud Deployment Workflows (`.github/**`)**:
   - `azure-static-web-apps-*.yml`
   - `master_restaurant-pos-api-demo.yml`
   - All demo workflow actions.

4. **Demo-Specific Customizations**:
   - Pure-veg demo seed data: `apps/backend/src/scripts/menuData.js`, `apps/backend/src/scripts/seedDemoData.js`, `scripts/seed-demo-data.js`, `apps/web/src/mock-data/seedData.js`
   - Demo database tests: `apps/backend/tests/helpers/testDb.js`, `phase1.health.test.js`, etc.
   - Demo branding & UI: `index.html` (title), `favicon.png`, `logo*.png`, `logoBase64.js`, `Sidebar.jsx`, `Topbar.jsx`, `LoginPage.jsx`, `ProfilePage.jsx`, `DashboardPage.jsx`, `printService.js`, `settingsLocalRepository.js`, `README.md`.

---

## 3. Automation Triggers

### A. Automatic Git Hook (On Commit & Push)
Git hooks are configured in `.git/hooks/`:
- **`post-commit`**: Whenever you commit in `restaurant-pos-backend-mern`, it automatically synchronizes changed files to `restaurant-pos-demo`, creates a commit in `restaurant-pos-demo`, and pushes to `origin/master`.
- **`pre-push`**: Ensures the demo repository is completely up to date with origin before pushes.
- **Hook Installer**: Run `npm run setup:hooks` at any time to re-install or verify the Git hooks.

### B. Live Real-Time Watcher Mode
For active development sessions where you want changes in `restaurant-pos-backend-mern` mirrored live to `restaurant-pos-demo` as you type:
```bash
npm run sync:demo:watch
```
- Monitors all project files using debounced filesystem watchers.
- Automatically copies new and modified files immediately.
- Never touches protected env or config files.

### C. Manual NPM Commands
| Command | Action |
| :--- | :--- |
| `npm run sync:demo` | Synchronizes files and commits changes to the local demo repo |
| `npm run sync:demo:push` | Synchronizes, commits, and pushes to `https://github.com/Ovesh89/restaurant-pos-demo` |
| `npm run sync:demo:dry` | Previews files to be updated and skipped without writing any changes |
| `npm run sync:demo:watch` | Starts the real-time background file watcher |
| `npm run setup:hooks` | Installs Git `post-commit` and `pre-push` hooks |
