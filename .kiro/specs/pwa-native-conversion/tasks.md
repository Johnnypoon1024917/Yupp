# Implementation Plan: PWA Native Conversion

## Overview

Convert the YUPP Next.js travel app into an installable PWA by adding the `@ducanh2912/next-pwa` build wrapper, a web app manifest, layout metadata/viewport exports, placeholder icons, and gitignore entries. Each task builds incrementally so the app remains buildable at every step.

## Tasks

- [x] 1. Install `@ducanh2912/next-pwa` and wrap Next.js config
  - [x] 1.1 Install `@ducanh2912/next-pwa` as a production dependency via `npm install @ducanh2912/next-pwa`
    - _Requirements: 1.1_
  - [x] 1.2 Update `next.config.mjs` to import `withPWA` from `@ducanh2912/next-pwa` and wrap the existing `nextConfig` object
    - Import using ESM: `import withPWA from '@ducanh2912/next-pwa'`
    - Set options: `dest: 'public'`, `register: true`, `skipWaiting: true`, `disable: process.env.NODE_ENV === 'development'`
    - Preserve the existing `serverExternalPackages: ['puppeteer-core']` setting
    - Export `withPWA({ ...options })(nextConfig)` as the default export
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Create web app manifest and placeholder icons
  - [x] 2.1 Create `public/manifest.json` with all required fields
    - `name`: `"YUPP Travel"`, `short_name`: `"YUPP"`
    - `description`: `"The AI-Powered Travel Command Center."`
    - `start_url`: `"/"`, `display`: `"standalone"`, `orientation`: `"portrait"`
    - `background_color`: `"#FAFAFA"`, `theme_color`: `"#FAFAFA"`
    - Icons array with 192×192 and 512×512 entries pointing to `/icons/icon-192x192.png` and `/icons/icon-512x512.png`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  - [x] 2.2 Create placeholder PNG icon files in `public/icons/`
    - Generate minimal valid PNG files at `public/icons/icon-192x192.png` (192×192) and `public/icons/icon-512x512.png` (512×512)
    - Files must start with the PNG magic bytes (`89 50 4E 47`) and be valid PNG image data
    - These are solid-color placeholders that can be replaced with branded artwork later
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Update layout metadata and viewport exports
  - [x] 3.1 Update `src/app/layout.tsx` to export `Viewport` and updated `Metadata` objects
    - Import `Viewport` type from `next` alongside `Metadata`
    - Export `viewport: Viewport` with `width: 'device-width'`, `initialScale: 1`, `maximumScale: 1`, `userScalable: false`, `themeColor: '#FAFAFA'`
    - Update `metadata: Metadata` to set `title: 'YUPP | Travel Planner'`, `description: 'The AI-Powered Travel Command Center.'`, `manifest: '/manifest.json'`
    - Add `appleWebApp: { capable: true, statusBarStyle: 'default', title: 'YUPP Travel' }` to metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Verify overscroll CSS and update gitignore
  - [x] 4.1 Verify `src/app/globals.css` body rule contains `overscroll-behavior: none` and `touch-action: none`
    - Both properties already exist in the current CSS — confirm they are present and preserved
    - If either is missing, add it to the `body` rule
    - _Requirements: 4.1, 4.2_
  - [x] 4.2 Append PWA Service Worker artifact entries to `.gitignore`
    - Add entries for `/public/sw.js`, `/public/sw.js.map`, `/public/workbox-*.js`, `/public/workbox-*.js.map`
    - _Requirements: 6.1_

- [x] 5. Checkpoint - Verify build and configuration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Write smoke tests and property-based test
  - [x] 6.1 Create smoke/unit tests in `src/__tests__/pwa-native-conversion.test.ts`
    - Test that `public/manifest.json` is valid JSON and contains all required fields with correct values (name, short_name, description, start_url, display, background_color, theme_color, orientation, icons)
    - Test that icon files exist at paths referenced in the manifest and contain valid PNG magic bytes
    - Test that `.gitignore` contains entries for `sw.js`, `sw.js.map`, `workbox-*.js`, `workbox-*.js.map`
    - Test that `src/app/globals.css` body rule contains `overscroll-behavior: none` and `touch-action: none`
    - _Requirements: 2.1–2.10, 4.1, 4.2, 5.1–5.3, 6.1_
  - [ ]* 6.2 Write property-based test for manifest JSON round-trip in `src/__tests__/pwa-native-conversion.pbt.test.ts`
    - **Property 1: Manifest JSON round-trip integrity**
    - Generate random manifest-like objects using fast-check arbitraries (string fields for name, short_name, description, start_url, display, background_color, theme_color, orientation; array of icon objects with src, sizes, type)
    - Serialize with `JSON.stringify`, parse with `JSON.parse`, assert deep equality
    - Minimum 100 iterations
    - **Validates: Requirements 7.1**

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all code examples and implementations use TypeScript
- The `overscroll-behavior: none` and `touch-action: none` CSS rules already exist in `globals.css` — task 4.1 is a verification step
- Property test validates the manifest JSON round-trip correctness property from the design document
