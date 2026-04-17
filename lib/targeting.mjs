import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeText(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function uniqueNormalized(values) {
  const seen = new Set();
  const out = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function tokenizePhrase(value) {
  return normalizeText(value)
    .split(/[^a-z0-9+#/. -]+/)
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function buildTargetingSignals(profile = {}) {
  const targetRoles = profile.target_roles || {};
  const narrative = profile.narrative || {};
  const jobSearch = profile.job_search || {};
  const geo = jobSearch.geo_restrictions || {};

  const includePhrases = uniqueNormalized([
    ...(targetRoles.primary || []),
    ...((targetRoles.archetypes || []).map((item) => item.name)),
    ...(jobSearch.include_keywords || []),
    ...(narrative.superpowers || []),
  ]);

  const excludePhrases = uniqueNormalized([
    ...(jobSearch.exclude_keywords || []),
  ]);

  const titleTokens = uniqueNormalized(includePhrases.flatMap((phrase) => tokenizePhrase(phrase)))
    .filter((token) => !['senior', 'staff', 'lead', 'engineer', 'developer'].includes(token));

  return {
    includePhrases,
    excludePhrases,
    titleTokens,
    geoRestrictions: {
      rejectIfTextContains: uniqueNormalized(geo.reject_if_text_contains || []),
      rejectIfLocationContains: uniqueNormalized(geo.reject_if_location_contains || []),
      allowIfTextContains: uniqueNormalized(geo.allow_if_text_contains || []),
      homeCountry: normalizeWhitespace(profile.location?.country || ''),
    },
  };
}

export function loadTargetingProfile(profilePath = 'config/profile.yml') {
  if (!existsSync(profilePath)) {
    return { profile: {}, targeting: buildTargetingSignals({}) };
  }

  const profile = yaml.load(readFileSync(profilePath, 'utf-8')) || {};
  return { profile, targeting: buildTargetingSignals(profile) };
}

export function inferRoleFit({ title = '', location = '', bodyText = '', targeting } = {}) {
  const titleText = normalizeText(title);
  const locationText = normalizeText(location);
  const body = normalizeText(bodyText);
  const combined = [titleText, locationText].filter(Boolean).join(' ');

  const matchedInclude = [];
  const matchedExclude = [];

  for (const phrase of targeting?.includePhrases || []) {
    const normalized = normalizeText(phrase);
    if (normalized && (combined.includes(normalized) || body.includes(normalized))) {
      matchedInclude.push(phrase);
    }
  }

  const tokenHits = [];
  for (const token of targeting?.titleTokens || []) {
    if (titleText.includes(token) || locationText.includes(token)) {
      tokenHits.push(token);
    }
  }

  for (const phrase of targeting?.excludePhrases || []) {
    const normalized = normalizeText(phrase);
    if (normalized && combined.includes(normalized)) {
      matchedExclude.push(phrase);
    }
  }

  if (matchedExclude.length > 0) {
    return {
      accepted: false,
      reason: `excluded by profile keyword(s): ${matchedExclude.slice(0, 3).join(', ')}`,
      matchedInclude,
      matchedExclude,
      tokenHits,
    };
  }

  if (matchedInclude.length === 0 && tokenHits.length === 0) {
    return {
      accepted: false,
      reason: 'no target-role keywords matched profile',
      matchedInclude,
      matchedExclude,
      tokenHits,
    };
  }

  return {
    accepted: true,
    reason: matchedInclude.length > 0
      ? `matched profile keyword(s): ${matchedInclude.slice(0, 3).join(', ')}`
      : `matched target-role tokens: ${tokenHits.slice(0, 4).join(', ')}`,
    matchedInclude,
    matchedExclude,
    tokenHits,
  };
}

const GEO_PATTERN_LIBRARY = [
  { label: 'EU-only', pattern: /\b(eu|europe|european union|eea)\s*(only|applicants only|candidates only)\b/i },
  { label: 'EMEA-only', pattern: /\bemea\s*(only|applicants only|candidates only)\b/i },
  { label: 'US-only', pattern: /\b(us|usa|united states)\s*(only|applicants only|candidates only)\b/i },
  { label: 'UK-only', pattern: /\buk\s*(only|applicants only|candidates only)\b/i },
  { label: 'Europe remote only', pattern: /\bremote[^.\n]{0,60}\b(europe|eu|emea|uk|germany|france|spain|italy|netherlands|ireland)\b/i },
  { label: 'Work authorization required', pattern: /\bmust have (existing )?(the )?(legal )?(right|authorization) to work in\b/i },
  { label: 'Sponsorship unavailable', pattern: /\b(no visa sponsorship|without sponsorship|cannot sponsor|unable to sponsor)\b/i },
  { label: 'Must be based in region', pattern: /\bmust be based in\b/i },
  { label: 'Candidates located in region', pattern: /\bonly candidates located in\b/i },
  { label: 'Applicants in region', pattern: /\bapplicants (must|should) be located in\b/i },
];

const FOREIGN_LOCATION_MARKERS = [
  'europe', 'eu', 'emea', 'uk', 'united kingdom', 'london', 'germany', 'berlin', 'cologne',
  'france', 'paris', 'spain', 'barcelona', 'madrid', 'italy', 'milan', 'netherlands',
  'amsterdam', 'ireland', 'dublin', 'sweden', 'stockholm', 'poland', 'warsaw', 'united states',
  'usa', 'new york', 'san francisco', 'charlotte', 'australia', 'brussels',
];

export function detectGeoRestriction({ title = '', location = '', bodyText = '', targeting } = {}) {
  const combined = [title, location, bodyText].filter(Boolean).join('\n');
  const allowText = normalizeText(combined);
  const normalizedLocation = normalizeText(location);

  for (const phrase of targeting?.geoRestrictions?.allowIfTextContains || []) {
    if (allowText.includes(normalizeText(phrase))) {
      return null;
    }
  }

  for (const phrase of targeting?.geoRestrictions?.rejectIfLocationContains || []) {
    if (normalizeText(location).includes(normalizeText(phrase)) || normalizeText(title).includes(normalizeText(phrase))) {
      return `location restricted: ${phrase}`;
    }
  }

  for (const phrase of targeting?.geoRestrictions?.rejectIfTextContains || []) {
    if (allowText.includes(normalizeText(phrase))) {
      return `geo restricted: ${phrase}`;
    }
  }

  for (const entry of GEO_PATTERN_LIBRARY) {
    if (entry.pattern.test(combined)) {
      return `geo restricted: ${entry.label}`;
    }
  }

  const homeCountry = normalizeText(targeting?.geoRestrictions?.homeCountry || '');
  const mentionsForeignMarket = FOREIGN_LOCATION_MARKERS.some((marker) => normalizedLocation.includes(marker));
  const looksRemoteGlobal = /\b(remote|worldwide|global|anywhere|distributed)\b/i.test(location) && !mentionsForeignMarket;
  if (
    normalizedLocation &&
    mentionsForeignMarket &&
    !looksRemoteGlobal &&
    homeCountry &&
    !normalizedLocation.includes(homeCountry)
  ) {
    return `geo restricted: location outside ${targeting.geoRestrictions.homeCountry}`;
  }

  return null;
}

export function isGenericJobPage({ finalUrl = '', title = '', bodyText = '' } = {}) {
  const normalizedUrl = normalizeText(finalUrl);
  const normalizedTitle = normalizeText(title);
  const normalizedBody = normalizeText(bodyText);

  const genericUrl = [
    /\/jobs\/?$/i,
    /\/careers\/?$/i,
    /\/positions\/?$/i,
    /\/open-roles\/?$/i,
    /\/job-search\/?$/i,
  ].some((pattern) => pattern.test(normalizedUrl));

  const genericTitle = [
    'careers',
    'all jobs',
    'open positions',
    'job openings',
    'join our team',
  ].some((phrase) => normalizedTitle === phrase || normalizedTitle.endsWith(` | ${phrase}`));

  const listingBody = [
    'search jobs',
    'job openings',
    'filter by',
    'view all jobs',
    'results found',
  ].some((phrase) => normalizedBody.includes(phrase));

  if (genericUrl && listingBody) return true;
  if (genericTitle && normalizedBody.length < 1200) return true;
  return false;
}
