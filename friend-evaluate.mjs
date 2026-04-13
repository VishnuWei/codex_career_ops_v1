#!/usr/bin/env node

import { ensureDir, markdownTable, nextReportNumber, pickPendingEntries, slugify, todayIso, writeText } from './friend-utils.mjs';

const args = process.argv.slice(2);
const limitArg = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : 5;
const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 5;
const today = todayIso();
const FETCH_TIMEOUT_MS = 8000;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchSnippet(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) return { status: `HTTP ${res.status}`, text: '', title: '' };
    const html = await res.text();
    const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim();
    const text = stripHtml(html).slice(0, 5000);
    return { status: 'ok', text, title };
  } catch (error) {
    return { status: error.message, text: '', title: '' };
  } finally {
    clearTimeout(timer);
  }
}

function evaluateHeuristically(entry, page) {
  const corpus = `${entry.title} ${entry.company} ${entry.location || ''} ${page.title} ${page.text}`.toLowerCase();
  const positives = [
    ['flutter', 1.6],
    ['dart', 1.2],
    ['mobile', 1.4],
    ['android', 1.0],
    ['ios', 1.0],
    ['firebase', 0.7],
    ['bloc', 0.6],
    ['mvvm', 0.4],
    ['clean architecture', 0.6],
    ['remote', 0.5],
  ];
  const negatives = [
    ['product manager', -1.0],
    ['account executive', -1.6],
    ['sales', -1.4],
    ['solutions architect', -0.9],
    ['solutions engineer', -0.7],
    ['machine learning', -0.4],
    ['phd', -0.8],
    ['onsite only', -0.8],
  ];

  let score = 2.2;
  const hits = [];
  const misses = [];

  for (const [token, value] of positives) {
    if (corpus.includes(token)) {
      score += value;
      hits.push(token);
    }
  }
  for (const [token, value] of negatives) {
    if (corpus.includes(token)) {
      score += value;
      misses.push(token);
    }
  }

  score = Math.max(1, Math.min(5, score));
  const verdict = score >= 4 ? 'Strong fit' : score >= 3 ? 'Possible fit' : 'Low fit';

  return {
    score: Number(score.toFixed(1)),
    verdict,
    hits,
    misses,
  };
}

const entries = pickPendingEntries()
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);

if (entries.length === 0) {
  console.error('No pending entries found. Run a scan first.');
  process.exit(1);
}

ensureDir('reports/heuristic');
const summaryRows = [];
let counter = nextReportNumber();

for (const entry of entries) {
  console.log(`Evaluating: ${entry.company} | ${entry.title}`);
  const page = await fetchSnippet(entry.url);
  const result = evaluateHeuristically(entry, page);
  const num = String(counter).padStart(3, '0');
  const slug = slugify(entry.company || 'company');
  const reportPath = `reports/heuristic/${num}-${slug}-${today}.md`;

  const report = [
    `# Heuristic Evaluation - ${entry.company} - ${entry.title}`,
    '',
    `- Report: ${num}`,
    `- Date: ${today}`,
    `- URL: ${entry.url}`,
    `- Fetch status: ${page.status}`,
    `- Score: ${result.score}/5`,
    `- Verdict: ${result.verdict}`,
    '',
    '## Why It Scored This Way',
    '',
    `- Positive signals: ${result.hits.join(', ') || 'none found'}`,
    `- Negative signals: ${result.misses.join(', ') || 'none found'}`,
    `- Existing shortlist score: ${entry.score}/5`,
    '',
    '## Job Snapshot',
    '',
    `- Company: ${entry.company}`,
    `- Role: ${entry.title}`,
    `- Location: ${entry.location || 'Unknown'}`,
    `- Age: ${entry.ageLabel}`,
    '',
    '## Page Title',
    '',
    page.title || '_No HTML title found._',
    '',
    '## Extracted Snippet',
    '',
    page.text ? `${page.text.slice(0, 1800)}...` : '_No page text fetched._',
    '',
    '## Recommendation',
    '',
    result.score >= 4
      ? '- Worth manual review for application.'
      : result.score >= 3
        ? '- Review manually if the company or location is attractive.'
        : '- Skip unless you have a strong personal reason to pursue it.',
    '',
  ].join('\n');

  writeText(reportPath, report);
  summaryRows.push([num, entry.company, entry.title, `${result.score}/5`, page.status, result.verdict, reportPath]);
  counter += 1;
}

const summaryPath = `reports/heuristic/${today}-summary.md`;
writeText(summaryPath, [
  `# Heuristic Evaluation Summary - ${today}`,
  '',
  markdownTable(summaryRows, ['#', 'Company', 'Role', 'Score', 'Fetch', 'Verdict', 'Report']),
  '',
].join('\n'));
writeText('reports/heuristic/latest-summary.md', [
  `# Heuristic Evaluation Summary - ${today}`,
  '',
  markdownTable(summaryRows, ['#', 'Company', 'Role', 'Score', 'Fetch', 'Verdict', 'Report']),
  '',
].join('\n'));

console.log(`Heuristic evaluation summary written to ${summaryPath}`);
for (const row of summaryRows.slice(0, 10)) {
  console.log(`  ${row[3]} | ${row[1]} | ${row[2]}`);
}
process.exit(0);
