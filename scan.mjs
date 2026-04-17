#!/usr/bin/env node

/**
 * scan.mjs - portal scanner with strict freshness and live-link validation
 *
 * Fetches Greenhouse, Ashby, and Lever APIs directly, optionally augments
 * discovery with web search queries from portals.yml, verifies candidate URLs
 * with Playwright, and appends only live + recent offers to pipeline.md and
 * scan-history.tsv.
 *
 * Usage:
 *   node scan.mjs
 *   node scan.mjs --dry-run
 *   node scan.mjs --company Cohere
 *   node scan.mjs --max-age-days 30
 *   node scan.mjs --include-unknown-age
 *   node scan.mjs --mode flutter
 *   node scan.mjs --search-web-global
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { chromium } from 'playwright';
import yaml from 'js-yaml';
import { classifyLiveness } from './liveness-core.mjs';
import {
  detectGeoRestriction,
  inferRoleFit,
  isGenericJobPage,
  loadTargetingProfile,
  normalizeText,
} from './lib/targeting.mjs';

const parseYaml = yaml.load;

const PORTALS_PATH = 'portals.yml';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';
const APPLICATIONS_PATH = 'data/applications.md';

const API_CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 10_000;
const PAGE_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_AGE_DAYS = 30;
const SEARCH_RESULTS_PER_QUERY = 5;
const MIN_JOB_DESCRIPTION_CHARS = 600;

function parseArgs(argv) {
  const args = argv.slice(2);
  const flagValue = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : '';
  };

  const rawMaxAge = flagValue('--max-age-days');
  const parsedMaxAge = rawMaxAge ? Number(rawMaxAge) : DEFAULT_MAX_AGE_DAYS;

  return {
    dryRun: args.includes('--dry-run'),
    includeUnknownAge: args.includes('--include-unknown-age'),
    filterCompany: flagValue('--company').toLowerCase(),
    filterMode: flagValue('--mode'),
    maxAgeDays: Number.isFinite(parsedMaxAge) && parsedMaxAge >= 0 ? parsedMaxAge : DEFAULT_MAX_AGE_DAYS,
    searchWebGlobal: args.includes('--search-web-global'),
  };
}

function detectApi(company) {
  if (company.api && company.api.includes('greenhouse')) {
    return { type: 'greenhouse', url: company.api };
  }

  const url = company.careers_url || '';

  const ashbyMatch = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
  if (ashbyMatch) {
    return {
      type: 'ashby',
      url: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`,
    };
  }

  const leverMatch = url.match(/jobs\.lever\.co\/([^/?#]+)/i);
  if (leverMatch) {
    return {
      type: 'lever',
      url: `https://api.lever.co/v0/postings/${leverMatch[1]}`,
    };
  }

  const ghEuMatch = url.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/i);
  if (ghEuMatch) {
    return {
      type: 'greenhouse',
      url: `https://boards-api.greenhouse.io/v1/boards/${ghEuMatch[1]}/jobs`,
    };
  }

  return null;
}

function pickDate(obj, keys) {
  for (const key of keys) {
    if (!obj?.[key]) continue;
    const value = obj[key];
    if (typeof value === 'number') {
      const millis = value > 1e12 ? value : value * 1000;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
      continue;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return '';
}

function parseGreenhouse(json, companyName) {
  return (json.jobs || []).map((job) => ({
    title: job.title || '',
    url: job.absolute_url || '',
    company: companyName,
    location: job.location?.name || '',
    postedAt: pickDate(job, ['updated_at', 'updatedAt', 'first_published', 'created_at']),
    updatedAt: pickDate(job, ['updated_at', 'updatedAt']),
    source: 'greenhouse-api',
  }));
}

function parseAshby(json, companyName) {
  return (json.jobs || []).map((job) => ({
    title: job.title || '',
    url: job.jobUrl || '',
    company: companyName,
    location: job.location || '',
    postedAt: pickDate(job, ['publishedDate', 'publishedAt', 'postedAt', 'createdAt', 'created_at']),
    updatedAt: pickDate(job, ['updatedAt', 'updated_at']),
    source: 'ashby-api',
  }));
}

function parseLever(json, companyName) {
  if (!Array.isArray(json)) return [];
  return json.map((job) => ({
    title: job.text || '',
    url: job.hostedUrl || '',
    company: companyName,
    location: job.categories?.location || '',
    postedAt: pickDate(job, ['createdAt', 'created_at', 'updatedAt', 'updated_at']),
    updatedAt: pickDate(job, ['updatedAt', 'updated_at']),
    source: 'lever-api',
  }));
}

const PARSERS = {
  greenhouse: parseGreenhouse,
  ashby: parseAshby,
  lever: parseLever,
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'codex-career-ops/1.0 (+https://github.com/santifer/career-ops)',
        accept: 'application/json,text/plain,*/*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageInDays(value) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function decodeSearchHref(href) {
  if (!href) return '';
  const cleanHref = decodeHtmlEntities(href).trim();

  try {
    const full = cleanHref.startsWith('http') ? cleanHref : `https://duckduckgo.com${cleanHref}`;
    const url = new URL(full);
    const uddg = url.searchParams.get('uddg');
    return normalizeUrl(uddg ? decodeURIComponent(uddg) : cleanHref);
  } catch {
    return normalizeUrl(cleanHref);
  }
}

function parseDuckDuckGoResults(html, fallbackCompany) {
  const results = [];
  const seen = new Set();
  const patterns = [
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+rel="nofollow"[^>]+class="[^"]*result-link[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) && results.length < SEARCH_RESULTS_PER_QUERY) {
      const url = decodeSearchHref(match[1]);
      const title = stripHtml(match[2]);
      if (!url || !title || seen.has(url)) continue;
      if (!/^https?:\/\//i.test(url)) continue;
      seen.add(url);
      results.push({
        url,
        title,
        company: fallbackCompany,
        source: 'websearch',
        postedAt: '',
        updatedAt: '',
        location: '',
      });
    }
    if (results.length >= SEARCH_RESULTS_PER_QUERY) break;
  }

  return results;
}

async function searchWeb(query, fallbackCompany) {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(searchUrl);
  return parseDuckDuckGoResults(html, fallbackCompany);
}

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map((token) => normalizeText(token));
  const negative = (titleFilter?.negative || []).map((token) => normalizeText(token));

  return (title) => {
    const lower = normalizeText(title);
    const hasPositive = positive.length === 0 || positive.some((token) => lower.includes(token));
    const hasNegative = negative.some((token) => lower.includes(token));
    return hasPositive && !hasNegative;
  };
}

function applyModeOverrides(titleFilter, mode) {
  if (!mode) return titleFilter;

  const modes = {
    flutter: {
      positive: ['flutter'],
      negative: ['ios', 'android', 'react native', 'product manager', 'solutions architect', 'solutions engineer', 'ai', 'ml', 'llm'],
    },
    android: {
      positive: ['android'],
      negative: ['flutter', 'ios', 'react native', 'product manager', 'solutions architect', 'solutions engineer', 'ai', 'ml', 'llm'],
    },
    ios: {
      positive: ['ios'],
      negative: ['flutter', 'android', 'react native', 'product manager', 'solutions architect', 'solutions engineer', 'ai', 'ml', 'llm'],
    },
    mobile: {
      positive: ['flutter', 'mobile engineer', 'mobile developer', 'android engineer', 'ios engineer', 'react native'],
      negative: ['product manager', 'solutions architect', 'solutions engineer', 'ai', 'ml', 'llm'],
    },
    'react-native': {
      positive: ['react native'],
      negative: ['flutter', 'android', 'ios', 'product manager', 'solutions architect', 'solutions engineer', 'ai', 'ml', 'llm'],
    },
  };

  const override = modes[String(mode).toLowerCase()];
  if (!override) return titleFilter;

  return {
    ...titleFilter,
    positive: override.positive,
    negative: [...new Set([...(titleFilter?.negative || []), ...override.negative])],
  };
}

function loadSeenUrls() {
  const seen = new Set();

  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split(/\r?\n/);
    for (const line of lines.slice(1)) {
      const url = line.split('\t')[0];
      if (url) seen.add(normalizeUrl(url));
    }
  }

  if (existsSync(PIPELINE_PATH)) {
    const text = readFileSync(PIPELINE_PATH, 'utf-8');
    for (const match of text.matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)) {
      seen.add(normalizeUrl(match[1]));
    }
  }

  if (existsSync(APPLICATIONS_PATH)) {
    const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(normalizeUrl(match[0]));
    }
  }

  return seen;
}

function loadSeenCompanyRoles() {
  const seen = new Set();
  if (!existsSync(APPLICATIONS_PATH)) return seen;

  const text = readFileSync(APPLICATIONS_PATH, 'utf-8');
  for (const match of text.matchAll(/\|[^|]+\|[^|]+\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g)) {
    const company = match[1].trim().toLowerCase();
    const role = match[2].trim().toLowerCase();
    if (company && role && company !== 'company') {
      seen.add(`${company}::${role}`);
    }
  }

  return seen;
}

function appendToPipeline(offers) {
  if (offers.length === 0) return;

  let text = readFileSync(PIPELINE_PATH, 'utf-8');
  const marker = '## Pendientes';
  const idx = text.indexOf(marker);

  if (idx === -1) {
    const procIdx = text.indexOf('## Procesadas');
    const insertAt = procIdx === -1 ? text.length : procIdx;
    const block = `\n${marker}\n\n${offers.map((offer) => `- [ ] ${offer.url} | ${offer.company} | ${offer.title}`).join('\n')}\n\n`;
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  } else {
    const afterMarker = idx + marker.length;
    const nextSection = text.indexOf('\n## ', afterMarker);
    const insertAt = nextSection === -1 ? text.length : nextSection;
    const block = `\n${offers.map((offer) => `- [ ] ${offer.url} | ${offer.company} | ${offer.title}`).join('\n')}\n`;
    text = text.slice(0, insertAt) + block + text.slice(insertAt);
  }

  writeFileSync(PIPELINE_PATH, text, 'utf-8');
}

function appendToScanHistory(offers, date) {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tposted_at\tupdated_at\n', 'utf-8');
  }

  const lines = offers.map((offer) => (
    `${offer.url}\t${date}\t${offer.source}\t${offer.title}\t${offer.company}\tadded\t${offer.postedAt || ''}\t${offer.updatedAt || ''}`
  )).join('\n') + '\n';

  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

async function parallelFetch(tasks, limit) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < tasks.length) {
      const task = tasks[index++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

function matchesAge(offer, maxAgeDays, includeUnknownAge) {
  const ageDays = ageInDays(offer.postedAt || offer.updatedAt);
  if (ageDays == null) return includeUnknownAge;
  return ageDays <= maxAgeDays;
}

function collectSearchTasks(config, companies, options) {
  const tasks = [];

  for (const company of companies) {
    if (!company.scan_query || company.scan_method !== 'websearch') continue;
    tasks.push({
      label: `${company.name} web`,
      query: company.scan_query,
      company: company.name,
      global: false,
    });
  }

  if (options.searchWebGlobal) {
    for (const queryConfig of config.search_queries || []) {
      if (queryConfig.enabled === false || !queryConfig.query) continue;
      tasks.push({
        label: queryConfig.name || queryConfig.query,
        query: queryConfig.query,
        company: '',
        global: true,
      });
    }
  }

  return tasks;
}

function selectDateFromCandidates(values) {
  for (const value of values) {
    const date = parseDate(value);
    if (date) return date.toISOString();
  }
  return '';
}

function extractRelevantSnippet(bodyText = '') {
  const lines = String(bodyText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => !/^(privacy|cookie|sign in|log in|menu|home|careers)$/i.test(line))
    .slice(0, 80)
    .join('\n');
}

function evaluateCandidate(job, targeting, titleFilter) {
  if (!job.url || !job.title) {
    return { accepted: false, reason: 'missing URL or title' };
  }

  if (!titleFilter(job.title)) {
    return { accepted: false, reason: 'rejected by title filter' };
  }

  const fit = inferRoleFit({
    title: job.title,
    location: job.location,
    bodyText: job.summary || '',
    targeting,
  });

  if (!fit.accepted) {
    return { accepted: false, reason: fit.reason };
  }

  const geoBlock = detectGeoRestriction({
    title: job.title,
    location: job.location,
    bodyText: job.summary || '',
    targeting,
  });

  if (geoBlock) {
    return { accepted: false, reason: geoBlock };
  }

  return { accepted: true, reason: fit.reason };
}

async function inspectOffer(page, offer) {
  try {
    const response = await page.goto(offer.url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(2000);

    const status = response?.status() ?? 0;
    const finalUrl = normalizeUrl(page.url());
    const pageData = await page.evaluate(() => {
      const bodyText = document.body?.innerText ?? '';
      const applyControls = Array.from(
        document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]')
      )
        .filter((element) => {
          if (element.closest('nav, header, footer')) return false;
          if (element.closest('[aria-hidden="true"]')) return false;
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (!element.getClientRects().length) return false;
          return Array.from(element.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0);
        })
        .map((element) => [
          element.innerText,
          element.value,
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const meta = {};
      for (const key of ['article:published_time', 'og:updated_time']) {
        const node = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
        if (node?.getAttribute('content')) meta[key] = node.getAttribute('content');
      }

      const jsonDates = [];
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        const raw = script.textContent || '';
        try {
          const parsed = JSON.parse(raw);
          const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
          while (stack.length) {
            const current = stack.pop();
            if (!current || typeof current !== 'object') continue;
            for (const key of ['datePosted', 'datePublished', 'dateModified']) {
              if (current[key]) jsonDates.push(current[key]);
            }
            for (const value of Object.values(current)) {
              if (value && typeof value === 'object') stack.push(value);
            }
          }
        } catch {
          // Ignore malformed structured data.
        }
      }

      return {
        bodyText,
        applyControls,
        title: document.title || '',
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map((node) => node.textContent?.trim() || '').filter(Boolean).slice(0, 12),
        meta,
        jsonDates,
      };
    });

    const liveness = classifyLiveness({
      status,
      finalUrl,
      bodyText: pageData.bodyText,
      applyControls: pageData.applyControls,
    });

    return {
      ...offer,
      url: finalUrl || offer.url,
      title: offer.title || pageData.title,
      summary: extractRelevantSnippet(pageData.bodyText),
      postedAt: offer.postedAt || selectDateFromCandidates([
        ...pageData.jsonDates,
        pageData.meta['article:published_time'],
      ]),
      updatedAt: offer.updatedAt || selectDateFromCandidates([
        pageData.meta['og:updated_time'],
      ]),
      pageTitle: pageData.title,
      pageHeadings: pageData.headings,
      pageBodyText: pageData.bodyText,
      verification: liveness,
    };
  } catch (error) {
    return {
      ...offer,
      verification: { result: 'expired', reason: `navigation error: ${String(error.message || error).split('\n')[0]}` },
    };
  }
}

async function verifyOffers(offers, options, targeting, titleFilter) {
  if (offers.length === 0) {
    return { accepted: [], rejected: [] };
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const accepted = [];
  const rejected = [];

  try {
    for (const offer of offers) {
      const inspected = await inspectOffer(page, offer);
      if (inspected.verification.result !== 'active') {
        rejected.push({ offer: inspected, reason: inspected.verification.reason || inspected.verification.result });
        continue;
      }

      if (isGenericJobPage({
        finalUrl: inspected.url,
        title: inspected.pageTitle || inspected.title,
        bodyText: inspected.pageBodyText || inspected.summary || '',
      })) {
        rejected.push({ offer: inspected, reason: 'generic careers or listing page, not a single job posting' });
        continue;
      }

      if ((inspected.pageBodyText || '').trim().length < MIN_JOB_DESCRIPTION_CHARS) {
        rejected.push({ offer: inspected, reason: 'job description too thin after verification' });
        continue;
      }

      const postVerifyFit = evaluateCandidate({
        ...inspected,
        summary: inspected.summary || inspected.pageBodyText || '',
      }, targeting, titleFilter);

      if (!postVerifyFit.accepted) {
        rejected.push({ offer: inspected, reason: postVerifyFit.reason });
        continue;
      }

      if (!matchesAge(inspected, options.maxAgeDays, options.includeUnknownAge)) {
        rejected.push({
          offer: inspected,
          reason: inspected.postedAt || inspected.updatedAt
            ? `older than ${options.maxAgeDays} days`
            : 'missing posted date',
        });
        continue;
      }

      accepted.push(inspected);
    }
  } finally {
    await browser.close();
  }

  return { accepted, rejected };
}

async function main() {
  const options = parseArgs(process.argv);
  const { profile, targeting } = loadTargetingProfile();

  if (!existsSync(PORTALS_PATH)) {
    console.error('Error: portals.yml not found. Run onboarding first.');
    process.exit(1);
  }

  const config = parseYaml(readFileSync(PORTALS_PATH, 'utf-8'));
  const allCompanies = config.tracked_companies || [];
  const preferredCompanies = new Set(((profile.job_search?.preferred_companies) || []).map((name) => normalizeText(name)));
  const companies = allCompanies
    .filter((company) => company.enabled !== false)
    .filter((company) => preferredCompanies.size === 0 || preferredCompanies.has(normalizeText(company.name)))
    .filter((company) => !options.filterCompany || company.name.toLowerCase().includes(options.filterCompany));

  const titleFilter = buildTitleFilter(applyModeOverrides(config.title_filter || {}, options.filterMode));
  const apiTargets = companies
    .map((company) => ({ ...company, _api: detectApi(company) }))
    .filter((company) => company._api);
  const searchTasks = collectSearchTasks(config, companies, options);

  console.log(`Scanning ${apiTargets.length} API-backed companies`);
  console.log(`Running ${searchTasks.length} web search task(s)`);
  console.log(`Freshness limit: ${options.maxAgeDays} days`);
  if (options.dryRun) console.log('(dry run - no files will be written)\n');

  const seenUrls = loadSeenUrls();
  const seenCompanyRoles = loadSeenCompanyRoles();
  const date = new Date().toISOString().slice(0, 10);

  let totalFound = 0;
  let totalFilteredByTitle = 0;
  let totalFilteredByGeo = 0;
  let totalFilteredByAge = 0;
  let totalDuplicates = 0;
  let totalSearchResults = 0;
  const candidates = [];
  const errors = [];

  const apiJobs = [];
  const apiTasks = apiTargets.map((company) => async () => {
    const { type, url } = company._api;
    try {
      const json = await fetchJson(url);
      const jobs = PARSERS[type](json, company.name);
      apiJobs.push(...jobs);
      totalFound += jobs.length;
    } catch (error) {
      errors.push({ label: `${company.name} API`, error: error.message });
    }
  });
  await parallelFetch(apiTasks, API_CONCURRENCY);

  const searchedJobs = [];
  for (const task of searchTasks) {
    try {
      const results = await searchWeb(task.query, task.company);
      totalSearchResults += results.length;
      for (const result of results) {
        searchedJobs.push({
          ...result,
          company: result.company || task.company || '',
          source: task.global ? 'websearch-global' : 'websearch-company',
        });
      }
    } catch (error) {
      errors.push({ label: task.label, error: error.message });
    }
  }

  for (const job of [...apiJobs, ...searchedJobs]) {
    const candidateCheck = evaluateCandidate(job, targeting, titleFilter);
    if (!candidateCheck.accepted) {
      if (candidateCheck.reason.startsWith('geo restricted') || candidateCheck.reason.startsWith('location restricted')) {
        totalFilteredByGeo++;
      } else {
        totalFilteredByTitle++;
      }
      continue;
    }

    if ((job.postedAt || job.updatedAt) && !matchesAge(job, options.maxAgeDays, options.includeUnknownAge)) {
      totalFilteredByAge++;
      continue;
    }

    const normalizedUrl = normalizeUrl(job.url);
    if (seenUrls.has(normalizedUrl)) {
      totalDuplicates++;
      continue;
    }

    const companyKey = String(job.company || '').trim().toLowerCase();
    const titleKey = String(job.title || '').trim().toLowerCase();
    const roleKey = `${companyKey}::${titleKey}`;
    if (companyKey && titleKey && seenCompanyRoles.has(roleKey)) {
      totalDuplicates++;
      continue;
    }

    seenUrls.add(normalizedUrl);
    if (companyKey && titleKey) seenCompanyRoles.add(roleKey);
    candidates.push({ ...job, url: normalizedUrl, relevanceReason: candidateCheck.reason });
  }

  const { accepted, rejected } = await verifyOffers(candidates, options, targeting, titleFilter);

  if (!options.dryRun && accepted.length > 0) {
    appendToPipeline(accepted);
    appendToScanHistory(accepted, date);
  }

  console.log(`\n${'='.repeat(48)}`);
  console.log(`Portal Scan - ${date}`);
  console.log(`${'='.repeat(48)}`);
  console.log(`Companies scanned:       ${companies.length}`);
  console.log(`API jobs found:          ${totalFound}`);
  console.log(`Web results found:       ${totalSearchResults}`);
  console.log(`Filtered by title:       ${totalFilteredByTitle} removed`);
  console.log(`Filtered by geo rules:   ${totalFilteredByGeo} removed`);
  console.log(`Filtered by age:         ${totalFilteredByAge} removed before verification`);
  console.log(`Duplicates skipped:      ${totalDuplicates}`);
  console.log(`Candidates verified:     ${candidates.length}`);
  console.log(`Live + recent offers:    ${accepted.length}`);
  console.log(`Rejected in verification:${rejected.length}`);

  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const entry of errors) {
      console.log(`  x ${entry.label}: ${entry.error}`);
    }
  }

  if (rejected.length > 0) {
    console.log('\nRejected offers:');
    for (const item of rejected.slice(0, 20)) {
      console.log(`  - ${item.offer.company || 'Unknown'} | ${item.offer.title} | ${item.reason}`);
    }
    if (rejected.length > 20) {
      console.log(`  ... and ${rejected.length - 20} more`);
    }
  }

  if (accepted.length > 0) {
    console.log('\nAccepted offers:');
    for (const offer of accepted) {
      const age = ageInDays(offer.postedAt || offer.updatedAt);
      const ageLabel = age == null ? 'unknown age' : `${age}d`;
      console.log(`  + ${offer.company || 'Unknown'} | ${offer.title} | ${ageLabel} | ${offer.url}`);
    }

    if (options.dryRun) {
      console.log('\n(dry run - run without --dry-run to save results)');
    } else {
      console.log(`\nResults saved to ${PIPELINE_PATH} and ${SCAN_HISTORY_PATH}`);
    }
  }

  console.log('\n-> Run npm run friend:pipeline to rank the live offers.');
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
