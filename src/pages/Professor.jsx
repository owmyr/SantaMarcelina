import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { getAlunosByTurma, getConfig, getResposta, upsertResposta } from '../lib/storage'
import { exportToCSV, exportToXLSX } from '../lib/csv'
import { CAMPOS, SegmentedField, BemEstarField, EvolucaoField, CheckBox } from '../components/FormFields.jsx'

export default function Professor() {
  const [search] = useSearchParams()
  const turma = search.get('turma') || ''
  const componente = search.get('comp') || ''
  const trimestre = search.get('tri') || getConfig().trimestre
  const token = search.get('token') || ''

  const config = getConfig()
  const isValidToken = token === config.senha

  const alunos = useMemo(()=> turma ? getAlunosByTurma(turma) : [], [turma])
  const [idx, setIdx] = useState(0)
  const [dados, setDados] = useState({})
  const [savedAt, setSavedAt] = useState(null)
  const [filter, setFilter] = useState('todos') // todos | pendentes | concluidos
  const [showResumo, setShowResumo] = useState(false)

  const aluno = alunos[idx]

  // load dados when aluno changes
  useEffect(()=>{
    if(!aluno) return
    const res = getResposta(turma, componente, trimestre, aluno.numero)
    setDados(res?.dados || {})
  }, [aluno, turma, componente, trimestre])

  const saveTimeout = useRef(null)
  const pendingDataRef = useRef(null)
  const flushSave = useCallback(()=>{
    if(pendingDataRef.current && aluno){
      upsertResposta({ turma, componente, trimestre, alunoNumero: aluno.numero, alunoNome: aluno.nome, dados: pendingDataRef.current })
      setSavedAt(new Date())
      pendingDataRef.current = null
    }
  }, [aluno, turma, componente, trimestre])

  const update = useCallback((key, val)=>{
    const nd = { ...dados, [key]: val }
    setDados(nd)
    pendingDataRef.current = nd
    if(saveTimeout.current) clearTimeout(saveTimeout.current)
    const isText = key==='observacoes' || key==='motivo'
    saveTimeout.current = setTimeout(flushSave, isText ? 450 : 150)
  }, [dados, aluno, turma, componente, trimestre, flushSave])

  useEffect(()=>()=>{ if(saveTimeout.current) clearTimeout(saveTimeout.current) }, [])

  const hasRequiredFilled = useCallback((dadosObj)=>{
    if(!dadosObj) return false
    const eng = dadosObj.engajamento || dadosObj.participacao || dadosObj.proatividade || ''
    const org = dadosObj.organizacao || dadosObj.cumprimento || dadosObj.colaboracao || ''
    const req = [dadosObj.aproveitamento, eng, org, dadosObj.concentracao, dadosObj.assiduidade, dadosObj.convivencia]
    return req.every(v=> String(v||'').trim()!=='')
  }, [])

  const progresso = useMemo(()=>{
    if(alunos.length===0) return { pct:0, concluidos:0 }
    let concluidos=0
    for(const a of alunos){
      const r = getResposta(turma, componente, trimestre, a.numero)
      if(r && hasRequiredFilled(r.dados)) concluidos++
    }
    return { pct: Math.round(concluidos/alunos.length*100), concluidos }
  }, [alunos, turma, componente, trimestre, dados, savedAt, hasRequiredFilled])

  const filteredIndices = useMemo(()=>{
    const list = []
    alunos.forEach((a,i)=>{
      const r = getResposta(turma, componente, trimestre, a.numero)
      const has = r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')
      const hasRequired = r && hasRequiredFilled(r.dados)
      if(filter==='pendentes' && hasRequired) return
      if(filter==='concluidos' && !hasRequired) return
      list.push({a, i, has, hasRequired})
    })
    return list
  }, [alunos, filter, turma, componente, trimestre, savedAt, hasRequiredFilled])

  const handleExport = (type)=>{
    const todas = alunos.map(a=>{
      const r = getResposta(turma, componente, trimestre, a.numero)
      return r || { turma, componente, trimestre, alunoNumero: a.numero, alunoNome: a.nome, dados:{} }
    })
    if(type==='csv') exportToCSV(todas, `${turma} - PRE CONSELHO ${trimestre}(${componente}).csv`)
    else exportToXLSX(todas, `${turma} - PRE CONSELHO ${trimestre}(${componente}).xlsx`)
    // also export JSON for import em Geral
    const json = JSON.stringify(todas, null, 2)
    const blob = new Blob([json], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`${turma}-${componente}-${trimestre}.json`; a.click(); URL.revokeObjectURL(url)
  }

  if(!turma || !componente){
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h2 className="font-bold text-slate-900">Link incompleto</h2>
        <p className="text-sm text-slate-500 mt-2">Use um link gerado em Coordenação. Exemplo: <code className="bg-slate-100 px-2 py-1 rounded text-xs">/p?turma=1A&comp=HIS%20ART&tri=2TRI&token=santa2026</code></p>
        <Link to="/admin" className="mt-4 inline-block bg-sky-600 text-white px-4 py-2 rounded-xl text-sm">Ir para Coordenação</Link>
      </div>
    )
  }

  if(!isValidToken){
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-red-200 p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">🔒</div>
        <h2 className="font-bold text-slate-900">Acesso restrito</h2>
        <p className="text-sm text-slate-500 mt-1">Token inválido para <strong>{turma} • {componente}</strong>. Verifique o link enviado pela coordenação.</p>
      </div>
    )
  }

  if(alunos.length===0){
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <h2 className="font-bold text-slate-900">Turma sem alunos no momento</h2>
        <p className="text-sm text-slate-500 mt-1">Nenhum aluno cadastrado para <strong>{turma}</strong> no momento.</p>
        <Link to="/admin" className="mt-4 inline-block bg-slate-900 text-white px-4 py-2 rounded-xl text-sm">Ir para coordenação</Link>
      </div>
    )
  }

  const charCountObs = (dados.observacoes||'').length
  const charCountMotivo = (dados.motivo||'').length

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="bg-slate-900 text-white px-2.5 py-1 rounded-full font-medium text-xs">{turma}</span>
              <span>•</span><span className="font-medium text-slate-900">{componente}</span><span>•</span><span>{trimestre}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-2">Ficha Pré-Conselho</h1>
            <p className="text-sm text-slate-500">Preencha um aluno por vez. Salvamento automático.</p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">{progresso.concluidos}/{alunos.length} preenchidos</span>
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full font-medium">{progresso.pct}%</span>
            </div>
            <div className="w-full sm:w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-600 transition-all" style={{width: progresso.pct+'%'}}></div>
            </div>
            {savedAt && <span className="text-xs text-emerald-600">✓ Salvo {savedAt.toLocaleTimeString()}</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={()=>handleExport('csv')} className="bg-white border border-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50">Exportar</button>
          <button onClick={()=>setShowResumo(!showResumo)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-black">{showResumo?'Ocultar resumo':'Resumo'}</button>
        </div>
      </div>

      {showResumo && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Resumo preenchimento</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {alunos.map(a=>{
              const r=getResposta(turma, componente, trimestre, a.numero)
              const has = r && Object.values(r.dados||{}).some(v=>String(v).trim()!=='')
              const obs = r?.dados?.observacoes ? '💬' : ''
              const reforco = r?.dados?.reforco ? '📚' : ''
              return <div key={a.id} className={`p-2.5 rounded-xl border flex items-center justify-between ${has?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                <span className="font-medium text-slate-700">{a.numero} • {a.nome.slice(0,22)}</span>
                <span className="text-xs">{has?'✓':''} {obs} {reforco}</span>
              </div>
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Lista alunos */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-fit lg:sticky lg:top-20">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-slate-900">Alunos ({alunos.length})</h3>
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
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    {hasRequired?'✓ completo': has?'⚠️ incompleto':'○ pendente'} {has && getResposta(turma, componente, trimestre, a.numero)?.dados?.observacoes && '• 💬 obs'}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-200 flex gap-2">
            <button disabled={idx===0} onClick={()=>setIdx(i=>Math.max(0,i-1))} className="flex-1 text-sm border border-slate-300 rounded-xl py-2 disabled:opacity-40">← Anterior</button>
            <button disabled={idx===alunos.length-1} onClick={()=>setIdx(i=>Math.min(alunos.length-1,i+1))} className="flex-1 text-sm bg-sky-600 text-white rounded-xl py-2 disabled:opacity-40">Próximo →</button>
          </div>
        </div>

        {/* Card aluno */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Aluno {idx+1} de {alunos.length}</div>
                <h2 className="text-xl font-bold text-slate-900">{aluno?.nome}</h2>
                <div className="text-sm text-slate-500">Nº {aluno?.numero} • {turma} • {componente} • {trimestre}</div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center disabled:opacity-30">‹</button>
                <button onClick={()=>setIdx(i=>Math.min(alunos.length-1,i+1))} disabled={idx===alunos.length-1} className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center disabled:opacity-30">›</button>
              </div>
            </div>
            {!hasRequiredFilled(dados) && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                <span>⚠️</span> Preencha os 6 campos obrigatórios (Desempenho 4 + Presença 2) para concluir este aluno. Os demais são opcionais.
              </div>
            )}

            {/* Desempenho — 4 campos obrigatórios */}
            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sm">🎯</span> Desempenho <span className="text-[11px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">* obrigatório</span>
              </h3>
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
                <div className={`text-xs text-right mt-1 ${charCountObs>360?'text-amber-600':'text-slate-400'}`}>{charCountObs}/400</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {CAMPOS.comportamentoAcoes.map(f=> (
                  <CheckBox key={f.key} label={f.label} checked={!!(dados[f.key] && String(dados[f.key]).trim()!=='')} onChange={v=>update(f.key, v)} />
                ))}
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
                  <label className="text-sm font-medium text-slate-700">Motivo / detalhe (160)</label>
                  <textarea value={dados.motivo||''} onChange={e=>update('motivo', e.target.value.slice(0,160))} rows={2} placeholder="Ex: Resultados nas avaliações, dificuldade em interpretação..." className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                  <div className={`text-xs text-right mt-1 ${charCountMotivo>140?'text-amber-600':'text-slate-400'}`}>{charCountMotivo}/160</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button onClick={()=>{ if(idx>0) setIdx(i=>i-1)}} disabled={idx===0} className="flex-1 border border-slate-300 rounded-xl py-3 text-sm font-medium disabled:opacity-40">← Voltar</button>
              {idx < alunos.length-1 ? (
                <button onClick={()=>setIdx(i=>i+1)} className="flex-[1.5] bg-sky-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-sky-700">Salvar e próximo →</button>
              ) : (
                <button onClick={()=>handleExport('csv')} className="flex-[1.5] bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700">Finalizar e exportar ✓</button>
              )}
            </div>
            <div className="mt-3 flex gap-2 justify-center">
              <button onClick={()=>update('observacoes','')} className="text-xs text-slate-500 hover:text-slate-700">Limpar observações</button>
              <span className="text-slate-300">•</span>
              <button onClick={()=>{
                if(confirm('Limpar todos os campos deste aluno?')) {
                  const empty={}; setDados(empty); upsertResposta({turma, componente, trimestre, alunoNumero: aluno.numero, alunoNome: aluno.nome, dados: empty}); setSavedAt(new Date())
                }
              }} className="text-xs text-red-500 hover:text-red-700">Limpar ficha</button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <span>Atalhos: <kbd className="bg-white border px-1.5 py-0.5 rounded">←</kbd> <kbd className="bg-white border px-1.5 py-0.5 rounded">→</kbd> para navegar entre alunos</span>
            <span className="hidden sm:inline">Progresso salvo automaticamente</span>
          </div>
        </div>
      </div>
    </div>
  )
}
