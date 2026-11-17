import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, Square, X } from 'lucide-react'
import { formData, useGetConfigQuery } from '@/app/api.js'
import { Button, Icon, IconButton, Modal, TextareaField, TextField } from '@/components/ui'
import { useErrorText } from '@/lib/forms.js'
import { useFormat } from '@/lib/preferences.js'
import { useApplyVoiceProfileMutation, useProposeVoiceProfileMutation } from '../api.js'
import AiButton from './AiButton.jsx'
import AiStatus from './AiStatus.jsx'
import CreditCost from './CreditCost.jsx'
import styles from './VoiceProfileBuilder.module.css'

// WebM/Opus where the browser records it (Chrome, Edge, Firefox); MP4 audio otherwise (older Safari).
const FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', name: 'voice.webm', type: 'audio/webm' },
  { mimeType: 'audio/mp4', name: 'voice.mp4', type: 'application/octet-stream' },
]

/** Records the microphone up to `maxSeconds`; `stop()` resolves the recording as a File. */
function useRecorder(maxSeconds) {
  const [seconds, setSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const recorder = useRef(null)
  const done = useRef(null)

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => {
    if (!recording) return undefined
    const started = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000)
      setSeconds(elapsed)
      if (elapsed >= maxSeconds) recorder.current?.stop()
    }, 250)
    return () => clearInterval(timer)
  }, [recording, maxSeconds])

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const format = FORMATS.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? FORMATS[0]
    const media = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: 32_000 })
    const chunks = []
    media.ondataavailable = (event) => event.data.size && chunks.push(event.data)
    const finished = new Promise((resolve) => {
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        resolve(new File(chunks, format.name, { type: format.type }))
      }
    })
    done.current = finished
    recorder.current = media
    setSeconds(0)
    media.start(1000)
    setRecording(true)
    return finished
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    return done.current
  }

  return { start, stop, seconds, recording }
}

/** The proposal, editable: text fields and lists the candidate can trim before it joins the profile. */
function Review({ proposal, setProposal }) {
  const { t } = useTranslation('ai')
  const format = useFormat()
  const remove = (list, index) => setProposal({ ...proposal, [list]: proposal[list].filter((_, i) => i !== index) })
  const chips = (list, label) =>
    proposal[list].length > 0 && (
      <section className={styles.group}>
        <h3 className={styles.groupTitle}>{t(`voice.review.${list}`)}</h3>
        <ul className={styles.items}>
          {proposal[list].map((item, index) => (
            <li key={`${label(item)}-${index}`} className={styles.item}>
              <span>{label(item)}</span>
              <IconButton icon={X} label={t('voice.review.remove', { item: label(item) })} onClick={() => remove(list, index)} />
            </li>
          ))}
        </ul>
      </section>
    )
  return (
    <div className={styles.review} data-voice-review>
      <TextField label={t('voice.review.headline')} value={proposal.headline} onChange={(event) => setProposal({ ...proposal, headline: event.target.value })} />
      <TextareaField label={t('voice.review.about')} rows={4} value={proposal.about} onChange={(event) => setProposal({ ...proposal, about: event.target.value })} />
      <TextField
        label={t('voice.review.years')}
        inputMode="numeric"
        value={String(proposal.yearsExperience)}
        onChange={(event) => setProposal({ ...proposal, yearsExperience: Number(event.target.value.replace(/\D/g, '')) || 0 })}
      />
      {chips('skills', (skill) => skill)}
      {chips('workHistory', (entry) => [entry.title, entry.employer].join(' · ') + (entry.start ? ` (${entry.start}${entry.current ? ' –' : entry.end ? ` – ${entry.end}` : ''})` : ''))}
      {chips('education', (entry) => `${entry.degree} · ${entry.institution}`)}
      {chips('languages', (entry) => `${format.languageName(entry.code)} · ${t(`enums:languageLevel.${entry.level}`)}`)}
    </div>
  )
}

/**
 * "Build my profile by voice" (owner 2026-11-17, Plus): the candidate talks for up to three minutes, the recording is
 * transcribed and deleted on the server, and AI proposes headline, About, years, skills, jobs, education and
 * languages. They review and trim it; "Add to my profile" only adds (existing entries stay).
 */
export default function VoiceProfileBuilder({ variant = 'outline', fullWidth }) {
  const { t } = useTranslation('ai')
  const errorText = useErrorText()
  const { data: config } = useGetConfigQuery()
  const maxSeconds = config?.limits.ai?.voice?.maxSeconds ?? 180
  const [open, setOpen] = useState(false)
  const [micError, setMicError] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [added, setAdded] = useState(null)
  const recorder = useRecorder(maxSeconds)
  const [propose, proposing] = useProposeVoiceProfileMutation()
  const [apply, applying] = useApplyVoiceProfileMutation()
  const clock = (value) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`

  function close() {
    if (recorder.recording) recorder.stop()
    setOpen(false)
    setProposal(null)
    setAdded(null)
    setMicError(null)
    proposing.reset()
  }

  async function record() {
    setMicError(null)
    let file
    try {
      // Resolves with the recording once it stops (Stop, or the time limit).
      file = await recorder.start()
    } catch {
      setMicError(t('voice.micBlocked'))
      return
    }
    try {
      const answer = await propose(formData(file)).unwrap()
      setProposal(answer.profile)
      setTranscript(answer.transcript)
    } catch {
      // AiStatus or the field error below shows it.
    }
  }

  async function addToProfile() {
    try {
      const { added: counts } = await apply(proposal).unwrap()
      setAdded(counts)
    } catch {
      // The error shows under the review.
    }
  }

  const tooShort = proposing.error?.data?.error?.fields?.file
  return (
    <>
      <AiButton variant={variant} fullWidth={fullWidth} leftIcon={<Icon as={Mic} size={14} />} onClick={() => setOpen(true)} data-voice-profile-open>
        {t('voice.action')}
      </AiButton>
      {open && (
        <Modal
          open
          onClose={close}
          width={600}
          title={t('voice.title')}
          description={t('voice.description', { minutes: Math.round(maxSeconds / 60) })}
          footer={
            added ? (
              <Button onClick={close}>{t('voice.done')}</Button>
            ) : proposal ? (
              <>
                <Button variant="secondary" onClick={() => setProposal(null)}>
                  {t('voice.again')}
                </Button>
                <Button loading={applying.isLoading} onClick={addToProfile} data-voice-apply>
                  {t('voice.apply')}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={close}>
                {t('common:cancel')}
              </Button>
            )
          }
        >
          {added ? (
            <p className={styles.done} role="status" data-voice-added>
              {t('voice.added', added)}
            </p>
          ) : proposal ? (
            <>
              <details className={styles.transcript}>
                <summary>{t('voice.heard')}</summary>
                <p>{transcript}</p>
              </details>
              <Review proposal={proposal} setProposal={setProposal} />
              {applying.error && <p className={styles.error}>{errorText.code(applying.error)}</p>}
            </>
          ) : (
            <div className={styles.record} data-voice-record>
              <ul className={styles.prompts}>
                {['role', 'jobs', 'skills', 'education', 'languages', 'wants'].map((key) => (
                  <li key={key}>{t(`voice.prompts.${key}`)}</li>
                ))}
              </ul>
              <div className={styles.controls}>
                {recorder.recording ? (
                  <Button variant="danger" leftIcon={<Icon as={Square} size={13} />} onClick={() => recorder.stop()} data-voice-stop>
                    {t('voice.stop')}
                  </Button>
                ) : (
                  <Button leftIcon={<Icon as={Mic} size={14} />} loading={proposing.isLoading} onClick={record} data-voice-start>
                    {t(proposing.isLoading ? 'voice.listening' : 'voice.start')}
                  </Button>
                )}
                {recorder.recording && (
                  <span className={styles.clock} aria-live="polite" data-voice-clock>
                    <span className={styles.dot} aria-hidden="true" /> {clock(recorder.seconds)} / {clock(maxSeconds)}
                  </span>
                )}
              </div>
              <CreditCost kind="voice_profile" />
              {micError && <p className={styles.error}>{micError}</p>}
              {tooShort ? (
                <p className={styles.error}>{t('voice.tooShort')}</p>
              ) : (
                <AiStatus isLoading={false} error={proposing.error} onRetry={record} />
              )}
              <p className={styles.privacy}>{t('voice.privacy')}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
