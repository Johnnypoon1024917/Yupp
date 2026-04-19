import type { Pin } from '@/types';

export interface VisualMarkerOptions {
  pin: Pin;
  onClick: (pin: Pin) => void;
}

const ANIMATION_NAME = 'visual-marker-pop-in';
let stylesInjected = false;

/**
 * Inject the pop-in keyframes and hover class into the document head once.
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
.visual-marker-inner:hover,
.visual-marker-inner:active {
  transform: scale(1.1);
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

  // Outer shell — MapLibre controls this element's transform for positioning.
  // CRITICAL: No transition, transform, or box-shadow on this element.
  const outer = document.createElement('div');
  Object.assign(outer.style, {
    width: '48px',
    height: '48px',
    position: 'relative',
    zIndex: '50',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);

  // Inner div — carries all visual styling and hover animation.
  // MapLibre never touches this element, so transitions are safe here.
  const inner = document.createElement('div');
  inner.className = 'visual-marker-inner';
  Object.assign(inner.style, {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: '#6366F1',
    border: '2.5px solid #FFFFFF',
    boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
    borderRadius: '50%',
    pointerEvents: 'none',
    display: 'block',
  } satisfies Partial<CSSStyleDeclaration>);

  // Fallback on image error
  img.onerror = () => {
    inner.removeChild(img);
    showFallback(inner);
  };

  inner.appendChild(img);
  outer.appendChild(inner);

  // Click handler on outer so the full hit area works
  outer.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(pin);
  });

  return outer;
}

/**
 * Renders the accent-colored fallback with a map-pin icon.
 */
function showFallback(inner: HTMLDivElement): void {
  Object.assign(inner.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies Partial<CSSStyleDeclaration>);

  inner.innerHTML = MAP_PIN_SVG;
}
