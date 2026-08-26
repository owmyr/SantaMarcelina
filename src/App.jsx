import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
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
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'conectando...' : 'local (sem backend)')
  useEffect(()=>{
    initStorage()
    if(getAlunos().length===0){
      seedMockDataCompleto({ comAmostra: true })
    } else if(getProfessores().length===0){
      seedMockDataCompleto({ comAmostra: false })
    }
    // Hydrate do Supabase se configurado (mantém token= na URL)
    let unsub
    if(isSupabaseConfigured){
      setSyncStatus('sincronizando...')
      fetchAllFromSupabase().then(data=>{
        if(data){
          if(data.alunos?.length) bulkSetAlunosFromRemote(data.alunos)
          if(data.professores?.length) bulkSetProfessoresFromRemote(data.professores)
          if(data.respostas?.length) bulkSetRespostasFromRemote(data.respostas)
          setSyncStatus(`sincronizado • ${data.respostas?.length||0} fichas`)
        } else {
          setSyncStatus('local (erro hydrate)')
        }
      })
      unsub = subscribeRespostas((entry)=>{
        // realtime: entry já aplicado via supabase.js -> bulk, aqui apenas força refresh via evento
        window.dispatchEvent(new CustomEvent('sm-respostas-updated'))
        setSyncStatus('atualizado ao vivo')
      })
      const statusHandler = (e)=> setSyncStatus(e.detail.status)
      window.addEventListener('sm-sync-status', statusHandler)
      return ()=>{
        if(unsub) unsub()
        window.removeEventListener('sm-sync-status', statusHandler)
      }
    } else {
      // fallback: escuta BroadcastChannel para sync entre abas
      const bcHandler = ()=> setSyncStatus('local • sync entre abas ativo')
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
