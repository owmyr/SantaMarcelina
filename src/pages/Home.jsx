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
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">👩‍🏫</div>
          <h3 className="font-semibold text-slate-900">1. Coordenação cadastra</h3>
          <p className="text-sm text-slate-500 mt-1">Importe alunos via CSV. Crie <strong>1 professor = 1 link</strong> para TODAS as turmas dele. Ou gere 21 links agregados por componente.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">✏️</div>
          <h3 className="font-semibold text-slate-900">2. Professor com 1 link</h3>
          <p className="text-sm text-slate-500 mt-1">Abre 1 único link, alterna turmas por abas no topo. Avalia com <span className="inline-flex gap-1"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs">Sim</span><span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs">Parcial</span><span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs">Não</span></span> + observações 280 chars.</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mb-3">📊</div>
          <h3 className="font-semibold text-slate-900">3. Geral organizado</h3>
          <p className="text-sm text-slate-500 mt-1">Matriz aluno×componente com filtros, cores por gravidade e export GERAL.csv pronto para conselho.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Novidade: 1 link por professor ✨</h2>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">Antes: 126 links → Agora: ~21 links</span>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-sky-500 bg-sky-50">
              <div className="text-sm font-bold text-sky-900">✅ Recomendado: Hub por Professor</div>
              <div className="text-xs text-sky-700 mt-1">Prof. de GEO recebe 1 link e vê 1A, 2A, 3A por abas. Exemplo:</div>
              <div className="mt-2 bg-white border border-sky-200 rounded-xl p-3 font-mono text-xs text-slate-600 truncate">/prof/AB12CD-XYZ → Hub GEO • 1A • 2A • 3A</div>
              <Link to="/admin" className="mt-3 inline-block text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg">Criar professores →</Link>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-sm font-bold text-slate-900">📦 Alternativa: Agregado por Componente</div>
              <div className="text-xs text-slate-500 mt-1">Se ainda não cadastrou professores, use 1 link por matéria cobrindo todas as turmas:</div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {componentes.slice(0,6).map(c=> (
                  <Link key={c} to={`/hub?comp=${encodeURIComponent(c)}&tri=${config.trimestre}&token=${config.senha}`} className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center hover:border-sky-300 hover:bg-sky-50 truncate">{c}</Link>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">{componentes.length} componentes • {turmas.length} turmas cada</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
            <span className="text-amber-600">⚠️</span>
            <div className="text-xs text-amber-800"><strong>Campos agora Sim/Não/Parcial:</strong> Em vez de “X” genérico, o professor avalia cada item com Sim (adequado, verde), Parcial (em desenvolvimento, amarelo) ou Não (atenção, vermelho). Legados como “BAIXO/REGULAR” são convertidos automaticamente.</div>
          </div>
          <div className="mt-4 text-center">
            <Link to="/admin" className="text-sm text-sky-600 hover:text-sky-700 font-medium">Gerenciar professores e links →</Link>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <span className="text-xl">💡</span>
        <div className="text-sm text-amber-900">
          <strong>Dica para 28/09:</strong> Mesmo sem backend, o fluxo já funciona: professor preenche e clica em “Exportar”. Ele te envia o arquivo de volta pelo Teams e você importa em Geral. Na Fase 2 isso será automático em tempo real.
        </div>
      </div>
    </div>
  )
}
