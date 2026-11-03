import { useTranslation } from 'react-i18next'

/**
 * A publish problem (U24) as text. The server names fields: `summary`, `prices.HUF`, `lessons` (too few),
 * `lessons.2.videoFileId` (the third lesson's video) or `quiz.questions`.
 */
export function useProblemText() {
  const { t } = useTranslation('courses')
  return (field, key) => {
    const [root, part, name] = field.split('.')
    if (root === 'prices') return t('problems.price', { currency: part })
    if (root === 'lessons' && name) return t(`problems.lesson.${name}`, { number: Number(part) + 1 })
    return t([`problems.${root}.${key}`, `problems.${root}.required`])
  }
}
