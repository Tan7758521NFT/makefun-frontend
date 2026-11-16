// Small, pure formatting helpers. Nothing here touches the network or the
// DOM, so every function is easy to test by reading it.

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
});
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const plainNumber = new Intl.NumberFormat('en-US');

export function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return (Number.isInteger(n) ? wholeDollars : dollars).format(n);
}

export function count(n) {
  return plainNumber.format(Number(n) || 0);
}

// "2d 5h left" / "3h 12m left" / "Closed 2d ago". The bounty deadline, not
// the status field, decides whether entries are still open.
export function timeLeft(deadlineIso, now = Date.now()) {
  const end = Date.parse(deadlineIso);
  if (!Number.isFinite(end)) return 'No deadline';
  const diff = end - now;
  if (diff <= 0) return 'Closed';
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function closingSoon(deadlineIso, now = Date.now()) {
  const end = Date.parse(deadlineIso);
  return Number.isFinite(end) && end - now > 0 && end - now < 24 * 3600_000;
}

export function dateShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The API's descriptions are Markdown. This renders the safe subset —
// headings, paragraphs, bullet lists, bold, code spans and links — after
// escaping everything, so no markup from the API ever reaches the page raw.
export function renderMarkdown(source) {
  const lines = String(source ?? '').split('\n');
  let out = '';
  let inList = false;
  const closeList = () => {
    if (inList) { out += '</ul>'; inList = false; }
  };
  const inline = (text) => {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
    html = html.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => `<strong>${bold}</strong>`);
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, href) =>
      `<a href="${href}" rel="noopener" target="_blank">${label}</a>`);
    return html;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      out += `<h${level + 1}>${inline(line.replace(/^#+\s*/, ''))}</h${level + 1}>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return out;
}
