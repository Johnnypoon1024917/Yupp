import maplibregl from 'maplibre-gl';
import type { Pin } from '@/types';

let activePopup: maplibregl.Popup | null = null;

/**
 * Shows a MapLibre GL JS Popup at the given pin's coordinates.
 * Displays the pin title and source URL as a clickable link.
 * Only one popup is visible at a time — opening a new one closes the previous.
 */
export function showMarkerPopover(
  map: maplibregl.Map,
  pin: Pin,
  onClose?: () => void,
): maplibregl.Popup {
  // Close any existing popup first
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  const container = document.createElement('div');
  Object.assign(container.style, {
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    padding: '12px 16px',
    maxWidth: '240px',
    lineHeight: '1.4',
  } satisfies Partial<CSSStyleDeclaration>);

  // Title
  const title = document.createElement('div');
  title.textContent = pin.title || 'Untitled Pin';
  Object.assign(title.style, {
    fontWeight: '600',
    fontSize: '14px',
    color: '#000000',
    marginBottom: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
  } satisfies Partial<CSSStyleDeclaration>);
  title.style.setProperty('-webkit-line-clamp', '2');
  title.style.setProperty('-webkit-box-orient', 'vertical');
  container.appendChild(title);

  // Source URL link
  const link = document.createElement('a');
  link.href = pin.sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = new URL(pin.sourceUrl).hostname;
  Object.assign(link.style, {
    fontSize: '12px',
    color: '#6366F1',
    textDecoration: 'none',
    display: 'inline-block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    whiteSpace: 'nowrap',
  } satisfies Partial<CSSStyleDeclaration>);
  link.addEventListener('mouseenter', () => {
    link.style.textDecoration = 'underline';
  });
  link.addEventListener('mouseleave', () => {
    link.style.textDecoration = 'none';
  });
  container.appendChild(link);

  const popup = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    offset: [0, -28], // offset above the 48px marker
    className: 'marker-popover',
  })
    .setLngLat([pin.longitude, pin.latitude])
    .setDOMContent(container)
    .addTo(map);

  popup.on('close', () => {
    if (activePopup === popup) {
      activePopup = null;
    }
    onClose?.();
  });

  activePopup = popup;
  return popup;
}

/**
 * Closes the currently active popover, if any.
 */
export function closeMarkerPopover(): void {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}
