import { useState, useEffect, useMemo } from 'react'
import { getAlunos, getTurmas, getComponentes, getRespostas, setRespostas, getConfig, classifyValor } from '../lib/storage'
import { exportGeralCSV, exportToXLSX } from '../lib/csv'
import Papa from 'papaparse'
import { normalizeRow, extractAlunoInfo, extractDados } from '../lib/helpers'

export default function Geral(){
  const [alunos, setAlunos] = useState([])
  const [turmas, setTurmasState] = useState([])
  const [componentes, setComponentesState] = useState([])
  const [respostas, setRespostasState] = useState([])
  const [filtroTurma, setFiltroTurma] = useState('todas')
  const [filtroComp, setFiltroComp] = useState('todos')
  const [filtroTri, setFiltroTri] = useState('')
  const [busca, setBusca] = useState('')
  const [view, setView] = useState('matriz') // matriz | lista | aluno
  const [selectedAluno, setSelectedAluno] = useState(null)
  const [auth, setAuth] = useState(false)
  const [pwdInput, setPwdInput] = useState('')
  const [importLog, setImportLog] = useState('')
  const [pagina, setPagina] = useState(1)
  const porPagina = 30

  useEffect(()=>{
    const t = getTurmas()
    setAlunos(getAlunos())
    setTurmasState(t)
    setComponentesState(getComponentes())
    setRespostasState(getRespostas())
    setFiltroTri(getConfig().trimestre)
    if(t.length>0) setFiltroTurma(t[0].nome) // default por turma (ex: 9A), com opção de ver todas
    const s = sessionStorage.getItem('sm_geral_auth')
    if(s==='1') setAuth(true)
  }, [])

  // Sync realtime: escuta atualizações de outras abas/professores e recarrega
  useEffect(()=>{
    // escuta BroadcastChannel + Supabase via supabase.js + storage events
    let unsub1, unsub2, unsub3
    import('../lib/supabase.js').then(m=>{
      unsub1 = m.subscribeRespostas((entry)=>{
        // entry pode ser single resposta ou array; atualiza local
        if(entry && entry.turma){
          // single entry
          setRespostasState(prev=>{
            // evita stale closure usando getRespostas fresh
            const all = getRespostas()
            return [...all]
          })
        } else {
          refresh()
        }
      })
      unsub2 = m.onBroadcast((table)=>{
        if(table==='respostas') refresh()
      })
    }).catch(()=>{})
    const handler = ()=> refresh()
    window.addEventListener('sm-respostas-updated', handler)
    window.addEventListener('sm-bulk-sync', handler)
    window.addEventListener('storage', (e)=>{
      if(e.key==='sm_respostas' || e.key==='sm_alunos') refresh()
    })
    return ()=>{
      if(unsub1) unsub1()
      if(unsub2) unsub2()
      window.removeEventListener('sm-respostas-updated', handler)
      window.removeEventListener('sm-bulk-sync', handler)
    }
  }, [])

  const handleAuth = (e)=>{
    e.preventDefault()
    if(pwdInput===getConfig().senha){ setAuth(true); sessionStorage.setItem('sm_geral_auth','1')}
    else alert('Senha incorreta')
  }

  const refresh = ()=>{
    setRespostasState(getRespostas())
    setAlunos(getAlunos())
  }

  // import CSV/JSON
  const handleImport = async (e)=>{
    const files = Array.from(e.target.files || [])
    if(files.length===0) return
    let total=0
    for(const file of files){
      const text = await file.text()
      try{
        if(file.name.endsWith('.json')){
          const data = JSON.parse(text)
          // data is array of respostas
          const all = getRespostas()
          let added=0
          for(const r of data){
            // ensure aluno exists
            const idx=all.findIndex(x=> x.turma===r.turma && x.componente===r.componente && x.trimestre===r.trimestre && String(x.alunoNumero)===String(r.alunoNumero))
            if(idx>=0) all[idx]=r
            else all.push(r)
            added++
          }
          setRespostas(all); added && (total+=added)
        } else {
          // CSV
          const parsed = Papa.parse(text, {header:true, skipEmptyLines:true})
          const rows = parsed.data
          const all = getRespostas()
          const alunosList = getAlunos()
          for(const rawRow of rows){
            const row = normalizeRow(rawRow)
            const info = extractAlunoInfo(row, null)
            let { turma: turmaFinal, numero, nome, trimestre, componente } = info
            trimestre = trimestre || filtroTri || '2TRI'
            if(!nome || !componente) continue
            if(!turmaFinal){
              const byNome = alunosList.find(a=> a.nome.toLowerCase()===nome.toLowerCase())
              if(byNome){ turmaFinal=byNome.turma; numero = byNome.numero }
              else continue
            }
            if(!numero){
              const byNome = alunosList.find(a=> a.turma===turmaFinal && a.nome.toLowerCase()===nome.toLowerCase())
              if(byNome) numero = byNome.numero
              else numero = String(alunosList.filter(a=>a.turma===turmaFinal).length + 1)
            }
            const dados = extractDados(row)
            const has = Object.values(dados).some(v=> String(v).trim()!=='')
            if(!has) continue
            const entry={ turma: turmaFinal, componente, trimestre, alunoNumero: String(numero), alunoNome: nome.toUpperCase(), dados, updatedAt: new Date().toISOString()}
            const idx=all.findIndex(x=> x.turma===entry.turma && x.componente===entry.componente && x.trimestre===entry.trimestre && String(x.alunoNumero)===String(entry.alunoNumero))
            if(idx>=0) all[idx]=entry; else all.push(entry)
            total++
          }
          setRespostas(all)
        }
      }catch(err){ console.error(err); setImportLog('Erro em '+file.name+': '+err.message)}
    }
    refresh()
    setImportLog(`${total} registros importados de ${files.length} arquivo(s).`)
    e.target.value=''
  }

  // Index para performance: Map em vez de find linear (2900 células)
  const respostasMap = useMemo(()=>{
    const m = new Map()
    for(const r of respostas){
      m.set(`${r.turma}|${r.componente}|${r.trimestre}|${String(r.alunoNumero)}`, r)
    }
    return m
  }, [respostas])

  const filteredAlunos = useMemo(()=>{
    let list = alunos
    if(filtroTurma!=='todas') list = list.filter(a=>a.turma===filtroTurma)
    if(busca) list = list.filter(a=>a.nome.toLowerCase().includes(busca.toLowerCase()) || String(a.numero).includes(busca))
    return list.sort((a,b)=> a.turma.localeCompare(b.turma) || Number(a.numero)-Number(b.numero))
  }, [alunos, filtroTurma, busca])

  // paginação: por turma mostra tudo (~20), visão geral pagina 30 por vez
  const totalPaginas = Math.max(1, Math.ceil(filteredAlunos.length / porPagina))
  const paginaSafe = Math.min(pagina, totalPaginas)
  const alunosPaginados = useMemo(()=>{
    if(filteredAlunos.length <= porPagina) return filteredAlunos
    const start = (paginaSafe - 1) * porPagina
    return filteredAlunos.slice(start, start + porPagina)
  }, [filteredAlunos, paginaSafe])

  useEffect(()=>{ setPagina(1) }, [filtroTurma, busca, filtroComp, filtroTri])

  const compsToShow = useMemo(()=>{
    if(filtroComp!=='todos') return [filtroComp]
    return componentes
  }, [componentes, filtroComp])

  const getCell = (aluno, comp)=>{
    const tri = filtroTri || getConfig().trimestre
    const r = respostasMap.get(`${aluno.turma}|${comp}|${tri}|${String(aluno.numero)}`)
    if(!r) return null
    const d=r.dados
    const count = Object.values(d).filter(v=>String(v).trim()!=='').length
    if(count===0) return { r, count:0, has:false }
    // desempenho fields for performance
    const desempenhoKeys = ['aproveitamento','participacao','cumprimento','progresso','colaboracao','proatividade','concentracao']
    const vals = desempenhoKeys.map(k=> classifyValor(d[k]||''))
    const hasRuim = vals.includes('nao')
    const hasParcial = vals.includes('parcial')
    const hasSim = vals.includes('sim')
    let performance = 'sem_avaliacao'
    if(hasRuim) performance='ruim'
    else if(hasParcial) performance='mediana'
    else if(hasSim) performance='otima'
    else performance='sem_avaliacao'

    // alertas: intervenção (necessidade SIM), comportamento (qualquer ação exceto nãoIntervim), reforço
    const temIntervencao = classifyValor(d.necessidade||'')==='sim' // SIM = precisa = alerta vermelho
    const temComportamento = !!(d.conversei || d.disciplinar || d.educacional || d.comunicado || d.tirei || d.observacoes)
    const temReforco = !!(d.reforco && String(d.reforco).trim()!=='')
    const temAlerta = temIntervencao || temComportamento || temReforco

    // cor: verde só se ótima sem alerta, amarelo mediana sem alerta, vermelho se ruim ou qualquer alerta
    let cor = 'emerald' // verde
    let label = 'Ótima'
    if(temAlerta || performance==='ruim'){
      cor='red'; label='Atenção'
      if(temReforco) label='Reforço'
      else if(temIntervencao) label='Intervenção'
      else if(temComportamento) label='Comportamento'
      else label='Baixo desempenho'
    } else if(performance==='mediana'){
      cor='amber'; label='Mediana'
    } else if(performance==='otima'){
      cor='emerald'; label='Ótima'
    } else {
      cor='slate'; label='Sem avaliação'
    }

    const flags=[]
    if(temIntervencao) flags.push('⚠️')
    if(temComportamento) flags.push('💬')
    if(temReforco) flags.push('📚')
    if(performance==='ruim') flags.push('🔴')
    else if(performance==='mediana') flags.push('🟡')
    else if(performance==='otima') flags.push('🟢')

    return { r, count, flags, has:true, performance, temAlerta, temIntervencao, temComportamento, temReforco, cor, label }
  }

  const stats = useMemo(()=>{
    const tri = filtroTri || getConfig().trimestre
    const totalCells = filteredAlunos.length * compsToShow.length
    let filled=0, withObs=0, withReforco=0, verdes=0, amarelos=0, vermelhos=0
    for(const a of filteredAlunos) for(const c of compsToShow){
      const cell=getCell(a,c)
      if(cell?.has) filled++
      if(cell?.r?.dados?.observacoes) withObs++
      if(cell?.r?.dados?.reforco) withReforco++
      if(cell?.cor==='emerald') verdes++
      else if(cell?.cor==='amber') amarelos++
      else if(cell?.cor==='red') vermelhos++
    }
    return { totalCells, filled, pct: totalCells? Math.round(filled/totalCells*100):0, withObs, withReforco, verdes, amarelos, vermelhos }
  }, [filteredAlunos, compsToShow, respostas, filtroTri])

  if(!auth){
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Dashboard Geral — Coordenação</h2>
        <p className="text-sm text-slate-500 mb-4">Acesso com senha simples.</p>
        <form onSubmit={handleAuth} className="space-y-3">
          <input type="password" value={pwdInput} onChange={e=>setPwdInput(e.target.value)} placeholder="Senha" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <button type="submit" className="w-full bg-sky-600 text-white py-3 rounded-xl font-semibold hover:bg-sky-700">Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel Geral</h1>
          <p className="text-sm text-slate-500">Acompanhe por turma, componente e desempenho — com atualização em tempo real.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="bg-white border border-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 cursor-pointer">
            Importar dados
            <input type="file" accept=".csv,.json" multiple onChange={handleImport} className="hidden" />
          </label>
          <button onClick={()=>exportGeralCSV(respostas.filter(r=> !filtroTri || r.trimestre===filtroTri), alunos, turmas, componentes, filtroTri, `GERAL - PRE CONSELHO ${filtroTri}.csv`)} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-black">Exportar</button>
        </div>
      </div>

      {importLog && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3 rounded-xl">{importLog}</div>}

      {/* Filtros — padrão por turma, com opção visão geral */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Visão:</span>
            <div className="flex rounded-xl overflow-hidden border border-slate-300">
              <button onClick={()=>{ if(turmas[0]) setFiltroTurma(turmas[0].nome) }} className={`px-3 py-1.5 text-xs font-medium ${filtroTurma!=='todas' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Por turma</button>
              <button onClick={()=> setFiltroTurma('todas')} className={`px-3 py-1.5 text-xs font-medium ${filtroTurma==='todas' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>Visão geral (todas)</button>
            </div>
            <span className="text-xs text-slate-500 hidden sm:inline">{filtroTurma==='todas' ? `${filteredAlunos.length} alunos • ${compsToShow.length} componentes` : `${filteredAlunos.length} alunos em ${filtroTurma}`}</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${filtroTurma==='todas' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-sky-100 text-sky-700 border border-sky-200'}`}>{filtroTurma==='todas' ? 'Geral' : `Turma ${filtroTurma}`}</span>
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Turma</label>
            <select value={filtroTurma} onChange={e=>setFiltroTurma(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
              <option value="todas">Todas — Visão geral ({alunos.length})</option>
              {turmas.map(t=> <option key={t.nome} value={t.nome}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Componente</label>
            <select value={filtroComp} onChange={e=>setFiltroComp(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
              <option value="todos">Todos ({componentes.length})</option>
              {componentes.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Trimestre</label>
            <select value={filtroTri} onChange={e=>setFiltroTri(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
              <option value="">Todos</option><option>1TRI</option><option>2TRI</option><option>3TRI</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Buscar aluno</label>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome ou nº" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Visualização</label>
            <div className="mt-1 flex rounded-xl overflow-hidden border border-slate-300">
              <button onClick={()=>setView('matriz')} className={`flex-1 py-2 text-xs font-medium ${view==='matriz'?'bg-slate-900 text-white':'bg-white text-slate-600'}`}>Matriz</button>
              <button onClick={()=>setView('lista')} className={`flex-1 py-2 text-xs font-medium ${view==='lista'?'bg-slate-900 text-white':'bg-white text-slate-600'}`}>Lista</button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="bg-slate-100 px-2.5 py-1 rounded-full">{stats.filled}/{stats.totalCells} preenchidas • {stats.pct}%</span>
          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {stats.verdes} ótimas</span>
          <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> {stats.amarelos} medianas</span>
          <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> {stats.vermelhos} atenção (ruim ou alerta)</span>
          <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">💬 {stats.withObs} obs • 📚 {stats.withReforco} reforço</span>
          <button onClick={()=>{sessionStorage.removeItem('sm_geral_auth'); setAuth(false)}} className="ml-auto text-slate-500 hover:text-slate-700">Sair</button>
        </div>
      </div>

      {view==='matriz' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  <th className="sticky left-0 bg-slate-900 px-3 py-3 text-left font-semibold border-r border-slate-700 min-w-[220px]">Aluno</th>
                  {compsToShow.map(c=> <th key={c} className="px-2 py-3 font-medium min-w-[110px] border-l border-slate-700 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlunos.length===0 ? <tr><td colSpan={compsToShow.length+1} className="px-4 py-12 text-center text-slate-400">Nenhum aluno encontrado para os filtros atuais.</td></tr> :
                  alunosPaginados.map(a=>{
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-3 py-2.5 border-r border-slate-200 font-medium text-slate-900 whitespace-nowrap">
                          <button onClick={()=>setSelectedAluno(a)} className="text-left hover:text-sky-600">
                            <div className="text-sm">{a.numero} • {a.nome}</div>
                            <div className="text-[11px] text-slate-500">{a.turma}</div>
                          </button>
                        </td>
                        {compsToShow.map(c=>{
                          const cell=getCell(a,c)
                          if(!cell || !cell.has) return <td key={c} className="px-2 py-2 border-l border-slate-100 text-center text-slate-300">—</td>
                          const colorMap = {
                            emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                            amber: 'bg-amber-100 text-amber-700 border-amber-300',
                            red: 'bg-red-100 text-red-700 border-red-300',
                            slate: 'bg-slate-100 text-slate-600 border-slate-200'
                          }
                          const color = colorMap[cell.cor] || colorMap.slate
                          return (
                            <td key={c} className="px-2 py-2 border-l border-slate-100 text-center">
                              <button onClick={()=>setSelectedAluno(a)} title={`${cell.label} • ${cell.performance} ${cell.temAlerta? '• Alerta':''}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium ${color}`}>
                                <span className="w-2 h-2 rounded-full" style={{background: cell.cor==='emerald' ? '#10b981' : cell.cor==='amber' ? '#f59e0b' : cell.cor==='red' ? '#ef4444' : '#64748b'}}></span>
                                {cell.label}
                                <span className="opacity-60">{cell.flags.slice(0,2).join(' ')}</span>
                              </button>
                              {cell.r.dados.observacoes && <div className="text-[10px] text-slate-500 truncate max-w-[110px] mt-1" title={cell.r.dados.observacoes}>{cell.r.dados.observacoes.slice(0,40)}</div>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-200 border border-emerald-300"></span> Ótima (verde) — todos Sim e sem alertas</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-200 border border-amber-300"></span> Mediana (amarelo) — algum Parcial</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 border border-red-300"></span> Atenção (vermelho) — ruim (Não) ou alerta (intervenção/comportamento/reforço)</span>
            <span className="ml-auto hidden sm:inline">Clique no aluno para detalhes</span>
          </div>
          {totalPaginas>1 && (
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">Página {paginaSafe} de {totalPaginas} • {filteredAlunos.length} alunos • {filteredAlunos.length>porPagina ? `mostrando ${alunosPaginados.length}` : ''}</span>
              <div className="flex gap-1">
                <button disabled={paginaSafe<=1} onClick={()=>setPagina(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs disabled:opacity-40 hover:bg-slate-50">‹ Anterior</button>
                <span className="px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg">{paginaSafe}</span>
                <button disabled={paginaSafe>=totalPaginas} onClick={()=>setPagina(p=>Math.min(totalPaginas,p+1))} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs disabled:opacity-40 hover:bg-slate-50">Próxima ›</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100 max-h-[65vh] overflow-auto">
            {alunosPaginados.map(a=>{
              const comps = compsToShow.map(c=> ({c, cell: getCell(a,c)})).filter(x=>x.cell?.has)
              return (
                <div key={a.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{a.numero} • {a.nome} <span className="text-xs font-normal text-slate-500">• {a.turma}</span></div>
                      <div className="text-xs text-slate-500 mt-1">{comps.length===0 ? 'Nenhum preenchimento neste filtro' : `${comps.length} componentes com dados`}</div>
                    </div>
                    <button onClick={()=>setSelectedAluno(a)} className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-full">Ver detalhes</button>
                  </div>
                  {comps.length>0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {comps.map(({c, cell})=> {
                        const dot = cell.cor==='emerald' ? 'bg-emerald-500' : cell.cor==='amber' ? 'bg-amber-500' : cell.cor==='red' ? 'bg-red-500' : 'bg-slate-400'
                        return (
                          <span key={c} className={`inline-flex items-center gap-1 border px-2.5 py-1 rounded-full text-xs ${cell.cor==='emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : cell.cor==='amber' ? 'bg-amber-50 border-amber-200 text-amber-700' : cell.cor==='red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${dot}`}></span><strong>{c}</strong> <span>• {cell.label}</span> {cell.temAlerta && '⚠️'} {cell.r.dados.observacoes && <span title={cell.r.dados.observacoes}>💬</span>} {cell.r.dados.reforco && '📚'}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {totalPaginas>1 && (
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">Página {paginaSafe} de {totalPaginas} • {filteredAlunos.length} alunos</span>
              <div className="flex gap-1">
                <button disabled={paginaSafe<=1} onClick={()=>setPagina(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs disabled:opacity-40 hover:bg-slate-50">‹ Anterior</button>
                <span className="px-3 py-1.5 text-xs bg-slate-900 text-white rounded-lg">{paginaSafe}</span>
                <button disabled={paginaSafe>=totalPaginas} onClick={()=>setPagina(p=>Math.min(totalPaginas,p+1))} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs disabled:opacity-40 hover:bg-slate-50">Próxima ›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal aluno */}
      {selectedAluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>setSelectedAluno(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-slate-900">{selectedAluno.numero} • {selectedAluno.nome}</h3>
                <p className="text-xs text-slate-500">{selectedAluno.turma} • {filtroTri || getConfig().trimestre}</p>
              </div>
              <button onClick={()=>setSelectedAluno(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">×</button>
            </div>
            <div className="overflow-auto p-6 space-y-4">
              {compsToShow.map(c=>{
                const cell=getCell(selectedAluno,c)
                if(!cell?.has) return (
                  <div key={c} className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="font-medium text-sm text-slate-700">{c}</div>
                    <div className="text-xs text-slate-400">Sem preenchimento</div>
                  </div>
                )
                const d=cell.r.dados
                const headerColor = cell.cor==='emerald' ? 'bg-emerald-600' : cell.cor==='amber' ? 'bg-amber-500' : cell.cor==='red' ? 'bg-red-600' : 'bg-slate-700'
                return (
                  <div key={c} className="border-2 rounded-xl overflow-hidden" style={{borderColor: cell.cor==='emerald' ? '#10b981' : cell.cor==='amber' ? '#f59e0b' : cell.cor==='red' ? '#ef4444' : '#e2e8f0'}}>
                    <div className={`${headerColor} text-white px-4 py-2 flex items-center justify-between`}>
                      <span className="font-semibold text-sm flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${cell.cor==='emerald'?'bg-white': cell.cor==='amber'?'bg-white':'bg-white'}`}></span>{c} • {cell.r.trimestre} • {cell.label}</span>
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{cell.performance} • {cell.count} campos {cell.temAlerta ? '• ⚠️ Alerta' : ''}</span>
                    </div>
                    <div className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div><strong>Aproveitamento:</strong> {d.aproveitamento||'—'}</div>
                        <div><strong>Participação:</strong> {d.participacao||'—'}</div>
                        <div><strong>Prazos:</strong> {d.cumprimento||'—'}</div>
                        <div><strong>Progresso:</strong> {d.progresso||'—'}</div>
                        <div><strong>Colaboração:</strong> {d.colaboracao||'—'}</div>
                        <div><strong>Proatividade:</strong> {d.proatividade||'—'}</div>
                        <div><strong>Concentração:</strong> {d.concentracao||'—'}</div>
                      </div>
                      <div className="space-y-1">
                        <div><strong>Nec. intervenção:</strong> {d.necessidade||'—'}</div>
                        <div><strong>Respostas positivas:</strong> {d.respostasPositivas||'—'}</div>
                        <div className="pt-2 border-t border-slate-100 mt-2">
                          <div className="text-xs font-semibold text-slate-600">Comportamento:</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {d.conversei && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">Conversei</span>}
                            {d.disciplinar && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">Disc.</span>}
                            {d.educacional && <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full text-xs">Educ.</span>}
                            {d.comunicado && <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full text-xs">Comunicado</span>}
                            {d.tirei && <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs">Tirei sala</span>}
                            {!d.conversei && !d.disciplinar && !d.educacional && !d.comunicado && !d.tirei && <span className="text-slate-400 text-xs">Nenhuma ação</span>}
                          </div>
                          {d.observacoes && <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-sm text-amber-900">💬 {d.observacoes}</div>}
                          {d.reforco && <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-sm text-emerald-900">📚 Reforço: {d.motivo || 'Sem motivo detalhado'}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button onClick={()=>setSelectedAluno(null)} className="px-4 py-2 rounded-xl border border-slate-300 text-sm">Fechar</button>
              <button onClick={()=>{
                const tri = filtroTri || getConfig().trimestre
                const rows = componentes.map(c=>{
                  const r=respostas.find(x=> x.turma===selectedAluno.turma && x.componente===c && x.trimestre===tri && String(x.alunoNumero)===String(selectedAluno.numero))
                  return r
                }).filter(Boolean)
                if(rows.length===0) alert('Nenhum dado para exportar')
                else {
                  const csv = Papa.unparse(rows.map(r=>{
                    const d=r.dados||{}
                    return {
                      'TURMA':r.turma,'NOME DO ALUNO':r.alunoNome,'Trimestre':r.trimestre,'Componente Curricular':r.componente,
                      'Aproveitamento da disciplina':d.aproveitamento||'','Participação em sala':d.participacao||'','Cumprimento dos prazos de entrega':d.cumprimento||'','Progresso em relação a si mesmo':d.progresso||'','Colaboração em atividades de grupo':d.colaboracao||'','Proatividade':d.proatividade||'','Concentração em sala':d.concentracao||'','Necessidade de intervenção pedagógica':d.necessidade||'','Respostas positivas às intervenções pedagógicas já aplicadas':d.respostasPositivas||'','Observações nas questões de comportamento':d.observacoes||'','Conversei particularmente com o(a) aluno (a)':d.conversei||'','Encaminhei para Orientação Disciplinar':d.disciplinar||'','Encaminhei para Orientação Educacional':d.educacional||'','Dei comunicado':d.comunicado||'','Tirei de sala':d.tirei||'','Não realizei intervenção sobre o comportamento do aluno(a)':d.naoIntervim||'','Encaminhado para aula(s) de reforço':d.reforco||'','Motivo do encaminhamento para reforço (campo cognitivo)':d.motivo||''
                    }
                  }))
                  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${selectedAluno.turma}-${selectedAluno.nome}-GERAL.csv`; a.click()
                }
              }} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm">Exportar aluno (CSV)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
