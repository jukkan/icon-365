import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { IconFile } from './types';
import { fetchIcons, getCategories, searchIcons, SearchResult, fetchRecentChanges, RecentChange } from './api';
import type { FuseResultMatch } from 'fuse.js';

const PAGE_SIZE = 50;

type ViewMode = 'grid' | 'list' | 'compare';
type FileTypeFilter = 'all' | 'png' | 'svg';

// URL state helpers
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('q') || '',
    category: params.get('category') || null,
  };
}

function setUrlParams(search: string, category: string | null) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (category) params.set('category', category);
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

// Header Component
function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-ms-blue">Icon 365</h1>
        <p className="text-sm text-gray-600">Visual browser for Microsoft Cloud Logos community repo</p>
      </div>
    </header>
  );
}

// Search Bar with filters
function SearchBar({
  value,
  onChange,
  resultCount,
  fileTypeFilter,
  onFileTypeChange,
  viewMode,
  onViewModeChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  fileTypeFilter: FileTypeFilter;
  onFileTypeChange: (filter: FileTypeFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search icons... (Press / to focus)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* File type filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Type:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['all', 'png', 'svg'] as FileTypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => onFileTypeChange(type)}
                className={`px-3 py-1 text-sm ${
                  fileTypeFilter === type
                    ? 'bg-ms-blue text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">View:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-ms-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Grid view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-ms-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="List view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('compare')}
              className={`p-1.5 ${viewMode === 'compare' ? 'bg-ms-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              title="Compare view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <span className="text-xs text-gray-400 ml-auto hidden sm:inline">
          / search • Esc clear • ↑↓←→ navigate • Enter download
        </span>
      </div>
    </div>
  );
}

// Category Tabs Component
function CategoryTabs({
  categories,
  selected,
  onSelect,
  iconCounts,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  iconCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          selected === null
            ? 'bg-ms-blue text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All ({Object.values(iconCounts).reduce((a, b) => a + b, 0)})
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selected === category
              ? 'bg-ms-blue text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {category} ({iconCounts[category] || 0})
        </button>
      ))}
    </div>
  );
}

// Skeleton loader for icon cards
function IconCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="aspect-square bg-gray-200 rounded-md mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-8 bg-gray-200 rounded mt-2" />
      </div>
    </div>
  );
}

// Icon Card Component
function IconCard({
  icon,
  matches,
  recentChange,
  isSelected,
  onSelect,
}: {
  icon: IconFile;
  matches?: readonly FuseResultMatch[];
  recentChange?: RecentChange;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const sizeKB = (icon.size / 1024).toFixed(1);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = icon.rawUrl;
    link.download = icon.filename;
    link.target = '_blank';
    link.click();
  };

  const handleError = () => {
    if (retryCount < 1) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        if (imgRef.current) {
          imgRef.current.src = icon.rawUrl + '?retry=' + Date.now();
        }
      }, 2000);
    } else {
      setImageError(true);
    }
  };

  const highlightText = (text: string, key: string) => {
    if (!matches) return text;

    const match = matches.find(m => m.key === key);
    if (!match?.indices?.length) return text;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    match.indices.forEach(([start, end], i) => {
      if (start > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.slice(lastIndex, start)}</span>);
      }
      parts.push(
        <mark key={`match-${i}`} className="bg-yellow-200 px-0.5 rounded">
          {text.slice(start, end + 1)}
        </mark>
      );
      lastIndex = end + 1;
    });

    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={containerRef}
      onClick={onSelect}
      className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow h-full cursor-pointer ${
        isSelected ? 'border-ms-blue ring-2 ring-ms-blue' : 'border-gray-200'
      }`}
    >
      <div className="relative aspect-square flex items-center justify-center bg-gray-100 rounded-md mb-3 overflow-hidden">
        {/* NEW badge */}
        {recentChange && (
          <div
            className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-medium"
            title={`Updated ${formatDate(recentChange.date)}: ${recentChange.message}`}
          >
            NEW
          </div>
        )}

        {!isVisible ? (
          <div className="w-full h-full bg-gray-100" />
        ) : imageError ? (
          <div className="flex flex-col items-center text-gray-400">
            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Failed</span>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={icon.rawUrl}
            alt={icon.filename}
            onLoad={() => setImageLoaded(true)}
            onError={handleError}
            className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 truncate" title={icon.filename}>
          {highlightText(icon.filename, 'filename')}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{sizeKB} KB</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            icon.extension === 'svg'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {icon.extension.toUpperCase()}
          </span>
          {icon.isLegacy && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
              Legacy
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="w-full mt-2 px-3 py-1.5 text-sm bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// List View Item Component
function IconListItem({
  icon,
  recentChange,
  isSelected,
  onSelect,
}: {
  icon: IconFile;
  matches?: readonly FuseResultMatch[];
  recentChange?: RecentChange;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const sizeKB = (icon.size / 1024).toFixed(1);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = icon.rawUrl;
    link.download = icon.filename;
    link.target = '_blank';
    link.click();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-white border rounded-lg p-3 flex items-center gap-4 hover:shadow-sm cursor-pointer ${
        isSelected ? 'border-ms-blue ring-1 ring-ms-blue' : 'border-gray-200'
      }`}
    >
      <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-50 rounded">
        <img src={icon.rawUrl} alt={icon.filename} className="max-w-full max-h-full object-contain" loading="lazy" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{icon.filename}</p>
        <p className="text-xs text-gray-500">{icon.path}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {recentChange && (
          <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-medium" title={`Updated ${formatDate(recentChange.date)}`}>
            NEW
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          icon.extension === 'svg' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {icon.extension.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500 w-16 text-right">{sizeKB} KB</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="px-3 py-1 text-sm bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// Compare View Component
function CompareView({
  results,
}: {
  results: SearchResult[];
  recentChanges: Map<string, RecentChange>;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (path: string) => {
    setSelected(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : prev.length < 2
        ? [...prev, path]
        : [prev[1], path]
    );
  };

  const selectedIcons = selected
    .map(path => results.find(r => r.item.path === path))
    .filter((r): r is SearchResult => !!r);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-600 mb-4">Select two icons to compare (click to select)</p>
        {selectedIcons.length === 2 && (
          <div className="grid grid-cols-2 gap-8">
            {selectedIcons.map((result) => (
              <div key={result.item.path} className="text-center">
                <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center mb-3 p-4">
                  <img src={result.item.rawUrl} alt={result.item.filename} className="max-w-full max-h-full object-contain" />
                </div>
                <p className="font-medium text-sm">{result.item.filename}</p>
                <p className="text-xs text-gray-500">{result.item.path}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(result.item.size / 1024).toFixed(1)} KB • {result.item.extension.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {results.slice(0, 50).map((result) => (
          <div
            key={result.item.path}
            onClick={() => toggleSelect(result.item.path)}
            className={`p-2 rounded-lg border cursor-pointer ${
              selected.includes(result.item.path)
                ? 'border-ms-blue bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="aspect-square flex items-center justify-center bg-gray-50 rounded mb-1">
              <img src={result.item.rawUrl} alt={result.item.filename} className="max-w-full max-h-full object-contain" loading="lazy" />
            </div>
            <p className="text-xs truncate text-center">{result.item.filename}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Icon Grid Component
function IconGrid({
  results,
  visibleCount,
  onLoadMore,
  recentChanges,
  viewMode,
  selectedIndex,
  onSelect,
}: {
  results: SearchResult[];
  visibleCount: number;
  onLoadMore: () => void;
  recentChanges: Map<string, RecentChange>;
  viewMode: ViewMode;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No icons found</p>
      </div>
    );
  }

  if (viewMode === 'compare') {
    return <CompareView results={results} recentChanges={recentChanges} />;
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div className="space-y-6">
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleResults.map((result, index) => (
            <IconCard
              key={result.item.path}
              icon={result.item}
              matches={result.matches}
              recentChange={recentChanges.get(result.item.path)}
              isSelected={index === selectedIndex}
              onSelect={() => onSelect(index)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleResults.map((result, index) => (
            <IconListItem
              key={result.item.path}
              icon={result.item}
              matches={result.matches}
              recentChange={recentChanges.get(result.item.path)}
              isSelected={index === selectedIndex}
              onSelect={() => onSelect(index)}
            />
          ))}
        </div>
      )}

      <div className="text-center space-y-3">
        <p className="text-sm text-gray-600">
          Showing {visibleResults.length} of {results.length} icons
        </p>
        {hasMore && (
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Load {Math.min(PAGE_SIZE, results.length - visibleCount)} more
          </button>
        )}
      </div>
    </div>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 px-6 py-4 mt-auto">
      <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
        <p>
          Icons from{' '}
          <a
            href="https://github.com/loryanstrant/MicrosoftCloudLogos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ms-blue hover:underline"
          >
            Loryan Strant's Microsoft Cloud Logos
          </a>
        </p>
        <p className="mt-1">Icons © Microsoft Corporation</p>
      </div>
    </footer>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <IconCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Error State
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="mb-4">
        <svg className="w-12 h-12 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-gray-700 mb-2 font-medium">Failed to load icons</p>
      <p className="text-gray-500 mb-4 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Main App Component
function App() {
  const [icons, setIcons] = useState<IconFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentChanges, setRecentChanges] = useState<Map<string, RecentChange>>(new Map());

  // Initialize from URL params
  const urlParams = getUrlParams();
  const [searchQuery, setSearchQuery] = useState(urlParams.search);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlParams.category);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadIcons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, changes] = await Promise.all([
        fetchIcons(),
        fetchRecentChanges(),
      ]);
      setIcons(data);
      setRecentChanges(changes);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load icons';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIcons();
  }, [loadIcons]);

  // Update URL when search/category changes
  useEffect(() => {
    setUrlParams(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on /
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Clear search on Escape
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        setSelectedIndex(-1);
        return;
      }

      // Arrow key navigation
      if (selectedIndex >= 0 || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const totalItems = Math.min(visibleCount, searchResults.length);
        const cols = viewMode === 'list' ? 1 : window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : window.innerWidth >= 640 ? 2 : 1;

        let newIndex = selectedIndex;

        switch (e.key) {
          case 'ArrowRight':
            newIndex = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, totalItems - 1);
            e.preventDefault();
            break;
          case 'ArrowLeft':
            newIndex = Math.max(selectedIndex - 1, 0);
            e.preventDefault();
            break;
          case 'ArrowDown':
            newIndex = selectedIndex < 0 ? 0 : Math.min(selectedIndex + cols, totalItems - 1);
            e.preventDefault();
            break;
          case 'ArrowUp':
            newIndex = Math.max(selectedIndex - cols, 0);
            e.preventDefault();
            break;
          case 'Enter':
            if (selectedIndex >= 0 && searchResults[selectedIndex]) {
              const icon = searchResults[selectedIndex].item;
              const link = document.createElement('a');
              link.href = icon.rawUrl;
              link.download = icon.filename;
              link.target = '_blank';
              link.click();
            }
            e.preventDefault();
            break;
        }

        if (newIndex !== selectedIndex) {
          setSelectedIndex(newIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, visibleCount, viewMode]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(PAGE_SIZE);
    setSelectedIndex(-1);
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setVisibleCount(PAGE_SIZE);
    setSelectedIndex(-1);
  };

  const handleFileTypeChange = (filter: FileTypeFilter) => {
    setFileTypeFilter(filter);
    setVisibleCount(PAGE_SIZE);
    setSelectedIndex(-1);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  const categories = useMemo(() => getCategories(icons), [icons]);
  const searchResults = useMemo(
    () => searchIcons(icons, searchQuery, selectedCategory, fileTypeFilter),
    [icons, searchQuery, selectedCategory, fileTypeFilter]
  );

  const iconCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    icons.forEach((icon) => {
      counts[icon.category] = (counts[icon.category] || 0) + 1;
    });
    return counts;
  }, [icons]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            resultCount={searchResults.length}
            fileTypeFilter={fileTypeFilter}
            onFileTypeChange={handleFileTypeChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            inputRef={searchInputRef}
          />

          {!loading && !error && (
            <CategoryTabs
              categories={categories}
              selected={selectedCategory}
              onSelect={handleCategoryChange}
              iconCounts={iconCounts}
            />
          )}

          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={loadIcons} />}
          {!loading && !error && (
            <IconGrid
              results={searchResults}
              visibleCount={visibleCount}
              onLoadMore={handleLoadMore}
              recentChanges={recentChanges}
              viewMode={viewMode}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
