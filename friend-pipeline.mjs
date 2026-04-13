#!/usr/bin/env node

import {
  ensureDir,
  latestFileCopy,
  markdownTable,
  pickPendingEntries,
  todayIso,
  writeText,
} from './friend-utils.mjs';

const args = process.argv.slice(2);
const onlyTypeArg = args.includes('--type') ? args[args.indexOf('--type') + 1] : '';
const limitArg = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 40;
const today = todayIso();
const label = onlyTypeArg ? `-${onlyTypeArg}` : '';

const pending = pickPendingEntries()
  .filter(entry => !onlyTypeArg || entry.type === onlyTypeArg)
  .sort((a, b) => b.score - a.score)
  .slice(0, Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 40);

ensureDir('reports/apply-queue');
ensureDir('reports/leads');

const rows = pending.map((entry, index) => ([
  index + 1,
  entry.company,
  entry.title,
  entry.type,
  `${entry.score}/5`,
  entry.ageLabel,
  entry.location || '',
  entry.url,
]));

const queuePath = `reports/apply-queue/${today}-apply-queue${label}.md`;
const summary = [
  `# Apply Queue${onlyTypeArg ? ` - ${onlyTypeArg}` : ''} - ${today}`,
  '',
  `Pending items reviewed: ${pending.length}`,
  '',
  '## Recommended Next Actions',
  '',
  '- Apply only after reviewing the job page and any tailored materials.',
  '- Prioritize scores 4.0+ first.',
  '- Treat freelance and gig leads as separate outreach tracks.',
  '',
  '## Ranked Queue',
  '',
  markdownTable(rows, ['#', 'Company', 'Role', 'Type', 'Score', 'Age', 'Location', 'URL']),
  '',
].join('\n');

writeText(queuePath, summary);
latestFileCopy(queuePath, `reports/apply-queue/latest${label}.md`);

const leadGroups = ['job', 'freelance', 'gig'].map(type => {
  const items = pending.filter(x => x.type === type).slice(0, 25);
  if (items.length === 0) return `## ${type}\n\n_No matches._\n`;
  return [
    `## ${type}`,
    '',
    ...items.map(item => `- ${item.company} | ${item.title} | ${item.score}/5 | ${item.ageLabel} | ${item.url}`),
    '',
  ].join('\n');
});

const leadsPath = `reports/leads/${today}-categorized-leads${label}.md`;
writeText(leadsPath, [`# Categorized Leads - ${today}`, '', ...leadGroups].join('\n'));
latestFileCopy(leadsPath, `reports/leads/latest${label}.md`);

console.log(`Apply queue written to ${queuePath}`);
console.log(`Lead categories written to ${leadsPath}`);
console.log('\nTop matches:');
for (const item of pending.slice(0, 10)) {
  console.log(`  ${item.score}/5 | ${item.type.padEnd(9)} | ${item.company} | ${item.title}`);
}
