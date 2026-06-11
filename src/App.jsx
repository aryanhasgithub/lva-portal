import React, { useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Rail from './components/Rail'
import Dashboard from './pages/Dashboard'
import Logs from './pages/Logs'
import Configuration from './pages/Configuration'
import Updates from './pages/Updates'
import Network from './pages/Network'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

const RebootModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-surface-container rounded-3xl border border-outline-variant shadow-xl p-8 max-w-sm w-full mx-4 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-error-container/40 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-error text-2xl">restart_alt</span>
        </div>
        <div>
          <p className="text-on-surface font-bold text-lg">Reboot System</p>
          <p className="text-on-surface-variant text-sm">The device will restart and be unavailable briefly.</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded-full border border-outline text-on-surface-variant font-bold hover:bg-on-surface/8 transition-all active:scale-95"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 h-10 rounded-full bg-error text-on-error font-bold hover:shadow-md transition-all active:scale-95"
        >
          Reboot
        </button>
      </div>
    </div>
  </div>
)

const Layout = () => {
  const [expanded, setExpanded] = useState(false)
  const [showReboot, setShowReboot] = useState(false)

  const handleReboot = async () => {
    setShowReboot(false)
    try {
      await fetch(`${API_BASE}/service/reboot`, { method: "POST" })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      {showReboot && (
        <RebootModal
          onConfirm={handleReboot}
          onCancel={() => setShowReboot(false)}
        />
      )}
      <Rail expanded={expanded} setExpanded={setExpanded} onReboot={() => setShowReboot(true)} />
      <div className="flex-col flex-1 flex">
        <div className="bg-surface flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/config" element={<Configuration />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/network" element={<Network />} />
      </Route>
    </Routes>
  )
}