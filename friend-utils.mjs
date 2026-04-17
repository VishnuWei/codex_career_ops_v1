import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
import { detectGeoRestriction, inferRoleFit, loadTargetingProfile } from './lib/targeting.mjs';

export function readText(path, fallback = '') {
  return existsSync(path) ? readFileSync(path, 'utf-8') : fallback;
}

export function loadDotEnv(paths = ['.env.local', '.env']) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const lines = readText(path, '').split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = value;
    }
  }
}

export function writeText(path, text) {
  ensureDir(dirname(path));
  writeFileSync(path, text, 'utf-8');
}

export function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function ensureCopied(from, to) {
  if (!existsSync(to) && existsSync(from)) {
    ensureDir(dirname(to));
    copyFileSync(from, to);
    return true;
  }
  return false;
}

export function loadYaml(path) {
  return yaml.load(readText(path, '')) || {};
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function parsePipeline(path = 'data/pipeline.md') {
  const text = readText(path, '');
  const lines = text.split(/\r?\n/);
  const entries = [];
  let section = '';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      section = line.replace(/^##\s+/, '').trim().toLowerCase();
      continue;
    }

    const match = line.match(/^- \[([ x!])\]\s+(.+?)(?:\s+\|\s+(.+?)\s+\|\s+(.+))?$/);
    if (!match) continue;

    entries.push({
      raw: line,
      status: match[1],
      url: match[2].trim(),
      company: (match[3] || '').trim(),
      title: (match[4] || '').trim(),
      section,
    });
  }

  return entries;
}

export function loadScanHistory(path = 'data/scan-history.tsv') {
  const text = readText(path, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const map = new Map();

  for (const line of lines.slice(1)) {
    const cols = line.split('\t');
    const [url, firstSeen, source, title, company, status, postedAt, updatedAt] = cols;
    if (!url) continue;
    map.set(url, {
      url,
      firstSeen: firstSeen || '',
      source: source || '',
      title: title || '',
      company: company || '',
      status: status || '',
      postedAt: postedAt || '',
      updatedAt: updatedAt || '',
    });
  }

  return map;
}

export function loadProfile(path = 'config/profile.yml') {
  const profile = loadYaml(path);
  const candidate = profile.candidate || {};
  const targetRoles = profile.target_roles || {};
  const location = profile.location || {};
  return { profile, candidate, targetRoles, location };
}

export function profileLooksPlaceholder() {
  const { candidate } = loadProfile();
  const joined = [
    candidate.full_name,
    candidate.email,
    candidate.location,
    candidate.linkedin,
    candidate.portfolio_url,
    candidate.github,
  ].join(' ').toLowerCase();

  return /jane smith|example\.com|janesmith|san francisco, ca/.test(joined);
}

export function extractCvSignals() {
  const cv = readText('cv.md', '');
  const lower = cv.toLowerCase();
  const skillBank = [
    'flutter', 'dart', 'mobile', 'android', 'ios', 'bloc', 'provider', 'firebase',
    'sqlite', 'mvvm', 'clean architecture', 'rest api', 'websocket', 'ci/cd',
    'codemagic', 'github actions', 'widget testing', 'unit testing', 'in-app purchases',
    'google play billing', 'app store', 'razorpay',
  ];
  const strongMatches = skillBank.filter(skill => lower.includes(skill));
  const titleMatches = [];
  for (const pattern of [
    'senior flutter developer',
    'mobile app developer',
    'android developer',
    'cross-platform app developer',
    'senior flutter engineer',
    'mobile engineer',
  ]) {
    if (lower.includes(pattern)) titleMatches.push(pattern);
  }

  const yearsMatch = cv.match(/approximately\s+(\d+)\s+years/i) || cv.match(/(\d+)\+?\s+years of experience/i);
  const emailMatch = cv.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const locationMatch = cv.match(/\|\s*([^|]+,\s*India)/i);

  return {
    strongMatches,
    titleMatches,
    years: yearsMatch ? Number(yearsMatch[1]) : null,
    email: emailMatch ? emailMatch[0] : '',
    locationText: locationMatch ? locationMatch[1].trim() : '',
    raw: cv,
  };
}

export function extractEmail() {
  const { candidate } = loadProfile();
  if (candidate.email && !candidate.email.includes('example.com')) return candidate.email;
  return extractCvSignals().email;
}

export function extractTargetKeywords() {
  const { profile, targeting } = loadTargetingProfile();
  const { target_roles: targetRoles, narrative, location } = profile;
  const parts = [
    ...(!profileLooksPlaceholder() ? (targetRoles?.primary || []) : []),
    ...(!profileLooksPlaceholder() ? ((targetRoles?.archetypes || []).map(x => x.name)) : []),
    ...(targeting.includePhrases || []),
    ...(narrative?.superpowers || []),
    location?.country,
    location?.city,
    ...extractCvSignals().titleMatches,
    ...extractCvSignals().strongMatches,
  ].filter(Boolean);

  const keywords = new Set();
  for (const part of parts) {
    for (const token of String(part).split(/[^A-Za-z0-9+.#/-]+/)) {
      const clean = token.trim().toLowerCase();
      if (clean.length >= 3) keywords.add(clean);
    }
  }
  return [...keywords];
}

export function classifyOpportunity(title = '') {
  const lower = title.toLowerCase();
  if (/\b(freelance|contractor|independent|consultant|fractional|contract)\b/.test(lower)) return 'freelance';
  if (/\b(part[- ]time|temporary|intern|internship|fellow|program)\b/.test(lower)) return 'gig';
  return 'job';
}

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysAgo(value) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

export function scoreOpportunity(entry, profileBundle = loadProfile()) {
  const cvSignals = extractCvSignals();
  const keywords = extractTargetKeywords();
  const { targeting } = loadTargetingProfile();
  const title = `${entry.title} ${entry.company} ${entry.location || ''}`.toLowerCase();
  let keywordHits = 0;
  for (const keyword of keywords) {
    if (title.includes(keyword)) keywordHits += 1;
  }

  const roleBoosts = [
    ['flutter', 2.4],
    ['mobile', 2.0],
    ['android', 1.6],
    ['ios', 1.4],
    ['app', 0.4],
    ['engineer', 0.4],
  ];
  const rolePenalties = [
    ['product manager', -1.4],
    ['account executive', -1.8],
    ['sales', -1.6],
    ['solutions architect', -1.0],
    ['solutions engineer', -0.7],
    ['customer success', -1.8],
    ['data analyst', -0.9],
    ['marketing', -1.5],
    ['research engineer', -0.6],
    ['ai', -1.0],
    ['ml', -0.8],
    ['agent', -1.0],
  ];

  let cvRoleScore = 0;
  for (const [token, value] of roleBoosts) {
    if (title.includes(token)) cvRoleScore += value;
  }
  for (const [token, value] of rolePenalties) {
    if (title.includes(token)) cvRoleScore += value;
  }
  if (/\breact native\b/.test(title)) cvRoleScore += 0.5;
  if (/\bstaff\b/.test(title) && (cvSignals.years ?? 0) < 5) cvRoleScore -= 0.8;
  if (/\blead\b/.test(title) && (cvSignals.years ?? 0) < 4) cvRoleScore -= 0.4;

  const locationText = `${entry.location || ''} ${title}`.toLowerCase();
  const cvLocation = cvSignals.locationText.toLowerCase();
  const preferredCity = profileLooksPlaceholder() ? '' : String(profileBundle.location?.city || '').toLowerCase();
  const preferredCountry = profileLooksPlaceholder() ? '' : String(profileBundle.location?.country || '').toLowerCase();
  const remoteBonus = /\b(remote|anywhere|hybrid)\b/.test(locationText) ? 1.4 : 0;
  const locationBonus =
    (preferredCity && locationText.includes(preferredCity)) ||
    (preferredCountry && locationText.includes(preferredCountry)) ||
    (cvLocation && locationText.includes('india'))
      ? 1
      : 0;

  const typePenalty = classifyOpportunity(entry.title) === 'job' ? 0 : 0.3;
  const postedDays = daysAgo(entry.postedAt || entry.firstSeen);
  const ageBonus = postedDays == null ? 0 : postedDays <= 7 ? 1.2 : postedDays <= 30 ? 0.8 : postedDays <= 60 ? 0.2 : -0.8;
  const geoPenalty = detectGeoRestriction({
    title: entry.title,
    location: entry.location,
    bodyText: `${entry.notes || ''} ${entry.company || ''}`,
    targeting,
  }) ? 2.4 : 0;
  const fit = inferRoleFit({
    title: entry.title,
    location: entry.location,
    bodyText: entry.notes || '',
    targeting,
  });

  const raw = keywordHits * 0.35 + cvRoleScore + remoteBonus + locationBonus + ageBonus - typePenalty - geoPenalty + (fit.accepted ? 0.6 : -1.4);
  const score = Math.max(1, Math.min(5, 2.2 + raw / 1.8));

  return {
    score: Number(score.toFixed(1)),
    postedDays,
    ageLabel: postedDays == null ? 'unknown' : postedDays <= 30 ? `${postedDays}d` : `${postedDays}d (stale)`,
    reason: geoPenalty > 0
      ? 'geo-blocked'
      : cvRoleScore >= 1.5
      ? 'strong-role-match'
      : cvRoleScore <= -1
        ? 'weak-role-match'
        : 'mixed-match',
  };
}

export function readPortals() {
  return loadYaml('portals.yml') || {};
}

export function findCompanyNotes(companyName) {
  const portals = readPortals();
  const companies = portals.companies || portals.tracked_companies || [];
  const company = companies.find(c => String(c.name || '').toLowerCase() === String(companyName || '').toLowerCase());
  return company?.notes || '';
}

export function topCvLines(limit = 12) {
  return readText('cv.md', '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function markdownTable(rows, headers) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(v => String(v ?? '')).join(' | ')} |`);
  return [headerLine, divider, ...body].join('\n');
}

export function buildMailto(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function latestFileCopy(path, latestPath) {
  writeText(latestPath, readText(path));
}

export function pickPendingEntries() {
  const history = loadScanHistory();
  const profileBundle = loadProfile();
  return parsePipeline()
    .filter(entry => entry.status === ' ' && entry.section.includes('pend'))
    .map(entry => {
      const historyRow = history.get(entry.url) || {};
      const enriched = {
        ...entry,
        ...historyRow,
        company: entry.company || historyRow.company || '',
        title: entry.title || historyRow.title || '',
        notes: findCompanyNotes(entry.company || historyRow.company || ''),
      };
      return { ...enriched, ...scoreOpportunity(enriched, profileBundle), type: classifyOpportunity(enriched.title) };
    });
}

export function nextReportNumber() {
  const dir = 'reports';
  if (!existsSync(dir)) return 1;
  const names = readdirSync(dir);
  let max = 0;
  for (const name of names) {
    const match = /^(\d{3})-/.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}
