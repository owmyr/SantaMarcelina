import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { initStorage, getAlunos, getProfessores, bulkSetRespostasFromRemote, bulkSetAlunosFromRemote, bulkSetProfessoresFromRemote } from './lib/storage'
import { seedMockDataCompleto } from './lib/mockData.js'
import { isSupabaseConfigured, fetchAllFromSupabase, subscribeRespostas } from './lib/supabase.js'
import Layout from './components/Layout'
import Home from './pages/Home'
import Admin from './pages/Admin'
import Professor from './pages/Professor'
import ProfessorHub from './pages/ProfessorHub'
import Geral from './pages/Geral'

export default function App(){
  useEffect(()=>{
    initStorage()
    // Apenas gera mock data automaticamente em modo local offline (sem backend Supabase)
    if(!isSupabaseConfigured){
      if(getAlunos().length===0){
        seedMockDataCompleto({ comAmostra: true })
      } else if(getProfessores().length===0){
        seedMockDataCompleto({ comAmostra: false })
      }
    }

    const notifySync = (status) => {
      try {
        window.dispatchEvent(new CustomEvent('sm-sync-status', { detail: { status } }))
      } catch {}
    }

    // Hydrate do Supabase se configurado (mantém token= na URL)
    let unsub
    if(isSupabaseConfigured){
      notifySync('sincronizando...')
      fetchAllFromSupabase().then(data=>{
        if(data){
          if(data.alunos?.length) bulkSetAlunosFromRemote(data.alunos)
          if(data.professores?.length) bulkSetProfessoresFromRemote(data.professores)
          if(data.respostas?.length) bulkSetRespostasFromRemote(data.respostas)
          notifySync(`sincronizado • ${data.respostas?.length||0} fichas`)
        } else {
          notifySync('local (erro hydrate)')
        }
      })
      unsub = subscribeRespostas(()=>{
        // realtime: entry já aplicado via supabase.js -> bulk, aqui apenas força refresh via evento
        window.dispatchEvent(new CustomEvent('sm-respostas-updated'))
        notifySync('atualizado ao vivo')
      })
      return ()=>{
        if(unsub) unsub()
      }
    } else {
      // fallback: escuta BroadcastChannel para sync entre abas
      const bcHandler = ()=> notifySync('local • sync entre abas ativo')
      window.addEventListener('sm-respostas-updated', bcHandler)
      return ()=> window.removeEventListener('sm-respostas-updated', bcHandler)
    }
  }, [])
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/geral" element={<Geral />} />
          <Route path="/p" element={<Professor />} />
          <Route path="/prof/:token" element={<ProfessorHub />} />
          <Route path="/prof" element={<ProfessorHub />} />
          <Route path="/hub" element={<ProfessorHub />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
