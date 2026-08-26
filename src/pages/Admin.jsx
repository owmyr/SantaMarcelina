import { useState, useEffect } from 'react'
import { getTurmas, setTurmas, getComponentes, setComponentes, getAlunos, setAlunos, getConfig, setConfig, importAlunosFromRows, importRespostasFromRows, getProfessores, addProfessor, removeProfessor } from '../lib/storage'
import { gerarMockAlunosPorTurma, gerarMockProfessoresUmPorMateria, gerarMockRespostasAmostra, gerarMockRespostasGeralCompleto, seedMockDataCompleto, resetMockData } from '../lib/mockData.js'
import Papa from 'papaparse'
import { parseCSVFile } from '../lib/csv'

export default function Admin() {
  const [turmas, setTurmasState] = useState([])
  const [componentes, setComponentesState] = useState([])
  const [alunos, setAlunosState] = useState([])
  const [config, setConfigState] = useState({ senha:'santa2026', trimestre:'2TRI', ano:'2025'})
  const [professores, setProfessoresState] = useState([])
  const [activeTab, setActiveTab] = useState('professores') // geral | turmas | professores | links
  const [newTurma, setNewTurma] = useState('')
  const [newComp, setNewComp] = useState('')
  const [newAlunoTurma, setNewAlunoTurma] = useState('1A')
  const [newAlunoNumero, setNewAlunoNumero] = useState('')
  const [newAlunoNome, setNewAlunoNome] = useState('')
  const [filterTurma, setFilterTurma] = useState('todas')
  const [importLog, setImportLog] = useState('')
  const [auth, setAuth] = useState(false)
  const [pwdInput, setPwdInput] = useState('')

  // professor form
  const [profNome, setProfNome] = useState('')
  const [profComp, setProfComp] = useState('')
  const [profTurmas, setProfTurmas] = useState([])

  useEffect(()=>{
    refresh()
    const savedAuth = sessionStorage.getItem('sm_admin_auth')
    if (savedAuth==='1') setAuth(true)
  }, [])
  const refresh = ()=>{
    setTurmasState(getTurmas())
    setComponentesState(getComponentes())
    setAlunosState(getAlunos())
    setConfigState(getConfig())
    setProfessoresState(getProfessores())
  }

  const handleAuth = (e)=>{
    e.preventDefault()
    if (pwdInput===getConfig().senha) {
      setAuth(true)
      sessionStorage.setItem('sm_admin_auth','1')
    } else alert('Senha incorreta. Padrão: santa2026')
  }

  if (!auth) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Área da Coordenação</h2>
        <p className="text-sm text-slate-500 mb-4">Digite a senha simples para acessar. (Padrão: <code className="bg-slate-100 px-1 rounded">santa2026</code>)</p>
        <form onSubmit={handleAuth} className="space-y-3">
          <input type="password" value={pwdInput} onChange={e=>setPwdInput(e.target.value)} placeholder="Senha" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-black">Entrar</button>
        </form>
      </div>
    )
  }

  const addTurma = ()=>{
    if(!newTurma.trim()) return
    const t = { id: newTurma.trim().toUpperCase(), nome: newTurma.trim().toUpperCase(), ano: '' }
    const all = getTurmas()
    if(all.find(x=>x.nome===t.nome)) {alert('Turma já existe'); return}
    setTurmas([...all,t]); refresh(); setNewTurma('')
  }
  const removeTurma = (nome)=>{
    if(!confirm(`Remover turma ${nome} e todos os alunos dela?`)) return
    setTurmas(getTurmas().filter(t=>t.nome!==nome))
    setAlunos(getAlunos().filter(a=>a.turma!==nome))
    // also remove from professors
    const profs=getProfessores().map(p=> ({...p, turmas: p.turmas.filter(t=>t!==nome)}))
    localStorage.setItem('sm_professores', JSON.stringify(profs))
    refresh()
  }
  const addComp = ()=>{
    if(!newComp.trim()) return
    const all = getComponentes()
    if(all.includes(newComp.trim().toUpperCase())) {alert('Já existe'); return}
    setComponentes([...all, newComp.trim().toUpperCase()]); refresh(); setNewComp('')
  }
  const removeComp = (c)=>{
    if(!confirm(`Remover componente ${c}?`)) return
    setComponentes(getComponentes().filter(x=>x!==c)); refresh()
  }
  const addAluno = ()=>{
    if(!newAlunoNome.trim() || !newAlunoNumero.trim()) {alert('Preencha número e nome'); return}
    const all = getAlunos()
    const exists = all.find(a=> a.turma===newAlunoTurma && String(a.numero)===String(newAlunoNumero))
    if(exists) {alert('Número já existe nessa turma'); return}
    const novo = { id: `${newAlunoTurma}-${newAlunoNumero}-${Date.now()}`, turma: newAlunoTurma, numero: String(newAlunoNumero), nome: newAlunoNome.trim().toUpperCase() }
    setAlunos([...all,novo]); refresh(); setNewAlunoNumero(''); setNewAlunoNome('')
  }
  const removeAluno = (id)=>{
    setAlunos(getAlunos().filter(a=>a.id!==id)); refresh()
  }
  const handleFileImport = async (e)=>{
    const file = e.target.files[0]
    if(!file) return
    try {
      let turmaFromFile = null
      const match = file.name.match(/([0-9][A-Z])\s*-/)
      if(match) turmaFromFile = match[1]
      const matchGeral = file.name.match(/\(3A\)/)
      if(matchGeral) turmaFromFile = '3A'
      let turmaEscolhida = turmaFromFile
      if(!turmaEscolhida) {
        turmaEscolhida = prompt('Não detectei a turma no nome do arquivo. Digite a turma (ex: 1A, 3A):', '1A')
      }
      if(!turmaEscolhida) return
      turmaEscolhida = turmaEscolhida.toUpperCase()
      if(!getTurmas().find(t=>t.nome===turmaEscolhida)){
        setTurmas([...getTurmas(), {id: turmaEscolhida, nome: turmaEscolhida, ano:''}])
      }
      const result = await parseCSVFile(file)
      const added = importAlunosFromRows(result.data, turmaEscolhida)
      const addedRespostas = importRespostasFromRows(result.data, turmaEscolhida)
      refresh()
      setImportLog(`Arquivo "${file.name}" importado. ${added} alunos novos em ${turmaEscolhida} + ${addedRespostas} fichas com dados.`)
      e.target.value=''
    } catch(err){
      console.error(err)
      alert('Erro ao importar: '+err.message)
    }
  }
  const handleSaveConfig = ()=>{
    setConfig(config)
    refresh()
    alert('Config salva!')
  }

  const toggleProfTurma = (t)=>{
    setProfTurmas(prev=> prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t])
  }
  const handleAddProfessor = ()=>{
    if(!profNome.trim()){ alert('Informe nome do professor'); return }
    if(!profComp) { alert('Selecione componente'); return }
    if(profTurmas.length===0){ alert('Selecione ao menos 1 turma'); return }
    const p = addProfessor({ nome: profNome.trim(), componente: profComp, turmas: profTurmas })
    refresh()
    setProfNome(''); setProfComp(''); setProfTurmas([])
    setImportLog(`Professor "${p.nome}" criado! Link: ${window.location.origin}/prof/${p.token}`)
  }
  const handleAutoGenerateProfessores = ()=>{
    if(!confirm('Gerar automaticamente 1 professor por componente com TODAS as turmas? (Você pode editar depois)')) return
    let created=0
    for(const comp of componentes){
      // skip if already exists a professor with same componente and all turmas?
      const exists = getProfessores().find(p=> p.componente===comp && p.turmas.length===turmas.length)
      if(exists) continue
      addProfessor({ nome: `Prof. ${comp}`, componente: comp, turmas: turmas.map(t=>t.nome) })
      created++
    }
    refresh()
    setImportLog(`Gerados ${created} professores automaticamente (um por componente). Edite os nomes depois.`)
    setActiveTab('professores')
  }

  const filteredAlunos = filterTurma==='todas' ? alunos : alunos.filter(a=>a.turma===filterTurma)

  // links
  const profLinks = professores.map(p=> ({
    ...p,
    url: `${window.location.origin}/prof/${p.token}?tri=${config.trimestre}`,
    alunos: p.turmas.reduce((acc,t)=> acc + getAlunos().filter(a=>a.turma===t).length, 0)
  }))
  const agregadoPorComponente = componentes.map(c=> ({
    componente: c,
    turmas: turmas.map(t=>t.nome),
    url: `${window.location.origin}/prof/${config.senha}?comp=${encodeURIComponent(c)}&tri=${config.trimestre}&token=${config.senha}`,
    // alternative hub aggregated: we will handle via /prof/:token with comp fallback, but for agregado we use /hub?comp=
    hubUrl: `${window.location.origin}/hub?comp=${encodeURIComponent(c)}&tri=${config.trimestre}&token=${config.senha}`,
    alunos: getAlunos().filter(a=> turmas.map(t=>t.nome).includes(a.turma)).length // total geral
  }))
  // For now agregado hub url will be same as prof hub with virtual professor, we create a virtual hub that accepts token=santa2026 + comp
  const agregadoLinks = componentes.map(c=> ({
    componente: c,
    url: `${window.location.origin}/hub?comp=${encodeURIComponent(c)}&tri=${config.trimestre}&token=${config.senha}`,
    alunos: turmas.reduce((acc,t)=> acc + getAlunos().filter(a=>a.turma===t.nome).length, 0)
  }))

  const legadoLinks = turmas.flatMap(t=> componentes.map(c=> ({
    turma: t.nome, componente: c,
    url: `${window.location.origin}/p?turma=${encodeURIComponent(t.nome)}&comp=${encodeURIComponent(c)}&tri=${encodeURIComponent(config.trimestre)}&token=${encodeURIComponent(config.senha)}`,
    alunos: getAlunos().filter(a=>a.turma===t.nome).length
  })))

  const tabs = [
    { id:'professores', label:'Professores', icon:'👩‍🏫', count: professores.length },
    { id:'links', label:'Links', icon:'🔗', count: profLinks.length },
    { id:'turmas', label:'Turmas & Alunos', icon:'🎒', count: alunos.length },
    { id:'geral', label:'Config', icon:'⚙️' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordenação — Central</h1>
          <p className="text-sm text-slate-500">Organize turmas, professores e gere <strong>1 link por professor</strong> para todas as turmas dele.</p>
        </div>
        <button onClick={()=>{sessionStorage.removeItem('sm_admin_auth'); setAuth(false)}} className="text-sm text-slate-500 hover:text-slate-700">Sair</button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1 overflow-auto">
        {tabs.map(tab=> (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex-1 min-w-[130px] px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition ${activeTab===tab.id ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>
            <span>{tab.icon}</span> {tab.label} {tab.count!==undefined && <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab===tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {importLog && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3 rounded-xl">{importLog}</div>}

      {/* TAB: Professores */}
      {activeTab==='professores' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10"></div>
            <div className="relative">
              <h2 className="text-xl font-bold">👩‍🏫 Professores — 1 link resolve várias turmas</h2>
              <p className="text-sky-100 text-sm mt-1 max-w-3xl">Cada professor recebe <strong>um único link</strong> que já abre TODAS as turmas dele. Ex: Prof. de GEO que dá aula em 1A, 2A e 3A recebe 1 link e dentro dele alterna as turmas por abas. Chega de 5 links por professor!</p>
              <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/15 backdrop-blur rounded-xl p-3"><div className="font-bold text-lg">{professores.length}</div><div className="text-sky-100">Professores cadastrados</div></div>
                <div className="bg-white/15 backdrop-blur rounded-xl p-3"><div className="font-bold text-lg">{turmas.length} turmas</div><div className="text-sky-100">9A, 9B, 1A, 1B, 2A, 3A</div></div>
                <div className="bg-white/15 backdrop-blur rounded-xl p-3"><div className="font-bold text-lg">21 → {professores.length || '?'}</div><div className="text-sky-100">links (antes 126)</div></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">➕ Cadastrar professor</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome do professor</label>
                <input value={profNome} onChange={e=>setProfNome(e.target.value)} placeholder="Ex: Maria Silva" className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Componente</label>
                <select value={profComp} onChange={e=>setProfComp(e.target.value)} className="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm">
                  <option value="">Selecione</option>
                  {componentes.map(c=> <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleAddProfessor} className="w-full bg-sky-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-sky-700">Criar professor + Gerar link único</button>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-600">Turmas que este professor leciona (marque várias)</label>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {turmas.map(t=> (
                  <label key={t.nome} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${profTurmas.includes(t.nome) ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="checkbox" checked={profTurmas.includes(t.nome)} onChange={()=>toggleProfTurma(t.nome)} className="rounded border-slate-300 text-sky-600" />
                    <span className="text-sm font-medium">{t.nome}</span>
                    <span className="text-xs text-slate-500">({getAlunos().filter(a=>a.turma===t.nome).length})</span>
                  </label>
                ))}
              </div>
              {profTurmas.length>0 && <p className="text-xs text-emerald-700 mt-2">✓ Selecionadas: {profTurmas.join(', ')} • {profTurmas.reduce((acc,t)=> acc + getAlunos().filter(a=>a.turma===t).length,0)} alunos no total</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleAutoGenerateProfessores} className="text-sm border border-amber-300 bg-amber-50 text-amber-800 px-4 py-2 rounded-xl hover:bg-amber-100">⚡ Gerar automaticamente 1 professor por componente</button>
              <span className="text-xs text-slate-500 self-center">Cria 21 links agregados (1 por matéria) cobrindo todas as turmas</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Professores cadastrados ({professores.length})</h3>
              {professores.length>0 && <button onClick={()=>{ const text=profLinks.map(p=>`${p.nome} - ${p.componente} (${p.turmas.join(', ')}) - ${p.alunos} alunos: ${p.url}`).join('\n'); navigator.clipboard.writeText(text); alert('Copiado!')}} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-xl">Copiar todos</button>}
            </div>
            {professores.length===0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">👩‍🏫</div>
                <p className="text-sm font-medium text-slate-900">Nenhum professor cadastrado</p>
                <p className="text-xs text-slate-500 mt-1">Cadastre acima ou gere automaticamente. Cada professor terá 1 link com todas as turmas.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {professores.map(p=>{
                  const link = profLinks.find(x=>x.id===p.id)
                  return (
                    <div key={p.id} className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{p.nome}</span>
                          <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded-full font-medium">{p.componente}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{p.turmas.join(' • ')}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{link.alunos} alunos • Token: <code className="bg-slate-100 px-1 rounded font-mono">{p.token}</code> • {config.trimestre}</div>
                        <div className="mt-2 flex gap-2">
                          <input readOnly value={link.url} className="flex-1 min-w-0 text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-2 font-mono truncate" />
                          <button onClick={()=>{navigator.clipboard.writeText(link.url); alert('Copiado!')}} className="shrink-0 text-xs bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50">Copiar</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={link.url} target="_blank" rel="noreferrer" className="bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sky-700">Abrir hub</a>
                        <button onClick={()=>{ if(confirm(`Remover ${p.nome}?`)){ removeProfessor(p.id); refresh() } }} className="text-xs text-red-600 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50">Remover</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Links */}
      {activeTab==='links' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900">🔗 Links — Escolha o formato</h3>
            <div className="mt-3 grid md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border-2 border-sky-500 bg-sky-50">
                <div className="font-bold text-sky-900 text-sm">✅ Recomendado: Por Professor (1 link cada)</div>
                <div className="text-xs text-sky-700 mt-1">1 link agrega todas as turmas daquele professor. Você gerencia na aba Professores. Ex: 21 professores → 21 links.</div>
                <div className="text-xs font-mono bg-white border border-sky-200 rounded-lg px-2 py-1 mt-2 truncate">/prof/TOKEN?tri=2TRI</div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="font-bold text-slate-900 text-sm">📦 Agregado por Componente</div>
                <div className="text-xs text-slate-500 mt-1">1 link por matéria cobrindo TODAS as turmas (útil se professor não cadastrado). 21 links.</div>
                <div className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 mt-2 truncate">/hub?comp=GEO&token=...</div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="font-bold text-slate-900 text-sm">📄 Legado: Por Turma+Componente</div>
                <div className="text-xs text-slate-500 mt-1">1 link por combinação turma+matéria. 126 links. Use só se precisar enviar por equipe do Teams por série.</div>
                <div className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 mt-2 truncate">/p?turma=1A&comp=...</div>
              </div>
            </div>
          </div>

          {/* Agregado por componente */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Links agregados por componente ({agregadoLinks.length})</h3>
              <button onClick={()=>{ const t=agregadoLinks.map(l=>`${l.componente} (${l.alunos} alunos): ${l.url}`).join('\n'); navigator.clipboard.writeText(t); alert('Copiado!')}} className="text-sm bg-sky-600 text-white px-4 py-2 rounded-xl">Copiar</button>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-3 max-h-[28rem] overflow-auto">
              {agregadoLinks.map(l=> (
                <div key={l.componente} className="border border-slate-200 rounded-xl p-3 hover:border-sky-300 hover:bg-sky-50/50">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-slate-900">{l.componente}</div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">1 link • {l.alunos} alunos • {turmas.length} turmas</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Todas as turmas: {turmas.map(t=>t.nome).join(', ')}</div>
                  <div className="mt-2 flex gap-2">
                    <input readOnly value={l.url} className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-mono truncate" />
                    <button onClick={()=>{navigator.clipboard.writeText(l.url); alert('Copiado!')}} className="text-xs bg-white border px-3 py-1.5 rounded-lg">Copiar</button>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg">Abrir</a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Professores links highlight */}
          {profLinks.length>0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Links por professor ({profLinks.length}) — Recomendado</h3>
                <p className="text-xs text-slate-500">Cada professor acessa 1 link e alterna as turmas por abas no topo.</p>
              </div>
              <div className="p-6 grid md:grid-cols-2 gap-3 max-h-[28rem] overflow-auto">
                {profLinks.map(l=> (
                  <div key={l.id} className="border-2 border-sky-200 bg-sky-50 rounded-xl p-3">
                    <div className="font-semibold text-sm text-sky-900">{l.nome} • {l.componente}</div>
                    <div className="text-xs text-sky-700">{l.turmas.join(' • ')} • {l.alunos} alunos</div>
                    <div className="mt-2 flex gap-2">
                      <input readOnly value={l.url} className="flex-1 text-[11px] bg-white border border-sky-200 rounded-lg px-2 py-1.5 font-mono truncate" />
                      <button onClick={()=>{navigator.clipboard.writeText(l.url); alert('Copiado!')}} className="text-xs bg-white border px-3 py-1.5 rounded-lg">Copiar</button>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded-lg">Abrir</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legado collapsible */}
          <details className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer font-semibold text-slate-700 flex items-center justify-between">
              <span>Ver links legados por turma+componente ({legadoLinks.length}) — avançado</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{legadoLinks.length} links</span>
            </summary>
            <div className="p-6 border-t border-slate-200">
              <div className="flex justify-end mb-3">
                <button onClick={()=>{ const t=legadoLinks.map(l=>`${l.turma} - ${l.componente}: ${l.url}`).join('\n'); navigator.clipboard.writeText(t); alert('Copiado!')}} className="text-sm bg-slate-900 text-white px-4 py-2 rounded-xl">Copiar todos legados</button>
              </div>
              <div className="grid md:grid-cols-2 gap-3 max-h-[28rem] overflow-auto">
                {legadoLinks.map(l=> (
                  <div key={l.turma+'-'+l.componente} className="border border-slate-200 rounded-xl p-3">
                    <div className="font-semibold text-sm">{l.turma} • {l.componente}</div>
                    <div className="text-xs text-slate-500">{l.alunos} alunos</div>
                    <div className="mt-2 flex gap-2">
                      <input readOnly value={l.url} className="flex-1 text-[11px] bg-slate-50 border rounded-lg px-2 py-1.5 font-mono truncate" />
                      <button onClick={()=>{navigator.clipboard.writeText(l.url); alert('Copiado!')}} className="text-xs bg-white border px-3 py-1.5 rounded-lg">Copiar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}

      {/* TAB: Turmas & Alunos */}
      {activeTab==='turmas' && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Turmas ({turmas.length})</h2>
              <div className="flex gap-2 mb-3">
                <input value={newTurma} onChange={e=>setNewTurma(e.target.value)} placeholder="Ex: 1A" className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm" />
                <button onClick={addTurma} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium">Adicionar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {turmas.map(t=> (
                  <span key={t.nome} className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-sm">
                    {t.nome} <span className="text-xs text-slate-500">({getAlunos().filter(a=>a.turma===t.nome).length})</span>
                    <button onClick={()=>removeTurma(t.nome)} className="text-slate-400 hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Componentes ({componentes.length})</h2>
              <div className="flex gap-2 mb-3">
                <input value={newComp} onChange={e=>setNewComp(e.target.value)} placeholder="Ex: HIS ART" className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm" />
                <button onClick={addComp} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium">Adicionar</button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
                {componentes.map(c=> (
                  <span key={c} className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full text-xs font-medium text-sky-800">
                    {c} <button onClick={()=>removeComp(c)} className="ml-1 text-sky-400 hover:text-red-600">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Alunos ({alunos.length})</h2>
              <div className="flex items-center gap-2">
                <select value={filterTurma} onChange={e=>setFilterTurma(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-xl text-sm">
                  <option value="todas">Todas turmas</option>
                  {turmas.map(t=> <option key={t.nome} value={t.nome}>{t.nome}</option>)}
                </select>
                <label className="bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sky-700 cursor-pointer">
                  Importar CSV
                  <input type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
                </label>
              </div>
            </div>
            {importLog && <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm p-3 rounded-xl">{importLog}</div>}
            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Turma</label>
                  <select value={newAlunoTurma} onChange={e=>setNewAlunoTurma(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
                    {turmas.map(t=> <option key={t.nome} value={t.nome}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Nº</label>
                  <input value={newAlunoNumero} onChange={e=>setNewAlunoNumero(e.target.value)} placeholder="1" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
                </div>
                <div className="sm:col-span-6">
                  <label className="text-xs font-medium text-slate-600">Nome completo</label>
                  <input value={newAlunoNome} onChange={e=>setNewAlunoNome(e.target.value)} placeholder="Nome do aluno" className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <button onClick={addAluno} className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium">Adicionar</button>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs text-slate-500">
                        <th className="px-4 py-2">Turma</th><th className="px-4 py-2">Nº</th><th className="px-4 py-2">Nome</th><th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAlunos.length===0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum aluno. Importe o CSV do 1A ou 3A.</td></tr> : filteredAlunos.map(a=> (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium">{a.turma}</td>
                          <td className="px-4 py-2">{a.numero}</td>
                          <td className="px-4 py-2">{a.nome}</td>
                          <td className="px-4 py-2 text-right"><button onClick={()=>removeAluno(a.id)} className="text-xs text-red-600 hover:underline">Remover</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB: Config */}
      {activeTab==='geral' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">⚙️ Configuração Geral</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Senha simples (link público)</label>
                <input value={config.senha} onChange={e=>setConfigState({...config, senha: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Trimestre atual</label>
                <select value={config.trimestre} onChange={e=>setConfigState({...config, trimestre: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm">
                  <option>1TRI</option><option>2TRI</option><option>3TRI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ano</label>
                <input value={config.ano} onChange={e=>setConfigState({...config, ano: e.target.value})} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
              </div>
            </div>
            <button onClick={handleSaveConfig} className="mt-4 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sky-700">Salvar config</button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-3">📦 Mock Data — Teste sem CSVs reais</h3>
            <p className="text-sm text-slate-500 mb-3">Gere automaticamente alunos fictícios para as 6 turmas e <strong>1 professor por matéria (21)</strong> com todas as turmas, como solicitado. Ideal para testar UX antes dos professores enviarem dados reais.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={()=>{
                const r = gerarMockAlunosPorTurma()
                refresh()
                setImportLog(`Mock alunos: ${r.criados} criados (total ${r.total}). Cada turma agora tem 18-28 alunos fictícios.`)
              }} className="text-sm bg-sky-600 text-white px-4 py-2 rounded-xl hover:bg-sky-700">👩‍🎓 Gerar alunos (6 turmas)</button>
              <button onClick={()=>{
                const r = gerarMockProfessoresUmPorMateria()
                refresh()
                setImportLog(`Mock professores: ${r.criados} criados (total ${r.total}). 1 por matéria com todas as turmas.`)
              }} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700">👩‍🏫 Gerar 1 prof por matéria (21)</button>
              <button onClick={()=>{
                const r = seedMockDataCompleto({ comAmostra: true })
                refresh()
                setImportLog(`Mock completo: ${r.alunos.criados} alunos + ${r.professores.criados} professores + ${r.amostra} fichas de exemplo (verde/amarelo/vermelho) para testar GERAL.`)
              }} className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700">⚡ Gerar tudo (alunos + 21 profs + amostra)</button>
              <button onClick={()=>{
                if(confirm('Gerar amostra leve de 18 fichas (ótima/mediana/ruim) para visualizar cores no GERAL?')){
                  const n = gerarMockRespostasAmostra()
                  refresh()
                  setImportLog(`${n} fichas leves criadas (2 turmas × 3 componentes × 3 perfis).`)
                }
              }} className="text-sm bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600">🎨 Amostra leve GERAL (18)</button>
              <button onClick={()=>{
                if(confirm('Popular GERAL com 40% de preenchimento para todas as 6 turmas × 21 matérias? Isso cria ~1000 fichas variadas (verde/amarelo/vermelho) para testar a matriz.')){
                  const t0=Date.now()
                  const n = gerarMockRespostasGeralCompleto({ densidade: 0.4 })
                  refresh()
                  setImportLog(`${n} fichas populadas em ${((Date.now()-t0)/1000).toFixed(1)}s — TODAS as 6 turmas × 21 matérias com 40% de preenchimento. Veja em /geral.`)
                }
              }} className="text-sm bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700">📊 Popular GERAL (6×21 • 40%)</button>
              <button onClick={()=>{
                if(confirm('Resetar tudo e recriar mock limpo?')) {
                  resetMockData()
                  refresh()
                  setImportLog('Reset completo: mock recriado com amostra leve (18).')
                }
              }} className="text-sm text-slate-600 border border-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50">♻️ Resetar mock</button>
              <button onClick={()=>{
                if(confirm('Limpar todos alunos, respostas e professores?')) {
                  localStorage.removeItem('sm_alunos'); localStorage.removeItem('sm_respostas'); localStorage.removeItem('sm_professores'); location.reload()
                }
              }} className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50">🗑️ Limpar tudo</button>
            </div>
            <p className="text-xs text-slate-500 mt-3">Os dados são gerados localmente no seu navegador (localStorage). Quando os professores começarem a enviar via links, os dados reais substituirão o mock. CSVs reais ainda podem ser importados via aba “Turmas & Alunos” → Importar CSV.</p>
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-semibold text-slate-700">Estado atual:</div>
              <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-2">
                <span className="bg-white border px-2 py-1 rounded-full">{alunos.length} alunos</span>
                <span className="bg-white border px-2 py-1 rounded-full">{getProfessores().length} professores</span>
                <span className="bg-white border px-2 py-1 rounded-full">{turmas.length} turmas</span>
                <span className="bg-white border px-2 py-1 rounded-full">{componentes.length} componentes</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-2">📄 Importar CSV real (quando tiver)</h3>
            <p className="text-sm text-slate-500 mb-3">Se receber CSVs legados, importe aqui. O sistema detecta turma pelo nome do arquivo e converte valores como BAIXO/REGULAR para Sim/Não/Parcial.</p>
            <label className="bg-white border border-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 cursor-pointer inline-block">
              Importar CSV legado
              <input type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
            </label>
            <span className="text-xs text-slate-400 ml-3">Também disponível em “Turmas & Alunos”</span>
          </div>
        </div>
      )}
    </div>
  )
}
