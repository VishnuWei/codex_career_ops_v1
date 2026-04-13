#!/usr/bin/env node

import { ensureCopied, ensureDir, readText, todayIso, writeText } from './friend-utils.mjs';

const created = [];

if (ensureCopied('config/profile.example.yml', 'config/profile.yml')) created.push('config/profile.yml');
if (ensureCopied('templates/portals.example.yml', 'portals.yml')) created.push('portals.yml');
if (ensureCopied('modes/_profile.template.md', 'modes/_profile.md')) created.push('modes/_profile.md');

ensureDir('data');
if (!readText('data/applications.md', '')) {
  writeText('data/applications.md', [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '',
  ].join('\n'));
  created.push('data/applications.md');
}

if (!readText('data/pipeline.md', '')) {
  writeText('data/pipeline.md', ['# Pipeline - Pending Offers', '', '## Pendientes', '', '## Procesadas', ''].join('\n'));
  created.push('data/pipeline.md');
}

if (!readText('cv.md', '')) {
  writeText('cv.md', ['# Your Name', '', `Last updated: ${todayIso()}`, '', '## Summary', '', '## Experience', '', '## Projects', '', '## Education', '', '## Skills', ''].join('\n'));
  created.push('cv.md');
}

console.log('Friend setup complete.');
if (created.length > 0) {
  console.log('\nCreated:');
  for (const file of created) console.log(`  + ${file}`);
}

console.log('\nNext steps:');
console.log('  1. Edit config/profile.yml with your real details');
console.log('  2. Edit portals.yml with your target companies and role keywords');
console.log('  3. Add your CV content to cv.md');
console.log('  4. Run: npm run friend:scan');
