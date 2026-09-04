import React, { useState, useEffect, useRef } from 'react'

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

// --- WiFi security label/icon helpers -------------------------------------

const SECURITY_LABELS = {
  open: "Open",
  wep: "WEP",
  "wpa-psk": "WPA",
  "wpa2-psk": "WPA2",
  "wpa2-wpa3-personal": "WPA2/WPA3",
  "wpa3-sae": "WPA3",
  "wpa-enterprise": "Enterprise",
  owe: "Enhanced Open",
  unknown: "Secured",
}

const securityLabel = (security) => SECURITY_LABELS[security] || "Secured"

// Enterprise (802.1x/EAP) networks aren't supported by the backend's
// wifi_connect() — no field to collect identity/cert data — so the UI
// disables selecting them rather than letting the user hit a submit error.
const isConnectable = (security) => security !== "wpa-enterprise"

const signalIcon = (strength) => {
  if (strength >= 70) return "wifi"
  if (strength >= 40) return "wifi_2_bar"
  return "wifi_1_bar"
}

// --- WiFi scan/connect modal ------------------------------------------------

const WifiModal = ({ wifiInterface, hostname, onClose, onConnected }) => {
  const [scanning, setScanning] = useState(true)
  const [networks, setNetworks] = useState([])
  const [scanError, setScanError] = useState(null)
  const [selectedAp, setSelectedAp] = useState(null)
  const [password, setPassword] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)
  const [connectStarted, setConnectStarted] = useState(false)

  const runScan = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch(`${API_BASE}/network/wifi/scan?interface=${encodeURIComponent(wifiInterface)}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "Scan failed")
      // De-dupe repeated SSIDs from multiple APs, keep the strongest signal
      const bySsid = new Map()
      for (const ap of Array.isArray(data) ? data : []) {
        if (!ap.ssid) continue
        const existing = bySsid.get(ap.ssid)
        if (!existing || ap.strength > existing.strength) bySsid.set(ap.ssid, ap)
      }
      setNetworks([...bySsid.values()].sort((a, b) => b.strength - a.strength))
    } catch (e) {
      setScanError(e.message || "Could not scan for networks")
      setNetworks([])
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => { runScan() }, [])

  const handleSelect = (ap) => {
    if (!isConnectable(ap.security)) return
    setSelectedAp(ap)
    setPassword("")
    setConnectError(null)
  }

  const handleConnect = async () => {
    if (!selectedAp) return
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch(`${API_BASE}/network/wifi/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interface: wifiInterface,
          ssid: selectedAp.ssid,
          password: selectedAp.security === "open" ? undefined : (password || undefined),
          key_mgmt: selectedAp.key_mgmt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || "Connect failed")
      setConnectStarted(true)
      onConnected?.()
    } catch (e) {
      // If this device is itself served over the WiFi interface being
      // reconfigured, the request may never come back at all — a network
      // error here is expected, not necessarily a failure. Show the
      // reconnect message either way rather than a hard error.
      if (e.message && e.message !== "Failed to fetch") {
        setConnectError(e.message)
      } else {
        setConnectStarted(true)
      }
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] bg-surface-container rounded-3xl border border-outline-variant shadow-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-14 bg-surface-container-high px-6 flex items-center justify-between border-b border-outline-variant/50 shrink-0">
          <div className="flex items-center">
            <span className="material-symbols-outlined text-primary mr-3">wifi</span>
            <p className="text-on-surface font-bold text-lg">Change WiFi</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {connectStarted ? (
          <div className="p-6 flex flex-col gap-4 items-center text-center">
            <span className="material-symbols-outlined text-4xl text-primary">wifi_tethering</span>
            <p className="text-on-surface font-bold">Connecting to {selectedAp?.ssid}…</p>
            <p className="text-on-surface-variant text-sm">
              This may take a few seconds. If you're currently viewing this page over WiFi,
              this session may disconnect during the switch.
            </p>
            <p className="text-on-surface-variant text-sm">
              If it does, reconnect at{" "}
              <span className="font-mono text-primary">http://{hostname || "lva"}.local:8000</span>
            </p>
            <button
              onClick={onClose}
              className="mt-2 h-10 px-6 rounded-full font-bold bg-primary text-on-primary hover:shadow-md active:scale-95"
            >
              Close
            </button>
          </div>
        ) : selectedAp ? (
          <div className="p-6 flex flex-col gap-4">
            <button
              onClick={() => setSelectedAp(null)}
              className="self-start flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to networks
            </button>

            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-highest border border-outline-variant/50">
              <span className="material-symbols-outlined text-primary">{signalIcon(selectedAp.strength)}</span>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-on-surface truncate">{selectedAp.ssid}</span>
                <span className="text-xs text-on-surface-variant">{securityLabel(selectedAp.security)}</span>
              </div>
            </div>

            {selectedAp.security !== "open" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm text-on-surface-variant">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleConnect()}
                  placeholder="Network password"
                  autoFocus
                  className="h-10 px-4 bg-surface-container-highest text-on-surface rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono text-sm placeholder:text-on-surface-variant/40"
                />
              </div>
            )}

            <div className="bg-secondary-container/20 px-4 py-3 rounded-xl border border-secondary-container/40">
              <p className="text-xs text-on-surface-variant">
                If you're viewing this page over WiFi, switching networks may drop this
                session. You can reconnect at{" "}
                <span className="font-mono text-primary">http://{hostname || "lva"}.local:8000</span> once
                the new connection is up.
              </p>
            </div>

            {connectError && (
              <p className="text-sm text-error">{connectError}</p>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || (selectedAp.security !== "open" && !password)}
              className={`h-10 px-6 rounded-full font-bold flex items-center justify-center gap-2 self-end transition-all
                ${connecting
                  ? "bg-primary/80 text-on-primary cursor-wait"
                  : "bg-primary text-on-primary hover:shadow-md active:scale-95 disabled:opacity-50"}`}
            >
              {connecting && <span className="material-symbols-outlined text-lg animate-spin">sync</span>}
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            <div className="flex justify-end px-2 pt-1">
              <button
                onClick={runScan}
                disabled={scanning}
                className="text-xs font-bold text-primary flex items-center gap-1 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${scanning ? "animate-spin" : ""}`}>refresh</span>
                Rescan
              </button>
            </div>

            {scanning && (
              <p className="text-on-surface-variant text-sm p-4 text-center">Scanning for networks…</p>
            )}
            {!scanning && scanError && (
              <p className="text-error text-sm p-4 text-center">{scanError}</p>
            )}
            {!scanning && !scanError && networks.length === 0 && (
              <p className="text-on-surface-variant text-sm p-4 text-center">No networks found</p>
            )}

            {!scanning && networks.map(ap => {
              const connectable = isConnectable(ap.security)
              return (
                <button
                  key={ap.bssid || ap.ssid}
                  onClick={() => handleSelect(ap)}
                  disabled={!connectable}
                  className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-3 transition-all border border-transparent
                    ${connectable ? "hover:bg-surface-container-high" : "opacity-50 cursor-not-allowed"}`}
                >
                  <span className="material-symbols-outlined text-xl text-on-surface-variant">
                    {signalIcon(ap.strength)}
                  </span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold text-sm text-on-surface truncate">{ap.ssid}</span>
                    <span className="text-xs text-on-surface-variant">
                      {securityLabel(ap.security)}{!connectable ? " — not supported" : ""}
                    </span>
                  </div>
                  {ap.security !== "open" && (
                    <span className="material-symbols-outlined text-base text-on-surface-variant">lock</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const Network = () => {
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState([])
  const [selected, setSelected] = useState(null)
  const [hostname, setHostname] = useState("")
  const [newHostname, setNewHostname] = useState("")
  const [ipForm, setIpForm] = useState({ method: "dhcp", address: "", prefix: "24", gateway: "", dns: "1.1.1.1, 8.8.8.8" })
  const [saving, setSaving] = useState(false)
  const [ipSaving, setIpSaving] = useState(false)
  const [statusText, setStatusText] = useState("Apply")
  const [hostStatusText, setHostStatusText] = useState("Set")
  const [wifiModalOpen, setWifiModalOpen] = useState(false)

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/network/info`)
      const data = await res.json()
      const list = data.devices || []
      setDevices(list)
      if (data.hostname) setHostname(data.hostname)
      setSelected(prev => {
        if (prev && list.some(d => d.interface === prev)) return prev
        return list.length > 0 ? list[0].interface : null
      })
    } catch (e) {
      console.error("Failed to load network info:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derived, not fetched — the backend already sends address/prefix/
  // gateway/dns/mac flattened onto each device, so no second request
  // or nested found.ip4.* lookup is needed here.
  const detail = devices.find(d => d.interface === selected) || null
  const wifiDevice = devices.find(d => d.type === "wifi") || null

  // Keep the IP config form scoped to whichever interface is actually
  // selected. Previously ipForm was one shared piece of state that never
  // reset on interface change, so switching from eth0 to wlan0 kept
  // showing (and could submit) eth0's last-edited values against wlan0.
  // Note: the backend doesn't currently report whether an interface's
  // current address came from DHCP or a static assignment, so this always
  // resets the method to "dhcp" on interface change — it prefills the
  // address/prefix/gateway/dns fields from that interface's live state,
  // but can't know to pre-select "static" for an interface that's actually
  // statically configured. Worth adding a "method" field to the supervisor's
  // device info if that distinction becomes important in the UI.
  const prevSelected = useRef(null)
  useEffect(() => {
    if (selected && selected !== prevSelected.current) {
      prevSelected.current = selected
      const d = devices.find(dev => dev.interface === selected)
      setIpForm({
        method: "dhcp",
        address: d?.address || "",
        prefix: d?.prefix ? String(d.prefix) : "24",
        gateway: d?.gateway || "",
        dns: Array.isArray(d?.dns) && d.dns.length ? d.dns.join(", ") : "1.1.1.1, 8.8.8.8",
      })
    }
  }, [selected, devices])

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
      await load()
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

      {/* Change WiFi — full-width row */}
      {wifiDevice && (
        <button
          onClick={() => setWifiModalOpen(true)}
          className="w-full bg-surface-container rounded-3xl border border-outline-variant flex items-center gap-4 px-6 py-4 shadow-sm hover:border-primary/40 transition-all active:scale-[0.99] shrink-0"
        >
          <span className="material-symbols-outlined text-2xl text-primary">wifi</span>
          <div className="flex flex-col flex-1 min-w-0 text-left">
            <span className="font-bold text-on-surface">Change WiFi</span>
            <span className="text-xs text-on-surface-variant">
              {wifiDevice.state === "activated" ? "Connected" : "Not connected"} · {wifiDevice.interface}
            </span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </button>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Interface list */}
        <div className="bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <SectionHeader icon="device_hub" title="Interfaces" />
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {devices.length === 0 && (
              <p className="text-on-surface-variant text-sm p-4 text-center">No interfaces found</p>
            )}
            {devices.map(iface => (
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

      {wifiModalOpen && wifiDevice && (
        <WifiModal
          wifiInterface={wifiDevice.interface}
          hostname={hostname}
          onClose={() => setWifiModalOpen(false)}
          onConnected={() => {
            // Don't auto-refresh /network/info immediately — if this session
            // is riding the interface being reconfigured, the request may
            // hang until the switch settles or fail outright. Let the user
            // close the modal and hit the manual Refresh button once things
            // have stabilized.
          }}
        />
      )}
    </div>
  )
}

export default Network