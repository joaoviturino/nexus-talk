import React from 'react'
import { FiActivity, FiUsers, FiMessageCircle, FiCpu } from 'react-icons/fi'

export default function Overview(){
  return (
    <>
      <h1>Visão Geral</h1>
      <div className="card-grid">
        <div className="card">
          <div className="card-title"><FiActivity /> Status do Sistema</div>
          <div className="card-body">
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>Online</div>
            <div style={{ opacity: 0.7 }}>Conectado ao WhatsApp</div>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><FiMessageCircle /> Disparos Hoje</div>
          <div className="card-body">
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>0</div>
            <div style={{ opacity: 0.7 }}>Mensagens enviadas</div>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><FiUsers /> Clientes</div>
          <div className="card-body">
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>—</div>
            <div style={{ opacity: 0.7 }}>Total na base</div>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><FiCpu /> IA</div>
          <div className="card-body">
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>Ativa</div>
            <div style={{ opacity: 0.7 }}>Respondendo automaticamente</div>
          </div>
        </div>
      </div>
    </>
  )
}
