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
        <button class="focused-route-modal__close" type="button" aria-label="Close page window">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </header>
      <main class="focused-route-modal__body"></main>
    </article>
  `;
  app.appendChild(modal);

  const titleEl = modal.querySelector('.focused-route-modal__label');
  const pathEl = modal.querySelector('.focused-route-modal__path');
  const bodyEl = modal.querySelector('.focused-route-modal__body');
  const closeButton = modal.querySelector('.focused-route-modal__close');

  closeButton?.addEventListener('click', closeRouteWindow);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeRouteWindow();
  });
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

  return {
    isActive: () => active,
    setActive,
    renderActiveRoute,
    refreshActiveRoute,
    restoreClassicContent,
  };
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
