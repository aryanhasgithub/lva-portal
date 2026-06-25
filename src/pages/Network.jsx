import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

const statusColor = (state) => {
  if (!state) return "bg-surface-container-highest text-on-surface-variant"
  const s = state.toLowerCase()
  if (s === "activated" || s === "connected") return "bg-tertiary-container text-on-tertiary-container"
  if (s === "activating" || s === "connecting") return "bg-secondary-container text-on-secondary-container"
  return "bg-error-container/40 text-error"
}

const Badge = ({ label }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor(label)}`}>
    {label || "unknown"}
  </span>
)

const Field = ({ label, value, mono = false }) => (
  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30 last:border-0">
    <span className="text-on-surface-variant text-sm">{label}</span>
    <span className={`text-on-surface text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
  </div>
)

const SectionHeader = ({ icon, title }) => (
  <div className="h-14 bg-surface-container-high px-6 flex items-center border-b border-outline-variant/50 shrink-0">
    <span className="material-symbols-outlined text-primary mr-3">{icon}</span>
    <p className="text-on-surface font-bold text-lg">{title}</p>
  </div>
)

const Network = () => {
  const [loading, setLoading] = useState(true)
  const [interfaces, setInterfaces] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [hostname, setHostname] = useState("")
  const [newHostname, setNewHostname] = useState("")
  const [ipForm, setIpForm] = useState({ method: "dhcp", address: "", prefix: "24", gateway: "", dns: "1.1.1.1, 8.8.8.8" })
  const [saving, setSaving] = useState(false)
  const [ipSaving, setIpSaving] = useState(false)
  const [statusText, setStatusText] = useState("Apply")
  const [hostStatusText, setHostStatusText] = useState("Set")

  const load = async () => {
    try {
      const [ifaceRes, infoRes] = await Promise.all([
        fetch(`${API_BASE}/network/interfaces`),
        fetch(`${API_BASE}/network/info`),
      ])
      const ifaces = await ifaceRes.json()
      const info = await infoRes.json()
      setInterfaces(ifaces)
      if (info.hostname) setHostname(info.hostname)
      if (!selected && ifaces.length > 0) setSelected(ifaces[0].interface)
    } catch (e) {
      console.error("Failed to load network info:", e)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (iface) => {
  try {
    const res = await fetch(`${API_BASE}/network/info`)
    const data = await res.json()
    const devices = data.devices || []
    const found = devices.find(d => d.interface === iface)
    setDetail(found || null)
  } catch (e) {
    console.error("Failed to load interface detail:", e)
  }
 }

  useEffect(() => { load() }, [])
  useEffect(() => { if (selected) loadDetail(selected) }, [selected])

  const handleHostname = async () => {
    if (!newHostname.trim()) return
    setSaving(true)
    setHostStatusText("Setting...")
    try {
      const res = await fetch(`${API_BASE}/network/hostname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: newHostname.trim() }),
      })
      if (!res.ok) throw new Error()
      setHostname(newHostname.trim())
      setNewHostname("")
      setHostStatusText("Done!")
      setTimeout(() => { setSaving(false); setHostStatusText("Set") }, 1500)
    } catch {
      setHostStatusText("Error")
      setTimeout(() => { setSaving(false); setHostStatusText("Set") }, 2000)
    }
  }

  const handleIp = async () => {
    setIpSaving(true)
    setStatusText("Applying...")
    try {
      const body = ipForm.method === "dhcp"
        ? { interface: selected, method: "dhcp" }
        : {
            interface: selected,
            method: "static",
            address: ipForm.address,
            prefix: parseInt(ipForm.prefix),
            gateway: ipForm.gateway,
            dns: ipForm.dns.split(",").map(s => s.trim()).filter(Boolean),
          }
      const res = await fetch(`${API_BASE}/network/ip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setStatusText("Done!")
      await loadDetail(selected)
      setTimeout(() => { setIpSaving(false); setStatusText("Apply") }, 1500)
    } catch {
      setStatusText("Error")
      setTimeout(() => { setIpSaving(false); setStatusText("Apply") }, 2000)
    }
  }

  const actionIcon = (text) => {
    if (text === "Done!") return "check"
    if (text === "Error") return "error"
    if (text.includes("...") || text === "Applying..." || text === "Setting...") return "sync"
    return null
  }

  if (loading) return <div className="p-10 text-on-surface animate-pulse">Loading Network...</div>

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar">

      {/* Header */}
      <div className="w-full flex justify-between items-end flex-none h-14">
        <div>
          <p className="text-on-surface text-3xl font-bold">Network</p>
          <p className="text-on-surface-variant mt-1 text-sm">Interfaces, IP configuration & hostname</p>
        </div>
        <button onClick={load} className="h-10 px-4 rounded-full border border-outline text-on-surface-variant hover:text-primary hover:border-primary flex items-center gap-2 transition-all active:scale-95 text-sm font-bold">
          <span className="material-symbols-outlined text-base">refresh</span>
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Interface list */}
        <div className="bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <SectionHeader icon="device_hub" title="Interfaces" />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {interfaces.length === 0 && (
              <p className="text-on-surface-variant text-sm p-4 text-center">No interfaces found</p>
            )}
            {interfaces.map(iface => (
              <button
                key={iface.interface}
                onClick={() => setSelected(iface.interface)}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all
                  ${selected === iface.interface
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-surface-container-high border border-transparent"}`}
              >
                <span className={`material-symbols-outlined text-xl ${selected === iface.interface ? "text-primary" : "text-on-surface-variant"}`}>
                  {iface.type === "wifi" ? "wifi" : "cable"}
                </span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-mono font-bold text-sm text-on-surface truncate">{iface.interface}</span>
                  <span className="text-xs text-on-surface-variant capitalize">{iface.type || "ethernet"}</span>
                </div>
                <Badge label={iface.state} />
              </button>
            ))}
          </div>
        </div>

        {/* Detail + IP config */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto custom-scrollbar">

          {/* Interface detail */}
          <div className="bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm shrink-0">
            <SectionHeader icon="info" title={selected ? `${selected} — details` : "Select an interface"} />
            <div className="p-6">
              {!detail ? (
                <p className="text-on-surface-variant text-sm">Select an interface to view details.</p>
              ) : (
                <>
                  <Field label="IP address" value={detail.address} mono />
                  <Field label="Prefix length" value={detail.prefix ? `/${detail.prefix}` : null} mono />
                  <Field label="Gateway" value={detail.gateway} mono />
                  <Field label="DNS" value={Array.isArray(detail.dns) ? detail.dns.join(", ") : detail.dns} mono />
                  <Field label="MAC address" value={detail.mac} mono />
                  <Field label="Connection type" value={detail.type} />
                  <Field label="State" value={<Badge label={detail.state} />} />
                </>
              )}
            </div>
          </div>

          {/* IP configuration */}
          <div className="bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm shrink-0">
            <SectionHeader icon="settings_ethernet" title="IP configuration" />
            <div className="p-6 flex flex-col gap-4">
              {/* Method toggle */}
              <div className="flex gap-2">
                {["dhcp", "static"].map(m => (
                  <button
                    key={m}
                    onClick={() => setIpForm(f => ({ ...f, method: m }))}
                    className={`flex-1 h-10 rounded-xl font-bold text-sm uppercase tracking-wide transition-all
                      ${ipForm.method === m
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {ipForm.method === "static" && (
                <div className="flex flex-col gap-3">
                  {[
                    { label: "IP address", key: "address", placeholder: "192.168.1.10" },
                    { label: "Prefix length", key: "prefix", placeholder: "24" },
                    { label: "Gateway", key: "gateway", placeholder: "192.168.1.1" },
                    { label: "DNS servers", key: "dns", placeholder: "1.1.1.1, 8.8.8.8" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="flex items-center gap-4">
                      <label className="text-sm text-on-surface-variant w-32 shrink-0">{label}</label>
                      <input
                        value={ipForm[key]}
                        onChange={e => setIpForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="flex-1 h-10 px-4 bg-surface-container-highest text-on-surface rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm placeholder:text-on-surface-variant/40"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleIp}
                disabled={ipSaving || !selected}
                className={`h-10 px-6 rounded-full font-bold flex items-center justify-center gap-2 transition-all self-end
                  ${ipSaving
                    ? statusText === "Error" ? "bg-error text-on-error" : "bg-primary/80 text-on-primary cursor-wait"
                    : "bg-primary text-on-primary hover:shadow-md active:scale-95"}`}
              >
                {actionIcon(statusText) && (
                  <span className={`material-symbols-outlined text-lg ${statusText.includes("...") ? "animate-spin" : ""}`}>
                    {actionIcon(statusText)}
                  </span>
                )}
                {statusText}
              </button>
            </div>
          </div>

          {/* Hostname */}
          <div className="bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm shrink-0">
            <SectionHeader icon="badge" title="Hostname" />
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-secondary-container/20 px-4 py-3 rounded-xl border border-secondary-container/40">
                <p className="text-sm text-on-surface-variant">
                  <span className="font-bold text-primary">Current: </span>
                  <span className="font-mono">{hostname || "unknown"}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  value={newHostname}
                  onChange={e => setNewHostname(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleHostname()}
                  placeholder="lva-living-room"
                  className="flex-1 h-10 px-4 bg-surface-container-highest text-on-surface rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm placeholder:text-on-surface-variant/40"
                />
                <button
                  onClick={handleHostname}
                  disabled={saving || !newHostname.trim()}
                  className={`h-10 px-5 rounded-full font-bold flex items-center gap-2 transition-all shrink-0
                    ${saving
                      ? hostStatusText === "Error" ? "bg-error text-on-error" : "bg-primary/80 text-on-primary cursor-wait"
                      : "bg-primary text-on-primary hover:shadow-md active:scale-95"}`}
                >
                  {actionIcon(hostStatusText) && (
                    <span className={`material-symbols-outlined text-lg ${hostStatusText.includes("...") ? "animate-spin" : ""}`}>
                      {actionIcon(hostStatusText)}
                    </span>
                  )}
                  {hostStatusText}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Network