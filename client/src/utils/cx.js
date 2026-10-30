/** Joins truthy class names: cx('a', cond && 'b') -> 'a b'. */
export function cx(...names) {
  return names.filter(Boolean).join(' ')
}
