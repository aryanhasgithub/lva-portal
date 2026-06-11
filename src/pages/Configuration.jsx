import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV ? "http://localhost:8000/api" : "/api"

// --- COMPONENTS ---
const Toggle = ({ value, onChange }) => {
  const isChecked = value === "1" || value === 1 || value === true
  return (
    <button 
      onClick={() => onChange(isChecked ? "0" : "1")}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ease-in-out shrink-0
        ${isChecked ? 'bg-primary' : 'bg-surface-container-highest border border-outline'}`}
    >
      <div className={`w-4 h-4 rounded-full shadow-sm absolute top-1 transition-all duration-300
        ${isChecked ? 'bg-on-primary left-7' : 'bg-outline left-1'}`} 
      />
    </button>
  )
}

const Range = ({ value, min, max, onChange }) => (
  <div className="flex items-center gap-3 w-full">
    <input
      type="range" min={min} max={max} value={value || min}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
    />
    <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/50">
        <span className="font-mono text-xs font-bold text-primary">{value}</span>
    </div>
  </div>
)

const Select = ({ value, options, onChange }) => (
  <div className="relative w-full">
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 pl-4 pr-10 bg-surface-container-highest text-on-surface rounded-lg border-r-8 border-transparent outline-none focus:ring-2 focus:ring-primary cursor-pointer appearance-none text-sm font-medium truncate"
    >
      {options && options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none material-symbols-outlined text-on-surface-variant text-lg">expand_more</span>
  </div>
)

const Input = ({ type, value, onChange }) => (
  <input
    type={type === 'number' ? 'number' : 'text'} value={value || ""} 
    onChange={(e) => onChange(e.target.value)}
    className="w-full h-10 px-4 bg-surface-container-highest text-on-surface rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all font-medium placeholder:text-on-surface-variant/50 font-mono text-sm"
  />
)

const ConfigSection = ({ fields, data, onChange }) => (
  <div className="flex flex-col gap-6">
    {fields && fields.map((field) => (
      <div key={field.key} className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-4 last:border-0 last:pb-0">
        <div className="flex flex-col max-w-[50%]">
          <label className="text-on-surface font-medium text-sm truncate" title={field.label}>{field.label}</label>
          <span className="text-primary font-mono text-[10px] opacity-80 wrap-break-word">{field.key}</span>
        </div>
        <div className={`${field.type === 'range' ? 'w-52' : 'w-48'} shrink-0 flex justify-end`}>
          {field.type === 'bool' && <Toggle value={data[field.key]} onChange={(val) => onChange(field.key, val)} />}
          {field.type === 'range' && <Range value={data[field.key]} min={field.min} max={field.max} onChange={(val) => onChange(field.key, val)} />}
          {field.type === 'list' && <Select value={data[field.key]} options={field.options || []} onChange={(val) => onChange(field.key, val)} />}
          {(field.type === 'string' || field.type === 'number') && <Input type={field.type} value={data[field.key]} onChange={(val) => onChange(field.key, val)} />}
        </div>
      </div>
    ))}
  </div>
)

const Config = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusText, setStatusText] = useState("Save")
  const [formData, setFormData] = useState({})
  const [schemas, setSchemas] = useState({ general: [], audio: [] })

  // --- LOAD DATA ---
  const loadConfigData = async () => {
    try {
      const response = await fetch(`${API_BASE}/config/schema`)
      const schemaData = await response.json()
      setSchemas(schemaData)
      const initialData = {}
      if (schemaData.general) schemaData.general.forEach(f => initialData[f.key] = f.default)
      if (schemaData.audio) schemaData.audio.forEach(f => initialData[f.key] = f.default)
      setFormData(initialData)
      return true
    } catch (error) {
      console.error("Failed to load config:", error)
      return false
    }
  }

  useEffect(() => { loadConfigData().then(() => setLoading(false)) }, [])

  const handleChange = (key, value) => { setFormData(prev => ({ ...prev, [key]: value })) }

  // --- SAVE -> RESTART -> RELOAD FLOW ---
  const handleSave = async () => {
    setSaving(true)
    setStatusText("Saving...")
    try {
      // 1. Write .env
      const saveRes = await fetch(`${API_BASE}/config/save`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData)
      })
      if (!saveRes.ok) throw new Error("Write failed")

      // 2. Restart Service
      setStatusText("Restarting LVA...")
      await fetch(`${API_BASE}/service/restart?service=lva`, { method: "POST" })

      // 3. Reload Config to verify
      setStatusText("Syncing...")
      await loadConfigData()

      setStatusText("Done!")
      setTimeout(() => { setSaving(false); setStatusText("Save") }, 1500)
    } catch (error) {
      console.error("Sequence failed:", error)
      setStatusText("Error")
      setTimeout(() => { setSaving(false); setStatusText("Save") }, 2000)
    }
  }

  // --- SYSTEM POWER ---
  const handlePower = async (action) => {
    if(!window.confirm(`Are you sure you want to ${action} the system?`)) return;
    try {
        await fetch(`${API_BASE}/system/${action}`, { method: "POST" })
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="p-10 text-on-surface animate-pulse">Loading Configuration...</div>

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-6 overflow-hidden">
      <div className="w-full flex justify-between items-end flex-none h-14">
        <div>
            <p className="text-on-surface text-3xl font-bold">Configuration</p>
            <p className="text-on-surface-variant mt-1 text-sm">System parameters & Environment variables</p>
        </div>
        <button onClick={handleSave} disabled={saving} className={`h-10 px-6 rounded-full font-bold shadow-md flex items-center gap-2 transition-all ${saving ? (statusText==="Error"?'bg-error text-on-error':'bg-primary/80 text-on-primary cursor-wait') : 'bg-primary text-on-primary hover:shadow-lg active:scale-95'}`}>
            <span className={`material-symbols-outlined text-lg ${saving && statusText !== "Done!" && statusText !== "Error" ? 'animate-spin' : ''}`}>
                {statusText === "Done!" ? 'check' : statusText === "Error" ? 'error' : saving ? 'sync' : 'save'}
            </span>
            {statusText}
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 grid-rows-1 lg:grid-rows-3 gap-6">
        <div className="lg:row-span-3 bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="h-16 bg-surface-container-high px-6 flex items-center border-b border-outline-variant/50 shrink-0">
            <span className="material-symbols-outlined text-primary mr-3">tune</span>
            <p className="text-on-surface font-bold text-lg">General Settings</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
             <ConfigSection fields={schemas.general} data={formData} onChange={handleChange} />
          </div>
        </div>
        <div className="lg:row-span-1 bg-surface-container-low rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="h-12 bg-error-container/30 px-6 flex items-center border-b border-outline-variant/50 shrink-0 justify-between">
             <div className="flex items-center"><span className="material-symbols-outlined text-error mr-3">power_settings_new</span><p className="text-on-surface font-bold text-lg">System Power</p></div>
             <span className="text-xs font-mono text-error uppercase tracking-wider">Danger Zone</span>
          </div>
          <div className="flex-1 p-6 flex items-center justify-center gap-4">
             <button onClick={() => handlePower('reboot')} className="flex-1 h-16 bg-surface-container-highest hover:bg-primary/10 border border-outline rounded-2xl flex flex-col items-center justify-center group transition-all active:scale-95">
                <span className="material-symbols-outlined text-3xl text-on-surface mb-1 group-hover:text-primary transition-colors">restart_alt</span>
                <span className="text-xs font-bold text-on-surface-variant">REBOOT</span>
             </button>
          </div>
        </div>
        <div className="lg:row-span-2 bg-surface-container rounded-3xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
          <div className="h-16 bg-surface-container-high px-6 flex items-center border-b border-outline-variant/50 shrink-0">
            <span className="material-symbols-outlined text-primary mr-3">graphic_eq</span>
            <p className="text-on-surface font-bold text-lg">Audio Hardware</p>
          </div>
          <div className="flex-1 p-6 flex flex-col justify-start gap-2 overflow-y-auto">
             <div className="bg-secondary-container/20 p-4 rounded-xl border border-secondary-container/40 mb-4">
                <p className="text-sm text-on-surface-variant leading-relaxed"><span className="font-bold text-primary">Note:</span> Changing audio devices requires a service restart to take effect.</p>
             </div>
             <ConfigSection fields={schemas.audio} data={formData} onChange={handleChange} />
          </div>
        </div>
      </div>
    </div>
  )
}
export default Config
