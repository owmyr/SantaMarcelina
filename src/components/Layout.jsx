import { Link, useLocation } from 'react-router-dom'
import { getConfig } from '../lib/storage'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { useEffect, useState } from 'react'

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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-sm">SM</div>
            <div>
              <div className="font-semibold text-slate-900 leading-none">Santa Marcelina</div>
              <div className="text-xs text-slate-500">Pré-Conselho • {config.ano} • {config.trimestre}</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium ${isSupabaseConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`} title={isSupabaseConfigured ? 'Supabase configurado — sync tempo real' : 'Sem backend — sync entre abas via BroadcastChannel (mantém token=)'}>
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              {isSupabaseConfigured ? 'Supabase' : 'Local'}
              <span className="hidden lg:inline">• {syncLabel}</span>
            </span>
            <Link to="/" className={`px-3 py-2 rounded-lg text-sm font-medium ${loc.pathname==='/'?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>Início</Link>
            <Link to="/admin" className={`px-3 py-2 rounded-lg text-sm font-medium ${loc.pathname.startsWith('/admin')?'bg-slate-900 text-white':'text-slate-600 hover:bg-slate-100'}`}>Coordenação</Link>
            <Link to="/geral" className={`px-3 py-2 rounded-lg text-sm font-medium ${loc.pathname.startsWith('/geral')?'bg-sky-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>Geral</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-slate-400">
          Colégio Santa Marcelina • Sistema Pré-Conselho • Suporte coordenação
        </div>
      </footer>
    </div>
  )
}
