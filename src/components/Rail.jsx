import React from 'react'
import { NavLink } from 'react-router-dom'

const NavItem = ({ to, icon, label, expanded }) => {
  return (
    <NavLink to={to} className="w-full">
      {({ isActive }) => (
        <div className={`
          flex items-center w-full cursor-pointer group transition-all duration-300
          ${expanded ? 'px-2 md:px-3 h-12 md:h-14' : 'flex-col justify-center h-14 md:h-16'}
        `}>
          <div className={`
            relative flex items-center transition-all duration-300 ease-in-out
            ${isActive ? 'text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/8'}
            ${expanded
                ? 'w-full h-10 md:h-12 px-4 rounded-full'
                : 'w-10 md:w-14 h-8 justify-center rounded-full'}
          `}>
            <div className={`
              absolute inset-0 rounded-full bg-secondary-container transition-opacity duration-300 z-0
              ${isActive ? 'opacity-100' : 'opacity-0'}
            `} />

            <div className="relative z-10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] md:text-[24px]">
                {icon}
              </span>
            </div>

            {expanded && (
              <span className="relative z-10 ml-4 transition-all duration-300 whitespace-nowrap text-sm font-medium">
                {label}
              </span>
            )}
          </div>

          {!expanded && (
            <span className={`
              mt-1 transition-all duration-300 whitespace-nowrap text-[9px] md:text-[10px] font-medium
              ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}
            `}>
              {label}
            </span>
          )}
        </div>
      )}
    </NavLink>
  )
}

const Rail = ({ expanded, setExpanded, onReboot }) => {
  return (
    <div className={`
      flex flex-col h-full bg-surface-container pt-4 md:pt-10 transition-all duration-300 ease-in-out
      ${expanded ? 'w-64 md:w-80 shadow-xl md:shadow-none z-50 absolute md:relative h-full' : 'w-16 md:w-24 relative'}
    `}>
      <div className="w-full flex justify-center items-center mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full hover:bg-on-surface/8"
        >
          <span className="material-symbols-outlined text-on-surface text-[20px] md:text-[24px]">
            {expanded ? 'menu_open' : 'menu'}
          </span>
        </button>
      </div>

      <nav className="flex flex-col gap-1 md:gap-2">
        <NavItem to="/dashboard" icon="home"          label="Dashboard"     expanded={expanded} />
        <NavItem to="/logs"      icon="list_alt"      label="Logs"          expanded={expanded} />
        <NavItem to="/config"    icon="settings"      label="Configuration" expanded={expanded} />
        <NavItem to="/updates"   icon="system_update" label="Updates"       expanded={expanded} />
        <NavItem to="/network"   icon="network_check" label="Network"       expanded={expanded} />
      </nav>

      {/* Pinned reboot button */}
      <div className="mt-auto pb-4 md:pb-6 flex justify-center px-2">
        <button
          onClick={onReboot}
          className={`
            flex items-center justify-center rounded-full transition-all duration-200
            text-error/40 hover:text-error hover:bg-error/10 active:scale-95
            ${expanded ? 'w-full h-10 md:h-12 px-4 gap-3' : 'w-10 md:w-14 h-10 flex-col gap-0.5'}
          `}
        >
          <span className="material-symbols-outlined text-[20px] md:text-[24px]">restart_alt</span>
          {expanded
            ? <span className="text-sm font-medium">Reboot</span>
            : <span className="text-[9px] md:text-[10px] font-medium">Reboot</span>
          }
        </button>
      </div>
    </div>
  )
}

export default Rail