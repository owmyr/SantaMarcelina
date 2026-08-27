import { Link, useLocation } from 'react-router-dom'
import { getConfig } from '../lib/storage'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { useEffect, useState } from 'react'
import logo from '../assets/santamarcelina.png'

export default function Layout({ children }) {
  const loc = useLocation()
  const config = getConfig()
  const isAdmin = loc.pathname.startsWith('/admin') || loc.pathname.startsWith('/geral')
  const [syncLabel, setSyncLabel] = useState(isSupabaseConfigured ? 'sync: conectando...' : 'sync: local')
  useEffect(()=>{
    const h = (e)=> {
      const s = e.detail?.status || e.detail?.queue ? `pendente ${e.detail.queue}` : e.detail?.status
      if(s) setSyncLabel(`sync: ${s}`)
    }
    window.addEventListener('sm-sync-status', h)
    window.addEventListener('sm-respostas-updated', ()=> setSyncLabel('sync: atualizado'))
    return ()=>{
      window.removeEventListener('sm-sync-status', h)
    }
  }, [])
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Santa Marcelina Colégio São Paulo" className="h-10 w-auto object-contain" />
            <div className="hidden sm:block">
              <div className="font-semibold text-slate-900 leading-none tracking-tight">Santa Marcelina</div>
              <div className="text-xs text-slate-500">{config.trimestre} • {config.ano}</div>
            </div>
            <div className="sm:hidden text-xs text-slate-500">{config.trimestre} • {config.ano}</div>
          </Link>
          <nav className="flex items-center gap-1.5">
            <span className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${isSupabaseConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              {isSupabaseConfigured ? 'Sincronizado' : 'Local'}
            </span>
            <Link to="/" className={`px-3.5 py-2 rounded-full text-sm font-medium transition ${loc.pathname==='/'?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>Início</Link>
            <Link to="/admin" className={`px-3.5 py-2 rounded-full text-sm font-medium transition ${loc.pathname.startsWith('/admin')?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>Coordenação</Link>
            <Link to="/geral" className={`px-3.5 py-2 rounded-full text-sm font-medium transition ${loc.pathname.startsWith('/geral')?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>Geral</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="mt-16 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>Colégio Santa Marcelina • Pré-Conselho</span>
          <span className="hidden sm:inline">Acesso restrito • Suporte coordenação</span>
        </div>
      </footer>
    </div>
  )
}
