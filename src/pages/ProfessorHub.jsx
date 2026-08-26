import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getAlunosByTurma, getAlunos, getTurmas, getConfig, getResposta, upsertResposta, getProfessorByToken, classifyValor } from '../lib/storage'
import { exportToCSV, exportToXLSX } from '../lib/csv'

const CAMPOS = {
  desempenho: [
    { key: 'aproveitamento', label: 'Aproveitamento da disciplina', hint: 'Rendimento geral' },
    { key: 'participacao', label: 'Participação em sala', hint: 'Participa e interage?' },
    { key: 'cumprimento', label: 'Cumprimento dos prazos', hint: 'Entrega em dia?' },
    { key: 'progresso', label: 'Progresso em relação a si mesmo', hint: 'Evoluiu no trimestre?' },
    { key: 'colaboracao', label: 'Colaboração em grupo', hint: 'Trabalha bem em equipe?' },
    { key: 'proatividade', label: 'Proatividade', hint: 'Toma iniciativa?' },
    { key: 'concentracao', label: 'Concentração em sala', hint: 'Mantém foco?' },
  ],
  pedagogico: [
    { key: 'necessidade', label: 'Necessidade de intervenção pedagógica', hint: 'Precisa de apoio extra?' },
    { key: 'respostasPositivas', label: 'Respostas positivas às intervenções', hint: 'Respondeu bem?' },
  ],
  comportamentoAcoes: [
    { key: 'conversei', label: 'Conversei particularmente' },
    { key: 'disciplinar', label: 'Encaminhei p/ Orient. Disciplinar' },
    { key: 'educacional', label: 'Encaminhei p/ Orient. Educacional' },
    { key: 'comunicado', label: 'Dei comunicado' },
    { key: 'tirei', label: 'Tirei de sala' },
    { key: 'naoIntervim', label: 'Não realizei intervenção' },
  ]
}

const OPCOES_SEGMENTED = [
  { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
  { value: 'SIM', label: 'Sim', desc: 'Adequado', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
  { value: 'PARCIAL', label: 'Parcial', desc: 'Em desenvolvimento', cls: 'bg-amber-400 text-white border-amber-400 shadow' },
  { value: 'NÃO', label: 'Não', desc: 'Atenção', cls: 'bg-red-500 text-white border-red-500 shadow' },
]
const OPCOES_BINARIO_NEGATIVA = [
  { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
  { value: 'SIM', label: 'Sim', desc: 'Precisa de apoio', cls: 'bg-red-500 text-white border-red-500 shadow' },
  { value: 'NÃO', label: 'Não', desc: 'Sem necessidade', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
]
const OPCOES_BINARIO_POSITIVA = [
  { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
  { value: 'SIM', label: 'Sim', desc: 'Respondeu bem', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
  { value: 'NÃO', label: 'Não', desc: 'Sem resposta positiva', cls: 'bg-red-500 text-white border-red-500 shadow' },
]

function normalizeSegmentValue(v){
  if(!v || String(v).trim()==='') return ''
  const c = classifyValor(v)
  if(c==='sim') return 'SIM'
  if(c==='parcial') return 'PARCIAL'
  if(c==='nao') return 'NÃO'
  if(String(v).trim().toUpperCase()==='X') return 'SIM'
  return String(v).trim().toUpperCase()
}

function SegmentedField({ label, hint, value, onChange }) {
  const norm = normalizeSegmentValue(value)
  const isCustomLegacy = value && norm!==String(value).trim().toUpperCase() && !['SIM','NÃO','PARCIAL',''].includes(String(value).trim().toUpperCase())
  return (
    <div className={`p-3 rounded-xl border-2 transition ${norm ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="text-sm font-medium text-slate-800">{label}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
          {isCustomLegacy && <div className="text-[11px] text-amber-700 mt-1">Legado: <span className="font-mono bg-amber-100 px-1 rounded">{value}</span> → {norm}</div>}
        </div>
        {norm && <span className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${norm==='SIM'?'bg-emerald-100 text-emerald-700': norm==='PARCIAL'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{norm}</span>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {OPCOES_SEGMENTED.map(op=>{
          const active = norm===op.value
          return (
            <button key={op.value} type="button" onClick={()=>onChange(op.value)} className={`px-2 py-2 rounded-xl border-2 text-xs font-semibold transition flex flex-col items-center gap-0.5 ${active ? op.cls : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span>{op.label}</span><span className={`text-[10px] leading-none ${active ? 'text-white/90' : 'text-slate-400'}`}>{op.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BinaryField({ label, hint, value, onChange, polarity='positive' }) {
  // polarity: 'positive' = SIM verde, NÃO vermelho; 'negative' = SIM vermelho, NÃO verde
  const opcoes = polarity==='negative' ? OPCOES_BINARIO_NEGATIVA : OPCOES_BINARIO_POSITIVA
  const norm = normalizeSegmentValue(value)
  // for binary, PARCIAL should not be allowed; if legacy PARCIAL exists, map to SIM? but user says no parcial option, so we force only SIM/NÃO
  const activeValue = (norm==='PARCIAL' ? 'SIM' : norm) // fallback
  const isCustomLegacy = value && !['SIM','NÃO',''].includes(String(value).trim().toUpperCase()) && norm!==String(value).trim().toUpperCase()
  return (
    <div className={`p-3 rounded-xl border-2 transition ${activeValue ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="text-sm font-medium text-slate-800">{label}</div>
          {hint && <div className="text-xs text-slate-500">{hint}</div>}
          {isCustomLegacy && <div className="text-[11px] text-amber-700 mt-1">Legado: <span className="font-mono bg-amber-100 px-1 rounded">{value}</span> → {activeValue}</div>}
        </div>
        {activeValue && <span className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${activeValue==='SIM' ? (polarity==='negative' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700') : (polarity==='negative' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}`}>{activeValue}</span>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {opcoes.map(op=>{
          const active = activeValue===op.value
          return (
            <button key={op.value} type="button" onClick={()=>onChange(op.value)} className={`px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition flex flex-col items-center gap-0.5 ${active ? op.cls : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span>{op.label}</span><span className={`text-[10px] leading-none ${active ? 'text-white/90' : 'text-slate-400'}`}>{op.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CheckBox({ label, checked, onChange }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${checked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-amber-600" />
      <span className={`text-sm font-medium ${checked?'text-amber-900':'text-slate-700'}`}>{label}</span>
      {checked && <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">X</span>}
    </label>
  )
}

export default function ProfessorHub(){
  const { token: tokenParam } = useParams()
  const [search] = useSearchParams()
  const token = tokenParam || search.get('token') || search.get('prof') || ''
  const [prof, setProf] = useState(null)
  const config = getConfig()
  const trimestre = search.get('tri') || config.trimestre

  useEffect(()=>{
    if(token){
      const p = getProfessorByToken(token)
      if(p){
        setProf(p)
      } else {
        // virtual hub: /hub?comp=GEO&token=santa2026 or /prof/<senha>?comp=...
        const comp = search.get('comp')
        if(comp && token===config.senha){
          const turmas = getTurmas().map(t=>t.nome)
          setProf({ id:'virtual', nome: `Hub ${comp}`, componente: comp.toUpperCase(), turmas, token, virtual:true })
        } else {
          setProf(null)
        }
      }
    }
  }, [token, search])

  const [turmaAtiva, setTurmaAtiva] = useState('')
  const [idx, setIdx] = useState(0)
  const [dados, setDados] = useState({})
  const [savedAt, setSavedAt] = useState(null)
  const [filter, setFilter] = useState('todos')
  const [showResumo, setShowResumo] = useState(false)

  // init turmaAtiva
  useEffect(()=>{
    if(prof && prof.turmas.length>0 && !turmaAtiva){
      setTurmaAtiva(prof.turmas[0])
    }
  }, [prof, turmaAtiva])

  const alunos = useMemo(()=> turmaAtiva ? getAlunosByTurma(turmaAtiva) : [], [turmaAtiva])
  // reset idx when turma changes
  useEffect(()=>{ setIdx(0) }, [turmaAtiva])
  const aluno = alunos[idx]

  useEffect(()=>{
    if(!aluno || !prof) return
    const res = getResposta(turmaAtiva, prof.componente, trimestre, aluno.numero)
    setDados(res?.dados || {})
  }, [aluno, turmaAtiva, prof, trimestre])

  const update = (key, val)=>{
    const nd = { ...dados, [key]: val }
    setDados(nd)
    if(aluno && prof) {
      upsertResposta({ turma: turmaAtiva, componente: prof.componente, trimestre, alunoNumero: aluno.numero, alunoNome: aluno.nome, dados: nd })
      setSavedAt(new Date())
    }
  }

  const progressoGeral = useMemo(()=>{
    if(!prof) return { pct:0, total:0, concluidos:0, porTurma:{} }
    let total=0, concluidos=0
    const porTurma={}
    for(const t of prof.turmas){
      const al = getAlunosByTurma(t)
      total += al.length
      let c=0
      for(const a of al){
        const r = getResposta(t, prof.componente, trimestre, a.numero)
        if(r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')) c++
      }
      porTurma[t]={ total: al.length, concluidos: c, pct: al.length? Math.round(c/al.length*100):0 }
      concluidos+=c
    }
    return { total, concluidos, pct: total? Math.round(concluidos/total*100):0, porTurma }
  }, [prof, trimestre, dados, savedAt])

  const progressoTurma = useMemo(()=>{
    if(!turmaAtiva || !prof) return { pct:0, concluidos:0 }
    const al = getAlunosByTurma(turmaAtiva)
    let c=0
    for(const a of al){
      const r=getResposta(turmaAtiva, prof.componente, trimestre, a.numero)
      if(r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')) c++
    }
    return { pct: al.length? Math.round(c/al.length*100):0, concluidos:c, total: al.length }
  }, [turmaAtiva, prof, trimestre, dados, savedAt])

  const filteredIndices = useMemo(()=>{
    const list=[]
    alunos.forEach((a,i)=>{
      const r=getResposta(turmaAtiva, prof?.componente, trimestre, a.numero)
      const has = r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')
      if(filter==='pendentes' && has) return
      if(filter==='concluidos' && !has) return
      list.push({a,i,has})
    })
    return list
  }, [alunos, filter, turmaAtiva, prof, trimestre, savedAt])

  const handleExportTurma = (type, turma)=>{
    const al = getAlunosByTurma(turma)
    const todas = al.map(a=>{
      const r=getResposta(turma, prof.componente, trimestre, a.numero)
      return r || { turma, componente: prof.componente, trimestre, alunoNumero: a.numero, alunoNome: a.nome, dados:{} }
    })
    if(type==='csv') exportToCSV(todas, `${turma} - PRE CONSELHO ${trimestre}(${prof.componente}).csv`)
    else exportToXLSX(todas, `${turma} - PRE CONSELHO ${trimestre}(${prof.componente}).xlsx`)
    const json = JSON.stringify(todas, null, 2)
    const blob=new Blob([json],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`${turma}-${prof.componente}-${trimestre}.json`; a.click(); URL.revokeObjectURL(url)
  }

  const handleExportTodas = ()=>{
    const todas=[]
    for(const t of prof.turmas){
      const al=getAlunosByTurma(t)
      for(const a of al){
        const r=getResposta(t, prof.componente, trimestre, a.numero)
        todas.push(r || { turma:t, componente: prof.componente, trimestre, alunoNumero: a.numero, alunoNome: a.nome, dados:{} })
      }
    }
    exportToCSV(todas, `${prof.nome.replace(/\s+/g,'_')} - TODAS TURMAS ${trimestre}(${prof.componente}).csv`)
    const json=JSON.stringify(todas,null,2)
    const blob=new Blob([json],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`${prof.componente}-TODAS-${trimestre}.json`; a.click(); URL.revokeObjectURL(url)
  }

  if(!token){
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h2 className="font-bold text-slate-900">Link inválido</h2>
        <p className="text-sm text-slate-500 mt-1">Acesse pelo link enviado pela coordenação. Ex: <code className="bg-slate-100 px-2 py-1 rounded text-xs">/prof/SEU-TOKEN</code></p>
        <Link to="/admin" className="mt-4 inline-block bg-sky-600 text-white px-4 py-2 rounded-xl text-sm">Coordenação</Link>
      </div>
    )
  }
  if(!prof){
    // check if token is actually config senha and maybe professor tried old link via /prof?
    if(token===config.senha){
      return (
        <div className="max-w-md mx-auto mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <h2 className="font-bold text-amber-900">Link antigo</h2>
          <p className="text-sm text-amber-700 mt-1">Este token é a senha geral. Use o link específico por turma: <code className="bg-white px-2 py-1 rounded text-xs">/p?turma=1A&comp=HIS ART&token=santa2026</code> ou peça à coordenação um link de professor com múltiplas turmas.</p>
          <Link to="/" className="mt-4 inline-block bg-amber-600 text-white px-4 py-2 rounded-xl text-sm">Início</Link>
        </div>
      )
    }
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-red-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">🔒</div>
        <h2 className="font-bold text-slate-900">Professor não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1">Token <code className="bg-slate-100 px-1 rounded">{token}</code> inválido. Solicite novo link à coordenação.</p>
      </div>
    )
  }

  if(prof.turmas.length===0){
    return <div className="max-w-2xl mx-auto mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">Professor sem turmas vinculadas. Peça à coordenação para editar.</div>
  }

  if(alunos.length===0){
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
        <h2 className="font-bold text-amber-900">Turma {turmaAtiva} sem alunos</h2>
        <p className="text-sm text-amber-700 mt-1">A turma não tem alunos cadastrados. Coordenação precisa importar CSV.</p>
      </div>
    )
  }

  const charCountObs=(dados.observacoes||'').length
  const charCountMotivo=(dados.motivo||'').length

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-0">
      {/* Header Hub */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-5 sm:p-6 text-white mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10"></div>
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-white text-sky-700 px-3 py-1 rounded-full text-xs font-bold">{prof.componente}</span>
                <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-medium">{trimestre} • {prof.nome}</span>
                <span className="bg-emerald-400 text-white px-3 py-1 rounded-full text-xs font-bold">{progressoGeral.pct}% concluído</span>
              </div>
              <h1 className="text-2xl font-bold mt-3">Olá, {prof.nome.split(' ')[0]}!</h1>
              <p className="text-sky-100 text-sm mt-1">Você tem <strong>{prof.turmas.length} turmas</strong> • <strong>{progressoGeral.total} alunos</strong> no total. Um único link para todas.</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4 min-w-[260px]">
              <div className="text-sm font-medium text-white mb-2">Progresso geral</div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white transition-all" style={{width: progressoGeral.pct+'%'}}></div>
                </div>
                <span className="text-sm font-bold">{progressoGeral.pct}%</span>
              </div>
              <div className="text-xs text-sky-100">{progressoGeral.concluidos}/{progressoGeral.total} fichas preenchidas</div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleExportTodas} className="flex-1 bg-white text-sky-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-sky-50">📥 Exportar tudo (CSV+JSON)</button>
              </div>
            </div>
          </div>
          {/* Turmas tabs */}
          <div className="mt-5 flex gap-2 overflow-auto pb-1">
            {prof.turmas.map(t=>{
              const p = progressoGeral.porTurma[t] || { pct:0, concluidos:0, total:0 }
              const active = t===turmaAtiva
              return (
                <button key={t} onClick={()=>setTurmaAtiva(t)} className={`px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition flex items-center gap-2 ${active ? 'bg-white text-sky-700 shadow' : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur'}`}>
                  <span>{t}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-sky-100 text-sky-700' : 'bg-white/20 text-white'}`}>{p.concluidos}/{p.total} • {p.pct}%</span>
                  {p.pct===100 && <span>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Subheader turma ativa */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">{turmaAtiva}</span>
            Turma {turmaAtiva} • {alunos.length} alunos
            <span className="text-xs font-normal text-slate-500">• {prof.componente} • {trimestre}</span>
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-40 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-600 transition-all" style={{width: progressoTurma.pct+'%'}}></div>
            </div>
            <span className="text-xs font-medium text-slate-600">{progressoTurma.concluidos}/{progressoTurma.total} • {progressoTurma.pct}%</span>
            {savedAt && <span className="text-xs text-emerald-600">✓ {savedAt.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>handleExportTurma('csv', turmaAtiva)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700">📥 CSV {turmaAtiva}</button>
          <button onClick={()=>setShowResumo(!showResumo)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium">{showResumo?'Ocultar':'Resumo'}</button>
        </div>
      </div>

      {showResumo && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Resumo {turmaAtiva}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {alunos.map(a=>{
              const r=getResposta(turmaAtiva, prof.componente, trimestre, a.numero)
              const has = r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')
              return <div key={a.id} className={`p-2.5 rounded-xl border flex items-center justify-between ${has?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                <span className="font-medium text-slate-700">{a.numero} • {a.nome.slice(0,22)}</span>
                <span className="text-xs">{has?'✓': '○'}</span>
              </div>
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-fit lg:sticky lg:top-20">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900">Alunos {turmaAtiva} ({alunos.length})</h3>
            <select value={filter} onChange={e=>setFilter(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1">
              <option value="todos">Todos</option><option value="pendentes">Pendentes</option><option value="concluidos">Concluídos</option>
            </select>
          </div>
          <div className="max-h-[50vh] lg:max-h-[70vh] overflow-auto divide-y divide-slate-100">
            {filteredIndices.map(({a,i,has})=> (
              <button key={a.id} onClick={()=>setIdx(i)} className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${idx===i?'bg-sky-50 border-l-4 border-sky-600': has?'bg-emerald-50/50':''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx===i?'bg-sky-600 text-white': has?'bg-emerald-500 text-white':'bg-slate-200 text-slate-600'}`}>{a.numero}</div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${idx===i?'text-sky-900':'text-slate-800'}`}>{a.nome}</div>
                  <div className="text-xs text-slate-500">{has?'✓ preenchido':'○ pendente'} {has && getResposta(turmaAtiva, prof.componente, trimestre, a.numero)?.dados?.observacoes && '• 💬'}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-200 flex gap-2">
            <button disabled={idx===0} onClick={()=>setIdx(i=>Math.max(0,i-1))} className="flex-1 text-sm border border-slate-300 rounded-xl py-2 disabled:opacity-40">←</button>
            <button disabled={idx===alunos.length-1} onClick={()=>setIdx(i=>Math.min(alunos.length-1,i+1))} className="flex-1 text-sm bg-sky-600 text-white rounded-xl py-2 disabled:opacity-40">→</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Aluno {idx+1} de {alunos.length} • {turmaAtiva}</div>
                <h2 className="text-xl font-bold text-slate-900">{aluno?.nome}</h2>
                <div className="text-sm text-slate-500">Nº {aluno?.numero} • {prof.componente} • {trimestre}</div>
              </div>
              <div className="hidden sm:flex gap-2">
                <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center disabled:opacity-30">‹</button>
                <button onClick={()=>setIdx(i=>Math.min(alunos.length-1,i+1))} disabled={idx===alunos.length-1} className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center disabled:opacity-30">›</button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sm">🎯</span> Desempenho Acadêmico <span className="text-xs font-normal text-slate-500">Sim / Não / Parcial</span></h3>
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                {CAMPOS.desempenho.map(f=> <SegmentedField key={f.key} label={f.label} hint={f.hint} value={dados[f.key]||''} onChange={v=>update(f.key, v)} />)}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🧩</span> Intervenção Pedagógica <span className="text-xs font-normal text-slate-500">Sim / Não</span></h3>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <BinaryField label="Necessidade de intervenção pedagógica" hint="Precisa de apoio extra? Sim = vermelho (alerta)" value={dados.necessidade||''} onChange={v=>update('necessidade', v)} polarity="negative" />
                <BinaryField label="Respostas positivas às intervenções" hint="Respondeu bem? Sim = verde (positivo)" value={dados.respostasPositivas||''} onChange={v=>update('respostasPositivas', v)} polarity="positive" />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-sm">💬</span> Comportamento</h3>
              <div className="mt-3">
                <label className="text-sm font-medium text-slate-700">Observações (máx. 280 caracteres)</label>
                <textarea value={dados.observacoes||''} onChange={e=>update('observacoes', e.target.value.slice(0,280))} rows={3} placeholder="Ex: Mantém dificuldades na escrita, mas com muita força de vontade..." className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <div className={`text-xs text-right mt-1 ${charCountObs>260?'text-amber-600':'text-slate-400'}`}>{charCountObs}/280</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {CAMPOS.comportamentoAcoes.map(f=> <CheckBox key={f.key} label={f.label} checked={!!(dados[f.key] && String(dados[f.key]).trim()!=='')} onChange={v=>update(f.key, v)} />)}
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📚</span> Reforço</h3>
              <label className="flex items-center gap-3 mt-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={!!(dados.reforco && String(dados.reforco).trim()!=='')} onChange={e=>update('reforco', e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">Encaminhado para reforço</span>
                {dados.reforco && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Sim</span>}
              </label>
              <div className="mt-3">
                <label className="text-sm font-medium text-slate-700">Motivo (280)</label>
                <textarea value={dados.motivo||''} onChange={e=>update('motivo', e.target.value.slice(0,280))} rows={2} placeholder="Ex: Resultados nas avaliações..." className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <div className={`text-xs text-right mt-1 ${charCountMotivo>260?'text-amber-600':'text-slate-400'}`}>{charCountMotivo}/280</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={()=>{ if(idx>0) setIdx(i=>i-1)}} disabled={idx===0} className="flex-1 border border-slate-300 rounded-xl py-3 text-sm font-medium disabled:opacity-40">← Voltar</button>
              {idx < alunos.length-1 ? <button onClick={()=>setIdx(i=>i+1)} className="flex-[1.5] bg-sky-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-sky-700">Salvar e próximo →</button> : <button onClick={()=>{ const nextTurmaIdx = prof.turmas.indexOf(turmaAtiva); if(nextTurmaIdx < prof.turmas.length-1){ setTurmaAtiva(prof.turmas[nextTurmaIdx+1]); setIdx(0); window.scrollTo({top:0, behavior:'smooth'}) } else { handleExportTodas(); } }} className="flex-[1.5] bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700">{prof.turmas.indexOf(turmaAtiva) < prof.turmas.length-1 ? 'Próxima turma →' : 'Concluir e exportar ✓'}</button>}
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm text-sky-900 flex gap-3">
            <span className="text-lg">💡</span>
            <div>Seu progresso é salvo automaticamente. Ao concluir todas as turmas, use <strong>Exportar tudo</strong> no topo. Dúvidas? Fale com a coordenação.
              <div className="mt-2 text-xs text-sky-700">Turmas: {prof.turmas.join(' • ')} • Componente: {prof.componente}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
