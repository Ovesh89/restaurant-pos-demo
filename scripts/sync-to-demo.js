import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '..');
const DEMO_DIR = path.resolve(SRC_DIR, '..', 'restaurant-pos-demo');

// Files that are specifically customized for the demo environment and must NOT be overwritten
const PRESERVED_DEMO_FILES = new Set([
  // Env configurations (ports & db names)
  'apps/backend/.env',
  'apps/web/.env',

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
  'apps/web/src/config/appConfig.js',
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
];

function normalize(p) {
  return p.replace(/\\/g, '/');
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

export function syncToDemo(options = {}) {
  const { dryRun = false, verbose = false } = options;

  console.log('====================================================');
  console.log(' Restaurant POS -> Demo Synchronization Tool');
  console.log('====================================================');
  console.log(`Source: ${SRC_DIR}`);
  console.log(`Target: ${DEMO_DIR}`);
  if (dryRun) console.log('MODE: DRY-RUN (no files will be written)');
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

    if (PRESERVED_DEMO_FILES.has(normalizedRel)) {
      skippedPreserved++;
      if (verbose) console.log(`[PRESERVED] ${normalizedRel}`);
      continue;
    }

    const srcFile = path.join(SRC_DIR, rel);
    const dstFile = path.join(DEMO_DIR, rel);

    let srcContentBuf = null;
    let expectedDstHash = getHash(srcFile);

    // Special content transformers for demo compatibility
    if (normalizedRel === 'apps/web/src/pages/customers/CustomersPage.jsx') {
      let content = fs.readFileSync(srcFile, 'utf8');
      content = content.replace(/Chiloda Cross Road, Gandhinagar/g, 'Sector 11, Gandhinagar');
      srcContentBuf = Buffer.from(content, 'utf8');
      expectedDstHash = crypto.createHash('sha256').update(srcContentBuf).digest('hex');
    }

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
  console.log(`  Demo files preserved:     ${skippedPreserved}`);
  console.log('----------------------------------------------------');

  // Also check if Git repo exists in DEMO_DIR
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
        }
      } else {
        console.log('[GIT] Demo working tree is clean.');
      }
    } catch (e) {
      console.warn(`[GIT WARNING] Could not auto-commit in demo: ${e.message}`);
    }
  } else {
    console.log('[GIT NOTICE] Target folder does not have .git initialized yet.');
  }

  console.log('Sync completed successfully!');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDry = process.argv.includes('--dry-run');
  const isVerbose = process.argv.includes('--verbose');
  syncToDemo({ dryRun: isDry, verbose: isVerbose });
}
