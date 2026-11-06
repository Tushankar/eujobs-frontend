import { useCallback, useEffect, useRef, useState } from 'react'
import { getToken } from '@/app/token.js'

/*
 * One-to-one WebRTC call of an interview (§3.23, P11d-Q2, Q5, Q18): the camera and microphone, the signaling socket
 * (the server relays offer/answer/ICE between the two parties), the recruiter as the offerer, the connection timeout
 * that shows the phone fallback, and the audio recording made in the recruiter's browser: both voices mixed, uploaded
 * in 5-second chunks, only after the server says it runs (both agreed).
 */
const API = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`
const CHUNK_MS = 5000

function signalUrl(ticket) {
  const base = new URL(import.meta.env.VITE_API_URL || window.location.origin)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  base.pathname = '/api/v1/interviews/signal'
  base.search = `?ticket=${encodeURIComponent(ticket)}`
  return base.toString()
}

/** Camera and microphone; audio only when there is no camera. */
async function localMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } })
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true })
  }
}

export function useCall({ session, onState }) {
  const [local, setLocal] = useState(null)
  const [remote, setRemote] = useState(null)
  const [status, setStatus] = useState('waiting')
  const [mediaError, setMediaError] = useState(false)
  const pc = useRef(null)
  const ws = useRef(null)
  const timer = useRef(null)
  const stream = useRef(null)
  const recorder = useRef(null)
  const onStateRef = useRef(onState)
  useEffect(() => {
    onStateRef.current = onState
  }, [onState])

  const send = (message) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(message))

  // A fresh peer connection for each pairing (a reconnect of either side starts over).
  const newPeer = useCallback(() => {
    pc.current?.close()
    const peer = new RTCPeerConnection({ iceServers: session.iceServers })
    stream.current.getTracks().forEach((track) => peer.addTrack(track, stream.current))
    peer.onicecandidate = (event) => event.candidate && send({ type: 'signal', data: { candidate: event.candidate } })
    peer.ontrack = (event) => setRemote(event.streams[0])
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        window.clearTimeout(timer.current)
        setStatus('connected')
      }
      if (peer.connectionState === 'failed') setStatus('failed')
    }
    pc.current = peer
    // P11d-Q2: no connection in time → the phone fallback shows (the call keeps trying).
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => peer.connectionState !== 'connected' && setStatus('failed'), session.connectTimeoutMs)
    setStatus('connecting')
    return peer
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    let closed = false
    const recruiter = session.side === 'recruiter'

    async function offer() {
      const peer = newPeer()
      await peer.setLocalDescription(await peer.createOffer())
      send({ type: 'signal', data: { sdp: peer.localDescription } })
    }

    async function onSignal({ sdp, candidate }) {
      if (sdp?.type === 'offer') {
        const peer = newPeer()
        await peer.setRemoteDescription(sdp)
        await peer.setLocalDescription(await peer.createAnswer())
        send({ type: 'signal', data: { sdp: peer.localDescription } })
      } else if (sdp?.type === 'answer') {
        await pc.current?.setRemoteDescription(sdp)
      } else if (candidate) {
        await pc.current?.addIceCandidate(candidate).catch(() => {})
      }
    }

    localMedia()
      .then((media) => {
        if (closed) return media.getTracks().forEach((track) => track.stop())
        stream.current = media
        setLocal(media)
        const socket = new WebSocket(signalUrl(session.ticket))
        ws.current = socket
        // Signals are applied one at a time, so a candidate never arrives before its offer is set.
        let chain = Promise.resolve()
        const then = (work) => {
          chain = chain.then(work).catch(() => {})
        }
        socket.onmessage = ({ data }) => {
          const message = JSON.parse(data)
          if ((message.type === 'ready' && message.peer && recruiter) || (message.type === 'peer-joined' && recruiter)) then(offer)
          if (message.type === 'signal') then(() => onSignal(message.data))
          if (message.type === 'peer-left') {
            pc.current?.close()
            window.clearTimeout(timer.current)
            setRemote(null)
            setStatus('waiting')
          }
          if (message.type === 'state') onStateRef.current(message)
        }
      })
      .catch(() => setMediaError(true))

    return () => {
      closed = true
      window.clearTimeout(timer.current)
      ws.current?.close()
      pc.current?.close()
      stream.current?.getTracks().forEach((track) => track.stop())
    }
  }, [session, newPeer])

  /** The recruiter's browser records both voices (audio only, P11d-Q5) and uploads each chunk in order. */
  const startRecorder = useCallback(() => {
    if (recorder.current || !stream.current || !remote) return
    const context = new AudioContext()
    // Chrome may create it suspended; both voices must reach the recording.
    context.resume().catch(() => {})
    const destination = context.createMediaStreamDestination()
    for (const source of [stream.current, remote]) {
      if (source.getAudioTracks().length) context.createMediaStreamSource(new MediaStream(source.getAudioTracks())).connect(destination)
    }
    const media = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24_000 })
    let seq = 0
    let queue = Promise.resolve()
    media.ondataavailable = ({ data }) => {
      if (!data.size) return
      const current = seq
      seq += 1
      queue = queue.then(() =>
        fetch(`${API}/interviews/${session.interview.id}/recording/chunks?seq=${current}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/octet-stream' },
          body: data,
        }).catch(() => {}),
      )
    }
    media.onstop = () => context.close()
    media.start(CHUNK_MS)
    recorder.current = media
  }, [remote, session])

  const stopRecorder = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current = null
  }, [])

  const toggle = useCallback((kind) => {
    const tracks = kind === 'audio' ? stream.current?.getAudioTracks() : stream.current?.getVideoTracks()
    tracks?.forEach((track) => {
      track.enabled = !track.enabled
    })
    return tracks?.[0]?.enabled ?? false
  }, [])

  return { local, remote, status, mediaError, startRecorder, stopRecorder, toggle }
}
