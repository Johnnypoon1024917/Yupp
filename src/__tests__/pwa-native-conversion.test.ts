import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('PWA Native Conversion – Smoke Tests', () => {
  describe('public/manifest.json', () => {
    const manifestPath = path.join(ROOT, 'public', 'manifest.json');
    let manifest: Record<string, unknown>;

    it('is valid JSON', () => {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      expect(() => {
        manifest = JSON.parse(raw);
      }).not.toThrow();
    });

    it('contains all required fields with correct values', () => {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);

      expect(manifest.name).toBe('YUPP Travel');
      expect(manifest.short_name).toBe('YUPP');
      expect(manifest.description).toBe('The AI-Powered Travel Command Center.');
      expect(manifest.start_url).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.background_color).toBe('#FAFAFA');
      expect(manifest.theme_color).toBe('#FAFAFA');
      expect(manifest.orientation).toBe('portrait');
    });

    it('declares 192x192 and 512x512 icon entries', () => {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);

      const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;
      expect(icons).toHaveLength(2);

      const icon192 = icons.find((i) => i.sizes === '192x192');
      expect(icon192).toBeDefined();
      expect(icon192!.src).toBe('/icons/icon-192x192.png');
      expect(icon192!.type).toBe('image/png');

      const icon512 = icons.find((i) => i.sizes === '512x512');
      expect(icon512).toBeDefined();
      expect(icon512!.src).toBe('/icons/icon-512x512.png');
      expect(icon512!.type).toBe('image/png');
    });
  });

  describe('Icon files', () => {
    const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    it('icon-192x192.png exists and has valid PNG magic bytes', () => {
      const iconPath = path.join(ROOT, 'public', 'icons', 'icon-192x192.png');
      expect(fs.existsSync(iconPath)).toBe(true);
      const header = Buffer.alloc(4);
      const fd = fs.openSync(iconPath, 'r');
      fs.readSync(fd, header, 0, 4, 0);
      fs.closeSync(fd);
      expect(header.equals(PNG_MAGIC)).toBe(true);
    });

    it('icon-512x512.png exists and has valid PNG magic bytes', () => {
      const iconPath = path.join(ROOT, 'public', 'icons', 'icon-512x512.png');
      expect(fs.existsSync(iconPath)).toBe(true);
      const header = Buffer.alloc(4);
      const fd = fs.openSync(iconPath, 'r');
      fs.readSync(fd, header, 0, 4, 0);
      fs.closeSync(fd);
      expect(header.equals(PNG_MAGIC)).toBe(true);
    });
  });

  describe('.gitignore entries', () => {
    it('contains PWA service worker artifact entries', () => {
      const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8');
      expect(gitignore).toContain('sw.js');
      expect(gitignore).toContain('sw.js.map');
      expect(gitignore).toContain('workbox-*.js');
      expect(gitignore).toContain('workbox-*.js.map');
    });
  });

  describe('globals.css body rule', () => {
    it('contains overscroll-behavior: none and touch-action: none', () => {
      const css = fs.readFileSync(
        path.join(ROOT, 'src', 'app', 'globals.css'),
        'utf-8',
      );
      expect(css).toContain('overscroll-behavior: none');
      expect(css).toContain('touch-action: none');
    });
  });
});
