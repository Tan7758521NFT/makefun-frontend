// Renderers: pure functions from API data to HTML strings. They never fetch
// and never touch the DOM; the router in main.js mounts what they return.
// Every value from the API passes through escapeHtml (or renderMarkdown,
// which escapes first), so no API text is ever injected raw.

import { API_ORIGIN } from './client.js';
import { money, count, timeLeft, closingSoon, dateShort, dateTime, escapeHtml, renderMarkdown } from './text.js';

const BOARD_PAGE_SIZE = 50;

function isOpen(item, now = Date.now()) {
  return item.acceptingSubmissions !== false && Date.parse(item.deadline) > now;
}

function potOf(item) {
  const pot = Number(item.potUsd ?? item.rewardAmount);
  return Number.isFinite(pot) ? pot : 0;
}

export function filterBounties(items, state, now = Date.now()) {
  const query = state.query.trim().toLowerCase();
  let list = items.filter((item) => {
    if (state.filter === 'open' && !isOpen(item, now)) return false;
    if (state.filter === 'soon' && !(isOpen(item, now) && closingSoon(item.deadline, now))) return false;
    if (state.filter === 'ended' && isOpen(item, now)) return false;
    if (query) {
      const hay = `${item.title} ${item.slug} ${item.category} ${(item.skills || []).join(' ')}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const byPot = (a, b) => potOf(b) - potOf(a);
  const byDeadline = (a, b) => Date.parse(a.deadline) - Date.parse(b.deadline);
  const byEntries = (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0);
  const byNewest = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  const sorts = { pot: byPot, deadline: byDeadline, entries: byEntries, newest: byNewest };
  list = [...list].sort(sorts[state.sort] || byPot);
  return list;
}

export function bountyCard(item) {
  const open = isOpen(item);
  const soon = open && closingSoon(item.deadline);
  const fee = Number(item.entryFeeUsd);
  const summary = (item.summary || item.description || '').split('\n')[0];
  const clipped = summary.length > 180
    ? `${summary.slice(0, 180).replace(/\s+\S*$/, '')}…`
    : summary;
  return `<li class="card">
    <h2><a href="#/bounty/${escapeHtml(item.slug)}">${escapeHtml(item.title)}</a></h2>
    <p class="summary">${escapeHtml(clipped)}</p>
    <div class="tagrow">
      <span class="tag">${escapeHtml(item.category || 'Bounty')}</span>
      <span class="tag ${open ? 'open' : 'ended'}">${open ? 'Open' : 'Closed'}</span>
      ${Number.isFinite(fee) && fee > 0 ? `<span class="tag fee">Entry fee ${money(fee)}</span>` : ''}
    </div>
    <div class="moneyline">
      <span><span class="pot">${money(potOf(item))}</span><br><span class="pot-label">live pot</span></span>
    </div>
    <div class="meta">
      <span>Time left: <span class="timeleft${soon ? ' soon' : ''}" data-deadline="${escapeHtml(item.deadline)}">${escapeHtml(timeLeft(item.deadline))}</span></span>
      <span><b>${count(item.submissionCount)}</b> entries</span>
      <span>Ends ${escapeHtml(dateShort(item.deadline))}</span>
    </div>
    <a class="go" href="#/bounty/${escapeHtml(item.slug)}">View bounty →</a>
  </li>`;
}

export function boardPage(items, state) {
  const list = filterBounties(items, state);
  const filters = [
    ['all', 'All'], ['open', 'Open'], ['soon', 'Closing soon'], ['ended', 'Ended'],
  ];
  const cards = list.map(bountyCard).join('');
  return `<div class="pagehead">
    <h1>Bounty board</h1>
    <p class="lede">Every live bounty on make.fun, with its real pot, entry fee and
    time left — read straight from the public API, refreshed once a minute.</p>
  </div>
  <div class="controls" role="search">
    <div class="chiprow" role="group" aria-label="Filter bounties">
      ${filters.map(([key, label]) =>
        `<button type="button" class="chip" data-filter="${key}" aria-pressed="${state.filter === key}">${label}</button>`).join('')}
    </div>
    <input type="search" id="board-search" placeholder="Search title, category or skill…" value="${escapeHtml(state.query)}" aria-label="Search bounties">
    <select id="board-sort" aria-label="Sort bounties">
      <option value="pot"${state.sort === 'pot' ? ' selected' : ''}>Highest pot</option>
      <option value="deadline"${state.sort === 'deadline' ? ' selected' : ''}>Soonest deadline</option>
      <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
      <option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Newest first</option>
    </select>
    <span class="result-count" aria-live="polite">${list.length} of ${items.length} bounties</span>
  </div>
  ${list.length === 0
    ? '<div class="empty"><p>No bounties match that filter. Try clearing the search or picking another filter.</p></div>'
    : `<ul class="cards">${cards}</ul>`}`;
}

function rewardsTable(comp) {
  const rows = (comp.rewardsNow || []).map((row) => {
    const place = Number(row.place);
    const label = place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;
    return `<tr><td>${label}</td><td class="num">${money(row.baseUsd)}</td>
      <td class="num">${money(row.feeShareUsd)}</td><td class="num"><b>${money(row.amountUsd)}</b></td></tr>`;
  }).join('');
  if (!rows) return '';
  return `<table>
    <thead><tr><th>Place</th><th class="num">Base prize</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function bountyPage(comp) {
  const open = isOpen(comp);
  const soon = open && closingSoon(comp.deadline);
  const fee = Number(comp.entryFeeUsd);
  const phases = (comp.phases || []).map((phase) =>
    `<li><b>${escapeHtml(phase.title)}</b> — ${escapeHtml(dateTime(phase.startsAt))} to ${escapeHtml(dateTime(phase.endsAt))}</li>`).join('');
  const skills = (comp.skills || []).map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('');
  return `<p class="crumb"><a href="#/">← Board</a></p>
  <div class="pagehead">
    <h1>${escapeHtml(comp.title)}</h1>
    <p class="lede">${escapeHtml(comp.summary || '')}</p>
    <div class="tagrow">
      <span class="tag">${escapeHtml(comp.category || 'Bounty')}</span>
      <span class="tag ${open ? 'open' : 'ended'}">${open ? 'Open — accepting entries' : 'Closed to entries'}</span>
      ${Number.isFinite(fee) && fee > 0 ? `<span class="tag fee">Entry fee ${money(fee)}</span>` : ''}
    </div>
  </div>
  <div class="stats" role="list">
    <div class="stat" role="listitem"><div class="num green">${money(potOf(comp))}</div><div class="lbl">Live pot</div></div>
    <div class="stat" role="listitem"><div class="num">${Number.isFinite(fee) && fee > 0 ? money(fee) : 'Free'}</div><div class="lbl">Entry fee</div></div>
    <div class="stat" role="listitem"><div class="num">${count(comp.submissionCount)}</div><div class="lbl">Entries</div></div>
    <div class="stat" role="listitem"><div class="num timeleft${soon ? ' soon' : ''}" data-deadline="${escapeHtml(comp.deadline)}">${escapeHtml(timeLeft(comp.deadline))}</div><div class="lbl">Ends ${escapeHtml(dateShort(comp.deadline))}</div></div>
  </div>
  <div class="detail-grid">
    <div class="detail-main">
      <section class="panel" aria-labelledby="rewards-h">
        <h2 id="rewards-h">Rewards</h2>
        ${rewardsTable(comp)}
        <p class="small muted">The pot grows as entry fees are paid in; the table shows each place's share right now.</p>
      </section>
      <section class="panel rules-text" aria-labelledby="about-h">
        <h2 id="about-h">About this bounty</h2>
        ${renderMarkdown(comp.description || 'No description published yet.')}
      </section>
    </div>
    <aside class="detail-side">
      <div class="panel side-actions">
        <a class="button" href="#/bounty/${escapeHtml(comp.slug)}/leaderboard">View leaderboard</a>
        <a class="button ghost" href="${API_ORIGIN}/bounty/${escapeHtml(comp.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a>
      </div>
      <div class="panel">
        <h2>Details</h2>
        <dl class="kv">
          <dt>Status</dt><dd>${escapeHtml(comp.status || '—')}</dd>
          <dt>Published</dt><dd>${escapeHtml(dateTime(comp.publishedAt))}</dd>
          <dt>Deadline</dt><dd>${escapeHtml(dateTime(comp.deadline))}</dd>
          <dt>Sponsor</dt><dd>${escapeHtml(comp.sponsor?.name || '—')}</dd>
          <dt>Category</dt><dd>${escapeHtml(comp.category || '—')}</dd>
        </dl>
        ${skills ? `<div class="tagrow" style="margin-top:0.6rem">${skills}</div>` : ''}
        ${phases ? `<h3>Phases</h3><ul>${phases}</ul>` : ''}
      </div>
    </aside>
  </div>`;
}

// --- leaderboard ---

function scoreText(entry, lb) {
  const key = lb.rank_key || 'judge';
  const column = (lb.columns || []).find((c) => c.key === key);
  const raw = entry.values?.[key];
  const display = entry.display?.[key];
  if (column && /win_rate/.test(column.source || '') && Number.isFinite(Number(raw))) {
    return `${(Number(raw) / 1_000_000 * 100).toFixed(2)}%`;
  }
  return display ?? (raw ?? '—');
}

function entrantCell(entry) {
  const handle = entry.handle || 'unknown';
  const image = entry.image;
  const thumb = typeof image === 'string' && image.length > 0
    ? `<img class="avatar" src="${escapeHtml(image.startsWith('/') ? API_ORIGIN + image : image)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous">`
    : `<span class="avatar" aria-hidden="true">${escapeHtml(handle.slice(0, 1).toUpperCase())}</span>`;
  return `${thumb}<a href="#/u/${escapeHtml(handle)}">${escapeHtml(handle)}</a>`;
}

export function leaderboardRows(entries, lb, from, to) {
  return entries.slice(from, to).map((entry) => {
    const key = lb.rank_key || 'judge';
    const low = entry.values?.[`${key}_low`];
    const high = entry.values?.[`${key}_high`];
    const interval = (Number.isFinite(Number(low)) && Number.isFinite(Number(high)) && /win_rate/.test((lb.columns || []).find((c) => c.key === key)?.source || ''))
      ? `${(Number(low) / 1_000_000 * 100).toFixed(1)}–${(Number(high) / 1_000_000 * 100).toFixed(1)}%`
      : '—';
    const size = entry.values?.bytes;
    return `<tr>
      <td class="rankcell">${count(entry.rank)}</td>
      <td>${entrantCell(entry)}${entry.prize_eligible ? '' : ' <span class="tag">not prize-eligible</span>'}</td>
      <td>${escapeHtml(entry.title || 'Untitled entry')}</td>
      <td class="num"><b>${escapeHtml(scoreText(entry, lb))}</b></td>
      <td class="num">${interval}</td>
      <td class="num">${Number.isFinite(Number(size)) ? `${(Number(size) / 1024).toFixed(0)} KB` : '—'}</td>
      <td class="num">${entry.prize_rank ? `<span class="prized">#${count(entry.prize_rank)}</span>` : '—'}</td>
    </tr>`;
  }).join('');
}

export function leaderboardPage(comp, lb, shown) {
  const entries = lb.entries || [];
  const shownNow = Math.min(shown, entries.length);
  const viewLinks = (lb.views || []).map((view) =>
    `<a class="chip" href="#/bounty/${escapeHtml(comp.slug)}/leaderboard?view=${view}"${view === lb.view ? ' aria-current="true"' : ''} style="${view === lb.view ? 'background:#1d4ed8;color:#fff;border-color:#1d4ed8' : ''}">${escapeHtml(view)}</a>`).join('');
  const rankTitle = (lb.columns || []).find((c) => c.key === (lb.rank_key || 'judge'))?.title || 'Score';
  return `<p class="crumb"><a href="#/">← Board</a> · <a href="#/bounty/${escapeHtml(comp.slug)}">${escapeHtml(comp.title)}</a></p>
  <div class="pagehead">
    <h1>${escapeHtml(comp.title)} — leaderboard</h1>
    <p class="lede">${escapeHtml(lb.title || 'Results')} · phase: ${escapeHtml(lb.phase?.title || lb.phase?.key || '—')}
    · ${count(entries.length)} ranked entries${lb.metrics_withheld ? ' · some scores are withheld while judging runs' : ''}.</p>
    ${viewLinks ? `<div class="chiprow" role="group" aria-label="Leaderboard view">${viewLinks}</div>` : ''}
  </div>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Rank</th><th>Entrant</th><th>Entry</th><th class="num">${escapeHtml(rankTitle)}</th><th class="num">90% interval</th><th class="num">Size</th><th class="num">Prize rank</th></tr></thead>
      <tbody id="lb-body">${leaderboardRows(entries, lb, 0, shownNow)}</tbody>
    </table>
    ${shownNow < entries.length
      ? `<div class="more-row"><button type="button" class="chip" id="lb-more">Show 50 more (${count(shownNow)} of ${count(entries.length)} shown)</button></div>`
      : `<div class="more-row muted small">Showing all ${count(entries.length)} entries.</div>`}
  </div>`;
}

// --- profile ---

export function profilePage(profile) {
  const record = profile.record || {};
  const avatar = profile.image || profile.avatar;
  const avatarImg = typeof avatar === 'string' && avatar.length > 0
    ? `<img class="avatar" src="${escapeHtml(avatar.startsWith('/') ? API_ORIGIN + avatar : avatar)}" alt="" crossorigin="anonymous">`
    : `<span class="avatar" aria-hidden="true">${escapeHtml((profile.handle || '?').slice(0, 1).toUpperCase())}</span>`;
  // Judge win rates arrive in micro units (743255 means 74.33%); other
  // scores (Elo, points) print as the API displays them.
  const solutionScore = (sol) => {
    const val = Number(sol.score?.value);
    if (sol.score?.column?.key === 'judge' && Number.isFinite(val)) {
      return `${(val / 1_000_000 * 100).toFixed(2)}%`;
    }
    return sol.score?.display ?? '—';
  };
  const solutions = (profile.solutions || []).map((sol) => {
    const comp = sol.competition || {};
    return `<tr>
      <td>${escapeHtml(sol.title || 'Untitled')}</td>
      <td><a href="#/bounty/${escapeHtml(comp.slug || '')}">${escapeHtml(comp.title || comp.slug || '—')}</a></td>
      <td class="num">${escapeHtml(solutionScore(sol))}</td>
      <td class="num">${sol.placement ? `#${count(sol.placement)}` : '—'}</td>
      <td class="num">${sol.prize_usd ? `<span class="prized">${money(sol.prize_usd)}</span>` : '—'}</td>
      <td class="num">${escapeHtml(dateShort(sol.entered_at))}</td>
    </tr>`;
  }).join('');
  return `<p class="crumb"><a href="#/">← Board</a></p>
  <div class="pagehead profile-head">
    ${avatarImg}
    <div>
      <h1>${escapeHtml(profile.display_name || profile.handle)}</h1>
      <p class="handle">@${escapeHtml(profile.handle)} · joined ${escapeHtml(dateShort(profile.joined_at))}</p>
      ${profile.bio ? `<p class="bio">${escapeHtml(profile.bio)}</p>` : ''}
      ${profile.github_login ? `<p class="small">GitHub: <a href="https://github.com/${escapeHtml(profile.github_login)}" target="_blank" rel="noopener">@${escapeHtml(profile.github_login)}</a></p>` : ''}
    </div>
  </div>
  <div class="stats" role="list">
    <div class="stat" role="listitem"><div class="num">${count(record.competitions_entered)}</div><div class="lbl">Bounties entered</div></div>
    <div class="stat" role="listitem"><div class="num">${count(record.competitions_placed)}</div><div class="lbl">Placed</div></div>
    <div class="stat" role="listitem"><div class="num">${count(record.competitions_won)}</div><div class="lbl">Won</div></div>
    <div class="stat" role="listitem"><div class="num green">${money(record.prize_usd)}</div><div class="lbl">Prize money</div></div>
  </div>
  <section class="panel" aria-labelledby="entries-h">
    <h2 id="entries-h">Entries</h2>
    ${solutions ? `<div class="tablewrap" style="box-shadow:none;border:0">
      <table><thead><tr><th>Entry</th><th>Bounty</th><th class="num">Score</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Entered</th></tr></thead>
      <tbody>${solutions}</tbody></table></div>`
    : '<p class="muted">No entries yet.</p>'}
  </section>`;
}

export function loadingPage(what) {
  return `<div class="loading" role="status"><p>Loading ${escapeHtml(what)} from the make.fun API…</p></div>`;
}

export function errorPage(error, retryHash) {
  const message = error && error.message ? error.message : 'Something went wrong.';
  return `<div class="errorbox" role="alert">
    <h2>Could not load this page</h2>
    <p>${escapeHtml(message)}</p>
    <p><a class="button" href="${escapeHtml(retryHash)}">Try again</a></p>
  </div>`;
}

export { BOARD_PAGE_SIZE };
