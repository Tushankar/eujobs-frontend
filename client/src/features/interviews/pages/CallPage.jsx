import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, PhoneOff, Sparkles, Square, Video, VideoOff } from 'lucide-react'
import { Button, Icon, Panel, Skeleton, SkeletonRegion } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState.jsx'
import { useErrorText } from '@/lib/forms.js'
import { usePreferences } from '@/lib/preferences.js'
import { useJoinInterviewMutation, useSetConsentMutation, useStartRecordingMutation, useStopRecordingMutation } from '../api.js'
import { useWhen } from '../useWhen.js'
import { useCall } from '../useCall.js'
import styles from './CallPage.module.css'

function VideoTile({ stream, muted, label, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <div className={className}>
      {stream ? <video ref={ref} autoPlay playsInline muted={muted} className={styles.video} data-video={muted ? 'local' : 'remote'} /> : null}
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}

/**
 * The in-app video interview (§3.23, P11d-Q2, Q5, Q17, Q18, Q23, Q26): both videos, mute and camera, the AI-notes
 * consent asked on screen, the "Recording" indicator with Stop for either side, the phone fallback when the call
 * cannot connect, and Leave.
 */
export default function CallPage() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const when = useWhen()
  const { me } = usePreferences()
  const { interviewId } = useParams()
  const [join, { error: joinError }] = useJoinInterviewMutation()
  const [setConsent] = useSetConsentMutation()
  const [startRecording] = useStartRecordingMutation()
  const [stopRecording] = useStopRecordingMutation()
  const [session, setSession] = useState(null)
  const [consent, setConsentState] = useState({ recruiter: null, candidate: null })
  const [recording, setRecording] = useState('off')
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)
  const side = me.role === 'candidate' ? 'candidate' : 'recruiter'
  const other = side === 'candidate' ? 'recruiter' : 'candidate'
  const call = useCall({
    session,
    onState: (state) => {
      setConsentState(state.consent)
      setRecording(state.recording)
    },
  })

  useEffect(() => {
    join(interviewId)
      .unwrap()
      .then((result) => {
        setSession(result)
        const mine = result.interview.consent
        setConsentState({ [side]: mine.mine, [other]: mine.other })
        setRecording(result.interview.recording.status)
      })
      .catch(() => {})
  }, [interviewId, join, side, other])

  // The recruiter's browser starts the recording once both agreed and the call is connected (the server checks again).
  const bothAgreed = consent.recruiter === true && consent.candidate === true
  useEffect(() => {
    if (side !== 'recruiter' || !session?.interview.aiNotes || !bothAgreed || call.status !== 'connected' || recording !== 'off') return
    startRecording(interviewId)
      .unwrap()
      .then((result) => setRecording(result.recording.status))
      .catch(() => {})
  }, [side, session, bothAgreed, call.status, recording, interviewId, startRecording])
  // P11d-Q18: whoever stops it, the recruiter's recorder stops (its last chunk still goes up).
  const { startRecorder, stopRecorder } = call
  useEffect(() => {
    if (side !== 'recruiter') return
    if (recording === 'recording') startRecorder()
    else stopRecorder()
  }, [side, recording, startRecorder, stopRecorder])

  const threadPath = session ? `/${me.role}/messages/${session.interview.conversationId}?card=${interviewId}` : `/${me.role}/messages`
  const back = (
    <Link to={threadPath} className={styles.back}>
      <Icon as={ArrowLeft} size={14} strokeWidth={2} />
      {t('interviews:call.back')}
    </Link>
  )

  // P11d-Q26: too early or too late gets its own sentence; anything else the error message.
  const joinReason = (error) => {
    const reason = error?.data?.error?.params?.reason
    return ['too_early', 'closed'].includes(reason) ? t(`interviews:call.reasons.${reason}`) : errorText.code(error)
  }

  if (joinError) {
    return (
      <>
        {back}
        <EmptyState icon={VideoOff} title={t('interviews:call.cannotJoin')} description={joinReason(joinError)} />
      </>
    )
  }
  if (!session) {
    return (
      <SkeletonRegion>
        <Skeleton shape="block" height={420} />
      </SkeletonRegion>
    )
  }

  const { interview } = session
  const myConsent = consent[side]
  const otherConsent = consent[other]
  const leave = () => {
    stopRecorder()
    navigate(threadPath)
  }

  return (
    <div className={styles.page} data-call-page data-call-status={call.status}>
      {back}
      <Panel className={styles.panel} padding={0}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('interviews:call.title', { job: interview.job.title })}</h1>
            <p className={styles.sub}>{when(interview.startAt, interview.minutes)}</p>
          </div>
          {recording === 'recording' && (
            <span className={styles.recording} role="status" data-recording-indicator>
              <span className={styles.dot} aria-hidden="true" />
              {t('interviews:call.recording')}
            </span>
          )}
        </header>

        {interview.aiNotes && myConsent === null && (
          <section className={styles.consent} data-consent-prompt>
            <Icon as={Sparkles} size={18} />
            <div className={styles.consentText}>
              <p className={styles.consentTitle}>{t('interviews:call.consentTitle')}</p>
              <p>{t('interviews:call.consentText')}</p>
            </div>
            <div className={styles.consentActions}>
              <Button variant="outline" onClick={() => setConsent({ id: interviewId, agree: false }).unwrap().then((result) => setConsentState({ [side]: result.consent.mine, [other]: result.consent.other }))} data-consent="decline">
                {t('interviews:call.decline')}
              </Button>
              <Button onClick={() => setConsent({ id: interviewId, agree: true }).unwrap().then((result) => setConsentState({ [side]: result.consent.mine, [other]: result.consent.other }))} data-consent="agree">
                {t('interviews:call.agree')}
              </Button>
            </div>
          </section>
        )}
        {interview.aiNotes && myConsent !== null && recording === 'off' && (
          <p className={styles.notice} data-consent-state={myConsent === false || otherConsent === false ? 'off' : 'waiting'}>
            {myConsent === false || otherConsent === false ? t('interviews:call.notesOff') : t('interviews:call.waitingConsent')}
          </p>
        )}
        {recording === 'processing' && <p className={styles.notice}>{t('interviews:call.recordingStopped')}</p>}

        {call.status === 'failed' && (
          <section className={styles.fallback} role="alert" data-call-failed>
            <p className={styles.consentTitle}>{t('interviews:call.failedTitle')}</p>
            <p>
              {session.fallbackPhone
                ? t(side === 'recruiter' ? 'interviews:call.fallbackRecruiter' : 'interviews:call.fallbackCandidate', { phone: session.fallbackPhone })
                : t('interviews:call.fallbackNoPhone')}
            </p>
          </section>
        )}
        {call.mediaError && <p className={styles.notice}>{t('interviews:call.mediaError')}</p>}

        <div className={styles.stage}>
          <VideoTile stream={call.remote} label={call.remote ? t('interviews:call.them') : t('interviews:call.waiting')} className={styles.remote} />
          <VideoTile stream={call.local} muted label={t('interviews:call.you')} className={styles.local} />
        </div>

        <footer className={styles.controls}>
          <Button variant="outline" leftIcon={<Icon as={mic ? Mic : MicOff} size={16} />} onClick={() => setMic(call.toggle('audio'))} aria-pressed={!mic}>
            {t(mic ? 'interviews:call.mute' : 'interviews:call.unmute')}
          </Button>
          <Button variant="outline" leftIcon={<Icon as={camera ? Video : VideoOff} size={16} />} onClick={() => setCamera(call.toggle('video'))} aria-pressed={!camera}>
            {t(camera ? 'interviews:call.cameraOff' : 'interviews:call.cameraOn')}
          </Button>
          {recording === 'recording' && (
            <Button variant="outline" leftIcon={<Icon as={Square} size={14} />} onClick={() => stopRecording(interviewId).unwrap().then((result) => setRecording(result.recording.status))} data-stop-recording>
              {t('interviews:call.stopRecording')}
            </Button>
          )}
          <Button variant="danger" leftIcon={<Icon as={PhoneOff} size={16} />} onClick={leave} data-leave-call>
            {t('interviews:call.leave')}
          </Button>
        </footer>
      </Panel>
    </div>
  )
}
