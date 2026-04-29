import React from 'react'
import { NavLink } from 'react-router-dom'
import { FiMenu, FiX, FiHome, FiColumns, FiUpload, FiSend, FiGitMerge, FiCpu, FiSettings } from 'react-icons/fi'

export default function Sidebar({ collapsed, onToggle }){
  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-logo-container">
        <img 
          src="/assets/logonexustalk.png" 
          alt="Nexus Talk" 
          className="sidebar-logo"
        />
      </div>
      <div className="brand">
        <button className="toggle-btn" onClick={onToggle} aria-label="Alternar menu">
          {collapsed ? <FiMenu /> : <FiX />}
        </button>
      </div>
      <nav className="menu">
        <NavLink className={({isActive}) => 'menu-item' + (isActive ? ' active' : '')} to="/overview">
          <span className="menu-icon"><FiHome /></span><span className="menu-label">Visão Geral</span>
        </NavLink>
        <NavLink className={({isActive}) => 'menu-item' + (isActive ? ' active' : '')} to="/livechat">
          <span className="menu-icon"><FiColumns /></span><span className="menu-label">Bate-papo ao Vivo</span>
        </NavLink>
        <NavLink className={({isActive}) => 'menu-item' + (isActive ? ' active' : '')} to="/upload">
          <span className="menu-icon"><FiUpload /></span><span className="menu-label">Extração & Upload</span>
        </NavLink>
        <NavLink className={({isActive}) => 'menu-item' + (isActive ? ' active' : '')} to="/disparo">
          <span className="menu-icon"><FiSend /></span><span className="menu-label">Disparo</span>
        </NavLink>
        <NavLink className={({isActive}) => 'menu-item' + (isActive ? ' active' : '')} to="/fluxo">
          <span className="menu-icon"><FiGitMerge /></span><span className="menu-label">Fluxo de Conversas</span>
        </NavLink>
        <NavLink className={({isActive}) => 'menu-item settings' + (isActive ? ' active' : '')} to="/config">
          <span className="menu-icon"><FiSettings /></span><span className="menu-label">Configurações</span>
        </NavLink>
        <NavLink className="menu-item disabled" to="/ia">
          <span className="menu-icon"><FiCpu /></span><span className="menu-label">Programação de IA [Em breve]</span>
        </NavLink>
      </nav>
    </aside>
  )
}
