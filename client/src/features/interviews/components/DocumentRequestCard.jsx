import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FileText, Paperclip, Upload } from 'lucide-react'
import { useGetConfigQuery } from '@/app/api.js'
import { Button, Icon } from '@/components/ui'
import StatusBadge from '@/components/common/StatusBadge.jsx'
import { useMarkSeen } from '@/features/notifications/api.js'
import { checkUpload, useErrorText, useUploadText } from '@/lib/forms.js'
import { useFormat, usePreferences } from '@/lib/preferences.js'
import { useCompleteRequestMutation, useDeclineDocumentMutation, useUploadDocumentMutation } from '../api.js'
import { NoteDialog } from './SmallDialogs.jsx'
import styles from './Cards.module.css'

/** A file of the request: its name and size, opened through its signed URL (every opening is logged, P11d-Q7). */
function FileLink({ file }) {
  const format = useFormat()
  return (
    <a className={styles.link} href={file.url} target="_blank" rel="noreferrer noopener" data-document-file>
      {file.name} · {format.fileSize(file.size)}
    </a>
  )
}

/** One requested document: the candidate uploads, replaces or declines it while the request is open. */
function Item({ request, item, candidate, rule }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const uploadText = useUploadText(rule)
  const input = useRef(null)
  const [problem, setProblem] = useState(null)
  const [declining, setDeclining] = useState(false)
  const [upload, { isLoading }] = useUploadDocumentMutation()
  const [decline] = useDeclineDocumentMutation()
  const { data: config } = useGetConfigQuery()
  const name = item.kind === 'other' ? item.label : t(`enums:documentKind.${item.kind}`)
  const open = request.status === 'open' && !request.removed

  async function onFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    const local = checkUpload(file, rule)
    if (local) return setProblem(uploadText.problem(local, file))
    setProblem(null)
    try {
      await upload({ id: request.id, itemId: item.id, file }).unwrap()
    } catch (error) {
      setProblem(errorText.code(error))
    }
  }

  return (
    <li className={styles.row} data-document-item={item.kind}>
      <span className={styles.rowMain}>
        <strong>{name}</strong>
        {item.file ? (
          <span className={styles.rowMeta}>
            <Icon as={Check} size={12} /> <FileLink file={item.file} /> · {format.date(item.uploadedAt)}
          </span>
        ) : item.declinedAt ? (
          <span className={styles.rowMeta} data-document-declined>
            {t('interviews:documents.declined', { note: item.declineNote })}
          </span>
        ) : (
          <span className={styles.rowMeta}>{request.removed ? t('interviews:documents.removed') : t('interviews:documents.waiting')}</span>
        )}
        {problem && (
          <span className={styles.rowMeta} role="alert" data-document-error>
            {problem}
          </span>
        )}
      </span>
      {candidate && open && (
        <span className={styles.actions}>
          <input ref={input} type="file" className={styles.hidden} accept={rule?.types.map((type) => `.${type}${type === 'jpg' ? ',.jpeg' : ''}`).join(',')} onChange={onFile} data-document-input={item.id} />
          <Button variant="outline" size="sm" loading={isLoading} leftIcon={<Icon as={Upload} size={13} />} onClick={() => input.current?.click()} data-document-upload={item.kind}>
            {t(item.file ? 'interviews:documents.replace' : 'interviews:documents.upload')}
          </Button>
          {!item.declinedAt && (
            <Button variant="ghost" size="sm" onClick={() => setDeclining(true)} data-document-decline={item.kind}>
              {t('interviews:documents.decline')}
            </Button>
          )}
        </span>
      )}
      {declining && (
        <NoteDialog
          title={t('interviews:documents.declineTitle', { name })}
          description={t('interviews:documents.declineDescription')}
          label={t('interviews:documents.declineLabel')}
          submitLabel={t('interviews:documents.decline')}
          max={config?.limits.documentRequest.declineNote.max ?? 300}
          send={(note) => decline({ id: request.id, itemId: item.id, note }).unwrap()}
          onClose={() => setDeclining(false)}
        />
      )}
    </li>
  )
}

/** The live document-request card in the thread (§3.23, P11d-Q7, Q20). */
export default function DocumentRequestCard({ request }) {
  const { t } = useTranslation()
  const { me } = usePreferences()
  const { data: config } = useGetConfigQuery()
  const [complete, { isLoading }] = useCompleteRequestMutation()
  useMarkSeen('document_request', request.id)
  const candidate = me.role === 'candidate'
  const rule = config?.limits.uploads.document_request
  return (
    <article className={styles.card} data-document-request={request.id} data-request-status={request.status}>
      <header className={styles.head}>
        <Icon as={FileText} size={18} className={styles.headIcon} />
        <div className={styles.headText}>
          <p className={styles.title}>{t('interviews:documents.title')}</p>
          <p className={styles.sub}>{request.job.title}</p>
        </div>
        <StatusBadge tone={request.status === 'open' ? 'info' : 'success'}>{t(`enums:documentRequestStatus.${request.status}`)}</StatusBadge>
      </header>
      {request.note && <p className={styles.note}>{request.note}</p>}
      {request.attachment && (
        <p className={styles.line}>
          <Icon as={Paperclip} size={16} />
          <FileLink file={request.attachment} />
        </p>
      )}
      <ul className={styles.rows}>
        {request.items.map((item) => (
          <Item key={item.id} request={request} item={item} candidate={candidate} rule={rule} />
        ))}
      </ul>
      <p className={styles.hint}>{t(candidate ? 'interviews:documents.privacyCandidate' : 'interviews:documents.privacyRecruiter')}</p>
      {!candidate && request.status === 'open' && (
        <div className={styles.actions}>
          <Button variant="outline" loading={isLoading} onClick={() => complete(request.id)} data-complete-request>
            {t('interviews:documents.complete')}
          </Button>
        </div>
      )}
    </article>
  )
}
