import React, { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

const Terminal = ({ title, status, logs, innerRef }) => (
  <div className="flex flex-col h-full w-full md:w-1/2">
    <div className="w-full h-full rounded-3xl bg-surface-container overflow-hidden flex flex-col border border-outline-variant">
      <div className="h-14 w-full items-center justify-between bg-surface-container-highest px-6 flex flex-none">
        <p className="font-bold text-on-surface">{title}</p>
        <div className={`w-fit h-fit rounded-full px-3 py-1 flex items-center justify-center
          ${status === "Running" ? "bg-green-500/20" : "bg-error-container"}`}>
          <p className={`text-xs font-black uppercase tracking-wider
            ${status === "Running" ? "text-green-500" : "text-error"}`}>
            {status}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-surface-container p-4 font-mono text-sm overflow-y-auto custom-scrollbar">
        {Object.entries(logs)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([time, message]) => (
            <div key={time} className="flex gap-3 mb-1 group hover:bg-white/5 px-1 rounded transition-colors">
              <span className="text-primary/70 shrink-0 select-none">
                [{new Date(time).toLocaleTimeString([], { hour12: false })}]
              </span>
              <span className="text-on-surface break-all">{message}</span>
            </div>
          ))}
        <div ref={innerRef} />
      </div>
    </div>
  </div>
)

const Logs = () => {
  const [isLive, setIsLive] = useState(true)
  const [lvaLogs, setLvaLogs] = useState({})
  const [portalLogs, setPortalLogs] = useState({})
  const [LVAState, setLVAState] = useState("Loading")
  const [PortalState, setPortalState] = useState("Loading")

  const lvaRef = useRef(null)
  const portalRef = useRef(null)

  // --- 1. AUTO-SCROLL LOGIC ---
  const scrollToBottom = (ref) => {
    if (isLive) ref.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => scrollToBottom(lvaRef), [lvaLogs, isLive])
  useEffect(() => scrollToBottom(portalRef), [portalLogs, isLive])

  // --- 2. NEW: CLEAR LOGS ON MODE SWITCH ---
  useEffect(() => {
    if (isLive) {
      // User switched to Live: Clear the history/old logs to start fresh
      setLvaLogs({})
      setPortalLogs({})
    }
  }, [isLive])

  // --- 3. STATUS POLLING ---
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [lvaRes, portalRes] = await Promise.all([
          fetch(`${API_BASE}/status?service=lva`),
          fetch(`${API_BASE}/status?service=portal`)
        ])
        const lvaData = await lvaRes.json()
        const portalData = await portalRes.json()
        setLVAState(lvaData.status)
        setPortalState(portalData.status)
      } catch {
        setLVAState("Error")
        setPortalState("Error")
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  // --- 4. LIVE LOG STREAM (SSE) ---
  useEffect(() => {
    const lvaSse = new EventSource(`${API_BASE}/stream/logs?service=lva`)
    const portalSse = new EventSource(`${API_BASE}/stream/logs?service=portal`)

    lvaSse.onmessage = (e) => {
      const { time, message } = JSON.parse(e.data)
      setLvaLogs(prev => ({ ...prev, [time]: message }))
    }

    portalSse.onmessage = (e) => {
      const { time, message } = JSON.parse(e.data)
      setPortalLogs(prev => ({ ...prev, [time]: message }))
    }

    return () => {
      lvaSse.close()
      portalSse.close()
    }
  }, [])

  // --- 5. HISTORY FETCH ---
  useEffect(() => {
    if (isLive) return

    const fetchHistory = async () => {
      try {
        const [lvaRes, portalRes] = await Promise.all([
          fetch(`${API_BASE}/logs/history?service=lva`),
          fetch(`${API_BASE}/logs/history?service=portal`)
        ])
        const lvaHist = await lvaRes.json()
        const portalHist = await portalRes.json()
        // Merge history. Because keys are timestamps, this is safe.
        setLvaLogs(prev => ({ ...lvaHist, ...prev }))
        setPortalLogs(prev => ({ ...portalHist, ...prev }))
      } catch (err) {
        console.error("History Backfill Failed:", err)
      }
    }

    fetchHistory()
  }, [isLive])

  return (
    <div className="p-4 md:p-10 h-full flex flex-col gap-5 overflow-hidden">
      <div className="w-full h-fit flex justify-between items-baseline">
        <p className="text-on-surface text-3xl font-bold">System Logs</p>
        <div className="flex gap-3">
          {['live', 'history'].map(type => (
            <button
              key={type}
              onClick={() => setIsLive(type === 'live')}
              className={`flex items-center justify-center h-8 rounded-lg border transition-all duration-300 overflow-hidden
                ${(type === 'live' ? isLive : !isLive)
                  ? "bg-secondary-container border-transparent text-on-secondary-container w-28 px-2 shadow-sm"
                  : "bg-surface-container-low border-outline-variant text-on-surface-variant w-20 px-0 hover:bg-on-surface/5"}`}
            >
              <div className={`flex items-center transition-all duration-300 ${(type === 'live' ? isLive : !isLive) ? "w-6 opacity-100 mr-1" : "w-0 opacity-0"}`}>
                <span className="material-symbols-outlined text-lg">{type === 'live' ? 'check' : 'history'}</span>
              </div>
              <span className={`text-sm ${(type === 'live' ? isLive : !isLive) ? "font-bold" : "font-medium"}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 h-full min-h-0">
        <div className="flex gap-6 flex-col md:flex-row h-full">
          <Terminal title="Linux Voice Assistant" status={LVAState} logs={lvaLogs} innerRef={lvaRef} />
          <Terminal title="LVA Portal" status={PortalState} logs={portalLogs} innerRef={portalRef} />
        </div>
      </div>
    </div>
  )
}

export default Logs
