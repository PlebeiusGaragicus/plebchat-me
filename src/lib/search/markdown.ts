// Markdown → sanitized HTML for assistant bubbles, with [sN] citation
// markers turned into clickable <span data-cite> elements (the consumer
// delegates clicks on [data-cite]). Citations are swapped in BEFORE parsing
// so marked passes the inline HTML through and DOMPurify keeps the data-*
// attribute; everything else scriptable is stripped.

import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(text: string): string {
	const withCites = text.replace(
		/\[(s\d+)\]/g,
		(_, id: string) =>
			`<span class="cite" role="button" tabindex="0" data-cite="${id}">[${id}]</span>`
	);
	const html = marked.parse(withCites, { async: false });
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'p', 'br', 'hr', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'ul', 'ol', 'li', 'a', 'span',
			'table', 'thead', 'tbody', 'tr', 'th', 'td'
		],
		ALLOWED_ATTR: ['href', 'title', 'class', 'role', 'tabindex', 'data-cite', 'start']
	});
}
