/** Lower case without accents, so "gestion" finds "Gestión" (M-194; Help search). */
export function foldText(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
