#!/usr/bin/env node

import {
  ensureDir,
  loadProfile,
  pickPendingEntries,
  slugify,
  todayIso,
  topCvLines,
  writeText,
} from './friend-utils.mjs';

const args = process.argv.slice(2);
const companyArg = args.includes('--company') ? args[args.indexOf('--company') + 1] : '';
const roleArg = args.includes('--role') ? args[args.indexOf('--role') + 1] : '';

const pending = pickPendingEntries().sort((a, b) => b.score - a.score);
const target = pending.find(entry =>
  (!companyArg || entry.company.toLowerCase().includes(companyArg.toLowerCase())) &&
  (!roleArg || entry.title.toLowerCase().includes(roleArg.toLowerCase()))
) || pending[0];

if (!target) {
  console.error('No pending pipeline entries found. Run scan first.');
  process.exit(1);
}

const { candidate, targetRoles, profile } = loadProfile();
const related = pending
  .filter(entry => entry.company === target.company)
  .slice(0, 12)
  .map(entry => `- ${entry.title} | ${entry.location || 'Unknown location'} | ${entry.score}/5 | ${entry.url}`);

const report = [
  `# Deep Dive - ${target.company}${target.title ? ` - ${target.title}` : ''}`,
  '',
  `- Date: ${todayIso()}`,
  `- Company: ${target.company}`,
  `- Role: ${target.title || 'Unknown'}`,
  `- URL: ${target.url}`,
  `- Candidate: ${candidate.full_name || 'Unknown candidate'}`,
  '',
  '## Executive Summary',
  '',
  `${target.company} is in the current pipeline and appears relevant for ${candidate.full_name || 'the candidate'} based on title overlap and current targeting. This report is a Codex-first research scaffold that should be expanded with live company research before interview or outreach.`,
  '',
  '## Candidate Context',
  '',
  `- Headline: ${profile.narrative?.headline || 'Not set'}`,
  `- Primary targets: ${(targetRoles.primary || []).join(', ') || 'Not set'}`,
  `- Location preference: ${profile.compensation?.location_flexibility || 'Not set'}`,
  '',
  '## CV Snapshot',
  '',
  ...topCvLines().map(line => `- ${line}`),
  '',
  '## Open Roles At This Company',
  '',
  ...(related.length > 0 ? related : ['- No related roles found in current pipeline.']),
  '',
  '## Research Angles',
  '',
  '1. Product and AI strategy',
  '2. Recent launches, partnerships, and hiring signals',
  '3. Engineering or delivery culture',
  '4. Risks, scaling challenges, or GTM pressure points',
  '5. Competitors and differentiation',
  '6. Candidate angle: strongest proof points and likely objections',
  '',
  '## Interview Hooks',
  '',
  `- Why this company now? Tie ${target.company} to your target themes and recent role interest.`,
  '- Which past project best proves your fit here?',
  '- What business pain could you help reduce in the first 90 days?',
  '',
  '## Sources To Check Next',
  '',
  '- Company homepage',
  '- Careers page and engineering blog',
  '- Recent product announcements and founder posts',
  '- Relevant role postings in this pipeline',
  '',
].join('\n');

ensureDir('reports/deep');
const outPath = `reports/deep/${slugify(target.company)}-${slugify(target.title || 'company')}-${todayIso()}-deep.md`;
writeText(outPath, report);
writeText('reports/deep/latest.md', report);

console.log(`Deep-dive scaffold written to ${outPath}`);
