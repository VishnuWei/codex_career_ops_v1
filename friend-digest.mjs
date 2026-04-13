#!/usr/bin/env node

import {
  buildMailto,
  ensureDir,
  extractEmail,
  latestFileCopy,
  loadDotEnv,
  pickPendingEntries,
  todayIso,
  writeText,
} from './friend-utils.mjs';
import { loadEmailConfig, sendResendEmail } from './lib/friend/email.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const typeArg = args.includes('--type') ? args[args.indexOf('--type') + 1] : '';
const pending = pickPendingEntries()
  .filter(entry => !typeArg || entry.type === typeArg)
  .sort((a, b) => b.score - a.score);

const jobs = pending.filter(x => x.type === 'job').slice(0, 15);
const freelance = pending.filter(x => x.type === 'freelance').slice(0, 15);
const gigs = pending.filter(x => x.type === 'gig').slice(0, 15);
const date = todayIso();
const email = extractEmail();
const subject = `Career Ops digest for ${date}`;

function linesFor(section, items) {
  if (items.length === 0) return [`## ${section}`, '', '_No matches._', ''];
  return [
    `## ${section}`,
    '',
    ...items.map(item => `- ${item.company} | ${item.title} | ${item.score}/5 | ${item.ageLabel} | ${item.url}`),
    '',
  ];
}

const markdown = [
  `# Career Ops Digest - ${date}`,
  '',
  `Recipient: ${email || 'No email found in profile or CV'}`,
  '',
  ...linesFor('Jobs', jobs),
  ...linesFor('Freelance', freelance),
  ...linesFor('Gigs', gigs),
  '## Notes',
  '',
  '- This digest is generated automatically from the current pipeline.',
  '- Review each listing before applying or contacting anyone.',
  '',
].join('\n');

const text = [
  `Career Ops Digest - ${date}`,
  '',
  'Jobs:',
  ...jobs.map(x => `- ${x.company} | ${x.title} | ${x.score}/5 | ${x.url}`),
  '',
  'Freelance:',
  ...freelance.map(x => `- ${x.company} | ${x.title} | ${x.score}/5 | ${x.url}`),
  '',
  'Gigs:',
  ...gigs.map(x => `- ${x.company} | ${x.title} | ${x.score}/5 | ${x.url}`),
  '',
].join('\n');

ensureDir('reports/digests');
const mdPath = `reports/digests/${date}-digest.md`;
const txtPath = `reports/digests/${date}-digest.txt`;
writeText(mdPath, markdown);
writeText(txtPath, text);
latestFileCopy(mdPath, 'reports/digests/latest.md');
latestFileCopy(txtPath, 'reports/digests/latest.txt');

console.log(`Digest written to ${mdPath}`);
console.log(`Plain-text digest written to ${txtPath}`);

if (email) {
  console.log(`Mailto draft: ${buildMailto(email, subject, text.slice(0, 1800))}`);
}

const { resendApiKey, resendFromEmail } = loadEmailConfig();
if (email && resendApiKey && resendFromEmail) {
  await sendResendEmail({ to: email, subject, text });
  console.log(`Email sent to ${email} using Resend`);
} else {
  console.log('Resend not configured, so no email was sent.');
  console.log('Set RESEND_API_KEY and RESEND_FROM_EMAIL to enable delivery.');
}
