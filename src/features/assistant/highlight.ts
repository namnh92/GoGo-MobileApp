/** Accent-free lower case per character ("Cà phê" → "ca phe"), for search highlighting. */
export function fold(text: string): string {
  return [...text]
    .map(char => {
      if (char === 'đ' || char === 'Đ') return 'd'
      const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '')
      return (base.length === 1 ? base : char).toLowerCase()
    })
    .join('')
}
