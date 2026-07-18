const fallbackColor = '#64748b';

const namedColors = {
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#eab308',
  red: '#e11d48',
  purple: '#7c3aed',
  gray: '#64748b',
};

function normalizeHexColor(value) {
  if (!value) return fallbackColor;

  const cleanValue = String(value).trim().toLowerCase();
  const namedValue = namedColors[cleanValue];
  if (namedValue) return namedValue;

  if (/^#[0-9a-f]{3}$/.test(cleanValue)) {
    const r = cleanValue[1];
    const g = cleanValue[2];
    const b = cleanValue[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^#[0-9a-f]{6}$/.test(cleanValue)) {
    return cleanValue;
  }

  return fallbackColor;
}

function getContrastTextColor(hexColor) {
  const color = normalizeHexColor(hexColor).replace('#', '');
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111827' : '#ffffff';
}

export function getLabelStyle(color) {
  const backgroundColor = normalizeHexColor(color);

  return {
    backgroundColor,
    borderColor: backgroundColor,
    color: getContrastTextColor(backgroundColor),
  };
}

export function getLabelColorValue(color) {
  return normalizeHexColor(color);
}
