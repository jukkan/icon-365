import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { IconFile } from './types';
import { fetchIcons, getCategories, searchIcons, SearchResult, fetchRecentChanges, RecentChange, getSearchSuggestions, getGitHubFileUrl, clearCache } from './api';
import type { FuseResultMatch } from 'fuse.js';
import JSZip from 'jszip';

const PAGE_SIZE = 50;

type ViewMode = 'grid' | 'list';
type FileTypeFilter = 'all' | 'png' | 'svg';

// Dark mode helpers
function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('icon365-dark-mode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

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

// Header Component with dark mode toggle and About button
function Header({ darkMode, onToggleDarkMode, onAboutClick, onRefresh, isRefreshing }: {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAboutClick: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <header className={`${darkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-200'} border-b px-6 py-4 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ms-blue">🎨 Icon 365</h1>
          <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            Visual browser for{' '}
            <a
              href="https://github.com/loryanstrant/MicrosoftCloudLogos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ms-blue hover:underline"
            >
              Microsoft Cloud Logos
            </a>
            {' '}community repo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-dark-border text-dark-text' : 'hover:bg-gray-100 text-gray-600'
            } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh data from GitHub"
          >
            <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onAboutClick}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode ? 'hover:bg-dark-border text-dark-text' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            About
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-dark-border text-dark-text' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// About Modal Component
function AboutModal({ onClose, darkMode }: { onClose: () => void; darkMode: boolean }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-2xl rounded-xl shadow-2xl animate-fade-in ${
          darkMode ? 'bg-dark-surface' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg z-10 transition-colors ${
            darkMode ? 'hover:bg-dark-border text-dark-text' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-8 space-y-4">
          <h2 className={`text-xl font-bold ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>
            Looking for the latest Microsoft product icons?
          </h2>

          <div className={`space-y-4 text-sm leading-relaxed ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
            <p>
              Microsoft doesn't offer a single place for discovering all the icons (a.k.a. logos) for their products. Luckily, the community has stepped up and addressed this gap.{' '}
              <a
                href="https://github.com/loryanstrant"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ms-blue hover:underline"
              >
                Loryan Strant
              </a>
              {' '}has published his own collection in the{' '}
              <a
                href="https://github.com/loryanstrant/MicrosoftCloudLogos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ms-blue hover:underline"
              >
                Microsoft Cloud Product Logos on GitHub
              </a>
              .
            </p>

            <p>
              This site is a vibe coded browser for searching, filtering and previewing the icons from Loryan's repo. Built by{' '}
              <a
                href="https://jukkan.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ms-blue hover:underline"
              >
                Jukka Niiranen
              </a>
              {' '}and Claude Code. Because everyone should have easy access to up-to-date visuals when referencing apps and services from the Microsoft Cloud.
            </p>

            <p>
              Obviously, all the images on this site are the property of Microsoft Corporation. If you plan to use them, please review the guidance on{' '}
              <a
                href="https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ms-blue hover:underline"
              >
                Microsoft trademarks and branding guidelines
              </a>
              .
            </p>

            <p>
              If you want to dig deeper into the history of icons/logos used by Microsoft, have a look at{' '}
              <a
                href="https://logos.fandom.com/wiki/Special:Search?scope=internal&navigationSearch=true&query=microsoft"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ms-blue hover:underline"
              >
                Logopedia
              </a>
              .
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-ms-blue text-white rounded-lg hover:bg-ms-blue-dark transition-colors press-effect font-medium"
            >
              Start Browsing Icons
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview Modal Component
function PreviewModal({
  icon,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  darkMode,
}: {
  icon: IconFile;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  darkMode: boolean;
}) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext, hasPrevious, hasNext]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = icon.rawUrl;
    link.download = icon.filename;
    link.target = '_blank';
    link.click();
  };

  const sizeKB = (icon.size / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-3xl rounded-xl shadow-2xl animate-fade-in ${
          darkMode ? 'bg-dark-surface' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg z-10 transition-colors ${
            darkMode ? 'hover:bg-dark-border text-dark-text' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Navigation arrows */}
        {hasPrevious && (
          <button
            onClick={onPrevious}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors ${
              darkMode ? 'bg-dark-border hover:bg-dark-text/20 text-dark-text' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full transition-colors ${
              darkMode ? 'bg-dark-border hover:bg-dark-text/20 text-dark-text' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Image preview */}
        <div className={`aspect-square max-h-96 flex items-center justify-center p-8 rounded-t-xl ${
          darkMode ? 'bg-dark-border' : 'bg-gray-50'
        }`}>
          <img
            src={icon.rawUrl}
            alt={icon.filename}
            onLoad={handleImageLoad}
            className={`max-w-full max-h-full object-contain transition-opacity ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className={`text-lg font-semibold ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>
              {icon.filename}
            </h3>
            <p className={`text-sm font-mono ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
              {icon.path}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className={darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}>Size: </span>
              <span className={darkMode ? 'text-dark-text' : 'text-gray-900'}>{sizeKB} KB</span>
            </div>
            {dimensions && (
              <div>
                <span className={darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}>Dimensions: </span>
                <span className={darkMode ? 'text-dark-text' : 'text-gray-900'}>{dimensions.width} × {dimensions.height}</span>
              </div>
            )}
            <div>
              <span className={darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}>Type: </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                icon.extension === 'svg'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}>
                {icon.extension.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 px-4 py-2 bg-ms-blue text-white rounded-lg hover:bg-ms-blue-dark transition-colors press-effect"
            >
              Download
            </button>
            <a
              href={getGitHubFileUrl(icon.path)}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                darkMode
                  ? 'bg-dark-border hover:bg-dark-text/20 text-dark-text'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating Action Bar for multi-select
function FloatingActionBar({
  selectedCount,
  onDownloadZip,
  onCopyUrls,
  onClear,
  darkMode,
}: {
  selectedCount: number;
  onDownloadZip: () => void;
  onCopyUrls: () => void;
  onClear: () => void;
  darkMode: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full shadow-lg flex items-center gap-4 animate-slide-up ${
      darkMode ? 'bg-dark-surface border border-dark-border' : 'bg-white border border-gray-200'
    }`}>
      <span className={`font-medium ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>
        ✓ {selectedCount} selected
      </span>
      <div className="h-6 w-px bg-gray-300 dark:bg-dark-border" />
      <button
        onClick={onDownloadZip}
        className="px-3 py-1.5 bg-ms-blue text-white rounded-lg text-sm hover:bg-ms-blue-dark transition-colors press-effect"
      >
        Download ZIP
      </button>
      <button
        onClick={onCopyUrls}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors press-effect ${
          darkMode
            ? 'bg-dark-border hover:bg-dark-text/20 text-dark-text'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        Copy URLs
      </button>
      <button
        onClick={onClear}
        className={`px-3 py-1.5 rounded-lg text-sm transition-colors press-effect ${
          darkMode
            ? 'hover:bg-dark-border text-dark-text-secondary'
            : 'hover:bg-gray-100 text-gray-500'
        }`}
      >
        Clear
      </button>
    </div>
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
  darkMode,
  showNewOnly,
  onShowNewOnlyChange,
}: {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  fileTypeFilter: FileTypeFilter;
  onFileTypeChange: (filter: FileTypeFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  darkMode: boolean;
  showNewOnly: boolean;
  onShowNewOnlyChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3 animate-slide-up">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search icons... (Press / to focus)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-ms-blue transition-all duration-200 ${
            darkMode
              ? 'bg-dark-surface border-dark-border text-dark-text placeholder-dark-text-secondary'
              : 'bg-white border-gray-300 text-gray-900'
          } border`}
        />
        <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* New filter toggle */}
        <button
          onClick={() => onShowNewOnlyChange(!showNewOnly)}
          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors press-effect ${
            showNewOnly
              ? 'bg-green-600 text-white'
              : darkMode
              ? 'bg-dark-surface text-dark-text hover:bg-dark-border border border-dark-border'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          title={showNewOnly ? 'Showing current icons only' : 'Show all icons including legacy'}
        >
          ✨ New
        </button>

        {/* File type filter */}
        <div className="flex items-center gap-2">
          <span className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Type:</span>
          <div className={`flex rounded-lg overflow-hidden border ${darkMode ? 'border-dark-border' : 'border-gray-300'}`}>
            {(['all', 'png', 'svg'] as FileTypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => onFileTypeChange(type)}
                className={`px-3 py-1 text-sm transition-colors press-effect ${
                  fileTypeFilter === type
                    ? 'bg-ms-blue text-white'
                    : darkMode
                    ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
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
          <span className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>View:</span>
          <div className={`flex rounded-lg overflow-hidden border ${darkMode ? 'border-dark-border' : 'border-gray-300'}`}>
            {[
              { mode: 'grid' as ViewMode, icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
              { mode: 'list' as ViewMode, icon: 'M4 6h16M4 12h16M4 18h16' },
            ].map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => onViewModeChange(mode)}
                className={`p-1.5 transition-colors press-effect ${
                  viewMode === mode
                    ? 'bg-ms-blue text-white'
                    : darkMode
                    ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <span className={`text-xs ml-auto hidden sm:inline ${darkMode ? 'text-dark-text-secondary' : 'text-gray-400'}`}>
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
  darkMode,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  iconCounts: Record<string, number>;
  darkMode: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: '50ms' }}>
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 press-effect ${
          selected === null
            ? 'bg-ms-blue text-white shadow-fluent'
            : darkMode
            ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All ({Object.values(iconCounts).reduce((a, b) => a + b, 0)})
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 press-effect ${
            selected === category
              ? 'bg-ms-blue text-white shadow-fluent'
              : darkMode
              ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {category} ({iconCounts[category] || 0})
        </button>
      ))}
    </div>
  );
}

// Skeleton loader
function IconCardSkeleton({ darkMode }: { darkMode: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${darkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-200'}`}>
      <div className={`aspect-square rounded-md mb-3 skeleton-shimmer`} />
      <div className="space-y-2">
        <div className={`h-4 rounded w-3/4 skeleton-shimmer`} />
        <div className={`h-3 rounded w-1/2 skeleton-shimmer`} />
        <div className={`h-8 rounded mt-2 skeleton-shimmer`} />
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
  isMultiSelected,
  onSelect,
  onMultiSelect,
  darkMode,
}: {
  icon: IconFile;
  matches?: readonly FuseResultMatch[];
  recentChange?: RecentChange;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  onSelect?: () => void;
  onMultiSelect?: () => void;
  darkMode: boolean;
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
        <mark key={`match-${i}`} className="bg-yellow-200 dark:bg-yellow-600 px-0.5 rounded">
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

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onMultiSelect?.();
    } else {
      onSelect?.();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`rounded-lg border p-4 transition-all duration-200 h-full cursor-pointer hover-lift ${
        isMultiSelected
          ? 'border-ms-green ring-2 ring-ms-green'
          : isSelected
          ? 'border-ms-blue ring-2 ring-ms-blue'
          : darkMode
          ? 'bg-dark-surface border-dark-border hover:shadow-fluent-lg'
          : 'bg-white border-gray-200 hover:shadow-fluent-lg'
      }`}
    >
      <div className={`relative aspect-square flex items-center justify-center rounded-md mb-3 overflow-hidden ${
        darkMode ? 'bg-dark-border' : 'bg-gray-100'
      }`}>
        {isMultiSelected && (
          <div className="absolute top-1 left-1 bg-ms-green text-white rounded-full w-5 h-5 flex items-center justify-center z-10">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {recentChange && (
          <div
            className="absolute top-1 right-1 bg-ms-green text-white text-xs px-1.5 py-0.5 rounded font-medium z-10"
            title={`Updated ${formatDate(recentChange.date)}: ${recentChange.message}`}
          >
            NEW
          </div>
        )}

        {!isVisible ? (
          <div className="w-full h-full skeleton-shimmer" />
        ) : imageError ? (
          <div className={`flex flex-col items-center ${darkMode ? 'text-dark-text-secondary' : 'text-gray-400'}`}>
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
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={handleError}
            className={`max-w-full max-h-full object-contain transition-all duration-300 ${
              imageLoaded ? 'opacity-100 blur-0' : 'opacity-50 blur-sm scale-95'
            }`}
          />
        )}
      </div>
      <div className="space-y-2">
        <p className={`text-sm font-medium truncate ${darkMode ? 'text-dark-text' : 'text-gray-900'}`} title={icon.filename}>
          {highlightText(icon.filename, 'filename')}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{sizeKB} KB</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            icon.extension === 'svg'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          }`}>
            {icon.extension.toUpperCase()}
          </span>
          {icon.isLegacy && (
            <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded">
              Legacy
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="w-full mt-2 px-3 py-1.5 text-sm bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors press-effect"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// List View Item
function IconListItem({
  icon,
  recentChange,
  isSelected,
  isMultiSelected,
  onSelect,
  onMultiSelect,
  darkMode,
}: {
  icon: IconFile;
  matches?: readonly FuseResultMatch[];
  recentChange?: RecentChange;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  onSelect?: () => void;
  onMultiSelect?: () => void;
  darkMode: boolean;
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

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onMultiSelect?.();
    } else {
      onSelect?.();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`border rounded-lg p-3 flex items-center gap-4 cursor-pointer transition-all duration-200 ${
        isMultiSelected
          ? 'border-ms-green ring-1 ring-ms-green'
          : isSelected
          ? 'border-ms-blue ring-1 ring-ms-blue'
          : darkMode
          ? 'bg-dark-surface border-dark-border hover:shadow-fluent'
          : 'bg-white border-gray-200 hover:shadow-fluent'
      }`}
    >
      {isMultiSelected && (
        <div className="w-5 h-5 bg-ms-green text-white rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded ${darkMode ? 'bg-dark-border' : 'bg-gray-50'}`}>
        <img src={icon.rawUrl} alt={icon.filename} className="max-w-full max-h-full object-contain" loading="lazy" decoding="async" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>{icon.filename}</p>
        <p className={`text-xs ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{icon.path}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {recentChange && (
          <span className="bg-ms-green text-white text-xs px-1.5 py-0.5 rounded font-medium" title={`Updated ${formatDate(recentChange.date)}`}>
            NEW
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          icon.extension === 'svg' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {icon.extension.toUpperCase()}
        </span>
        <span className={`text-xs w-16 text-right ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{sizeKB} KB</span>
        <a
          href={getGitHubFileUrl(icon.path)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`p-1.5 rounded transition-colors ${
            darkMode ? 'hover:bg-dark-border text-dark-text-secondary' : 'hover:bg-gray-100 text-gray-500'
          }`}
          title="View on GitHub"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="px-3 py-1 text-sm bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors press-effect"
        >
          Download
        </button>
      </div>
    </div>
  );
}

// Empty State Component with smart suggestions
function EmptyState({
  searchQuery,
  suggestion,
  suggestedCategory,
  onSuggestionClick,
  onCategoryClick,
  darkMode,
  showNewOnly,
  onShowNewOnlyChange,
}: {
  searchQuery: string;
  suggestion: string | null;
  suggestedCategory: string | null;
  onSuggestionClick: (term: string) => void;
  onCategoryClick: (category: string) => void;
  darkMode: boolean;
  showNewOnly?: boolean;
  onShowNewOnlyChange?: (value: boolean) => void;
}) {
  const defaultSuggestions = ['Teams', 'Azure', 'Office', 'SharePoint', 'OneDrive', 'Outlook'];

  // Determine the appropriate message
  const getMessage = () => {
    if (searchQuery) {
      return `No icons found for "${searchQuery}"`;
    }
    if (showNewOnly) {
      return 'No current icons in this selection';
    }
    return 'No icons found';
  };

  return (
    <div className="text-center py-12 animate-fade-in">
      <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>
        {getMessage()}
      </p>

      {/* Show option to disable New filter if it's causing empty results */}
      {showNewOnly && !searchQuery && onShowNewOnlyChange && (
        <p className={`mb-3 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
          <button
            onClick={() => onShowNewOnlyChange(false)}
            className="text-ms-blue hover:underline font-medium"
          >
            Show all icons including legacy
          </button>
        </p>
      )}

      {/* Smart suggestions */}
      {suggestion && (
        <p className={`mb-3 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
          Did you mean:{' '}
          <button
            onClick={() => onSuggestionClick(suggestion.replace(/\.(png|svg)$/i, ''))}
            className="text-ms-blue hover:underline font-medium"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}

      {suggestedCategory && (
        <p className={`mb-3 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
          Try browsing{' '}
          <button
            onClick={() => onCategoryClick(suggestedCategory)}
            className="text-ms-blue hover:underline font-medium"
          >
            {suggestedCategory}
          </button>
          {' '}instead
        </p>
      )}

      {!suggestion && !suggestedCategory && (
        <p className={`mb-4 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>
          Try searching for something else
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {defaultSuggestions.map((term) => (
          <button
            key={term}
            onClick={() => onSuggestionClick(term)}
            className={`px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
              darkMode
                ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

// Icon Grid
function IconGrid({
  results,
  visibleCount,
  onLoadMore,
  recentChanges,
  viewMode,
  selectedIndex,
  onSelect,
  multiSelected,
  onMultiSelect,
  darkMode,
  searchQuery,
  suggestion,
  suggestedCategory,
  onSuggestionClick,
  onCategoryClick,
  showNewOnly,
  onShowNewOnlyChange,
}: {
  results: SearchResult[];
  visibleCount: number;
  onLoadMore: () => void;
  recentChanges: Map<string, RecentChange>;
  viewMode: ViewMode;
  selectedIndex: number;
  onSelect: (index: number) => void;
  multiSelected: Set<string>;
  onMultiSelect: (path: string) => void;
  darkMode: boolean;
  searchQuery: string;
  suggestion: string | null;
  suggestedCategory: string | null;
  onSuggestionClick: (term: string) => void;
  onCategoryClick: (category: string) => void;
  showNewOnly: boolean;
  onShowNewOnlyChange: (value: boolean) => void;
}) {
  if (results.length === 0) {
    return (
      <EmptyState
        searchQuery={searchQuery}
        suggestion={suggestion}
        suggestedCategory={suggestedCategory}
        onSuggestionClick={onSuggestionClick}
        onCategoryClick={onCategoryClick}
        darkMode={darkMode}
        showNewOnly={showNewOnly}
        onShowNewOnlyChange={onShowNewOnlyChange}
      />
    );
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div className="space-y-6">
      <p className={`text-xs ${darkMode ? 'text-dark-text-secondary' : 'text-gray-400'}`}>
        Tip: Ctrl+Click to select multiple icons
      </p>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleResults.map((result, index) => (
            <div key={result.item.path} className="animate-fade-in" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <IconCard
                icon={result.item}
                matches={result.matches}
                recentChange={recentChanges.get(result.item.path)}
                isSelected={index === selectedIndex}
                isMultiSelected={multiSelected.has(result.item.path)}
                onSelect={() => onSelect(index)}
                onMultiSelect={() => onMultiSelect(result.item.path)}
                darkMode={darkMode}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleResults.map((result, index) => (
            <div key={result.item.path} className="animate-slide-up" style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}>
              <IconListItem
                icon={result.item}
                recentChange={recentChanges.get(result.item.path)}
                isSelected={index === selectedIndex}
                isMultiSelected={multiSelected.has(result.item.path)}
                onSelect={() => onSelect(index)}
                onMultiSelect={() => onMultiSelect(result.item.path)}
                darkMode={darkMode}
              />
            </div>
          ))}
        </div>
      )}

      <div className="text-center space-y-3">
        <p className={`text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
          Showing {visibleResults.length} of {results.length} icons
        </p>
        {hasMore && (
          <button
            onClick={onLoadMore}
            className={`px-6 py-2 rounded-lg font-medium transition-colors press-effect ${
              darkMode
                ? 'bg-dark-surface text-dark-text hover:bg-dark-border'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Load {Math.min(PAGE_SIZE, results.length - visibleCount)} more
          </button>
        )}
      </div>
    </div>
  );
}

// Footer
function Footer({ darkMode }: { darkMode: boolean }) {
  return (
    <footer className={`border-t px-6 py-4 mt-auto transition-colors ${
      darkMode ? 'bg-dark-surface border-dark-border' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`max-w-7xl mx-auto text-center text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
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
        <p className="mt-2">
          Built by{' '}
          <a
            href="https://jukkan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ms-blue hover:underline"
          >
            Jukka Niiranen
          </a>
          . View project on{' '}
          <a
            href="https://github.com/jukkan/icon-365"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ms-blue hover:underline"
          >
            GitHub
          </a>
          .
        </p>
        <div className="flex justify-center gap-4 mt-3">
          <a
            href="https://www.linkedin.com/in/jukkaniiranen"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${darkMode ? 'hover:text-dark-text' : 'hover:text-gray-900'}`}
            title="LinkedIn"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a
            href="https://mstdn.social/@jukkan"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${darkMode ? 'hover:text-dark-text' : 'hover:text-gray-900'}`}
            title="Mastodon"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.668 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12v6.406z"/>
            </svg>
          </a>
          <a
            href="https://bsky.app/profile/jukkan.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${darkMode ? 'hover:text-dark-text' : 'hover:text-gray-900'}`}
            title="Bluesky"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
            </svg>
          </a>
          <a
            href="https://www.youtube.com/@jukkan"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${darkMode ? 'hover:text-dark-text' : 'hover:text-gray-900'}`}
            title="YouTube"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a
            href="https://github.com/jukkan"
            target="_blank"
            rel="noopener noreferrer"
            className={`transition-colors ${darkMode ? 'hover:text-dark-text' : 'hover:text-gray-900'}`}
            title="GitHub"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

// Loading State
function LoadingState({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <IconCardSkeleton key={i} darkMode={darkMode} />
        ))}
      </div>
    </div>
  );
}

// Error State
function ErrorState({ message, onRetry, darkMode }: { message: string; onRetry: () => void; darkMode: boolean }) {
  return (
    <div className="text-center py-12 animate-fade-in">
      <div className="mb-4">
        <svg className="w-12 h-12 mx-auto text-ms-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className={`mb-2 font-medium ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>Failed to load icons</p>
      <p className={`mb-4 text-sm ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors press-effect"
      >
        Try Again
      </button>
    </div>
  );
}

// Main App
function App() {
  const [icons, setIcons] = useState<IconFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentChanges, setRecentChanges] = useState<Map<string, RecentChange>>(new Map());
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  const urlParams = getUrlParams();
  const [searchQuery, setSearchQuery] = useState(urlParams.search);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlParams.category);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  const [showNewOnly, setShowNewOnly] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [showAboutModal, setShowAboutModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('icon365-visited');
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mark as visited when About modal is closed
  const handleCloseAbout = useCallback(() => {
    setShowAboutModal(false);
    localStorage.setItem('icon365-visited', 'true');
  }, []);

  // Compute derived state first (before effects that use them)
  const categories = useMemo(() => getCategories(icons), [icons]);
  const searchResults = useMemo(
    () => searchIcons(icons, searchQuery, selectedCategory, fileTypeFilter, showNewOnly, recentChanges),
    [icons, searchQuery, selectedCategory, fileTypeFilter, showNewOnly, recentChanges]
  );

  const iconCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    icons.forEach((icon) => {
      counts[icon.category] = (counts[icon.category] || 0) + 1;
    });
    return counts;
  }, [icons]);

  // Get search suggestions when no results
  const { suggestion, suggestedCategory } = useMemo(() => {
    if (searchResults.length > 0 || !searchQuery.trim()) {
      return { suggestion: null, suggestedCategory: null };
    }
    return getSearchSuggestions(icons, searchQuery, selectedCategory);
  }, [icons, searchQuery, selectedCategory, searchResults.length]);

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('icon365-dark-mode', String(darkMode));
  }, [darkMode]);

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

  const handleRefresh = useCallback(() => {
    clearCache();
    loadIcons();
  }, [loadIcons]);

  useEffect(() => {
    loadIcons();
  }, [loadIcons]);

  useEffect(() => {
    setUrlParams(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modal is open (modal has its own handlers)
      if (previewIndex !== null) return;

      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        setSelectedIndex(-1);
        return;
      }

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
              setPreviewIndex(selectedIndex);
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
  }, [selectedIndex, visibleCount, viewMode, previewIndex, searchResults]);

  // Multi-select handlers
  const handleMultiSelect = useCallback((path: string) => {
    setMultiSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleDownloadZip = useCallback(async () => {
    if (multiSelected.size === 0) return;

    const zip = new JSZip();
    const selectedIcons = icons.filter(icon => multiSelected.has(icon.path));

    for (const icon of selectedIcons) {
      try {
        const response = await fetch(icon.rawUrl);
        const blob = await response.blob();
        zip.file(icon.filename, blob);
      } catch (e) {
        console.error(`Failed to fetch ${icon.filename}:`, e);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'icons.zip';
    link.click();
    URL.revokeObjectURL(url);
  }, [multiSelected, icons]);

  const handleCopyUrls = useCallback(() => {
    const selectedIcons = icons.filter(icon => multiSelected.has(icon.path));
    const urls = selectedIcons.map(icon => icon.rawUrl).join('\n');
    navigator.clipboard.writeText(urls);
  }, [multiSelected, icons]);

  const handleClearSelection = useCallback(() => {
    setMultiSelected(new Set());
  }, []);

  // Modal handlers
  const handleOpenPreview = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const handlePreviousPreview = useCallback(() => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  }, [previewIndex]);

  const handleNextPreview = useCallback(() => {
    if (previewIndex !== null && previewIndex < searchResults.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  }, [previewIndex, searchResults.length]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(PAGE_SIZE);
    setSelectedIndex(-1);
    // Clear "New" filter when user starts searching to search all icons
    if (query.trim() && showNewOnly) {
      setShowNewOnly(false);
    }
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

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      darkMode ? 'bg-dark-bg' : 'bg-gray-50'
    }`}>
      <Header darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} onAboutClick={() => setShowAboutModal(true)} onRefresh={handleRefresh} isRefreshing={loading} />

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
            darkMode={darkMode}
            showNewOnly={showNewOnly}
            onShowNewOnlyChange={setShowNewOnly}
          />

          {!loading && !error && (
            <CategoryTabs
              categories={categories}
              selected={selectedCategory}
              onSelect={handleCategoryChange}
              iconCounts={iconCounts}
              darkMode={darkMode}
            />
          )}

          {loading && <LoadingState darkMode={darkMode} />}
          {error && <ErrorState message={error} onRetry={loadIcons} darkMode={darkMode} />}
          {!loading && !error && (
            <IconGrid
              results={searchResults}
              visibleCount={visibleCount}
              onLoadMore={handleLoadMore}
              recentChanges={recentChanges}
              viewMode={viewMode}
              selectedIndex={selectedIndex}
              onSelect={handleOpenPreview}
              multiSelected={multiSelected}
              onMultiSelect={handleMultiSelect}
              darkMode={darkMode}
              searchQuery={searchQuery}
              suggestion={suggestion}
              suggestedCategory={suggestedCategory}
              onSuggestionClick={handleSearchChange}
              onCategoryClick={handleCategoryChange}
              showNewOnly={showNewOnly}
              onShowNewOnlyChange={setShowNewOnly}
            />
          )}
        </div>
      </main>

      <Footer darkMode={darkMode} />

      {/* Preview Modal */}
      {previewIndex !== null && searchResults[previewIndex] && (
        <PreviewModal
          icon={searchResults[previewIndex].item}
          onClose={handleClosePreview}
          onPrevious={handlePreviousPreview}
          onNext={handleNextPreview}
          hasPrevious={previewIndex > 0}
          hasNext={previewIndex < searchResults.length - 1}
          darkMode={darkMode}
        />
      )}

      {/* Floating Action Bar for multi-select */}
      <FloatingActionBar
        selectedCount={multiSelected.size}
        onDownloadZip={handleDownloadZip}
        onCopyUrls={handleCopyUrls}
        onClear={handleClearSelection}
        darkMode={darkMode}
      />

      {/* About Modal */}
      {showAboutModal && (
        <AboutModal onClose={handleCloseAbout} darkMode={darkMode} />
      )}
    </div>
  );
}

export default App;
