import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"
const Dashboard = () => {
  const [stats, setStats] = useState({ cpu: 0, memory: 0, uptime: "00:00:00" })
  const [isUiActive, setIsUiActive] = useState(false)
  const [lvaStatus, setLvaStatus] = useState("LOADING")
  const [toggleRunning, setToggleRunning] = useState(false)
  const [toggleRestarting, setToggleRestarting] = useState(false)
  const [errored, setErrored] = useState(false)

  const showError = async () => {
    setErrored(true)
    setLvaStatus("Error")
    await new Promise(resolve => setTimeout(resolve, 3000))
    setErrored(false)
  }

  const sendLVACommand = async (command) => {
    const endpointMap = { "Run": "start", "Stop": "stop", "Restart": "restart" }
    const endpoint = endpointMap[command]

    try {
      if (command === "Restart") setLvaStatus("Restarting")

      const response = await fetch(`${API_BASE}/service/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await response.json()

      if (data.status === "Running") {
        setLvaStatus("Running")
        setIsUiActive(true)
      } else if (data.status === "Stopped") {
        setLvaStatus("Stopped")
        setIsUiActive(false)
      } else if (data.status === "Restarted") {
        setLvaStatus("Running")
        setIsUiActive(true)
      } else {
        await showError()
        const statusRes = await fetch(`${API_BASE}/status`)
        const statusData = await statusRes.json()
        setLvaStatus(statusData.status)
        setIsUiActive(statusData.status === "Running")
      }
    } catch (err) {
      console.error("Command failed:", err)
      await showError()
    }
  }

  const triggerToggle = async () => {
    if (toggleRunning) return
    setToggleRunning(true)
    const command = isUiActive ? "Stop" : "Run"
    await sendLVACommand(command)
    setToggleRunning(false)
  }

  const triggerRestart = async () => {
    if (toggleRestarting) return
    setToggleRestarting(true)
    setToggleRunning(true)
    await sendLVACommand("Restart")
    setToggleRunning(false)
    setToggleRestarting(false)
  }

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/stats`)
    eventSource.onmessage = (event) => {
      setStats(JSON.parse(event.data))
    }
    eventSource.onerror = (err) => {
      console.error("SSE failed:", err)
      eventSource.close()
    }
    return () => eventSource.close()
  }, [])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/status`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        })
        const data = await response.json()
        // FIX: Set isUiActive explicitly based on fetched status
        setLvaStatus(data.status)
        setIsUiActive(data.status === "Running")
      } catch (error) {
        console.error("Failed to fetch initial status:", error)
        setLvaStatus("Error")
        setIsUiActive(false)
      }
    }
    fetchStatus()
  }, [])

  return (
    <div className="p-4 md:p-8 overflow-y-auto h-full flex flex-col gap-6">

      {/* STAT CARDS SECTION */}
      <div className="flex flex-col md:flex-row w-full h-auto md:h-70 gap-4 md:gap-6 md:p-8">

        {/* CPU Card */}
        <div className="flex-1 h-48 md:h-full bg-surface-container-highest rounded-3xl md:rounded-4xl p-6 md:p-8 flex flex-col gap-4">
          <div className="flex items-start justify-start">
            <div className="w-12 h-12 rounded-full bg-secondary-container items-center justify-center flex">
              <span className="material-symbols-outlined text-on-surface text-[28px]! md:text-[35px]! leading-none block">
                developer_board
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-on-surface-variant font-semibold text-lg md:text-xl leading-none">CPU Load</p>
            <div className="flex items-baseline justify-start">
              <p className="text-2xl md:text-4xl text-on-surface font-bold">{stats.cpu}</p>
              <p className="text-lg md:text-2xl text-on-surface-variant ml-1">%</p>
            </div>
          </div>
          <div className="relative w-full h-2">
            <div className="absolute inset-0 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${stats.cpu}%` }} />
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="flex-1 h-48 md:h-full bg-surface-container-highest rounded-3xl md:rounded-4xl p-6 md:p-8 flex flex-col gap-4">
          <div className="flex items-start justify-start">
            <div className="w-12 h-12 rounded-full bg-secondary-container items-center justify-center flex">
              <span className="material-symbols-outlined text-on-surface text-[28px]! md:text-[35px]! leading-none block">
                memory
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-on-surface-variant font-semibold text-lg md:text-xl leading-none">Memory Usage</p>
            <div className="flex items-baseline justify-start">
              <p className="text-2xl md:text-4xl text-on-surface font-bold">{stats.memory}</p>
              <p className="text-lg md:text-2xl text-on-surface-variant ml-1">%</p>
            </div>
          </div>
          <div className="relative w-full h-2">
            <div className="absolute inset-0 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${stats.memory}%` }} />
            </div>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="flex-1 h-48 md:h-full bg-surface-container-highest rounded-3xl md:rounded-4xl p-6 md:p-8 flex flex-col gap-4">
          <div className="flex items-start justify-start">
            <div className="w-12 h-12 rounded-full bg-secondary-container items-center justify-center flex">
              <span className="material-symbols-outlined text-on-surface text-[28px]! md:text-[35px]! leading-none block">
                schedule
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-on-surface-variant font-semibold text-lg md:text-xl leading-none">System Uptime</p>
            <div className="flex items-baseline justify-start">
              <p className="text-2xl md:text-4xl text-on-surface font-bold">{stats.uptime}</p>
            </div>
          </div>
          <div className="relative w-full h-2">
            <div className="absolute inset-0 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `100%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* SERVICE STATION SECTION */}
      <div className="px-4 md:px-8 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 w-full min-h-105 bg-surface-container rounded-[48px] overflow-hidden border border-outline-variant shadow-md">

          <div className="md:col-span-2 p-10 md:p-16 flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-on-surface text-4xl font-black">LVA Command Center</h2>
              <p className="text-on-surface-variant text-xl font-medium">Toggle system process and monitor health</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <button
                onClick={triggerToggle}
                disabled={toggleRunning}
                className={`flex-1 h-24 rounded-4xl flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95
                  ${toggleRunning
                    ? 'bg-outline-variant text-on-surface-variant cursor-not-allowed grayscale'
                    : isUiActive ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
                  }
                `}
              >
                <span className="material-symbols-outlined text-4xl">
                  {toggleRunning ? 'sync' : isUiActive ? 'power_settings_new' : 'bolt'}
                </span>
                <span className="text-2xl font-black uppercase tracking-tight">
                  {toggleRunning ? 'Processing...' : isUiActive ? 'Turn Off LVA' : 'Turn On LVA'}
                </span>
              </button>

              <button
                disabled={toggleRunning || toggleRestarting}
                onClick={triggerRestart}
                className="flex-1 h-24 border-4 border-outline text-on-surface rounded-4xl flex items-center justify-center gap-4 hover:bg-on-surface/5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-4xl">restart_alt</span>
                <span className="text-2xl font-black uppercase tracking-tight">Restart</span>
              </button>
            </div>
          </div>

          <div className="bg-surface-container-low p-10 md:p-16 flex flex-col items-center justify-center gap-6 border-t md:border-t-0 md:border-l border-outline-variant">
            <div className={`w-36 h-36 rounded-full flex items-center justify-center shadow-xl transition-all duration-500
              ${lvaStatus === 'Running' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
            `}>
              <span className="material-symbols-outlined text-8xl font-bold">
                {lvaStatus === 'Running' ? 'verified' : 'report'}
              </span>
            </div>
            <div className="text-center">
              <p className="text-on-surface-variant font-black uppercase tracking-[0.4em] text-[10px]">Real-Time Monitor</p>
              <h3 className={`text-5xl font-black mt-2 transition-colors duration-500
                ${lvaStatus === 'Running' ? 'text-green-600' : 'text-error'}
              `}>
                {lvaStatus.toUpperCase()}
              </h3>
            </div>
          </div>

        </div>
      </div>

      <div className={`fixed items-center justify-center bottom-4 left-1/2 -translate-x-1/2 w-60 md:w-125 h-15 z-50 px-6 py-3 rounded-lg shadow-lg bg-error-container text-white transition-all transform duration-300 ${errored ? 'translate-y-0 opacity-100 flex' : 'translate-y-10 opacity-0 hidden'}`}>
        <p className='text-on-error-container'>ERROR: Please Check The Logs</p>
      </div>
    </div>
  )
}

export default Dashboard