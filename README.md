# Icon 365

A visual browser for [Loryan Strant's Microsoft Cloud Logos](https://github.com/loryanstrant/MicrosoftCloudLogos) community repository.

**URL**: https://icons.jukkan.com

![Icon 365 - New icons in Power Platform category](https://raw.githubusercontent.com/jukkan/icon-365/main/public/Icon%20365%20-%20new%20icons%20in%20Power%20Platform%20category.png)

## Features

- **Search & Filter**: Fuzzy search across filenames and product names, filter by category (Azure, Teams, Office, Power Platform, etc.) and file type (PNG/SVG)
- **New Icons Filter**: Toggle to show only current icons vs legacy versions
- **Grid & List Views**: Switch between visual layouts
- **Multi-select & Bulk Download**: Ctrl+click to select multiple icons, download as ZIP
- **Preview Modal**: View full-size icons with dimensions and file size, navigate with arrow keys
- **Keyboard Navigation**: `/` to search, arrow keys to navigate, `Enter` to preview
- **Dark Mode**: Respects system preference with manual toggle
- **URL State**: Search queries and filters persist in URL for sharing

## Technical Details

### Stack

- React 18 + TypeScript
- Vite build tooling
- Tailwind CSS
- Fuse.js for fuzzy search
- JSZip for bulk downloads

### Caching & Data Updates

Icon 365 fetches data from the GitHub API and caches it in browser localStorage:

- **Cache TTL**: 7 days
- **Conditional Requests**: Uses ETags (HTTP 304) to avoid re-downloading unchanged data
- **Recent Changes**: Fetches last 30 days of commits to identify newly added/modified icons (marked with "NEW" badge)
- **Fallback**: Returns cached data if network requests fail

Data refreshes automatically when cache expires or manually via the refresh button. The app processes ~1000+ icons across 10+ categories from the source repository.
