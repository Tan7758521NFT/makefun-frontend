// Router and boot code. One job: turn the hash into a view, fetch what that
// view needs (through the cached client, so repeat visits are free), mount
// the HTML, and mark the page ready for screenshots. A 30-second ticker
// refreshes only the countdown texts, never the whole page.

import { listBounties, bounty, leaderboard, profile, ApiError } from './client.js';
import { timeLeft, closingSoon } from './text.js';
import {
  boardPage, bountyPage, leaderboardPage, leaderboardRows, profilePage,
  loadingPage, errorPage, filterBounties, bountyCard, BOARD_PAGE_SIZE,
} from './pages.js';

const view = document.getElementById('view');

// The board's data and controls live here so filters and search can update
// just the card list without rebuilding the whole page or losing focus.
const board = { items: null, state: { filter: 'all', sort: 'pot', query: '' } };

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, queryString] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = new URLSearchParams(queryString || '');
  if (parts.length === 0) return { name: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return { name: 'leaderboard', slug: parts[1], view: query.get('view') || '' };
  }
  if (parts[0] === 'bounty' && parts[1]) return { name: 'bounty', slug: parts[1] };
  if (parts[0] === 'u' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'notfound' };
}

function setReady() {
  window.__shotReady = true;
}

function finishRender(title) {
  document.title = title;
  const heading = view.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  const onBoard = parseHash().name === 'board';
  document.querySelectorAll('.topnav a').forEach((link) => {
    if (link.dataset.nav === 'board' && onBoard) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  requestAnimationFrame(setReady);
}

function showError(error, retryHash) {
  window.__shotReady = false;
  view.innerHTML = errorPage(error, retryHash);
  setReady();
}

async function renderBoard() {
  window.__shotReady = false;
  view.innerHTML = loadingPage('the bounty board');
  try {
    if (!board.items) {
      const data = await listBounties();
      board.items = data.items || [];
    }
    view.innerHTML = boardPage(board.items, board.state);
    finishRender('Bounty board — make.fun bounties');
  } catch (error) {
    showError(error, '#/');
  }
}

function refreshBoardList() {
  const list = filterBounties(board.items, board.state);
  const cards = view.querySelector('.cards');
  const count = view.querySelector('.result-count');
  if (count) count.textContent = `${list.length} of ${board.items.length} bounties`;
  const empty = view.querySelector('.empty');
  if (list.length === 0) {
    if (cards) cards.remove();
    if (!empty) {
      view.insertAdjacentHTML('beforeend', '<div class="empty"><p>No bounties match that filter. Try clearing the search or picking another filter.</p></div>');
    }
    return;
  }
  if (empty) empty.remove();
  if (cards) {
    cards.outerHTML = `<ul class="cards">${list.map(bountyCard).join('')}</ul>`;
  }
}

async function renderBounty(slug) {
  window.__shotReady = false;
  view.innerHTML = loadingPage('the bounty');
  try {
    const comp = await bounty(slug);
    view.innerHTML = bountyPage(comp);
    finishRender(`${comp.title} — make.fun bounties`);
  } catch (error) {
    showError(error, `#/bounty/${slug}`);
  }
}

async function renderLeaderboard(slug, viewName) {
  window.__shotReady = false;
  view.innerHTML = loadingPage('the leaderboard');
  try {
    const [comp, lb] = await Promise.all([bounty(slug), leaderboard(slug, viewName)]);
    let shown = BOARD_PAGE_SIZE;
    view.innerHTML = leaderboardPage(comp, lb, shown);
    finishRender(`${comp.title} — leaderboard — make.fun bounties`);
    const more = document.getElementById('lb-more');
    if (more) {
      more.addEventListener('click', () => {
        const entries = lb.entries || [];
        shown = Math.min(shown + BOARD_PAGE_SIZE, entries.length);
        const body = document.getElementById('lb-body');
        body.insertAdjacentHTML('beforeend', leaderboardRows(entries, lb, shown - BOARD_PAGE_SIZE, shown));
        if (shown >= entries.length) {
          more.closest('.more-row').innerHTML = `<span class="muted small">Showing all ${entries.length} entries.</span>`;
        } else {
          more.textContent = `Show 50 more (${shown} of ${entries.length} shown)`;
        }
      });
    }
  } catch (error) {
    showError(error, `#/bounty/${slug}/leaderboard`);
  }
}

async function renderProfile(handle) {
  window.__shotReady = false;
  view.innerHTML = loadingPage('the profile');
  try {
    const data = await profile(handle);
    view.innerHTML = profilePage(data);
    finishRender(`@${data.handle} — make.fun bounties`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      showError(new Error(`No public profile for @${handle} exists on make.fun.`), '#/');
    } else {
      showError(error, `#/u/${handle}`);
    }
  }
}

function renderNotFound() {
  window.__shotReady = false;
  view.innerHTML = `<div class="errorbox"><h2>Page not found</h2>
    <p>That address does not match a board, bounty, leaderboard or profile on this front end.</p>
    <p><a class="button" href="#/">Back to the board</a></p></div>`;
  setReady();
}

function render() {
  const route = parseHash();
  if (route.name === 'board') return renderBoard();
  if (route.name === 'bounty') return renderBounty(route.slug);
  if (route.name === 'leaderboard') return renderLeaderboard(route.slug, route.view);
  if (route.name === 'profile') return renderProfile(route.handle);
  return renderNotFound();
}

// Board controls: chips, search and sort update only the card list.
view.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter]');
  if (chip && board.items) {
    board.state.filter = chip.dataset.filter;
    view.querySelectorAll('[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button === chip));
    });
    refreshBoardList();
  }
  // A retry link pointing at the hash we are already on: re-render instead.
  const retry = event.target.closest('a[href]');
  if (retry && retry.getAttribute('href') === location.hash) {
    event.preventDefault();
    render();
  }
});

let searchTimer = 0;
view.addEventListener('input', (event) => {
  if (event.target.id === 'board-search' && board.items) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      board.state.query = event.target.value;
      refreshBoardList();
      const input = document.getElementById('board-search');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 150);
  }
});

view.addEventListener('change', (event) => {
  if (event.target.id === 'board-sort' && board.items) {
    board.state.sort = event.target.value;
    refreshBoardList();
  }
});

// Countdown ticker: rewrite only the time-left texts, every 30 seconds.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.dataset.deadline);
    el.classList.toggle('soon', closingSoon(el.dataset.deadline));
  });
}, 30_000);

window.addEventListener('hashchange', render);
render();
