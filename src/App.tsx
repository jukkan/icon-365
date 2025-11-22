import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { IconFile } from './types';
import { fetchIcons, getCategories, searchIcons, SearchResult } from './api';
import type { FuseResultMatch } from 'fuse.js';

const PAGE_SIZE = 50;

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

// Search Bar Component
function SearchBar({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search icons..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>
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

// Icon Card Component with intersection observer
function IconCard({
  icon,
  matches
}: {
  icon: IconFile;
  matches?: readonly FuseResultMatch[];
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

  // Highlight matching text
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

  return (
    <div ref={containerRef} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow h-full">
      <div className="aspect-square flex items-center justify-center bg-gray-100 rounded-md mb-3 overflow-hidden">
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {sizeKB} KB • {icon.extension.toUpperCase()}
          </span>
          {icon.isLegacy && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
              Legacy
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          className="w-full mt-2 px-3 py-1.5 text-sm bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// Icon Grid Component
function IconGrid({
  results,
  visibleCount,
  onLoadMore,
}: {
  results: SearchResult[];
  visibleCount: number;
  onLoadMore: () => void;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No icons found</p>
      </div>
    );
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleResults.map((result) => (
          <IconCard key={result.item.path} icon={result.item} matches={result.matches} />
        ))}
      </div>

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

// Loading State with Skeletons
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

// Error State Component
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

  // Initialize from URL params
  const urlParams = getUrlParams();
  const [searchQuery, setSearchQuery] = useState(urlParams.search);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlParams.category);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadIcons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIcons();
      setIcons(data);
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

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(PAGE_SIZE);
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  };

  const categories = useMemo(() => getCategories(icons), [icons]);
  const searchResults = useMemo(
    () => searchIcons(icons, searchQuery, selectedCategory),
    [icons, searchQuery, selectedCategory]
  );

  // Calculate counts per category
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
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
