import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Upload } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import { Button, Icon, Panel, SelectField, Skeleton, SkeletonRegion, TextareaField, TextField } from '@/components/ui'
import { checkUpload, useErrorText, useFormState, useUploadText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useCreatePostMutation, useGetAdminPostQuery, useSetPostStatusMutation, useUpdatePostMutation, useUploadBlogCoverMutation } from '../api.js'
import styles from './WebsitePage.module.css'

const LANGUAGES = ['en', 'es', 'fr']

/** Admin › Website › new or edit a blog post (2026-11-13). The body is Markdown; a cover is needed to publish. */
export default function BlogEditorPage() {
  const { postId } = useParams()
  const { data: post, isLoading } = useGetAdminPostQuery(postId, { skip: !postId })
  if (postId && isLoading) {
    return (
      <SkeletonRegion>
        <Skeleton height={480} />
      </SkeletonRegion>
    )
  }
  return <Editor key={post?.id ?? 'new'} post={post} />
}

function Editor({ post }) {
  const { t, i18n } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const { data: config } = useGetConfigQuery()
  const B = config?.limits.blog
  const coverRule = config?.limits.uploads.blog_cover
  const uploadText = useUploadText(coverRule)
  const [create, { isLoading: creating }] = useCreatePostMutation()
  const [update, { isLoading: updating }] = useUpdatePostMutation()
  const [setStatus, { isLoading: publishing }] = useSetPostStatusMutation()
  const [upload, { isLoading: uploading }] = useUploadBlogCoverMutation()
  const [cover, setCover] = useState(post?.coverFileId ? { id: post.coverFileId, url: post.coverUrl } : null)
  const [coverError, setCoverError] = useState('')
  const [notice, setNotice] = useState('')
  const form = useFormState({
    title: post?.title ?? '',
    language: post?.language ?? (LANGUAGES.includes(i18n.language) ? i18n.language : 'en'),
    excerpt: post?.excerpt ?? '',
    bodyMarkdown: post?.bodyMarkdown ?? '',
  })
  const { values } = form

  const length = (value, { min, max }) => {
    const text = value.trim()
    if (!text) return { key: 'required' }
    if (text.length < min) return { key: 'too_short', params: { min } }
    return text.length > max ? { key: 'too_long', params: { max } } : undefined
  }

  async function chooseCover(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || !coverRule) return
    const problem = checkUpload(file, coverRule)
    if (problem) return setCoverError(uploadText.problem(problem, file))
    setCoverError('')
    try {
      setCover(await upload(file).unwrap())
    } catch (error) {
      setCoverError(errorText.code(error))
    }
  }

  /** Saves the post (creating it first); with `publish`, then publishes it. */
  async function save(publish) {
    setNotice('')
    const body = {
      ...values,
      title: values.title.trim(),
      excerpt: values.excerpt.trim(),
      bodyMarkdown: values.bodyMarkdown.trim(),
      coverFileId: cover?.id ?? null,
    }
    let saved
    const ok = await form.run(
      B ? { title: length(values.title, B.title), excerpt: length(values.excerpt, B.excerpt), bodyMarkdown: length(values.bodyMarkdown, B.body) } : {},
      async () => {
        saved = post ? await update({ id: post.id, ...body }).unwrap() : await create({ ...body, coverFileId: cover?.id }).unwrap()
        if (publish && saved.status !== 'published') saved = await setStatus({ id: saved.id, status: 'published' }).unwrap()
      },
    )
    if (!ok) return
    if (!post) navigate(`/admin/website/blog/${saved.id}/edit`, { replace: true })
    setNotice(t(publish ? 'website:admin.notice.published' : 'website:admin.notice.saved', { title: saved.title }))
  }

  const busy = creating || updating || publishing
  const published = post?.status === 'published'
  const fieldError = (name) => errorText.field(name, form.errors[name])

  return (
    <>
      <Link to="/admin/website" className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('website:admin.editor.back')}
      </Link>
      <PageTitle
        title={post ? t('website:admin.editor.editTitle') : t('website:admin.editor.newTitle')}
        description={
          post
            ? t(`website:admin.blog.statuses.${post.status}`) + (post.publishedAt ? ` · ${format.date(post.publishedAt)}` : '')
            : t('website:admin.editor.description')
        }
        actions={
          published && (
            <Button variant="outline" as="a" href={`/blog/${post.slug}`} target="_blank" rel="noopener" rightIcon={<Icon as={ExternalLink} size={14} />}>
              {t('website:admin.editor.view')}
            </Button>
          )
        }
      />
      {notice && <NoticeBanner>{notice}</NoticeBanner>}
      <form
        className={styles.editor}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save(false)
        }}
      >
        <Panel padding={24} className={styles.editorMain}>
          <TextField
            name="title"
            label={t('website:admin.editor.title')}
            value={values.title}
            maxLength={B?.title.max}
            onChange={(event) => form.set('title', event.target.value)}
            error={fieldError('title')}
          />
          <TextareaField
            name="excerpt"
            label={t('website:admin.editor.excerpt')}
            hint={t('website:admin.editor.excerptHint')}
            rows={3}
            maxLength={B?.excerpt.max}
            value={values.excerpt}
            onChange={(event) => form.set('excerpt', event.target.value)}
            error={fieldError('excerpt')}
          />
          <TextareaField
            name="bodyMarkdown"
            label={t('website:admin.editor.body')}
            hint={t('website:admin.editor.bodyHint')}
            rows={18}
            maxLength={B?.body.max}
            className={styles.markdown}
            value={values.bodyMarkdown}
            onChange={(event) => form.set('bodyMarkdown', event.target.value)}
            error={fieldError('bodyMarkdown')}
          />
        </Panel>
        <div className={styles.editorSide}>
          <Panel padding={24} className={styles.sideCard}>
            <SelectField
              label={t('website:admin.blog.language')}
              value={values.language}
              onChange={(event) => form.set('language', event.target.value)}
              options={LANGUAGES.map((value) => ({ value, label: format.languageName(value) }))}
            />
            <div>
              <p className={styles.sideLabel}>{t('website:admin.editor.cover')}</p>
              {cover?.url ? (
                <img src={cover.url} alt="" className={styles.coverPreview} />
              ) : (
                <div className={styles.coverEmpty}>{t('website:admin.editor.noCover')}</div>
              )}
              <Button
                as="label"
                htmlFor="blog-cover"
                variant="outline"
                leftIcon={<Icon as={Upload} size={14} />}
                disabled={uploading}
                className={styles.coverButton}
              >
                {t(cover ? 'website:admin.editor.replaceCover' : 'website:admin.editor.chooseCover')}
              </Button>
              <input id="blog-cover" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseCover} disabled={uploading} />
              <p className={styles.hint}>{uploadText.limits}</p>
              {(coverError || form.errors.coverFileId) && (
                <p className={styles.error} role="alert">
                  {coverError || t('website:admin.editor.coverRequired')}
                </p>
              )}
            </div>
            {form.failure && (
              <p className={styles.error} role="alert">
                {errorText.code(form.failure)}
              </p>
            )}
            <div className={styles.sideActions}>
              <Button type="submit" variant={published ? 'primary' : 'outline'} loading={busy && !publishing}>
                {t(published ? 'website:admin.editor.save' : 'website:admin.editor.saveDraft')}
              </Button>
              {!published && (
                <Button loading={publishing} disabled={busy} onClick={() => (cover ? save(true) : form.setErrors({ coverFileId: { key: 'required' } }))}>
                  {t('website:admin.blog.publish')}
                </Button>
              )}
            </div>
          </Panel>
        </div>
      </form>
    </>
  )
}
