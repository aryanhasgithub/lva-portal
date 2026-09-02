import React, { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

// ─────────────────────────────────────────────────────────────────────────────
// MD3-style linear progress bar
// ─────────────────────────────────────────────────────────────────────────────
const ProgressBar = ({ pct }) => (
  <div className="w-full h-1 rounded-full bg-surface-container-highest overflow-hidden">
    <div
      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
      style={{ width: `${pct ?? 0}%` }}
    />
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Toast — simple auto-dismissing notification, stacked bottom-right
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 6000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div
      className="pointer-events-auto max-w-sm w-full rounded-2xl border shadow-lg px-5 py-4
                 bg-surface-container-high border-outline-variant flex items-start gap-3
                 animate-[fadeIn_0.2s_ease-out]"
    >
      <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-on-surface-variant/50 hover:text-on-surface-variant shrink-0"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  )
}

const ToastStack = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
    {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// UpdateCard
// ─────────────────────────────────────────────────────────────────────────────
const UpdateCard = ({ data, onUpdate, updatingId, pullPct }) => {
  if (!data) return null

  const isUpdating = updatingId === data.id
  const requirementsMet = data.requirements_met !== false
  const blocked = data.available && !requirementsMet

  return (
    <div className={`rounded-3xl border shadow-sm transition-all flex flex-col overflow-hidden
      ${data.available
        ? 'bg-surface-container border-primary/30'
        : 'bg-surface-container border-outline-variant'}`}>

      <div className="p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
          <div className="flex items-start gap-4">

            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl mt-1
              ${data.available ? 'bg-primary-container text-on-primary-container' : 'bg-green-100 text-green-700'}`}>
              <span className="material-symbols-outlined">
                {data.available ? 'cloud_download' : 'verified'}
              </span>
            </div>

            {/* Title + versions */}
            <div>
              <h3 className="text-xl font-bold text-on-surface">{data.name}</h3>
              <a
                href={`https://github.com/${data.repo}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline font-mono flex items-center gap-1 mb-2"
              >
                {data.repo}
                <span className="material-symbols-outlined text-[10px]">open_in_new</span>
              </a>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded-md bg-surface-container-highest text-xs font-mono text-on-surface border border-outline-variant">
                  {data.current ?? 'unknown'}
                </span>
                {data.available && (
                  <>
                    <span className="text-on-surface-variant">→</span>
                    <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono border border-primary/20 font-bold">
                      {data.latest ?? 'unknown'}
                    </span>
                  </>
                )}
              </div>

              {/* Unmet requirements chip */}
              {blocked && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  <span>Requires other updates first</span>
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <div className="shrink-0">
            {data.available ? (
              <button
                onClick={() => onUpdate(data)}
                disabled={!!updatingId || blocked}
                title={blocked ? 'Update dependencies before installing this update' : undefined}
                className="h-10 px-6 bg-primary text-on-primary rounded-full font-bold shadow-md
                           hover:shadow-lg active:scale-95 flex items-center gap-2 transition-all
                           w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Installing…' : (blocked ? 'Locked' : 'Install Update')}
                <span className={`material-symbols-outlined ${isUpdating ? 'animate-spin' : ''}`}>
                  {isUpdating ? 'sync' : (blocked ? 'lock' : 'download')}
                </span>
              </button>
            ) : (
              <div className="h-10 px-4 flex items-center gap-2 text-on-surface-variant/50 font-bold select-none">
                <span className="material-symbols-outlined">check_circle</span>
                <span>Up to Date</span>
              </div>
            )}
          </div>
        </div>

        {/* Release notes */}
        {data.available && data.notes && (
          <div className="bg-surface-container-high/30 rounded-xl border border-outline-variant/50 overflow-hidden">
            <div className="px-5 py-3 bg-surface-container-high/50 border-b border-outline-variant/50 flex justify-between items-center">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Release Notes
              </p>
              {data.url && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View on GitHub
                  <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                </a>
              )}
            </div>
            <div className="p-5 max-h-60 overflow-y-auto custom-scrollbar">
              <pre className="whitespace-pre-wrap font-sans text-sm text-on-surface-variant leading-relaxed">
                {data.notes}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar — only shown on the actively updating card */}
      {isUpdating && pullPct !== null && (
        <div className="px-6 pb-5 flex flex-col gap-1.5">
          <ProgressBar pct={pullPct} />
          <div className="flex justify-between text-xs font-mono text-on-surface-variant">
            <span>Pulling image</span>
            <span className="text-primary font-bold">{pullPct}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal log panel
// ─────────────────────────────────────────────────────────────────────────────
const TerminalPanel = ({ logs, updatingId, updateFailed, onClear }) => {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const lineColor = (type) => {
    if (type === 'success') return 'text-green-400'
    if (type === 'error')   return 'text-red-400'
    return 'text-green-300/80'
  }

  const dotColor = updatingId
    ? 'bg-green-400 animate-pulse'
    : updateFailed
      ? 'bg-red-500'
      : 'bg-gray-500'

  return (
    <div className="bg-black/90 rounded-2xl border border-outline-variant shadow-inner flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-white/40 text-xs font-mono">updates.log</span>
        {!updatingId && (
          <button
            onClick={onClear}
            className="ml-auto text-white/20 hover:text-white/50 text-xs font-mono transition-colors"
          >
            clear
          </button>
        )}
      </div>
      <div className="p-6 font-mono text-sm max-h-96 overflow-y-auto custom-scrollbar">
        {logs.map((entry, i) => (
          <div key={i} className={`break-all leading-6 ${lineColor(entry.type)}`}>
            {entry.type === 'log'     && <span className="text-white/30 mr-2">›</span>}
            {entry.type === 'success' && <span className="text-green-400 mr-2">✓</span>}
            {entry.type === 'error'   && <span className="text-red-400 mr-2">✗</span>}
            {entry.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const Updates = () => {
  const [loading,      setLoading]      = useState(true)
  const [updates,      setUpdates]      = useState(null)
  const [updatingId,   setUpdatingId]   = useState(null)
  const [updateFailed, setUpdateFailed] = useState(false)
  const [logs,         setLogs]         = useState([])
  const [pullPct,      setPullPct]      = useState(null)  // null = not pulling / no % yet
  const [toasts,       setToasts]       = useState([])

  const sseRef = useRef(null)
  const toastIdRef = useRef(0)

  const pushToast = (title, message) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, title, message }])
  }

  const dismissToast = (id) =>
    setToasts(prev => prev.filter(t => t.id !== id))

  const checkUpdates = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/system/updates`)
      const data = await res.json()
      setUpdates(data)

      // Surface a toast for any available update that's blocked on
      // dependency versions, so it's noticed even without opening the card.
      Object.values(data || {}).forEach(component => {
        if (component?.available && component?.requirements_met === false) {
          const unmet = component.unmet_requirements || {}
          const parts = Object.entries(unmet).map(
            ([dep, info]) => `${dep} ≥ ${info.required} (currently ${info.current ?? 'unknown'})`
          )
          pushToast(
            `${component.name} update requires other components first`,
            parts.length ? `Needs: ${parts.join(', ')}` : undefined
          )
        }
      })
    } catch (err) {
      console.error('[Updates] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkUpdates() }, [])
  useEffect(() => () => sseRef.current?.close(), [])

  const appendLog = (text, type = 'log') =>
    setLogs(prev => [...prev, { text, type }])

  const handleUpdate = (componentData) => {
    if (updatingId) return

    // Defensive: the button is disabled when requirements aren't met, but
    // guard here too in case this is ever invoked another way.
    if (componentData.available && componentData.requirements_met === false) {
      const unmet = componentData.unmet_requirements || {}
      const parts = Object.entries(unmet).map(
        ([dep, info]) => `${dep} ≥ ${info.required} (currently ${info.current ?? 'unknown'})`
      )
      pushToast(
        `Can't update ${componentData.name} yet`,
        parts.length ? `Needs: ${parts.join(', ')}` : 'Update its dependencies first.'
      )
      return
    }

    sseRef.current?.close()
    setUpdatingId(componentData.id)
    setUpdateFailed(false)
    setPullPct(null)
    setLogs([{
      text: `Initiating update for ${componentData.name}  ${componentData.current} → ${componentData.latest}`,
      type: 'log',
    }])

    const url = `${API_BASE}/system/update/stream?component=${encodeURIComponent(componentData.id)}`
    const sse = new EventSource(url)
    sseRef.current = sse

    sse.onmessage = (e) => {
      let payload
      try { payload = JSON.parse(e.data) }
      catch { appendLog(e.data); return }

      const { type, status, pull_percent } = payload

      // Every event goes to the log — use status as the human-readable text.
      // pull_percent events are frequent layer-by-layer updates; only log
      // them every 10% to avoid flooding the terminal panel.
      const logText = status || ''
      if (pull_percent === undefined || pull_percent % 10 === 0) {
        appendLog(logText, type)
      }

      // pull_percent drives the progress bar independently of log frequency.
      if (pull_percent !== undefined) {
        setPullPct(pull_percent)
      }

      if (type === 'success') {
        sse.close()
        setUpdatingId(null)
        setPullPct(null)
        setTimeout(checkUpdates, 1500)
      }

      if (type === 'error') {
        sse.close()
        setUpdatingId(null)
        setUpdateFailed(true)
      }
    }

    sse.onerror = () => {
      sse.close()
      appendLog('Connection to update stream lost.', 'error')
      setUpdatingId(null)
      setUpdateFailed(true)
    }
  }

  return (
    <div className="p-4 md:p-10 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar">

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="w-full flex justify-between items-end flex-none h-14">
        <div>
          <p className="text-on-surface text-3xl font-bold">System Updates</p>
          <p className="text-on-surface-variant mt-1 text-sm">
            Manage LVA Core, Portal, Audio, CLI, &amp; OS versions
          </p>
        </div>
        <button
          onClick={checkUpdates}
          disabled={loading || !!updatingId}
          className="h-10 px-4 bg-surface-container-high text-primary font-bold rounded-full
                     hover:bg-primary/10 transition-colors flex items-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          Check
        </button>
      </div>

      <div className="max-w-5xl w-full flex flex-col gap-6">

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-40 bg-surface-container rounded-3xl border border-outline-variant" />
            ))}
          </div>
        ) : (
          <>
            <UpdateCard data={updates?.portal} updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
            <UpdateCard data={updates?.core}   updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
            <UpdateCard data={updates?.supervisor} updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
            <UpdateCard data={updates?.audio}  updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
             <UpdateCard data={updates?.cli}  updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
            <UpdateCard data={updates?.os}     updatingId={updatingId} onUpdate={handleUpdate} pullPct={pullPct} />
          </>
        )}

        {logs.length > 0 && (
          <TerminalPanel
            logs={logs}
            updatingId={updatingId}
            updateFailed={updateFailed}
            onClear={() => setLogs([])}
          />
        )}
      </div>
    </div>
  )
}

export default Updates