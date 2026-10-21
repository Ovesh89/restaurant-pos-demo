import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const hooksDir = path.join(rootDir, '.git', 'hooks');

const POST_COMMIT_HOOK = `#!/bin/sh
echo ""
echo "========================================================"
echo " [Git Hook] Auto-syncing to restaurant-pos-demo..."
echo "========================================================"
node scripts/sync-to-demo.js --push
`;

const PRE_PUSH_HOOK = `#!/bin/sh
echo ""
echo "========================================================"
echo " [Git Hook] Pre-push: Ensuring demo repo is synced..."
echo "========================================================"
node scripts/sync-to-demo.js --push
`;

if (!fs.existsSync(hooksDir)) {
  console.log(`[INFO] .git/hooks directory not found at ${hooksDir}. Skipping hook installation.`);
  process.exit(0);
}

fs.writeFileSync(path.join(hooksDir, 'post-commit'), POST_COMMIT_HOOK);
fs.writeFileSync(path.join(hooksDir, 'pre-push'), PRE_PUSH_HOOK);

console.log('✓ Git hooks (post-commit, pre-push) successfully configured for auto-syncing to demo repository!');
