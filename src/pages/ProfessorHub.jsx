import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { getAlunosByTurma, getAlunos, getTurmas, getConfig, getResposta, upsertResposta, getProfessorByToken, getProfessores } from '../lib/storage'
import { exportToCSV, exportToXLSX } from '../lib/csv'
import { CAMPOS, SegmentedField, BemEstarField, EvolucaoField, CheckBox } from '../components/FormFields.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

function decodeProfData(encoded){
  if(!encoded) return null
  try{
    const b64 = decodeURIComponent(encoded)
    const json = decodeURIComponent(escape(atob(b64)))
    return JSON.parse(json)
  }catch{
    try{
      const json2 = atob(decodeURIComponent(encoded))
      return JSON.parse(decodeURIComponent(escape(json2)))
    }catch{
      try{
        return JSON.parse(atob(encoded))
      }catch{ return null }
    }
  }
}

export default function ProfessorHub(){
  const { token: tokenParam } = useParams()
  const [search] = useSearchParams()
  const token = tokenParam || search.get('token') || search.get('prof') || ''
  const [prof, setProf] = useState(null)
  const config = getConfig()
  const trimestre = search.get('tri') || config.trimestre

  const [profLoading, setProfLoading] = useState(!!token && isSupabaseConfigured)
  const [syncTick, setSyncTick] = useState(0)
  useEffect(()=>{
    const h = ()=> setSyncTick(t=>t+1)
    window.addEventListener('sm-bulk-sync', h)
    window.addEventListener('sm-sync-broadcast', h)
    window.addEventListener('storage', h)
    window.addEventListener('sm-respostas-updated', h)
    return ()=>{
      window.removeEventListener('sm-bulk-sync', h)
      window.removeEventListener('sm-sync-broadcast', h)
      window.removeEventListener('storage', h)
      window.removeEventListener('sm-respostas-updated', h)
    }
  }, [])

  useEffect(()=>{
    let cancelled = false
    const tryFind = ()=>{
      if(!token){
        if(!cancelled) { setProf(null); setProfLoading(false) }
        return
      }
      let p = getProfessorByToken(token)
      if(p){
        if(!cancelled){ setProf(p); setProfLoading(false) }
        return true
      }
      // fallback: dados codificados na URL (&d=) para modo sem backend (cross-browser)
      const dParam = search.get('d') || search.get('data')
      if(dParam){
        const decoded = decodeProfData(dParam)
        if(decoded && decoded.nome && decoded.componente && Array.isArray(decoded.turmas) && decoded.turmas.length>0){
          const tempProf = { id: `tmp-${token}`, nome: decoded.nome, componente: String(decoded.componente).toUpperCase(), turmas: decoded.turmas, token, createdAt: new Date().toISOString(), viaUrl: true }
          try{
            const all = getProfessores()
            if(!all.find(x=>x.token===token)){
              all.push(tempProf)
              localStorage.setItem('sm_professores', JSON.stringify(all))
            }
          }catch{}
          if(!cancelled){ setProf(tempProf); setProfLoading(false) }
          return true
        }
      }
      // virtual hub: /hub?comp=GEO&token=santa2026 or /prof/<senha>?comp=...
      const comp = search.get('comp')
      if(comp && token===config.senha){
        const turmas = getTurmas().map(t=>t.nome)
        const vProf = { id:'virtual', nome: `Hub ${comp}`, componente: comp.toUpperCase(), turmas, token, virtual:true }
        if(!cancelled){ setProf(vProf); setProfLoading(false) }
        return true
      }
      return false
    }

    // tenta imediato
    const found = tryFind()
    if(found) return

    // se Supabase configurado, pode estar hidratando — aguarda bulk sync
    if(isSupabaseConfigured){
      setProfLoading(true)
      const handler = ()=>{
        if(tryFind()){
          // encontrado após sync
        }
      }
      window.addEventListener('sm-bulk-sync', handler)
      window.addEventListener('sm-sync-broadcast', handler)
      window.addEventListener('storage', (e)=>{
        if(e.key==='sm_professores') handler()
      })
      // timeout: após 4s, desiste e mostra erro
      const t = setTimeout(()=>{ if(!cancelled) setProfLoading(false) }, 4000)
      return ()=>{
        cancelled = true
        window.removeEventListener('sm-bulk-sync', handler)
        window.removeEventListener('sm-sync-broadcast', handler)
        clearTimeout(t)
      }
    } else {
      // sem backend e sem d param: não há como recuperar
      setProfLoading(false)
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

  const alunos = useMemo(()=> turmaAtiva ? getAlunosByTurma(turmaAtiva) : [], [turmaAtiva, syncTick])
  // reset idx when turma changes
  useEffect(()=>{ setIdx(0) }, [turmaAtiva])
  const aluno = alunos[idx]

  useEffect(()=>{
    if(!aluno || !prof) return
    const res = getResposta(turmaAtiva, prof.componente, trimestre, aluno.numero)
    setDados(res?.dados || {})
  }, [aluno, turmaAtiva, prof, trimestre])

  const saveTimeout = useRef(null)
  const pendingDataRef = useRef(null)
  // debounce 400ms para não travar localStorage a cada tecla (observações 280 chars)
  const flushSave = useCallback(()=>{
    if(pendingDataRef.current && aluno && prof){
      upsertResposta({ turma: turmaAtiva, componente: prof.componente, trimestre, alunoNumero: aluno.numero, alunoNome: aluno.nome, dados: pendingDataRef.current })
      setSavedAt(new Date())
      pendingDataRef.current = null
    }
  }, [aluno, prof, turmaAtiva, trimestre])

  const update = useCallback((key, val)=>{
    const nd = { ...dados, [key]: val }
    setDados(nd)
    pendingDataRef.current = nd
    if(saveTimeout.current) clearTimeout(saveTimeout.current)
    // segmented muda pouco, mas textarea beneficia de debounce
    const isText = key==='observacoes' || key==='motivo'
    saveTimeout.current = setTimeout(flushSave, isText ? 450 : 150)
  }, [dados, aluno, prof, turmaAtiva, trimestre, flushSave])

  useEffect(()=>()=>{ if(saveTimeout.current) clearTimeout(saveTimeout.current) }, [])

  const hasRequiredFilled = useCallback((dadosObj)=>{
    if(!dadosObj) return false
    const eng = dadosObj.engajamento || dadosObj.participacao || dadosObj.proatividade || ''
    const org = dadosObj.organizacao || dadosObj.cumprimento || dadosObj.colaboracao || ''
    const req = [dadosObj.aproveitamento, eng, org, dadosObj.concentracao, dadosObj.assiduidade, dadosObj.convivencia]
    return req.every(v=> String(v||'').trim()!=='')
  }, [])

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
        if(r && hasRequiredFilled(r.dados)) c++
      }
      porTurma[t]={ total: al.length, concluidos: c, pct: al.length? Math.round(c/al.length*100):0 }
      concluidos+=c
    }
    return { total, concluidos, pct: total? Math.round(concluidos/total*100):0, porTurma }
  }, [prof, trimestre, dados, savedAt, hasRequiredFilled])

  const progressoTurma = useMemo(()=>{
    if(!turmaAtiva || !prof) return { pct:0, concluidos:0 }
    const al = getAlunosByTurma(turmaAtiva)
    let c=0
    for(const a of al){
      const r=getResposta(turmaAtiva, prof.componente, trimestre, a.numero)
      if(r && hasRequiredFilled(r.dados)) c++
    }
    return { pct: al.length? Math.round(c/al.length*100):0, concluidos:c, total: al.length }
  }, [turmaAtiva, prof, trimestre, dados, savedAt, hasRequiredFilled])

  const filteredIndices = useMemo(()=>{
    const list=[]
    alunos.forEach((a,i)=>{
      const r=getResposta(turmaAtiva, prof?.componente, trimestre, a.numero)
      const has = r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')
      const hasRequired = r && hasRequiredFilled(r.dados)
      if(filter==='pendentes' && hasRequired) return
      if(filter==='concluidos' && !hasRequired) return
      list.push({a,i,has, hasRequired})
    })
    return list
  }, [alunos, filter, turmaAtiva, prof, trimestre, savedAt, hasRequiredFilled])

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
  if(profLoading){
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <h2 className="font-bold text-slate-900">Carregando professor...</h2>
        <p className="text-sm text-slate-500 mt-1">Buscando dados do Supabase (se configurado)...</p>
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
    const hasDataParam = !!(search.get('d') || search.get('data'))
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-red-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">🔒</div>
        <h2 className="font-bold text-slate-900">Professor não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1">Token <code className="bg-slate-100 px-1 rounded">{token}</code> inválido.</p>
        {!isSupabaseConfigured ? (
          <div className="mt-4 text-xs text-left bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="font-semibold text-amber-900">Modo local (sem backend) detectado</div>
            <div className="text-amber-800 mt-1">Este navegador não tem o professor salvo. Isso acontece quando o Supabase não está configurado (links só funcionam no mesmo navegador). <br/>Solução rápida: peça à coordenação para re-copiar o link da aba <strong>Professores</strong> — agora ele já vem com <code>&d=</code> codificado e funciona em outro navegador mesmo sem backend.</div>
            <div className="text-amber-800 mt-2">Para produção: na Vercel, defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> em Settings → Environment Variables e faça redeploy. Depois, recrie os professores (ou aguarde sync).</div>
            {!hasDataParam && <div className="mt-2 text-amber-700">Este link não contém <code>&d=</code>. Se você copiou antes da correção, gere um novo link na coordenação.</div>}
          </div>
        ) : (
          <div className="mt-4 text-xs text-left bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="font-semibold text-slate-700">Backend configurado, mas token não encontrado</div>
            <div className="text-slate-600 mt-1">O professor pode ainda estar sincronizando. Aguarde alguns segundos e recarregue. Se persistir, peça à coordenação para verificar em <strong>/admin → Professores</strong> se o professor existe e se o Supabase em <code>supabase/schema.sql</code> foi executado e as policies <code>allow_all_professores</code> existem.</div>
            <div className="text-slate-500 mt-2">Dica: links antigos sem <code>&d=</code> só funcionam após hidratação do Supabase. Tente recarregar ou abrir com <code>?d=</code> (novo link).</div>
          </div>
        )}
        <Link to="/" className="mt-4 inline-block bg-slate-900 text-white px-4 py-2 rounded-xl text-sm">Início</Link>
      </div>
    )
  }

  if(prof.turmas.length===0){
    return <div className="max-w-2xl mx-auto mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">Professor sem turmas vinculadas. Peça à coordenação para editar.</div>
  }

  if(alunos.length===0){
    if(isSupabaseConfigured && syncTick < 2){
      return (
        <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <h2 className="font-bold text-slate-900">Carregando alunos...</h2>
          <p className="text-sm text-slate-500 mt-1">Buscando turma <strong>{turmaAtiva}</strong> no Supabase...</p>
        </div>
      )
    }
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h2 className="font-bold text-slate-900">Turma sem alunos no momento</h2>
        <p className="text-sm text-slate-500 mt-1">Nenhum aluno cadastrado para <strong>{turmaAtiva}</strong>.</p>
        {!isSupabaseConfigured && <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">Modo local: alunos ficam salvos apenas no navegador da coordenação. Para que o professor veja os alunos em outro navegador, configure Supabase (Vercel → <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>) e importe os alunos lá. Links com <code>&d=</code> resolvem só o professor, não os alunos.</p>}
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

      {prof.viaUrl && !isSupabaseConfigured && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-xl mb-6">
          ⚠️ Professor carregado via link com dados codificados (modo local sem backend). Dados salvos neste navegador. Para sincronizar respostas entre dispositivos, configure Supabase (Vercel → <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>).
        </div>
      )}
      {!isSupabaseConfigured && !prof.viaUrl && !prof.virtual && (
        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-4 py-3 rounded-xl mb-6">
          ℹ️ Modo local (sem Supabase) — respostas salvas apenas neste navegador. Para produção com sync entre professores/coordenação, configure Supabase.
        </div>
      )}

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
            {filteredIndices.map(({a,i,has, hasRequired})=> (
              <button key={a.id} onClick={()=>setIdx(i)} className={`w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${idx===i?'bg-sky-50 border-l-4 border-sky-600': hasRequired?'bg-emerald-50/50': has?'bg-amber-50/50':''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${idx===i?'bg-sky-600 text-white': hasRequired?'bg-emerald-500 text-white': has?'bg-amber-500 text-white':'bg-slate-200 text-slate-600'}`}>{a.numero}</div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${idx===i?'text-sky-900':'text-slate-800'}`}>{a.nome}</div>
                  <div className="text-xs text-slate-500">{hasRequired?'✓ completo': has?'⚠️ incompleto (faltam obrigatórios)':'○ pendente'} {has && getResposta(turmaAtiva, prof.componente, trimestre, a.numero)?.dados?.observacoes && '• 💬'}</div>
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
            {!hasRequiredFilled(dados) && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                <span>⚠️</span> Preencha os 6 campos obrigatórios (Desempenho 4 + Presença 2) para concluir este aluno. Os demais são opcionais.
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sm">🎯</span> Desempenho <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">* obrigatório</span></h3>
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                <SegmentedField required fieldKey="aproveitamento" label="Aproveitamento" hint="Rendimento no conteúdo" value={dados.aproveitamento||''} onChange={v=>update('aproveitamento', v)} />
                <SegmentedField required fieldKey="engajamento" label="Engajamento e participação" hint="Participa, pergunta, toma iniciativa?" value={dados.engajamento || dados.participacao || dados.proatividade || ''} onChange={v=>update('engajamento', v)} />
                <SegmentedField required fieldKey="organizacao" label="Organização e entregas" hint="Traz material, entrega em dia, colabora?" value={dados.organizacao || dados.cumprimento || dados.colaboracao || ''} onChange={v=>update('organizacao', v)} />
                <SegmentedField required fieldKey="concentracao" label="Atenção e foco" hint="Mantém foco? Dispersa/celular?" value={dados.concentracao||''} onChange={v=>update('concentracao', v)} />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🕒</span> Presença e convivência <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">* obrigatório</span></h3>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <SegmentedField required fieldKey="assiduidade" label="Frequência e pontualidade" value={dados.assiduidade||''} onChange={v=>update('assiduidade', v)} />
                <SegmentedField required fieldKey="convivencia" label="Convivência e respeito" value={dados.convivencia||''} onChange={v=>update('convivencia', v)} />
              </div>
            </div>

            <details className="mt-6 bg-violet-50/50 border border-violet-200 rounded-2xl p-4">
              <summary className="font-semibold text-slate-900 flex items-center gap-2 cursor-pointer"><span className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-sm">🧠</span> Sinais observáveis <span className="ml-auto text-xs text-violet-600 border border-violet-200 bg-white px-2 py-1 rounded-full">opcional</span></summary>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <BemEstarField label="Sinal de bem-estar" hint="Ansiedade, apatia, agitação... (opcional)" value={dados.bemEstar||''} onChange={v=>update('bemEstar', v)} />
                <EvolucaoField label="Evolução no trimestre" hint="Melhorou, manteve ou piorou?" value={dados.evolucao || dados.progresso || ''} onChange={v=>update('evolucao', v)} />
              </div>
            </details>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm">💬</span> Observações <span className="text-xs font-normal text-slate-500">400 caracteres</span></h3>
              <div className="mt-3">
                <textarea value={dados.observacoes||''} onChange={e=>update('observacoes', e.target.value.slice(0,400))} rows={3} placeholder="Ex: Falta de rotina, copia de colega, muita conversa paralela, ansiedade antes de prova..." className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <div className={`text-xs text-right mt-1 ${charCountObs>360?'text-amber-600': charCountObs>390?'text-red-600':'text-slate-400'}`}>{charCountObs}/400</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {CAMPOS.comportamentoAcoes.map(f=> <CheckBox key={f.key} label={f.label} checked={!!(dados[f.key] && String(dados[f.key]).trim()!=='')} onChange={v=>update(f.key, v)} />)}
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📚</span> Encaminhamento sugerido</h3>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${dados.reforco ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={!!(dados.reforco && String(dados.reforco).trim()!=='')} onChange={e=>update('reforco', e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-emerald-600" />
                  <span className="text-sm font-medium">Reforço conteúdo</span>
                </label>
                <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${dados.apoio ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={!!(dados.apoio && String(dados.apoio).trim()!=='')} onChange={e=>update('apoio', e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-violet-600" />
                  <span className="text-sm font-medium">Apoio socioemocional</span>
                </label>
                <label className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${dados.familia ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={!!(dados.familia && String(dados.familia).trim()!=='')} onChange={e=>update('familia', e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-sky-600" />
                  <span className="text-sm font-medium">Conversa família</span>
                </label>
              </div>
              {(dados.reforco || dados.apoio || dados.familia) && (
                <div className="mt-3">
                  <label className="text-sm font-medium text-slate-700">Motivo / detalhe do encaminhamento (160)</label>
                  <textarea value={dados.motivo||''} onChange={e=>update('motivo', e.target.value.slice(0,160))} rows={2} placeholder="Ex: Resultados nas avaliações, dificuldade em interpretação..." className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                  <div className={`text-xs text-right mt-1 ${charCountMotivo>140?'text-amber-600':'text-slate-400'}`}>{charCountMotivo}/160</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={()=>{ if(idx>0) setIdx(i=>i-1)}} disabled={idx===0} className="flex-1 border border-slate-300 rounded-xl py-3 text-sm font-medium disabled:opacity-40">← Voltar</button>
              {idx < alunos.length-1 ? <button onClick={()=>setIdx(i=>i+1)} className="flex-[1.5] bg-sky-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-sky-700">Salvar e próximo →</button> : <button onClick={()=>{ const nextTurmaIdx = prof.turmas.indexOf(turmaAtiva); if(nextTurmaIdx < prof.turmas.length-1){ setTurmaAtiva(prof.turmas[nextTurmaIdx+1]); setIdx(0); window.scrollTo({top:0, behavior:'smooth'}) } else { handleExportTodas(); } }} className="flex-[1.5] bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700">{prof.turmas.indexOf(turmaAtiva) < prof.turmas.length-1 ? 'Próxima turma →' : 'Concluir e exportar ✓'}</button>}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <span>Turmas: {prof.turmas.join(' • ')} • {prof.componente}</span>
            <span className="hidden sm:inline">Salvo automaticamente</span>
          </div>
        </div>
      </div>
    </div>
  )
}
