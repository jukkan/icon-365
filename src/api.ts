import Fuse, { IFuseOptions, FuseResultMatch } from 'fuse.js';
import { GitHubTreeResponse, IconFile, CachedData } from './types';

const GITHUB_API_URL = 'https://api.github.com/repos/loryanstrant/MicrosoftCloudLogos/git/trees/main?recursive=1';
const RAW_CONTENT_BASE = 'https://raw.githubusercontent.com/loryanstrant/MicrosoftCloudLogos/main/';
const CACHE_KEY = 'icon365-cache';
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
  const yearPattern = /\d{4}-\d{4}/;
  return yearPattern.test(path);
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

      return {
        path: item.path,
        filename,
        category: detectCategory(item.path),
        size: item.size || 0,
        rawUrl: `${RAW_CONTENT_BASE}${item.path}`,
        isLegacy: isLegacyIcon(item.path),
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
  selectedCategory: string | null
): SearchResult[] {
  let filtered = icons;

  if (selectedCategory) {
    filtered = filtered.filter(icon => icon.category === selectedCategory);
  }

  if (!searchQuery.trim()) {
    return filtered.map(item => ({ item }));
  }

  const fuse = new Fuse(filtered, fuseOptions);
  return fuse.search(searchQuery);
}
