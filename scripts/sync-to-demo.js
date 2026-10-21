import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '..');
const DEMO_DIR = path.resolve(SRC_DIR, '..', 'restaurant-pos-demo');

// Files specifically customized for the demo environment that must NOT be overwritten
const PRESERVED_DEMO_FILES = new Set([
  // Pure-veg demo menu & seeding scripts
  'apps/backend/src/scripts/menuData.js',
  'apps/backend/src/scripts/seedDemoData.js',
  'scripts/seed-demo-data.js',
  'apps/web/src/mock-data/seedData.js',

  // Demo test db configuration & tests
  'apps/backend/tests/helpers/testDb.js',
  'apps/backend/tests/phase1.health.test.js',
  'apps/backend/tests/phase2.restaurant_menu.test.js',
  'apps/backend/tests/phase2.web_integration.test.js',

  // Demo Branding, HTML Title & Logos
  'apps/web/index.html',
  'apps/web/public/favicon.png',
  'apps/web/public/logo-black.png',
  'apps/web/public/logo-receipt.png',
  'apps/web/public/logo-red-receipt.png',
  'apps/web/public/logo-white.png',
  'apps/web/public/logo.png',
  'apps/web/src/assets/logoBase64.js',
  'apps/web/src/layouts/Sidebar.jsx',
  'apps/web/src/layouts/Topbar.jsx',
  'apps/web/src/pages/auth/LoginPage.jsx',
  'apps/web/src/pages/auth/ProfilePage.jsx',
  'apps/web/src/pages/dashboard/DashboardPage.jsx',
  'apps/web/src/services/printing/printService.js',
  'apps/web/src/services/repositories/local/settingsLocalRepository.js',

  // Demo Documentation
  'README.md',
]);

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'backups',
  '.system_generated',
  '.gemini',
  'scratch',
  '.vscode',
  '.idea',
  '.temp',
  '.cache',
];

function normalize(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Checks whether a given relative file path should be excluded from sync.
 * Strictly excludes:
 *   1. All .env files (.env, .env.*, *.env)
 *   2. All configuration directories (src/config, config/*)
 *   3. All configuration files (*config*.js, *config*.json, *config*.ts, etc.)
 *   4. All CI/CD workflows (.github/*)
 *   5. Demo customized files (branding, pure-veg seed data, demo tests)
 */
export function getExclusionReason(relPath) {
  const norm = normalize(relPath);
  const base = path.basename(norm);
  const segments = norm.split('/');

  // 1. Explicitly preserved demo files
  if (PRESERVED_DEMO_FILES.has(norm)) {
    return 'Demo customized file (branding, pure-veg menu, or test)';
  }

  // 2. All .env files anywhere
  if (base.startsWith('.env') || base.endsWith('.env') || base.includes('.env.')) {
    return 'Environment configuration (.env*)';
  }

  // 3. Configuration directories (e.g., apps/web/src/config, apps/backend/src/config)
  if (segments.includes('config')) {
    return 'Config directory file (*config/*)';
  }

  // 4. Configuration files (*config*.js, *config*.json, *config*.mjs, *config*.cjs, etc.)
  if (/(^|[._-])config([._-]|$)/i.test(base) || base.toLowerCase().includes('config')) {
    return 'Configuration file (*config*)';
  }

  // 5. GitHub workflows and deployment configs (.github/*)
  if (segments.includes('.github') || norm.startsWith('.github/')) {
    return 'CI/CD workflow configuration (.github)';
  }

  return null;
}

function getHash(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) {
    return null;
  }
}

function walk(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (IGNORED_PATHS.includes(item)) continue;
    const fullPath = path.join(dir, item);
    const relPath = path.join(base, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath, relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

function transformContent(relPath, srcFile) {
  // Special content transformers for demo compatibility
  if (relPath === 'apps/web/src/pages/customers/CustomersPage.jsx') {
    let content = fs.readFileSync(srcFile, 'utf8');
    content = content.replace(/Chiloda Cross Road, Gandhinagar/g, 'Sector 11, Gandhinagar');
    return Buffer.from(content, 'utf8');
  }
  return null;
}

export function syncToDemo(options = {}) {
  const { dryRun = false, verbose = false, push = false } = options;

  console.log('====================================================');
  console.log(' Restaurant POS -> Demo Synchronization Tool');
  console.log('====================================================');
  console.log(`Source: ${SRC_DIR}`);
  console.log(`Target: ${DEMO_DIR}`);
  if (dryRun) console.log('MODE: DRY-RUN (no files will be written)');
  if (push) console.log('AUTO-PUSH: ENABLED (changes will be pushed to demo remote)');
  console.log('----------------------------------------------------');

  if (!fs.existsSync(DEMO_DIR)) {
    console.error(`[ERROR] Target directory does not exist: ${DEMO_DIR}`);
    process.exit(1);
  }

  const srcFiles = walk(SRC_DIR);
  let copiedCount = 0;
  let updatedCount = 0;
  let skippedPreserved = 0;
  let identicalCount = 0;

  for (const rel of srcFiles) {
    const normalizedRel = normalize(rel);
    const exclusionReason = getExclusionReason(normalizedRel);

    if (exclusionReason) {
      skippedPreserved++;
      if (verbose) {
        console.log(`[EXCLUDED] ${normalizedRel} (${exclusionReason})`);
      }
      continue;
    }

    const srcFile = path.join(SRC_DIR, rel);
    const dstFile = path.join(DEMO_DIR, rel);

    const srcContentBuf = transformContent(normalizedRel, srcFile);
    let expectedDstHash = srcContentBuf
      ? crypto.createHash('sha256').update(srcContentBuf).digest('hex')
      : getHash(srcFile);

    const dstHash = getHash(dstFile);

    if (expectedDstHash === dstHash) {
      identicalCount++;
      continue;
    }

    const isNew = !fs.existsSync(dstFile);
    if (!dryRun) {
      const dstParent = path.dirname(dstFile);
      if (!fs.existsSync(dstParent)) {
        fs.mkdirSync(dstParent, { recursive: true });
      }

      if (srcContentBuf) {
        fs.writeFileSync(dstFile, srcContentBuf);
      } else {
        fs.copyFileSync(srcFile, dstFile);
      }
    }

    if (isNew) {
      copiedCount++;
      console.log(`[NEW]     ${normalizedRel}`);
    } else {
      updatedCount++;
      console.log(`[UPDATED] ${normalizedRel}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Summary:`);
  console.log(`  Identical files:          ${identicalCount}`);
  console.log(`  New files copied:         ${copiedCount}`);
  console.log(`  Modified files updated:   ${updatedCount}`);
  console.log(`  Env/Config/Demo skipped:  ${skippedPreserved}`);
  console.log('----------------------------------------------------');

  // Git operations in demo repository
  const gitDir = path.join(DEMO_DIR, '.git');
  if (fs.existsSync(gitDir)) {
    console.log('[GIT] Demo repository has Git initialized.');
    try {
      const status = execSync('git status --porcelain', { cwd: DEMO_DIR, encoding: 'utf8' }).trim();
      if (status) {
        console.log('[GIT] Staging changes in demo repository...');
        if (!dryRun) {
          execSync('git add -A', { cwd: DEMO_DIR, stdio: 'inherit' });
          const commitMsg = `Sync updates from restaurant-pos-backend-mern (${new Date().toISOString().slice(0, 10)})`;
          execSync(`git commit -m "${commitMsg}"`, { cwd: DEMO_DIR, stdio: 'inherit' });
          console.log(`[GIT] Committed synced changes in demo repository.`);

          if (push) {
            console.log('[GIT] Pushing changes to remote demo repository...');
            try {
              execSync('git push origin master', { cwd: DEMO_DIR, stdio: 'inherit' });
              console.log('[GIT] Successfully pushed to origin/master on demo repository.');
            } catch (pushErr) {
              console.warn(`[GIT WARNING] Could not push to demo origin: ${pushErr.message}`);
            }
          }
        }
      } else {
        console.log('[GIT] Demo working tree is clean.');
        if (push && !dryRun) {
          // Check if there are any unpushed commits
          const unpushed = execSync('git log origin/master..HEAD --oneline', { cwd: DEMO_DIR, encoding: 'utf8' }).trim();
          if (unpushed) {
            console.log('[GIT] Pushing unpushed commits in demo repository...');
            execSync('git push origin master', { cwd: DEMO_DIR, stdio: 'inherit' });
            console.log('[GIT] Successfully pushed to origin/master.');
          }
        }
      }
    } catch (e) {
      console.warn(`[GIT WARNING] Git operation in demo failed: ${e.message}`);
    }
  } else {
    console.log('[GIT NOTICE] Target folder does not have .git initialized.');
  }

  console.log('Sync completed successfully!');
}

/**
 * Real-time watch and auto-sync mode.
 * Monitors the source workspace and copies modified files instantly to the demo repo.
 */
export function watchAndSync(options = {}) {
  const { verbose = false } = options;

  console.log('====================================================');
  console.log(' Starting Real-Time Watch & Auto-Sync Mode');
  console.log('====================================================');
  console.log(`Watching: ${SRC_DIR}`);
  console.log(`Target:   ${DEMO_DIR}`);
  console.log('Press Ctrl+C to stop.');
  console.log('----------------------------------------------------');

  // Run initial sync
  syncToDemo({ dryRun: false, verbose, push: false });

  console.log('\n[WATCHER] Active. Listening for file changes...');

  let debounceTimer = null;
  const pendingChanges = new Set();

  function processPendingChanges() {
    if (pendingChanges.size === 0) return;

    const filesToSync = Array.from(pendingChanges);
    pendingChanges.clear();

    for (const rel of filesToSync) {
      const normalizedRel = normalize(rel);
      const exclusionReason = getExclusionReason(normalizedRel);

      if (exclusionReason) {
        if (verbose) {
          console.log(`[WATCH EXCLUDED] ${normalizedRel} (${exclusionReason})`);
        }
        continue;
      }

      const srcFile = path.join(SRC_DIR, rel);
      const dstFile = path.join(DEMO_DIR, rel);

      if (!fs.existsSync(srcFile)) {
        // File was deleted
        if (fs.existsSync(dstFile)) {
          fs.unlinkSync(dstFile);
          console.log(`[WATCH REMOVED] ${normalizedRel}`);
        }
        continue;
      }

      try {
        const stat = fs.statSync(srcFile);
        if (stat.isDirectory()) continue;

        const srcContentBuf = transformContent(normalizedRel, srcFile);
        const expectedDstHash = srcContentBuf
          ? crypto.createHash('sha256').update(srcContentBuf).digest('hex')
          : getHash(srcFile);

        const dstHash = getHash(dstFile);
        if (expectedDstHash === dstHash) continue;

        const dstParent = path.dirname(dstFile);
        if (!fs.existsSync(dstParent)) {
          fs.mkdirSync(dstParent, { recursive: true });
        }

        if (srcContentBuf) {
          fs.writeFileSync(dstFile, srcContentBuf);
        } else {
          fs.copyFileSync(srcFile, dstFile);
        }

        console.log(`[WATCH SYNCED]  ${normalizedRel} (${new Date().toLocaleTimeString()})`);
      } catch (err) {
        console.error(`[WATCH ERROR]   Failed to sync ${normalizedRel}: ${err.message}`);
      }
    }
  }

  try {
    fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      const norm = normalize(filename);
      // Skip ignored paths
      for (const ignored of IGNORED_PATHS) {
        if (norm === ignored || norm.startsWith(`${ignored}/`) || norm.includes(`/${ignored}/`)) {
          return;
        }
      }

      pendingChanges.add(norm);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processPendingChanges, 300);
    });
  } catch (err) {
    console.error(`[WATCH ERROR] Failed to start watcher: ${err.message}`);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDry = process.argv.includes('--dry-run');
  const isVerbose = process.argv.includes('--verbose');
  const shouldPush = process.argv.includes('--push');
  const isWatch = process.argv.includes('--watch');

  if (isWatch) {
    watchAndSync({ verbose: isVerbose });
  } else {
    syncToDemo({ dryRun: isDry, verbose: isVerbose, push: shouldPush });
  }
}
