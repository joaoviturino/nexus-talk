import React, { useState } from 'react'
import { FiPlus, FiMoreHorizontal, FiCalendar, FiUser, FiMoreVertical } from 'react-icons/fi'

export default function Kanban(){
  const [cols, setCols] = useState([
    { id: 'todo', title: 'Novos Leads', items: [{ id: 1, title: 'Contato Inicial', tag: 'Novo', color: '#3b82f6' }] },
    { id: 'progress', title: 'Em Negociação', items: [{ id: 2, title: 'Aguardando Proposta', tag: 'Quente', color: '#f59e0b' }] },
    { id: 'done', title: 'Fechado', items: [{ id: 3, title: 'Venda Concluída', tag: 'Sucesso', color: '#10b981' }] }
  ])

  return (
    <>
      <h1>CRM / Kanban</h1>
      <div className="kanban" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
        {cols.map(col => (
          <div key={col.id} className="kan-col" style={{ background: 'var(--card-bg)', minWidth: 280, width: 280, padding: '0.8rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
            <div className="kan-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                {col.title}
                <span className="badge" style={{ fontSize: '0.75rem' }}>{col.items.length}</span>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon"><FiMoreHorizontal /></button>
            </div>
            <div className="kan-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {col.items.map(item => (
                <div key={item.id} className="kan-card" style={{ background: 'var(--bg)', padding: '0.8rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                  <div className="kan-card-tags" style={{ marginBottom: '0.5rem' }}>
                     <span className="badge" style={{ background: item.color + '20', color: item.color, fontSize: '0.7rem' }}>{item.tag}</span>
                  </div>
                  <div className="kan-card-title" style={{ fontWeight: 500, marginBottom: '0.8rem' }}>{item.title}</div>
                  <div className="kan-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                     <div style={{ display: 'flex', gap: '0.5rem' }}>
                       <FiUser />
                       <FiCalendar />
                     </div>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ccc' }}></div>
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-secondary)' }}><FiPlus /> Adicionar Card</button>
            </div>
          </div>
        ))}
        <div className="kan-col add-col" style={{ minWidth: 280 }}>
           <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }}><FiPlus /> Nova Coluna</button>
        </div>
      </div>
    </>
  )
}
