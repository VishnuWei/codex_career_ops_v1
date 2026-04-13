#!/usr/bin/env node

import { spawnSync } from 'child_process';

const steps = [
  ['node', ['scan.mjs', '--max-age-days', '30', '--include-unknown-age']],
  ['node', ['friend-pipeline.mjs']],
  ['node', ['friend-evaluate.mjs', '--limit', '5']],
  ['node', ['friend-deep.mjs']],
  ['node', ['friend-digest.mjs']],
];

for (const [cmd, args] of steps) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
