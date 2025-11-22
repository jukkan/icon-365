import { useState, useEffect } from 'react';
import { IconFile } from './types';
import { fetchIcons, getCategories, filterIcons } from './api';

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
      {value && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          {resultCount} results
        </span>
      )}
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

// Icon Card Component
function IconCard({ icon }: { icon: IconFile }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeKB = (icon.size / 1024).toFixed(1);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = icon.rawUrl;
    link.download = icon.filename;
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="aspect-square flex items-center justify-center bg-gray-50 rounded-md mb-3 overflow-hidden">
        {!imageLoaded && !imageError && (
          <div className="w-8 h-8 border-2 border-ms-blue border-t-transparent rounded-full animate-spin" />
        )}
        {imageError ? (
          <div className="text-gray-400 text-xs text-center px-2">Failed to load</div>
        ) : (
          <img
            src={icon.rawUrl}
            alt={icon.filename}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`max-w-full max-h-full object-contain ${imageLoaded ? 'block' : 'hidden'}`}
          />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 truncate" title={icon.filename}>
          {icon.filename}
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
function IconGrid({ icons }: { icons: IconFile[] }) {
  if (icons.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No icons found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {icons.map((icon) => (
        <IconCard key={icon.path} icon={icon} />
      ))}
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

// Loading State Component
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 border-4 border-ms-blue border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-600">Loading icons...</p>
    </div>
  );
}

// Error State Component
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-red-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-ms-blue text-white rounded hover:bg-ms-blue-dark transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// Main App Component
function App() {
  const [icons, setIcons] = useState<IconFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadIcons = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIcons();
      setIcons(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load icons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIcons();
  }, []);

  const categories = getCategories(icons);
  const filteredIcons = filterIcons(icons, searchQuery, selectedCategory);

  // Calculate counts per category
  const iconCounts: Record<string, number> = {};
  icons.forEach((icon) => {
    iconCounts[icon.category] = (iconCounts[icon.category] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={filteredIcons.length}
          />

          {!loading && !error && (
            <CategoryTabs
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
              iconCounts={iconCounts}
            />
          )}

          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={loadIcons} />}
          {!loading && !error && <IconGrid icons={filteredIcons} />}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
