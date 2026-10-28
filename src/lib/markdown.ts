import { escapeHtml } from './util';

// Minimalny, bezpieczny markdown (## nagłówki, listy, **pogrubienie**, [link](url)) – tekst zawsze escapowany
export function markdownToHtml(md: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_m, t, u) => `<a href="${u}"${u.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${t}</a>`);
  const blocks = String(md || '').replace(/\r/g, '').split(/\n{2,}/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return '';
      if (t.startsWith('### ')) return `<h3>${inline(t.slice(4))}</h3>`;
      if (t.startsWith('## ')) return `<h2>${inline(t.slice(3))}</h2>`;
      const lines = t.split('\n');
      if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
      if (lines.every((l) => /^\s*\d+[.)] /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)] /, ''))}</li>`).join('')}</ol>`;
      return `<p>${lines.map(inline).join('<br/>')}</p>`;
    })
    .join('\n');
}
