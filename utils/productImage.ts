/** Два URL в `products.image`: «карточка|герой»; обратная совместимость — одна строка = и там, и там. */
export function productImageCard(image: string | null | undefined): string {
  const raw = typeof image === 'string' ? image.trim() : ''
  if (!raw) return ''
  const i = raw.indexOf('|')
  if (i === -1) return raw
  return raw.slice(0, i).trim() || raw
}

export function productImageHero(image: string | null | undefined): string {
  const raw = typeof image === 'string' ? image.trim() : ''
  if (!raw) return ''
  const i = raw.indexOf('|')
  if (i === -1) return raw
  return raw.slice(i + 1).trim() || raw
}
