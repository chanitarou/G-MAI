# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **UI mockup** for a case search RAG (Retrieval-Augmented Generation) system for public sector proposals. It demonstrates the interface and basic interactions but does not implement actual RAG functionality - search is keyword-based only.

**Key Context:**
- This is a **prototype/mockup**, not a production system
- All data is in-memory and resets on page reload
- No backend integration exists yet (planned for Dify or similar)
- File uploads are visual-only (files are not actually stored)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Architecture

### Two-Page Application Structure

The app has two main pages, both accessed through a tab navigation:

1. **Search Page (`/`)** - `src/pages/ChatSearch.tsx`
   - Left panel: Chat interface for entering search queries
   - Right panel: Search results display
   - Tag-based filtering with multi-select support

2. **File Management Page (`/files`)** - `src/pages/FileManagement.tsx`
   - File upload area (drag & drop + file picker)
   - File list with tag assignment
   - Tag management modal

### Data Flow Pattern

**Important:** This app uses in-memory state management with dummy data - no persistence layer.

```
src/data/dummyData.ts (source of truth)
    ↓
Component useState initialization
    ↓
User interactions modify local state
    ↓
On page reload → reset to dummyData
```

### Search Implementation

Search uses a hybrid approach in `ChatSearch.tsx`:

```typescript
performSearch(queryText: string, tagFilters: string[])
```

1. **Text Search**: Keyword matching against `fileName`, `matchedText`, and `tags` (OR logic for keywords)
2. **Tag Filtering**: AND logic - results must have ALL selected tags
3. **Combined**: When both are used, results must match BOTH conditions

**Tag Selection Behavior:**
- When tags are selected, they appear in the input field as `#tagName` format
- Input field becomes disabled while tags are selected
- Searching with tags sends empty queryText to prevent text matching against the `#` prefix

### State Management

No global state library is used. Each page manages its own state:

- `ChatSearch.tsx`: `messages`, `results`, `selectedTags`, `inputValue`, `hasSearched`
- `FileManagement.tsx`: `files`, `tags`, `editingFileId`, `selectedTags`

Tags have a `color` property but it's **not used** in the UI - all tags display as gray for a professional look.

## Design System

### Color Palette (Grayscale-Focused)

- **Accent color**: `bg-gray-900` / `text-gray-900` (black, used for buttons and selected states)
- **Borders**: `border-gray-200`, `border-gray-300`
- **Backgrounds**: `bg-white`, `bg-gray-50`, `bg-gray-100`
- **Text**: `text-gray-900`, `text-gray-700`, `text-gray-500`
- **Hover states**: `hover:bg-gray-800`, `hover:border-gray-400`

**No blue accents are used** - this is intentional to avoid an "AI tool" appearance.

### Navigation Pattern

The `Layout.tsx` component uses a tab-style navigation positioned **below** the title (not beside it):
- Active tab: `border-gray-900` bottom border with `text-gray-900`
- Inactive tab: `border-transparent` with `text-gray-500`

### Tag Display

All tags use uniform styling regardless of the `color` property:
```tsx
className="bg-gray-100 text-gray-700 border border-gray-300"
```

## Data Structure

See `src/types/index.ts` for TypeScript interfaces.

**Current dummy data counts:**
- 9 files (real organization names: 大阪市, 厚生労働省, 愛知県, etc.)
- 14 tags (公共, 自治体, 2022-2024, DX, クラウド, セキュリティ, etc.)
- 20 search results (extracted text snippets from the files)

**When adding new dummy data:**
- Use real Japanese organization names (avoid placeholders like "A市", "XX県")
- Ensure every tag has at least one associated search result
- Tags must be referenced in `allSearchResults` array for searches to work

## Common Modifications

### Adding a New Tag

1. Add to `src/data/dummyData.ts` → `tags` array with `color: 'gray'`
2. Add the tag to at least one entry in `allSearchResults` and `uploadedFiles`
3. No code changes needed - UI automatically picks up new tags

### Modifying Search Behavior

Edit `ChatSearch.tsx` → `performSearch()` function. Current logic:
- Empty query + tags → tag filtering only
- Query + no tags → text search only
- Query + tags → both filters applied (AND logic)

### Styling Changes

This project uses Tailwind CSS. All styling is inline via `className`. To maintain the professional, minimal aesthetic:
- Avoid colorful accents (stick to grays and black)
- Limit icon usage (prefer text-based UI)
- Use subtle hover effects (`hover:border-gray-400` not `hover:border-blue-500`)

## Important Constraints

1. **Chat input is fixed at bottom**: Uses flexbox with `flex-1` for messages area
2. **Tags display as `#tagName`**: When selected, format in chat and input field
3. **Tag search is case-sensitive**: Tags in data must exactly match UI selections
4. **No actual file processing**: `handleFiles()` only creates metadata objects
5. **Dates are always `new Date()`**: When creating dummy data entries
