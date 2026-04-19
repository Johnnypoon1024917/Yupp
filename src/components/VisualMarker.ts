import type { Pin } from '@/types';

export interface VisualMarkerOptions {
  pin: Pin;
  onClick: (pin: Pin) => void;
}

const ANIMATION_NAME = 'visual-marker-pop-in';
let stylesInjected = false;

/**
 * Inject the pop-in keyframes into the document head once.
 */
function injectStyles(): void {
  if (stylesInjected) return;
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
@keyframes ${ANIMATION_NAME} {
  0% { transform: scale(0); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
`;
  document.head.appendChild(style);
  stylesInjected = true;
}

/** Lucide map-pin SVG (24×24 viewBox, stroke-based) */
const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

/**
 * Creates an imperative DOM element for use as a MapLibre GL JS custom marker.
 */
export function createVisualMarkerElement(options: VisualMarkerOptions): HTMLDivElement {
  const { pin, onClick } = options;

  injectStyles();

  // Container
  const container = document.createElement('div');
  Object.assign(container.style, {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    border: '2px solid white',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    cursor: 'pointer',
    animation: `${ANIMATION_NAME} 400ms ease-out forwards`,
  } satisfies Partial<CSSStyleDeclaration>);

  // Image
  const img = document.createElement('img');
  img.src = pin.imageUrl;
  img.alt = pin.title || 'Pin image';
  Object.assign(img.style, {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    aspectRatio: '1 / 1',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);

  // Fallback on image error
  img.onerror = () => {
    container.removeChild(img);
    showFallback(container);
  };

  container.appendChild(img);

  // Click handler
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(pin);
  });

  return container;
}

/**
 * Renders the accent-colored fallback with a map-pin icon.
 */
function showFallback(container: HTMLDivElement): void {
  Object.assign(container.style, {
    backgroundColor: '#6366F1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies Partial<CSSStyleDeclaration>);

  container.innerHTML = MAP_PIN_SVG;
}
