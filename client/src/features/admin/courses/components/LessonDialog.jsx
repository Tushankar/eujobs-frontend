import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Modal, SelectField, TextareaField, TextField } from '@/components/ui'
import { useGetConfigQuery } from '@/app/api.js'
import { useErrorText, useFormState } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useAddLessonMutation, usePreviewMarkdownMutation, useUpdateLessonMutation } from '../api.js'
import FileUpload from './FileUpload.jsx'
import styles from './builder.module.css'

const FORM_ID = 'lesson-form'

/**
 * The video's length in whole seconds, read by the browser (U16); null when it cannot be played here. A WebM
 * recorded in a browser often has no duration in its header: seeking to the end makes the browser find it.
 */
function readDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const done = (value) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const report = () => Number.isFinite(video.duration) && done(Math.max(1, Math.round(video.duration)))
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      if (!report()) {
        video.ondurationchange = report
        video.currentTime = Number.MAX_SAFE_INTEGER
      }
    }
    video.onerror = () => done(null)
    video.src = url
  })
}

/**
 * Adds or edits a lesson (M-102, M-106, M-113, U16): title, type (fixed once added), the type's content (video or
 * PDF upload, Markdown with the server preview, or an https link), duration, free preview and content language.
 */
export default function LessonDialog({ course, lesson, onClose }) {
  const { t } = useTranslation('courses')
  const errorText = useErrorText()
  const format = useFormat()
  const { data: config } = useGetConfigQuery()
  const [add, { isLoading: adding }] = useAddLessonMutation()
  const [update, { isLoading: updating }] = useUpdateLessonMutation()
  const [preview, { data: previewHtml, isLoading: previewing }] = usePreviewMarkdownMutation()
  const [files, setFiles] = useState({ video: lesson?.video ?? null, document: lesson?.document ?? null })
  const [unplayable, setUnplayable] = useState(false)
  const form = useFormState({
    title: lesson?.title ?? '',
    type: lesson?.type ?? 'text',
    durationSec: lesson?.durationSec ? String(lesson.durationSec) : '',
    textMarkdown: lesson?.textMarkdown ?? '',
    url: lesson?.url ?? '',
    isPreview: lesson?.isPreview ?? false,
    contentLanguage: lesson?.contentLanguage ?? course.language,
  })
  const { values, set, errors } = form
  const media = values.type === 'video' || values.type === 'document'
  const field = (name) => ({ name, value: values[name], onChange: (event) => set(name, event.target.value), error: errorText.field(name, errors[name]) })

  async function handleVideo(file, local) {
    setFiles((current) => ({ ...current, video: file }))
    const seconds = await readDuration(local)
    setUnplayable(seconds === null)
    if (seconds) set('durationSec', String(seconds))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const duration = values.durationSec.trim()
    const body = {
      title: values.title,
      isPreview: values.isPreview,
      durationSec: duration ? Number(duration) : null,
      ...(values.type === 'video' && { videoFileId: files.video?.id ?? null, contentLanguage: values.contentLanguage }),
      ...(values.type === 'document' && { documentFileId: files.document?.id ?? null, contentLanguage: values.contentLanguage }),
      ...(values.type === 'text' && { textMarkdown: values.textMarkdown }),
      ...(values.type === 'link' && { url: values.url }),
    }
    const durationError = duration && !/^\d+$/.test(duration) ? { key: 'invalid' } : undefined
    const ok = await form.run({ durationSec: durationError }, () =>
      lesson ? update({ id: course.id, lessonId: lesson.id, ...body }).unwrap() : add({ id: course.id, type: values.type, ...body }).unwrap(),
    )
    if (ok) onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t(lesson ? 'lessons.editTitle' : 'lessons.addTitle')}
      width={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={adding || updating} data-save-lesson>
            {t('lessons.save')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className={styles.stack} data-lesson-form>
        <TextField label={t('lessons.title')} {...field('title')} autoFocus />
        <SelectField
          label={t('lessons.type')}
          options={(config?.enums.lessonType ?? []).map((value) => ({ value, label: t(`enums:lessonType.${value}`) }))}
          disabled={Boolean(lesson)}
          {...field('type')}
        />

        {values.type === 'video' && (
          <FileUpload purpose="lesson_video" label={t('lessons.video')} current={files.video} onUploaded={handleVideo} />
        )}
        {values.type === 'video' && files.video && (
          <video className={styles.videoPreview} src={files.video.url} controls preload="metadata" data-video-preview />
        )}
        {unplayable && <p className={styles.error}>{t('lessons.unplayable')}</p>}
        {values.type === 'document' && (
          <FileUpload purpose="lesson_document" label={t('lessons.document')} current={files.document} onUploaded={(file) => setFiles((current) => ({ ...current, document: file }))} />
        )}
        {values.type === 'text' && (
          <>
            <TextareaField label={t('lessons.markdown')} hint={t('lessons.markdownHint')} rows={10} {...field('textMarkdown')} />
            <div>
              <Button variant="outline" loading={previewing} onClick={() => preview(values.textMarkdown)} data-markdown-preview>
                {t('lessons.preview')}
              </Button>
            </div>
            {previewHtml && <div className={styles.markdown} data-markdown-html dangerouslySetInnerHTML={{ __html: previewHtml.html }} />}
          </>
        )}
        {values.type === 'link' && <TextField label={t('lessons.url')} hint={t('lessons.urlHint')} type="url" {...field('url')} />}

        <TextField label={t('lessons.duration')} hint={t(values.type === 'video' ? 'lessons.durationVideoHint' : 'lessons.durationHint')} inputMode="numeric" {...field('durationSec')} />
        {media && (
          <SelectField label={t('lessons.contentLanguage')} options={(config?.enums.language ?? []).map((value) => ({ value, label: format.languageName(value) }))} {...field('contentLanguage')} />
        )}
        <Checkbox name="isPreview" checked={values.isPreview} onChange={(event) => set('isPreview', event.target.checked)}>
          {t('lessons.isPreview')}
        </Checkbox>
        {Object.entries(errors)
          .filter(([name, error]) => error && !['title', 'durationSec', 'textMarkdown', 'url'].includes(name))
          .map(([name, error]) => (
            <p key={name} className={styles.error} role="alert">
              {errorText.field(name, error)}
            </p>
          ))}
        {form.failure && <p className={styles.error}>{errorText.code(form.failure)}</p>}
      </form>
    </Modal>
  )
}
