import React from 'react'
import { FiCpu, FiSettings, FiSliders, FiMessageSquare, FiUploadCloud } from 'react-icons/fi'

export default function IA(){
  return (
    <>
      <h1>Inteligência Artificial</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '1rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '3rem', textAlign: 'center', minHeight: 400 }}>
          <div style={{ fontSize: '4rem', color: '#60a5fa', marginBottom: '1.5rem', background: 'rgba(96, 165, 250, 0.1)', padding: '2rem', borderRadius: '50%' }}>
            <FiCpu />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Nexus AI</h2>
          <p style={{ opacity: 0.7, maxWidth: 400, marginBottom: '2rem', lineHeight: 1.6 }}>
            Seu assistente inteligente está ativo e aprendendo. Configure as respostas automáticas e a personalidade do bot para atender melhor seus clientes.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary"><FiSettings /> Configurar</button>
            <button className="btn btn-outline"><FiMessageSquare /> Testar Chat</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           <div className="card">
             <div className="card-title"><FiSliders /> Parâmetros Básicos</div>
             <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Personalidade</label>
                <select className="select">
                  <option>Profissional e Objetivo</option>
                  <option>Amigável e Descontraído</option>
                  <option>Vendedor Agressivo</option>
                </select>
             </div>
             <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Criatividade (Temperatura)</label>
                <input type="range" min="0" max="100" className="input" style={{ padding: 0, height: 40 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.7, marginTop: '-5px' }}>
                  <span>Preciso</span>
                  <span>Criativo</span>
                </div>
             </div>
           </div>
           
           <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <div className="card-title"><FiUploadCloud /> Base de Conhecimento</div>
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius)', textAlign: 'center', background: 'var(--bg)', cursor: 'pointer', transition: 'all 0.2s' }}>
               <FiUploadCloud style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '1rem' }} />
               <p style={{ opacity: 0.7 }}>Arraste arquivos PDF ou TXT aqui<br/>para treinar sua IA</p>
             </div>
           </div>
        </div>
      </div>
    </>
  )
}
