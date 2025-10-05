#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const relationsPath = path.join(process.cwd(), 'app/db/relations.ts');
const backupPath = path.join(process.cwd(), 'app/db/relations.backup.ts');

function preserveRelations() {
  try {
    // Step 1: Backup existing relations.ts if it exists
    if (fs.existsSync(relationsPath)) {
      console.log('📦 Backing up existing relations.ts...');
      fs.copyFileSync(relationsPath, backupPath);
    }

    // Step 2: Run drizzle-kit introspect
    console.log('🔍 Running drizzle-kit introspect...');
    execSync('drizzle-kit introspect --config=drizzle.config.ts', { stdio: 'inherit' });

    // Step 3: Restore the original relations.ts
    if (fs.existsSync(backupPath)) {
      console.log('♻️  Restoring original relations.ts...');
      fs.copyFileSync(backupPath, relationsPath);
      fs.unlinkSync(backupPath);
    }

    // Step 4: Run the fix-schema script
    console.log('🔧 Running schema fixes...');
    execSync('tsx scripts/db/fix-schema.ts', { stdio: 'inherit' });

    console.log('✅ Database reflection complete with preserved relations!');
  } catch (error) {
    // If something goes wrong, try to restore the backup
    if (fs.existsSync(backupPath)) {
      console.error('❌ Error occurred, restoring relations.ts backup...');
      fs.copyFileSync(backupPath, relationsPath);
      fs.unlinkSync(backupPath);
    }
    throw error;
  }
}

preserveRelations();