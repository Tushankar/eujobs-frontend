import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { can } from '@/app/permissions.js'
import ConfirmDialog from '@/components/common/ConfirmDialog.jsx'
import NoticeBanner from '@/components/common/NoticeBanner.jsx'
import PageTitle from '@/components/common/PageTitle.jsx'
import PillBadge from '@/components/common/PillBadge.jsx'
import SegmentedTabs from '@/components/common/SegmentedTabs.jsx'
import { Button, Checkbox, Icon, Panel, Skeleton, SkeletonRegion, TextareaField, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { ISSUE_TONES } from '../components/NewsletterTab.jsx'
import {
  useGetNewsletterIssueQuery,
  useGetNewsletterOptionsQuery,
  useGetNewsletterPreviewQuery,
  useSendNewsletterIssueMutation,
  useSendNewsletterTestMutation,
  useUpdateNewsletterIssueMutation,
} from '../api.js'
import styles from './WebsitePage.module.css'

const LANGUAGES = ['en', 'es', 'fr']

/** Admin › Website › Newsletter › one issue (2026-11-19): copy per language, the jobs and posts to feature, a preview, a test and the send. */
export default function NewsletterIssuePage() {
  const { issueId } = useParams()
  // A sending issue refreshes every few seconds until its batches are done.
  const [sending, setSending] = useState(false)
  const { data: issue, isLoading, isError } = useGetNewsletterIssueQuery(issueId, { pollingInterval: sending ? 5000 : 0 })
  const isSending = issue?.status === 'sending'
  if (isSending !== sending) setSending(isSending)
  if (isLoading || isError || !issue) {
    return (
      <SkeletonRegion>
        <Skeleton height={480} />
      </SkeletonRegion>
    )
  }
  return <Editor key={issue.id} issue={issue} />
}

function Editor({ issue }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const { me } = usePreferences()
  const manage = can(me, 'content.manage')
  const draft = issue.status === 'draft'
  const { data: config } = useGetConfigQuery()
  const L = config?.limits.newsletterIssue
  const { data: options } = useGetNewsletterOptionsQuery(undefined, { skip: !draft })
  const [update, { isLoading: saving }] = useUpdateNewsletterIssueMutation()
  const [sendTest, { isLoading: testing }] = useSendNewsletterTestMutation()
  const [send, { isLoading: sendingNow }] = useSendNewsletterIssueMutation()
  const [language, setLanguage] = useState('en')
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [translations, setTranslations] = useState(issue.translations)
  const [jobIds, setJobIds] = useState(issue.jobIds)
  const [postIds, setPostIds] = useState(issue.postIds)
  const preview = useGetNewsletterPreviewQuery({ id: issue.id, language })

  const setCopy = (field, value) => setTranslations((current) => ({ ...current, [language]: { ...current[language], [field]: value } }))
  const toggle = (setIds, id) => setIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))

  // The picks and the posts and jobs already in the draft (a pick that left the newest list stays selectable).
  const jobOptions = [...(options?.jobs ?? []), ...issue.jobs.filter((job) => !options?.jobs.some((option) => option.id === job.id))]
  const postOptions = options?.posts ?? []
  const postTitle = (id) => postOptions.find((post) => post.id === id)

  function failure(error) {
    const fields = error?.data?.error?.fields
    const key = fields && Object.keys(fields)[0]
    return key ? t(`website:admin.newsletter.errors.${key}`) : errorText.code(error)
  }

  async function save() {
    await update({ id: issue.id, translations, jobIds, postIds }).unwrap()
  }

  async function run(work, done) {
    setNotice('')
    try {
      await work()
      if (done) setNotice(done)
    } catch (error) {
      setNotice(failure(error))
    }
  }

  const copy = translations[language]
  const fallback = language !== 'en'

  return (
    <>
      <Link to="/admin/website/newsletter" className={styles.back}>
        <Icon as={ArrowLeft} size={14} />
        {t('website:admin.newsletter.back')}
      </Link>
      <PageTitle
        title={t('website:admin.newsletter.issueTitle')}
        description={
          draft
            ? t('website:admin.newsletter.issueDescription')
            : `${t(`website:admin.newsletter.statuses.${issue.status}`)} · ${format.date(issue.sentAt)}`
        }
      />
      {notice && <NoticeBanner>{notice}</NoticeBanner>}
      <div className={styles.editor}>
        <Panel padding={24} className={styles.editorMain}>
          <SegmentedTabs
            label={t('website:admin.newsletter.language')}
            tabs={LANGUAGES.map((id) => ({ id, label: format.languageName(id) }))}
            value={language}
            onChange={setLanguage}
          />
          <TextField
            name="subject"
            label={t('website:admin.newsletter.subject')}
            hint={fallback ? t('website:admin.newsletter.fallbackHint') : undefined}
            value={copy.subject}
            maxLength={L?.subject.max}
            disabled={!draft || !manage}
            onChange={(event) => setCopy('subject', event.target.value)}
          />
          <TextareaField
            name="intro"
            label={t('website:admin.newsletter.intro')}
            hint={t('website:admin.newsletter.introHint')}
            rows={5}
            value={copy.intro}
            maxLength={L?.intro.max}
            disabled={!draft || !manage}
            onChange={(event) => setCopy('intro', event.target.value)}
          />

          <fieldset className={styles.picker} disabled={!draft || !manage}>
            <legend className={styles.sideLabel}>{t('website:admin.newsletter.jobs', { count: jobIds.length, max: L?.maxJobs })}</legend>
            {draft ? (
              <ul className={styles.pickList}>
                {jobOptions.map((job) => (
                  <li key={job.id}>
                    <Checkbox
                      checked={jobIds.includes(job.id)}
                      disabled={!jobIds.includes(job.id) && jobIds.length >= (L?.maxJobs ?? 10)}
                      onChange={() => toggle(setJobIds, job.id)}
                    >
                      <span className={styles.pickTitle}>{job.title}</span>
                      <span className={styles.postMeta}>{[job.company, job.remote ? t('website:admin.newsletter.remote') : job.city].filter(Boolean).join(' · ')}</span>
                    </Checkbox>
                  </li>
                ))}
                {!jobOptions.length && <li className={styles.hint}>{t('website:admin.newsletter.noJobs')}</li>}
              </ul>
            ) : (
              <ul className={styles.pickList}>
                {issue.jobs.map((job) => (
                  <li key={job.id}>
                    <span className={styles.pickTitle}>{job.title}</span>
                    <span className={styles.postMeta}>{[job.company, job.remote ? t('website:admin.newsletter.remote') : job.city].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className={styles.picker} disabled={!draft || !manage}>
            <legend className={styles.sideLabel}>{t('website:admin.newsletter.posts', { count: postIds.length, max: L?.maxPosts })}</legend>
            {draft ? (
              <ul className={styles.pickList}>
                {postOptions.map((post) => (
                  <li key={post.id}>
                    <Checkbox
                      checked={postIds.includes(post.id)}
                      disabled={!postIds.includes(post.id) && postIds.length >= (L?.maxPosts ?? 5)}
                      onChange={() => toggle(setPostIds, post.id)}
                    >
                      <span className={styles.pickTitle}>{post.title}</span>
                      <span className={styles.postMeta}>{format.languageName(post.language)}</span>
                    </Checkbox>
                  </li>
                ))}
                {!postOptions.length && <li className={styles.hint}>{t('website:admin.newsletter.noPosts')}</li>}
              </ul>
            ) : (
              <ul className={styles.pickList}>
                {issue.posts.map((post) => (
                  <li key={post.slug}>
                    <span className={styles.pickTitle}>{post.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </Panel>

        <div className={styles.editorSide}>
          <Panel padding={24} className={styles.sideCard}>
            <div>
              <PillBadge tone={ISSUE_TONES[issue.status]}>{t(`website:admin.newsletter.statuses.${issue.status}`)}</PillBadge>
            </div>
            {draft ? (
              <>
                <p className={styles.sideText}>{t('website:admin.newsletter.willSend', { count: issue.confirmed })}</p>
                {manage && (
                  <div className={styles.sideActions}>
                    <Button variant="outline" loading={saving} disabled={testing || sendingNow} onClick={() => run(save, t('website:admin.newsletter.notice.saved'))}>
                      {t('website:admin.newsletter.save')}
                    </Button>
                    <Button
                      variant="outline"
                      loading={testing}
                      disabled={saving || sendingNow}
                      onClick={() =>
                        run(async () => {
                          await save()
                          await sendTest({ id: issue.id, language }).unwrap()
                        }, t('website:admin.newsletter.notice.test', { language: format.languageName(language) }))
                      }
                    >
                      {t('website:admin.newsletter.test')}
                    </Button>
                    <Button leftIcon={<Icon as={Send} size={14} />} disabled={saving || testing || !issue.confirmed} loading={sendingNow} onClick={() => setConfirming(true)}>
                      {t('website:admin.newsletter.send')}
                    </Button>
                  </div>
                )}
                <p className={styles.hint}>{t('website:admin.newsletter.previewNote')}</p>
              </>
            ) : (
              <>
                <p className={styles.sideText}>
                  {t('website:admin.newsletter.progress', { sent: issue.deliveries.sent, total: issue.recipients })}
                </p>
                {issue.deliveries.failed > 0 && <p className={styles.sideText}>{t('website:admin.newsletter.failed', { count: issue.deliveries.failed })}</p>}
                {issue.status === 'sending' && <p className={styles.hint}>{t('website:admin.newsletter.sendingNote')}</p>}
              </>
            )}
          </Panel>
        </div>
      </div>

      <Panel padding={24} className={styles.previewPanel}>
        <p className={styles.sideLabel}>{t('website:admin.newsletter.preview', { language: format.languageName(language), subject: preview.data?.subject ?? '' })}</p>
        {preview.data ? (
          <iframe title={t('website:admin.newsletter.previewTitle')} sandbox="" srcDoc={preview.data.html} className={styles.previewFrame} />
        ) : (
          <Skeleton height={420} />
        )}
      </Panel>

      <ConfirmDialog
        open={confirming}
        title={t('website:admin.newsletter.confirmTitle')}
        description={t('website:admin.newsletter.confirmText', { count: issue.confirmed })}
        confirmLabel={t('website:admin.newsletter.send')}
        onConfirm={() => {
          setConfirming(false)
          run(async () => {
            await save()
            await send(issue.id).unwrap()
          }, t('website:admin.newsletter.notice.sending'))
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  )
}
