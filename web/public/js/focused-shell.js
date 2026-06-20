import {
  getSavedShellLayer,
  setSavedShellLayer,
  SHELL_LAYER_EVENT,
  LEGACY_WORKSTATION_MODE_EVENT,
  readShellLayerFromEvent,
} from './shell-layout.js';

const ROUTE_LABELS = {
  '/': 'Assistant',
  '/system': 'System',
  '/dashboard': 'System',
  '/security': 'Security',
  '/network': 'Network',
  '/cloud': 'Cloud',
  '/automations': 'Automations',
  '/code': 'Code',
  '/memory': 'Memory',
  '/reference': 'Reference',
  '/performance': 'Performance',
  '/config': 'Configuration',
};

const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 260;
const WINDOW_MARGIN = 8;
const FOCUSED_WINDOW_STATE_KEY = 'guardianagent_focused_route_window_v1';

export function initFocusedShell({
  app,
  routes,
  chatPanel,
  layout,
  content,
  getRouteState,
  renderRoute,
  updateChatContext,
}) {
  if (!app || !routes || !chatPanel || !layout || !content || !getRouteState || !renderRoute) return null;

  let active = getSavedShellLayer() === 'focused';
  let activeRoute = null;
  let activePath = null;
  let focusedWindowState = loadFocusedWindowState();

  const modal = document.createElement('section');
  modal.id = 'focused-route-modal';
  modal.className = 'focused-route-modal';
  modal.hidden = true;
  modal.setAttribute('aria-label', 'Focused shell page window');
  modal.innerHTML = `
    <article class="focused-route-modal__window" role="dialog" aria-modal="true" aria-labelledby="focused-route-title">
      <header class="focused-route-modal__header">
        <div class="focused-route-modal__title">
          <span class="focused-route-modal__label" id="focused-route-title">Configuration</span>
          <span class="focused-route-modal__path"></span>
        </div>
        <div class="focused-route-modal__controls">
          <button class="focused-route-modal__max" type="button" aria-label="Maximize page window">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 4h12v12"/>
              <path d="M20 4 8 16"/>
              <path d="M4 8v12h12"/>
            </svg>
          </button>
          <button class="focused-route-modal__close" type="button" aria-label="Close page window">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      <span class="focused-route-modal__resize focused-route-modal__resize--top" data-focused-resize="top"></span>
      <span class="focused-route-modal__resize focused-route-modal__resize--right" data-focused-resize="right"></span>
      <span class="focused-route-modal__resize focused-route-modal__resize--bottom" data-focused-resize="bottom"></span>
      <span class="focused-route-modal__resize focused-route-modal__resize--left" data-focused-resize="left"></span>
      <span class="focused-route-modal__resize focused-route-modal__resize--bottom-right" data-focused-resize="bottom-right"></span>
      <span class="focused-route-modal__resize focused-route-modal__resize--bottom-left" data-focused-resize="bottom-left"></span>
      </header>
      <main class="focused-route-modal__body"></main>
    </article>
  `;
  app.appendChild(modal);

  const titleEl = modal.querySelector('.focused-route-modal__label');
  const pathEl = modal.querySelector('.focused-route-modal__path');
  const bodyEl = modal.querySelector('.focused-route-modal__body');
  const windowEl = modal.querySelector('.focused-route-modal__window');
  const headerEl = modal.querySelector('.focused-route-modal__header');
  const maxButton = modal.querySelector('.focused-route-modal__max');
  const closeButton = modal.querySelector('.focused-route-modal__close');

  closeButton?.addEventListener('click', closeRouteWindow);
  maxButton?.addEventListener('click', toggleMaximized);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeRouteWindow();
  });
  installWindowDrag();
  modal.querySelectorAll('[data-focused-resize]').forEach((handle) => installWindowResize(handle));
  window.addEventListener('keydown', (event) => {
    if (active && !modal.hidden && event.key === 'Escape') {
      closeRouteWindow();
    }
  });
  window.addEventListener(SHELL_LAYER_EVENT, (event) => applyLayer(readShellLayerFromEvent(event)));
  window.addEventListener(LEGACY_WORKSTATION_MODE_EVENT, (event) => {
    if (event?.detail?.layer) return;
    applyLayer(readShellLayerFromEvent(event));
  });

  syncMode();

  function applyLayer(layer) {
    const nextActive = layer === 'focused';
    if (active === nextActive) return;
    active = nextActive;
    syncMode();
    if (active) void renderActiveRoute();
  }

  function setActive(nextActive) {
    const layer = setSavedShellLayer(nextActive ? 'focused' : 'classic');
    applyLayer(layer);
  }

  function syncMode() {
    document.body.classList.toggle('focused-mode', active);
    layout.classList.toggle('layout-focused-shell', active);
    if (active) {
      content.hidden = true;
      chatPanel.hidden = false;
    } else {
      content.hidden = false;
      modal.hidden = true;
    }
  }

  async function renderActiveRoute(options = {}) {
    if (!active) return false;

    const state = getRouteState();
    const raw = window.location.hash.slice(1) || '/';
    const [path, query] = raw.split('?');
    const params = new URLSearchParams(query || '');
    const route = state.route || routes[path] || routes['/'];
    const normalizedPath = routes[path] ? path : '/';

    activePath = normalizedPath;
    activeRoute = route;
    updateChatContext?.(route.name || 'second-brain');

    if (route.name === 'second-brain' || normalizedPath === '/') {
      modal.hidden = true;
      bodyEl.innerHTML = '';
      return true;
    }

    const label = labelFor(normalizedPath, route);
    titleEl.textContent = label;
    pathEl.textContent = normalizedPath;
    bodyEl.className = `focused-route-modal__body${route.name === 'code' ? ' content-code-page' : ''}`;
    modal.classList.toggle('is-config-route', normalizedPath === '/config');
    modal.classList.toggle('is-chat-cooperative-route', normalizedPath !== '/config');
    modal.hidden = false;
    restoreWindowState();
    await renderRoute({
      route,
      path: normalizedPath,
      params,
      container: bodyEl,
      options,
    });
    bodyEl.scrollTop = 0;
    return true;
  }

  async function refreshActiveRoute(options = {}) {
    if (!active) return false;
    if (!activeRoute || !activePath) {
      return renderActiveRoute(options);
    }
    return renderActiveRoute(options);
  }

  function closeRouteWindow() {
    modal.hidden = true;
    modal.classList.remove('is-config-route', 'is-chat-cooperative-route');
    windowEl.classList.remove('is-maximized');
    bodyEl.innerHTML = '';
    activePath = '/';
    activeRoute = routes['/'];
    if ((window.location.hash || '#/') !== '#/') {
      window.location.hash = '#/';
    }
  }

  function restoreClassicContent() {
    if (!active) {
      content.hidden = false;
      modal.hidden = true;
    }
  }

  function materializeWindowRect() {
    if (!windowEl || modal.hidden) return null;
    if (windowEl.classList.contains('is-positioned')) return currentWindowRect();
    const modalRect = modal.getBoundingClientRect();
    const windowRect = windowEl.getBoundingClientRect();
    const rect = {
      left: windowRect.left - modalRect.left,
      top: windowRect.top - modalRect.top,
      width: windowRect.width,
      height: windowRect.height,
    };
    applyRect(rect);
    windowEl.classList.add('is-positioned');
    return rect;
  }

  function clampRect(left, top, width, height) {
    const maxWidth = Math.max(MIN_WINDOW_WIDTH, modal.clientWidth - WINDOW_MARGIN * 2);
    const maxHeight = Math.max(MIN_WINDOW_HEIGHT, modal.clientHeight - WINDOW_MARGIN * 2);
    const nextWidth = clamp(width, MIN_WINDOW_WIDTH, maxWidth);
    const nextHeight = clamp(height, MIN_WINDOW_HEIGHT, maxHeight);
    return {
      left: clamp(left, WINDOW_MARGIN, modal.clientWidth - nextWidth - WINDOW_MARGIN),
      top: clamp(top, WINDOW_MARGIN, modal.clientHeight - nextHeight - WINDOW_MARGIN),
      width: nextWidth,
      height: nextHeight,
    };
  }

  function applyRect(rect) {
    const next = clampRect(rect.left, rect.top, rect.width, rect.height);
    windowEl.style.left = `${next.left}px`;
    windowEl.style.top = `${next.top}px`;
    windowEl.style.width = `${next.width}px`;
    windowEl.style.height = `${next.height}px`;
    windowEl.classList.add('is-positioned');
    return next;
  }

  function restoreWindowState() {
    if (focusedWindowState) {
      focusedWindowState = {
        ...applyRect(focusedWindowState),
        maximized: Boolean(focusedWindowState.maximized),
        z: Number(focusedWindowState.z) || 300,
      };
      windowEl.classList.toggle('is-maximized', focusedWindowState.maximized);
      modal.style.zIndex = String(focusedWindowState.z);
    }
    syncMaxButton();
  }

  function saveWindowState(rect = currentWindowRect()) {
    if (!rect || modal.hidden) return;
    focusedWindowState = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      maximized: windowEl.classList.contains('is-maximized'),
      z: Number(modal.style.zIndex || getComputedStyle(modal).zIndex) || 300,
    };
    localStorage.setItem(FOCUSED_WINDOW_STATE_KEY, JSON.stringify(focusedWindowState));
  }

  function currentWindowRect() {
    return {
      left: windowEl.offsetLeft,
      top: windowEl.offsetTop,
      width: windowEl.offsetWidth,
      height: windowEl.offsetHeight,
    };
  }

  function toggleMaximized() {
    if (windowEl.classList.contains('is-maximized')) {
      windowEl.classList.remove('is-maximized');
      saveWindowState();
    } else {
      const rect = materializeWindowRect();
      saveWindowState(rect);
      windowEl.classList.add('is-maximized');
      saveWindowState(rect);
    }
    syncMaxButton();
  }

  function syncMaxButton() {
    maxButton?.setAttribute('aria-label', windowEl.classList.contains('is-maximized') ? 'Restore page window' : 'Maximize page window');
  }

  function installWindowDrag() {
    let start = null;
    headerEl?.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button') || windowEl.classList.contains('is-maximized')) return;
      materializeWindowRect();
      start = {
        x: event.clientX,
        y: event.clientY,
        left: windowEl.offsetLeft,
        top: windowEl.offsetTop,
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      };
      headerEl.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    });

    function onMove(event) {
      if (!start) return;
      applyRect({
        ...start,
        left: start.left + event.clientX - start.x,
        top: start.top + event.clientY - start.y,
      });
    }

    function stop() {
      if (start) saveWindowState();
      start = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    }
  }

  function installWindowResize(handle) {
    let start = null;
    const edge = handle.dataset.focusedResize || '';
    handle.addEventListener('pointerdown', (event) => {
      if (windowEl.classList.contains('is-maximized')) return;
      event.preventDefault();
      event.stopPropagation();
      materializeWindowRect();
      start = {
        x: event.clientX,
        y: event.clientY,
        left: windowEl.offsetLeft,
        top: windowEl.offsetTop,
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      };
      handle.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    });

    function onMove(event) {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const next = { ...start };
      if (edge.includes('right')) next.width = start.width + dx;
      if (edge.includes('bottom')) next.height = start.height + dy;
      if (edge.includes('left')) {
        next.left = start.left + dx;
        next.width = start.width - dx;
      }
      if (edge.includes('top')) {
        next.top = start.top + dy;
        next.height = start.height - dy;
      }
      applyRect(next);
    }

    function stop() {
      if (start) saveWindowState();
      start = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    }
  }

  return {
    isActive: () => active,
    setActive,
    renderActiveRoute,
    refreshActiveRoute,
    restoreClassicContent,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadFocusedWindowState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOCUSED_WINDOW_STATE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const rect = ['left', 'top', 'width', 'height'].reduce((next, key) => {
      next[key] = Number(parsed[key]);
      return next;
    }, {});
    return Object.values(rect).every(Number.isFinite)
      ? { ...rect, maximized: Boolean(parsed.maximized), z: Number(parsed.z) || 300 }
      : null;
  } catch {
    return null;
  }
}

function labelFor(path, route) {
  const navItem = Array.from(document.querySelectorAll('.nav-item'))
    .find((item) => item.getAttribute('href') === `#${path}` || item.dataset.page === route?.name);
  const navLabel = navItem?.querySelector('.nav-label')?.textContent?.trim() || navItem?.title;
  return navLabel || ROUTE_LABELS[path] || titleCase(route?.name || path.replace('/', '') || 'Page');
}

function titleCase(value) {
  return String(value)
    .split(/[-\s]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
