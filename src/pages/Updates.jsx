import React, { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

// ─────────────────────────────────────────────────────────────────────────────
// UpdateCard
// ─────────────────────────────────────────────────────────────────────────────
const UpdateCard = ({ data, onUpdate, updatingId }) => {
  if (!data) return null

  const isUpdating = updatingId === data.id

  return (
    <div className={`rounded-3xl p-6 border shadow-sm transition-all flex flex-col gap-6
      ${data.available
        ? 'bg-surface-container border-primary/30'
        : 'bg-surface-container border-outline-variant'}`}>

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
              {/* Current version */}
              <span className="px-2 py-1 rounded-md bg-surface-container-highest text-xs font-mono text-on-surface border border-outline-variant">
                {data.current ?? 'unknown'}
              </span>

              {data.available && (
                <>
                  <span className="text-on-surface-variant">→</span>
                  {/* Latest version */}
                  <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono border border-primary/20 font-bold">
                    {data.latest ?? 'unknown'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {data.available ? (
            <button
              onClick={() => onUpdate(data)}
              disabled={!!updatingId}
              className="h-10 px-6 bg-primary text-on-primary rounded-full font-bold shadow-md
                         hover:shadow-lg active:scale-95 flex items-center gap-2 transition-all
                         w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Installing…' : 'Install Update'}
              <span className={`material-symbols-outlined ${isUpdating ? 'animate-spin' : ''}`}>
                {isUpdating ? 'sync' : 'download'}
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
      {/* Top bar */}
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

      {/* Log lines */}
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
  const [updatingId,   setUpdatingId]   = useState(null)   // component id being updated
  const [updateFailed, setUpdateFailed] = useState(false)
  const [logs,         setLogs]         = useState([])

  const sseRef = useRef(null)

  // ── data fetching ──────────────────────────────────────────────────────────
  const checkUpdates = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/system/updates`)
      const data = await res.json()
      setUpdates(data)
    } catch (err) {
      console.error('[Updates] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkUpdates() }, [])

  // Cleanup SSE on unmount
  useEffect(() => () => sseRef.current?.close(), [])

  // ── helpers ────────────────────────────────────────────────────────────────
  const appendLog = (text, type = 'log') =>
    setLogs(prev => [...prev, { text, type }])

  // ── update trigger ─────────────────────────────────────────────────────────
  const handleUpdate = (componentData) => {
    if (updatingId) return

    sseRef.current?.close()

    setUpdatingId(componentData.id)
    setUpdateFailed(false)
    setLogs([{
      text: `Initiating update for ${componentData.name}  ${componentData.current} → ${componentData.latest}`,
      type: 'log',
    }])

    const url = `${API_BASE}/system/update/stream?component=${encodeURIComponent(componentData.id)}`
    const sse = new EventSource(url)
    sseRef.current = sse

    sse.onmessage = (e) => {
      let payload
      try {
        payload = JSON.parse(e.data)
      } catch {
        appendLog(e.data)
        return
      }

      const { type, message } = payload
      appendLog(message, type)

      if (type === 'success') {
        sse.close()
        setUpdatingId(null)
        // Re-check versions after a moment so badges update
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

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-10 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar">

      {/* Page header */}
      <div className="w-full flex justify-between items-end flex-none h-14">
        <div>
          <p className="text-on-surface text-3xl font-bold">System Updates</p>
          <p className="text-on-surface-variant mt-1 text-sm">
            Manage LVA Core, Portal, Audio &amp; OS versions
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

        {/* Cards */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-surface-container rounded-3xl border border-outline-variant" />
            ))}
          </div>
        ) : (
          <>
            <UpdateCard data={updates?.portal} updatingId={updatingId} onUpdate={handleUpdate} />
            <UpdateCard data={updates?.core}   updatingId={updatingId} onUpdate={handleUpdate} />
            <UpdateCard data={updates?.audio}  updatingId={updatingId} onUpdate={handleUpdate} />
            <UpdateCard data={updates?.os}     updatingId={updatingId} onUpdate={handleUpdate} />
          </>
        )}

        {/* Terminal panel — shown as soon as any log line arrives */}
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