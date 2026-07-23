const ALLOWED_TAGS = new Set([
  'A', 'B', 'BR', 'DIV', 'EM', 'H1', 'H2', 'H3', 'I', 'LI', 'OL', 'P', 'STRONG', 'UL',
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeLink(value) {
  const href = String(value || '').trim();
  if (!href) return '';
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(href) ? href : `https://${href}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? candidate : '';
  } catch {
    return '';
  }
}

export function sanitizeRichText(value) {
  if (!value || typeof document === 'undefined') return '';

  const template = document.createElement('template');
  template.innerHTML = String(value);

  [...template.content.querySelectorAll('*')].forEach((element) => {
    if (['SCRIPT', 'STYLE'].includes(element.tagName)) {
      element.remove();
      return;
    }

    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const href = element.tagName === 'A' ? safeLink(element.getAttribute('href')) : '';
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

    if (element.tagName === 'A' && href) {
      element.setAttribute('href', href);
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    } else if (element.tagName === 'A') {
      element.replaceWith(...element.childNodes);
    }
  });

  return template.innerHTML.trim();
}

export function normalizeRichText(value) {
  const content = String(value || '');
  if (!content) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return sanitizeRichText(content);
  return escapeHtml(content).replace(/\r?\n/g, '<br>');
}

export function cleanRichText(value) {
  const html = sanitizeRichText(normalizeRichText(value));
  if (!html || typeof document === 'undefined') return html;

  const container = document.createElement('div');
  container.innerHTML = html;
  return container.textContent.trim() ? html : '';
}

export function normalizeLink(value) {
  return safeLink(value);
}
