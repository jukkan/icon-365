import Fuse, { IFuseOptions, FuseResultMatch } from 'fuse.js';
import { GitHubTreeResponse, IconFile, CachedData } from './types';

const GITHUB_API_URL = 'https://api.github.com/repos/loryanstrant/MicrosoftCloudLogos/git/trees/main?recursive=1';
const GITHUB_COMMITS_URL = 'https://api.github.com/repos/loryanstrant/MicrosoftCloudLogos/commits';
const RAW_CONTENT_BASE = 'https://raw.githubusercontent.com/loryanstrant/MicrosoftCloudLogos/main/';
const CACHE_KEY = 'icon365-cache';
const COMMITS_CACHE_KEY = 'icon365-commits-cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

function isImageFile(path: string): boolean {
  const ext = path.toLowerCase();
  return ext.endsWith('.png') || ext.endsWith('.svg');
}

function detectCategory(path: string): string {
  const parts = path.split('/');
  if (parts.length > 0) {
    return parts[0];
  }
  return 'Other';
}

function isLegacyIcon(path: string): boolean {
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes('zzlegacy') || lowerPath.includes('legacy')) {
    return true;
  }
  // Check for year range patterns like "2016-2020" or "2020-2025"
  // Only mark as legacy if the end year is before the current year
  const yearPattern = /(\d{4})-(\d{4})/;
  const match = path.match(yearPattern);
  if (match) {
    const endYear = parseInt(match[2], 10);
    const currentYear = new Date().getFullYear();
    return endYear < currentYear;
  }
  return false;
}

function inferProductName(path: string): string {
  // Extract meaningful product name from path
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  // Remove extension and common suffixes
  return filename
    .replace(/\.(png|svg)$/i, '')
    .replace(/[-_]/g, ' ')
    .toLowerCase();
}

function parseIconFiles(tree: GitHubTreeResponse): IconFile[] {
  return tree.tree
    .filter(item => item.type === 'blob' && isImageFile(item.path))
    .map(item => {
      const pathParts = item.path.split('/');
      const filename = pathParts[pathParts.length - 1];
      const extension = filename.split('.').pop()?.toLowerCase() || '';

      const isLegacy = isLegacyIcon(item.path);
      return {
        path: item.path,
        filename,
        category: detectCategory(item.path),
        size: item.size || 0,
        rawUrl: `${RAW_CONTENT_BASE}${item.path}`,
        isLegacy,
        isNew: !isLegacy,
        extension,
        productName: inferProductName(item.path),
      };
    });
}

function getCachedData(): CachedData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CachedData = JSON.parse(cached);
    const now = Date.now();

    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function setCachedData(icons: IconFile[]): void {
  try {
    const data: CachedData = {
      timestamp: Date.now(),
      icons,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache data:', e);
  }
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx) except rate limiting
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      lastError = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Network error');
    }

    if (attempt < maxRetries - 1) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms... (attempt ${attempt + 2}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}

export async function fetchIcons(): Promise<IconFile[]> {
  // Check cache first
  const cached = getCachedData();
  if (cached) {
    console.log('Using cached icon data');
    logCategoryCounts(cached.icons);
    return cached.icons;
  }

  console.log('Fetching icons from GitHub API...');

  const response = await fetchWithRetry(GITHUB_API_URL);
  const data: GitHubTreeResponse = await response.json();
  const icons = parseIconFiles(data);

  // Cache the results
  setCachedData(icons);

  console.log(`Fetched ${icons.length} icons`);
  logCategoryCounts(icons);

  return icons;
}

function logCategoryCounts(icons: IconFile[]): void {
  const counts: Record<string, number> = {};

  icons.forEach(icon => {
    counts[icon.category] = (counts[icon.category] || 0) + 1;
  });

  console.log('Category counts:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count} icons`);
    });
}

export function getCategories(icons: IconFile[]): string[] {
  const categories = new Set<string>();
  icons.forEach(icon => categories.add(icon.category));
  return Array.from(categories).sort();
}

// Fuse.js configuration for fuzzy search
const fuseOptions: IFuseOptions<IconFile> = {
  keys: [
    { name: 'filename', weight: 0.4 },
    { name: 'path', weight: 0.3 },
    { name: 'productName', weight: 0.3 },
  ],
  threshold: 0.4,
  includeMatches: true,
  minMatchCharLength: 2,
};

export interface SearchResult {
  item: IconFile;
  matches?: readonly FuseResultMatch[];
}

export function searchIcons(
  icons: IconFile[],
  searchQuery: string,
  selectedCategory: string | null,
  fileTypeFilter: 'all' | 'png' | 'svg' = 'all',
  showNewOnly: boolean = false
): SearchResult[] {
  let filtered = icons;

  if (selectedCategory) {
    filtered = filtered.filter(icon => icon.category === selectedCategory);
  }

  if (fileTypeFilter !== 'all') {
    filtered = filtered.filter(icon => icon.extension === fileTypeFilter);
  }

  if (showNewOnly) {
    filtered = filtered.filter(icon => icon.isNew);
  }

  if (!searchQuery.trim()) {
    // Sort by isNew first (new icons on top), then alphabetically
    const sorted = [...filtered].sort((a, b) => {
      if (a.isNew !== b.isNew) {
        return a.isNew ? -1 : 1;
      }
      return a.filename.localeCompare(b.filename);
    });
    return sorted.map(item => ({ item }));
  }

  const fuse = new Fuse(filtered, fuseOptions);
  const results = fuse.search(searchQuery);

  // Sort results: new icons first within similar relevance scores
  return results.sort((a, b) => {
    // If scores are similar (within 0.1), prioritize new icons
    const scoreDiff = Math.abs((a.score || 0) - (b.score || 0));
    if (scoreDiff < 0.1 && a.item.isNew !== b.item.isNew) {
      return a.item.isNew ? -1 : 1;
    }
    return 0; // Keep original relevance order
  });
}

// Get search suggestions when no results found
export function getSearchSuggestions(
  icons: IconFile[],
  searchQuery: string,
  selectedCategory: string | null
): { suggestion: string | null; suggestedCategory: string | null } {
  if (!searchQuery.trim()) {
    return { suggestion: null, suggestedCategory: null };
  }

  // Try searching all icons with a higher threshold to find closest match
  const lenientOptions: IFuseOptions<IconFile> = {
    ...fuseOptions,
    threshold: 0.6, // More lenient
  };

  let searchPool = icons;
  if (selectedCategory) {
    // If searching within category, also search all icons for suggestions
    searchPool = icons;
  }

  const fuse = new Fuse(searchPool, lenientOptions);
  const results = fuse.search(searchQuery);

  if (results.length > 0) {
    const topResult = results[0].item;
    // If the top result is in a different category, suggest that category
    if (selectedCategory && topResult.category !== selectedCategory) {
      return {
        suggestion: topResult.filename,
        suggestedCategory: topResult.category,
      };
    }
    return {
      suggestion: topResult.filename,
      suggestedCategory: null,
    };
  }

  // No matches found - suggest a category based on the query
  const categories = getCategories(icons);
  const categoryFuse = new Fuse(categories, { threshold: 0.4 });
  const categoryResults = categoryFuse.search(searchQuery);

  if (categoryResults.length > 0) {
    return {
      suggestion: null,
      suggestedCategory: categoryResults[0].item,
    };
  }

  return { suggestion: null, suggestedCategory: null };
}

// GitHub file URL helper
export function getGitHubFileUrl(path: string): string {
  return `https://github.com/loryanstrant/MicrosoftCloudLogos/blob/main/${path}`;
}

// Recent commits functionality
interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
  files?: Array<{
    filename: string;
    status: string;
  }>;
}

export interface RecentChange {
  path: string;
  date: string;
  message: string;
}

function getCachedCommits(): Map<string, RecentChange> | null {
  try {
    const cached = localStorage.getItem(COMMITS_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();

    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(COMMITS_CACHE_KEY);
      return null;
    }

    return new Map(data.changes);
  } catch {
    return null;
  }
}

function setCachedCommits(changes: Map<string, RecentChange>): void {
  try {
    const data = {
      timestamp: Date.now(),
      changes: Array.from(changes.entries()),
    };
    localStorage.setItem(COMMITS_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache commits:', e);
  }
}

export async function fetchRecentChanges(): Promise<Map<string, RecentChange>> {
  const cached = getCachedCommits();
  if (cached) {
    console.log('Using cached commit data');
    return cached;
  }

  console.log('Fetching recent commits from GitHub API...');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const changes = new Map<string, RecentChange>();

  try {
    // Fetch commits from last 30 days
    const response = await fetchWithRetry(
      `${GITHUB_COMMITS_URL}?since=${since}&per_page=100`
    );
    const commits: GitHubCommit[] = await response.json();

    // For each commit, fetch the files changed
    for (const commit of commits.slice(0, 20)) { // Limit to 20 commits to avoid rate limiting
      try {
        const detailResponse = await fetch(
          `${GITHUB_COMMITS_URL}/${commit.sha}`
        );
        if (detailResponse.ok) {
          const detail: GitHubCommit = await detailResponse.json();
          if (detail.files) {
            for (const file of detail.files) {
              if (isImageFile(file.filename) && !changes.has(file.filename)) {
                changes.set(file.filename, {
                  path: file.filename,
                  date: commit.commit.author.date,
                  message: commit.commit.message.split('\n')[0],
                });
              }
            }
          }
        }
      } catch {
        // Skip individual commit errors
      }
    }

    setCachedCommits(changes);
    console.log(`Found ${changes.size} recently changed icons`);
    return changes;
  } catch (e) {
    console.warn('Failed to fetch recent changes:', e);
    return new Map();
  }
}
