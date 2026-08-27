import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTurmas, getComponentes, getAlunos, getConfig, getRespostas } from '../lib/storage'

export default function Home() {
  const [turmas, setTurmas] = useState([])
  const [componentes, setComponentes] = useState([])
  const [alunos, setAlunos] = useState([])
  const [config, setConfig] = useState({ trimestre:'2TRI' })
  const [respostas, setRespostasState] = useState([])

  useEffect(()=>{
    setTurmas(getTurmas())
    setComponentes(getComponentes())
    setAlunos(getAlunos())
    setConfig(getConfig())
    setRespostasState(getRespostas())
  }, [])

  const totalAlunos = alunos.length
  const totalRespostas = respostas.length

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl"></div>
        <div className="relative">
          <h1 className="text-3xl font-bold mb-2">Pré-Conselho — Experiência nova para professores</h1>
          <p className="text-sky-100 max-w-3xl">Substitui a planilha gigante de 22 colunas por um formulário simples: um aluno por vez, com progresso salvo automaticamente. Você na coordenação acompanha tudo em tempo real no painel Geral.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/admin" className="bg-white text-sky-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-sky-50 transition">Área da Coordenação</Link>
            <Link to="/geral" className="bg-sky-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-sky-400 border border-white/20">Ver Dashboard Geral</Link>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 max-w-xl">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3">
              <div className="text-2xl font-bold">{turmas.length}</div>
              <div className="text-xs text-sky-100">Turmas ativas</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3">
              <div className="text-2xl font-bold">{totalAlunos}</div>
              <div className="text-xs text-sky-100">Alunos cadastrados</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3">
              <div className="text-2xl font-bold">{totalRespostas}</div>
              <div className="text-xs text-sky-100">Respostas registradas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-3 text-sky-700">👩‍🏫</div>
          <h3 className="font-semibold text-slate-900">1. Coordenação organiza</h3>
          <p className="text-sm text-slate-500 mt-1">Cadastre turmas, alunos e professores. Cada professor recebe <strong>1 link único</strong> para todas as turmas.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 text-emerald-700">✏️</div>
          <h3 className="font-semibold text-slate-900">2. Professor avalia</h3>
          <p className="text-sm text-slate-500 mt-1">Acesso direto ao hub, navegação por turmas e avaliação com <span className="inline-flex gap-1 align-middle"><span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded text-xs">Sim</span><span className="bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded text-xs">Parcial</span><span className="bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded text-xs">Não</span></span> — sincronizado em tempo real.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-700">📊</div>
          <h3 className="font-semibold text-slate-900">3. Coordenação acompanha</h3>
          <p className="text-sm text-slate-500 mt-1">Painel Geral por turma com visão geral, cores por desempenho e exportação pronta.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 text-sm">1 link por professor ✨ <span className="font-normal text-slate-500 hidden sm:inline">— setup único feito em /admin</span></h2>
          <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium shrink-0">126 → ~21 links</span>
        </div>
        <div className="p-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border-2 border-sky-500 bg-sky-50">
              <div className="text-xs font-bold text-sky-900">✅ Hub por Professor</div>
              <div className="text-[11px] text-sky-700 mt-0.5">1 link agrega todas as turmas dele (ex: GEO → 1A, 2A, 3A por abas)</div>
              <div className="mt-2 bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-600 truncate">/prof/AB12CD-XYZ → Hub GEO • 1A • 2A • 3A</div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-xs font-bold text-slate-900">📦 Agregado por Componente</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Fallback se ainda não cadastrou professores — 1 link por matéria</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {componentes.slice(0,6).map(c=> (
                  <Link key={c} to={`/hub?comp=${encodeURIComponent(c)}&tri=${config.trimestre}&token=${config.senha}`} className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-center hover:border-sky-300 hover:bg-sky-50 truncate">{c}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 hidden sm:inline">{componentes.length} componentes • {turmas.length} turmas • links gerenciados em Coordenação</span>
            <Link to="/admin" className="text-xs bg-slate-900 text-white px-3.5 py-1.5 rounded-xl hover:bg-black ml-auto">Gerenciar professores →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
