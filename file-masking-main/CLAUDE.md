# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + TypeScript web application for detecting masking issues in Japanese government procurement proposal documents. It identifies company names, personal names, project names, and system names that should have been masked before submission.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5174)
npm run build        # Build for production (TypeScript compile + Vite build)
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Architecture

### State Management (Context API)

All application state is managed through `AppContext` in `src/context/AppContext.tsx`:

- **ngWords**: Array of NG words with categories (会社名/人名/案件名/システム名/その他)
- **uploadedFiles**: Files pending check
- **detections**: Detection results after check runs

Access state via the `useApp()` hook. All components that need state must be wrapped in `<AppProvider>`.

### Routing Structure

```
/ → redirects to /check
/check → CheckPage (file upload)
/check/results → ResultsPage (detection results)
/settings/ng-words → NgWordsPage (NG word management)
```

Layout component wraps all routes, providing consistent header and navigation.

### Detection Logic Flow

1. User uploads files → stored in context with actual File object (`uploadedFiles[]`)
2. User clicks "チェック開始" (Check Start)
3. `performCheck()` in `src/utils/checkLogic.ts` runs:
   - For each file, extracts text content using appropriate parser
   - Performs two types of detection:
     - **完全一致 (Exact Match)**: Substring search for registered NG words
     - **AI検知 (AI Detection)**: Pattern matching + optional Gemini AI detection
4. Detection results stored in context (`detections[]`)
5. Navigate to results page

### File Parsing Architecture

**Key Implementation**: `src/utils/fileParser/`

Actual file content extraction using:
- **PDF**: `pdfjs-dist` (Mozilla's PDF.js)
- **PPTX**: `jszip` + XML parsing (`ppt/slides/slide*.xml` → `<a:t>` tags)
- **DOCX**: `jszip` + XML parsing (`word/document.xml` → `<w:t>` tags)
- **XLSX**: `jszip` + XML parsing (`xl/sharedStrings.xml` + `xl/worksheets/sheet*.xml`)

**Unsupported formats**: `.ppt`, `.doc`, `.xls` (legacy binary formats)

### Gemini AI Integration

**Key Implementation**: `src/utils/geminiApi.ts`

- **OCR**: For image-based PDFs (scanned documents)
- **Advanced Detection**: AI-powered masking leak detection
- **Configuration**: Set `VITE_GEMINI_API_KEY` in `.env` file

### Image-based PDF Detection

PDFs with less than 50 characters per page average are flagged as "image-based" and listed in `imagePdfs[]`. If Gemini API is configured, OCR is automatically performed.

## Type Definitions

Key types in `src/types.ts`:

```typescript
Category = '会社名' | '人名' | '案件名' | 'システム名' | 'その他'

NgWord {
  word: string
  category: Category
}

Detection {
  id: string
  type: '完全一致' | 'AI検知'
  keyword: string
  fileName: string
  location: string  // e.g., "スライド3", "P.5"
  context: string   // 40-char window around detection
  fullText: string  // Full page text
  reason?: string   // Only for AI detections
}
```

## UI Components

### NgWordsPage
- Accordion-style category display (expandable/collapsible)
- Add/remove NG words with category selection
- Default 16 NG words pre-registered (including デジタル庁, 厚生労働省, 農林水産省)

### CheckPage
- Drag & drop file upload (visual feedback on drag state)
- File type detection via extension
- No actual file parsing - names and types only

### ResultsPage
- Filtering by detection type (完全一致/AI検知) and file name
- `useMemo` optimizes filtering performance
- Click row → opens `DetectionModal` with full context
- Keyword highlighting in context text via string split

### DetectionModal
- Full text display with highlighted keywords
- Shows detection reason for AI patterns
- Click outside or × button to close

## Design System

- **Tailwind CSS** for styling
- **Color scheme**: gray-900 primary (not blue - matches case-search-rag sibling project)
- **Layout**: max-w-7xl container, consistent padding (px-4 sm:px-6 lg:px-8)
- **Navigation**: Active tab uses `border-gray-900`, inactive uses `text-gray-500`
- **Buttons**: Primary actions use `bg-gray-900 hover:bg-gray-800`

## Important Implementation Notes

### Why Dynamic Generation?

Original implementation required specific filenames ("提案書_v3.pptx", etc.) to work. Current implementation generates content for **any filename** to provide consistent demo experience regardless of uploaded files.

### Detection Context Window

Exact match detection extracts 20 characters before and after the keyword to show context. This is stored in `detection.context` while full page text is in `detection.fullText`.

### AI Detection Patterns

Defined in `src/data/dummyData.ts` as `aiDetectionPatterns[]`:
- String patterns: '弊社', '当社', '我々'
- RegExp patterns: `/[A-Z]社/g`, `/[A-Z]氏/g`
- Masking indicators: '〇〇', '△△'
- Each has a `reason` explaining why it's suspicious

### Category-Template Mapping

The mapping in `generateDummyContent()` ensures natural sentences:
- 会社名 → companyTemplates (10 variants)
- 人名 → personTemplates (7 variants)
- 案件名 → projectTemplates (4 variants)
- システム名 → systemTemplates (4 variants)

**Never** mix categories incorrectly (e.g., don't use person names in company templates).

## Configuration Files

- `vite.config.ts`: React plugin + pdf.js optimizeDeps
- `tsconfig.json`: Strict mode enabled, `noUnusedLocals/Parameters` enforced
- `tailwind.config.js`: Content paths for src/**/*.{ts,tsx}
- `postcss.config.js`: Tailwind + Autoprefixer
- `.env.example`: Template for environment variables

## Environment Variables

```bash
# Copy .env.example to .env and set your API key
cp .env.example .env

# Required for Gemini AI features (OCR, advanced detection)
VITE_GEMINI_API_KEY=your_api_key_here
```

Get your Gemini API key from: https://aistudio.google.com/apikey

## Code Conventions

- Components use PascalCase (React standard)
- Hooks start with `use` prefix
- State setters follow `setX` pattern
- Japanese domain terms preserved in code (会社名, 完全一致, etc.)
- File IDs use `${Date.now()}-${Math.random()}` pattern
- Detection IDs use `detection-${counter}` pattern
