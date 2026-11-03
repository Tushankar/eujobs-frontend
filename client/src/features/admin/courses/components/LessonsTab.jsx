import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import { Button, Icon, IconButton, Panel } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { cx } from '@/utils/cx.js'
import { useDeleteLessonMutation, useReorderLessonsMutation } from '../api.js'
import LessonDialog from './LessonDialog.jsx'
import styles from './builder.module.css'

/**
 * Lessons (M-101, M-102): add, edit, delete, and reorder by drag or with the Move up / Move down buttons. Locked
 * once anyone is enrolled (M-108); the reason is shown above the tabs.
 */
export default function LessonsTab({ course }) {
  const { t } = useTranslation('courses')
  const format = useFormat()
  const errorText = useErrorText()
  const [reorder, { error: reorderError }] = useReorderLessonsMutation()
  const [remove] = useDeleteLessonMutation()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [dragged, setDragged] = useState(null)
  const locked = course.locked

  function move(from, to) {
    if (to < 0 || to >= course.lessons.length || from === to) return
    const ids = course.lessons.map((lesson) => lesson.id)
    const [id] = ids.splice(from, 1)
    ids.splice(to, 0, id)
    reorder({ id: course.id, lessonIds: ids })
  }

  return (
    <div className={styles.stack}>
      {reorderError && <NoticeBanner>{errorText.code(reorderError)}</NoticeBanner>}
      {course.lessons.length === 0 ? (
        <EmptyState icon={Plus} title={t('lessons.emptyTitle')} description={t('lessons.emptyText')} />
      ) : (
        <ol className={styles.lessonList} aria-label={t('lessons.listLabel')}>
          {course.lessons.map((lesson, index) => (
            <li
              key={lesson.id}
              className={cx(styles.lessonItem, dragged === index && styles.dragging)}
              draggable={!locked}
              onDragStart={() => setDragged(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                move(dragged, index)
                setDragged(null)
              }}
              onDragEnd={() => setDragged(null)}
              data-lesson-item={lesson.id}
            >
              <Panel padding={16} className={styles.lessonPanel}>
                <Icon as={GripVertical} size={16} className={styles.grip} aria-hidden="true" />
                <div className={styles.grow}>
                  <p className={styles.lessonTitle}>
                    {index + 1}. {lesson.title}
                  </p>
                  <p className={styles.muted}>
                    {[t(`enums:lessonType.${lesson.type}`), lesson.durationSec && format.duration(lesson.durationSec), lesson.video?.name, lesson.document?.name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {lesson.isPreview && <PillBadge tone="info">{t('lessons.previewBadge')}</PillBadge>}
                <div className={styles.lessonActions}>
                  <IconButton label={t('lessons.moveUp', { title: lesson.title })} onClick={() => move(index, index - 1)} disabled={locked || index === 0} data-move="up">
                    <Icon as={ArrowUp} size={14} />
                  </IconButton>
                  <IconButton label={t('lessons.moveDown', { title: lesson.title })} onClick={() => move(index, index + 1)} disabled={locked || index === course.lessons.length - 1} data-move="down">
                    <Icon as={ArrowDown} size={14} />
                  </IconButton>
                  <IconButton label={t('lessons.edit', { title: lesson.title })} onClick={() => setEditing(lesson)} disabled={locked}>
                    <Icon as={Pencil} size={14} />
                  </IconButton>
                  <IconButton label={t('lessons.delete', { title: lesson.title })} onClick={() => setDeleting(lesson)} disabled={locked}>
                    <Icon as={Trash2} size={14} />
                  </IconButton>
                </div>
              </Panel>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button leftIcon={<Icon as={Plus} size={14} />} onClick={() => setEditing('new')} disabled={locked} data-add-lesson>
          {t('lessons.add')}
        </Button>
      </div>

      {editing && <LessonDialog course={course} lesson={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('lessons.deleteTitle')}
        description={t('lessons.deleteText', { title: deleting?.title })}
        confirmLabel={t('lessons.deleteConfirm')}
        cancelLabel={t('common:cancel')}
        tone="danger"
        onConfirm={async () => {
          await remove({ id: course.id, lessonId: deleting.id })
          setDeleting(null)
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
