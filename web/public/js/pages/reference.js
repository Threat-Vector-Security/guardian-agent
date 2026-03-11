/**
 * Reference Guide page.
 */

import { api } from '../api.js';

export async function renderReference(container) {
  container.innerHTML = '<h2 class="page-title">Reference Guide</h2><div class="loading">Loading...</div>';

  try {
    const guide = await api.reference();
    const pages = (guide.categories || []).flatMap((category) => category.pages || []);

    container.innerHTML = '<h2 class="page-title">Reference Guide</h2>';
    container.insertAdjacentHTML('beforeend', `
      <section class="guide-hero">
        <div>
          <div class="guide-kicker">Operator Wiki</div>
          <h3>${esc(guide.title || 'Reference Guide')}</h3>
          <p>${esc(guide.intro || '')}</p>
        </div>
        <div class="guide-hero-stats">
          <div class="guide-stat">
            <span class="guide-stat-value">${guide.categories?.length || 0}</span>
            <span class="guide-stat-label">Categories</span>
          </div>
          <div class="guide-stat">
            <span class="guide-stat-value">${pages.length}</span>
            <span class="guide-stat-label">Guides</span>
          </div>
        </div>
      </section>
      <div class="guide-wiki">
        <aside class="guide-sidebar">
          <div class="guide-sidebar-inner">
            <div class="guide-sidebar-title">Browse Guides</div>
            ${(guide.categories || []).map((category) => `
              <section class="guide-nav-category">
                <div class="guide-nav-heading">${esc(category.title)}</div>
                <div class="guide-nav-description">${esc(category.description || '')}</div>
                <nav class="guide-nav-links">
                  ${(category.pages || []).map((page) => `
                    <a class="guide-nav-link" href="#/reference" data-guide-target="guide-${escAttr(page.id)}">
                      <span class="guide-nav-link-title">${esc(page.title)}</span>
                      <span class="guide-nav-link-summary">${esc(page.summary || '')}</span>
                    </a>
                  `).join('')}
                </nav>
              </section>
            `).join('')}
          </div>
        </aside>
        <main class="guide-content">
          ${(guide.categories || []).map((category) => `
            <section class="guide-category-block">
              <div class="guide-category-header">
                <div class="guide-category-kicker">Category</div>
                <h3>${esc(category.title)}</h3>
                <p>${esc(category.description || '')}</p>
              </div>
              ${(category.pages || []).map((page) => `
                <article class="guide-article" id="guide-${escAttr(page.id)}" data-guide-article="guide-${escAttr(page.id)}">
                  <header class="guide-article-header">
                    <h4>${esc(page.title)}</h4>
                    <p class="guide-page-summary">${esc(page.summary || '')}</p>
                  </header>
                  ${(page.sections || []).map((section) => `
                    <section class="guide-section">
                      <h5>${esc(section.title)}</h5>
                      <ul>
                        ${(section.items || []).map((item) => `<li>${esc(item)}</li>`).join('')}
                      </ul>
                      ${section.note ? `<div class="guide-note">${esc(section.note)}</div>` : ''}
                    </section>
                  `).join('')}
                </article>
              `).join('')}
            </section>
          `).join('')}
        </main>
      </div>
    `);

    wireGuideNavigation(container);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    container.innerHTML = `<h2 class="page-title">Reference Guide</h2><div class="loading">Error: ${esc(message)}</div>`;
  }
}

function wireGuideNavigation(container) {
  const links = Array.from(container.querySelectorAll('[data-guide-target]'));
  const articles = Array.from(container.querySelectorAll('[data-guide-article]'));

  if (links.length === 0 || articles.length === 0) {
    return;
  }

  const setActiveLink = (targetId) => {
    links.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('data-guide-target') === targetId);
    });
  };

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('data-guide-target');
      const target = targetId ? container.querySelector(`#${cssEscape(targetId)}`) : null;
      if (!target) return;
      event.preventDefault();
      setActiveLink(targetId);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  setActiveLink(articles[0].id);

  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) {
        setActiveLink(visible.target.id);
      }
    }, {
      root: null,
      rootMargin: '-20% 0px -55% 0px',
      threshold: [0.1, 0.35, 0.6],
    });

    articles.forEach((article) => observer.observe(article));
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}

function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
