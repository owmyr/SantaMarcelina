const KEYS = {
  turmas: 'sm_turmas',
  alunos: 'sm_alunos',
  componentes: 'sm_componentes',
  respostas: 'sm_respostas',
  config: 'sm_config',
  professores: 'sm_professores',
}

const DEFAULT_TURMAS = [
  { id: '9A', nome: '9A', ano: '9º Ano' },
  { id: '9B', nome: '9B', ano: '9º Ano' },
  { id: '1A', nome: '1A', ano: '1ª Série EM' },
  { id: '1B', nome: '1B', ano: '1ª Série EM' },
  { id: '2A', nome: '2A', ano: '2ª Série EM' },
  { id: '3A', nome: '3A', ano: '3ª Série EM' },
]

const DEFAULT_COMPONENTES = [
  'ARTE','BIO 1','BIO 2','ED.FÍS','FIL.SOC','FÍS 1','FÍS 2','GEO','HIS','HIS ART','IFC','L.ING','LIT','MAT 1','MAT 2','PORT','QUÍ 1','QUÍ 2','RED','SOC','TEC'
]

const DEFAULT_CONFIG = {
  senha: 'santa2026',
  trimestre: '2TRI',
  ano: '2025'
}

export function initStorage() {
  if (!localStorage.getItem(KEYS.turmas)) {
    localStorage.setItem(KEYS.turmas, JSON.stringify(DEFAULT_TURMAS))
  }
  if (!localStorage.getItem(KEYS.componentes)) {
    localStorage.setItem(KEYS.componentes, JSON.stringify(DEFAULT_COMPONENTES))
  }
  if (!localStorage.getItem(KEYS.alunos)) {
    localStorage.setItem(KEYS.alunos, JSON.stringify([]))
  }
  if (!localStorage.getItem(KEYS.respostas)) {
    localStorage.setItem(KEYS.respostas, JSON.stringify([]))
  }
  if (!localStorage.getItem(KEYS.config)) {
    localStorage.setItem(KEYS.config, JSON.stringify(DEFAULT_CONFIG))
  }
  if (!localStorage.getItem(KEYS.professores)) {
    localStorage.setItem(KEYS.professores, JSON.stringify([]))
  }
}

export function getTurmas() {
  try { return JSON.parse(localStorage.getItem(KEYS.turmas) || '[]') } catch { return [] }
}
export function setTurmas(v) { localStorage.setItem(KEYS.turmas, JSON.stringify(v)) }

export function getComponentes() {
  try { return JSON.parse(localStorage.getItem(KEYS.componentes) || '[]') } catch { return [] }
}
export function setComponentes(v) { localStorage.setItem(KEYS.componentes, JSON.stringify(v)) }

export function getAlunos() {
  try { return JSON.parse(localStorage.getItem(KEYS.alunos) || '[]') } catch { return [] }
}
export function setAlunos(v) { localStorage.setItem(KEYS.alunos, JSON.stringify(v)) }

export function getRespostas() {
  try { return JSON.parse(localStorage.getItem(KEYS.respostas) || '[]') } catch { return [] }
}
export function setRespostas(v) {
  localStorage.setItem(KEYS.respostas, JSON.stringify(v))
  try{ window.dispatchEvent(new CustomEvent('sm-respostas-updated', { detail: { count: v.length } })) }catch{}
}

export function getConfig() {
  try { return JSON.parse(localStorage.getItem(KEYS.config) || JSON.stringify(DEFAULT_CONFIG)) } catch { return DEFAULT_CONFIG }
}
export function setConfig(v) { localStorage.setItem(KEYS.config, JSON.stringify(v)) }

// helpers
export function getAlunosByTurma(turma) {
  return getAlunos().filter(a => a.turma === turma).sort((a,b)=> Number(a.numero)-Number(b.numero))
}

// internal flag to avoid sync loop when applying remote data
let _skipSync = false
export function withSkipSync(fn){
  _skipSync = true
  try{ return fn() } finally { _skipSync = false }
}

export function upsertResposta({ turma, componente, trimestre, alunoNumero, alunoNome, dados }) {
  const all = getRespostas()
  const idx = all.findIndex(r => r.turma===turma && r.componente===componente && r.trimestre===trimestre && String(r.alunoNumero)===String(alunoNumero))
  const entry = { turma, componente, trimestre, alunoNumero: String(alunoNumero), alunoNome, dados, updatedAt: new Date().toISOString() }
  if (idx >= 0) { all[idx]=entry; } else { all.push(entry); }
  setRespostas(all)
  if(!_skipSync){
    // lazy import to avoid circular at top
    import('./supabase.js').then(m=>{
      if(m.isSupabaseConfigured || typeof BroadcastChannel !== 'undefined'){
        m.queueRespostaSync(entry)
      }
    }).catch(()=>{})
    // dispatch storage-like event for same-tab listeners
    try{ window.dispatchEvent(new CustomEvent('sm-local-resposta', { detail: entry })) }catch{}
  }
}

// Used by sync to apply remote data without re-queueing
export function upsertRespostaFromRemote(entry){
  return withSkipSync(()=> upsertResposta(entry))
}

export function bulkSetRespostasFromRemote(rows){
  // rows from supabase: {turma, componente, trimestre, aluno_numero, aluno_nome, dados, updated_at}
  return withSkipSync(()=>{
    const mapped = rows.map(r=> ({
      turma: r.turma,
      componente: r.componente,
      trimestre: r.trimestre,
      alunoNumero: String(r.aluno_numero),
      alunoNome: r.aluno_nome,
      dados: r.dados || {},
      updatedAt: r.updated_at || r.updatedAt
    }))
    setRespostas(mapped)
    try{ window.dispatchEvent(new CustomEvent('sm-bulk-sync', { detail: { count: mapped.length } })) }catch{}
  })
}

export function bulkSetAlunosFromRemote(rows){
  return withSkipSync(()=>{
    const mapped = rows.map(r=> ({ id: r.id, turma: r.turma, numero: String(r.numero), nome: r.nome }))
    setAlunos(mapped)
  })
}

export function bulkSetProfessoresFromRemote(rows){
  return withSkipSync(()=>{
    const mapped = rows.map(r=> ({ id: r.id, nome: r.nome, componente: r.componente, turmas: r.turmas || [], token: r.token, createdAt: r.created_at || r.createdAt }))
    setProfessores(mapped)
  })
}

export function getResposta(turma, componente, trimestre, alunoNumero) {
  return getRespostas().find(r=> r.turma===turma && r.componente===componente && r.trimestre===trimestre && String(r.alunoNumero)===String(alunoNumero))
}

export function getRespostasByTurmaComponente(turma, componente, trimestre) {
  return getRespostas().filter(r=> r.turma===turma && r.componente===componente && r.trimestre===trimestre)
}

// import helpers for alunos from CSV rows - robust via helpers.js
import { normalizeRow, getField, detectTurmaFromHeader, extractAlunoInfo } from './helpers.js'

export function importAlunosFromRows(rows, turmaDefault) {
  const alunosMap = new Map()
  const existing = getAlunos()
  const existingKeys = new Set(existing.map(a=> `${a.turma}-${a.numero}`))
  let added = 0
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow)
    const info = extractAlunoInfo(row, turmaDefault)
    const { turma, numero, nome } = info
    if (!nome) continue
    if (!turma) continue
    // numero may be empty for some exports; we need to handle: if numero empty, try to use existing aluno numero by nome
    let numeroFinal = numero
    if(!numeroFinal){
      const byNome = existing.find(a=> a.turma===turma && a.nome.toLowerCase()===nome.toLowerCase())
      if(byNome) continue // already exists, skip
      // try to find any numeric value in row as fallback
      const fallbackNum = String(Object.values(row).find(v=> /^[0-9]{1,3}$/.test(String(v).trim())) || '').trim()
      if(fallbackNum) numeroFinal = fallbackNum
      else {
        // generate from map size
        numeroFinal = String(alunosMap.size + existing.filter(a=>a.turma===turma).length + 1)
      }
    }
    const key = `${turma}-${numeroFinal}-${nome}`
    if (!alunosMap.has(key)) {
      alunosMap.set(key, { turma, numero: numeroFinal, nome: nome.toUpperCase() })
    }
  }
  // dedupe by nome+turma
  const dedupedByNome = new Map()
  for (const v of alunosMap.values()) {
    const k = `${v.turma}-${v.nome.toLowerCase()}`
    if (!dedupedByNome.has(k)) dedupedByNome.set(k, v)
  }
  const toAdd = []
  for (const v of dedupedByNome.values()) {
    const ek = `${v.turma}-${v.numero}`
    const existsNome = existing.find(a=> a.turma===v.turma && a.nome.toLowerCase()===v.nome.toLowerCase())
    if (existsNome) continue
    if (existingKeys.has(ek)) {
      const existsNum = existing.find(a=> a.turma===v.turma && String(a.numero)===String(v.numero))
      if (existsNum && existsNum.nome !== v.nome) {
        continue
      }
    }
    toAdd.push({ id: `${v.turma}-${v.numero}-${Date.now()}-${Math.random()}`, turma: v.turma, numero: String(v.numero), nome: v.nome })
    added++
  }
  if (toAdd.length>0) {
    setAlunos([...existing, ...toAdd])
    if(!_skipSync){
      import('./supabase.js').then(m=>{
        for(const al of toAdd) m.queueAlunoSync(al)
      }).catch(()=>{})
    }
  }
  return added
}

export function importRespostasFromRows(rows, fallbackTurma) {
  let count=0
  for(const rawRow of rows){
    const row = normalizeRow(rawRow)
    const info = extractAlunoInfo(row, fallbackTurma)
    const { turma, numero, nome, trimestre, componente } = info
    if(!nome || !componente) continue
    // try to resolve numero via alunos list if empty
    let numeroFinal = numero
    if(!numeroFinal){
      const al = getAlunos().find(a=> a.turma===turma && a.nome.toLowerCase()===nome.toLowerCase())
      if(al) numeroFinal = al.numero
      else continue
    }
    const engajamentoImport = getField(row, 'Engajamento') || getField(row, 'Participação')|| getField(row, 'Participa')|| getField(row, 'Proatividade')||''
    const organizacaoImport = getField(row, 'Organização') || getField(row, 'Organizacao') || getField(row, 'Cumprimento')|| getField(row, 'Colaboração')|| getField(row, 'Colaboracao')||''
    const evolucaoImport = getField(row, 'Evolução') || getField(row, 'Evolucao') || getField(row, 'Progresso')||''
    const bemEstarImport = getField(row, 'Bem-estar') || getField(row, 'Bem estar') || getField(row, 'Sinais de bem-estar')||''
    const dados = {
      aproveitamento: getField(row, 'Aproveitamento')||'',
      engajamento: engajamentoImport,
      organizacao: organizacaoImport,
      concentracao: getField(row, 'Concentração')|| getField(row, 'Concentra')|| getField(row, 'Atenção')||'',
      assiduidade: getField(row, 'Frequência')|| getField(row, 'Frequencia')|| getField(row, 'Assiduidade')||'',
      convivencia: getField(row, 'Convivência')|| getField(row, 'Convivencia')||'',
      bemEstar: bemEstarImport,
      evolucao: evolucaoImport,
      // legado mantido para leitura Geral antiga
      participacao: getField(row, 'Participação')|| getField(row, 'Participa')||'',
      cumprimento: getField(row, 'Cumprimento')||'',
      colaboracao: getField(row, 'Colaboração')|| getField(row, 'Colaboracao')||'',
      proatividade: getField(row, 'Proatividade')||'',
      progresso: getField(row, 'Progresso')||'',
      necessidade: getField(row, 'Necessidade de intervenção')|| getField(row, 'Necessidade')||'',
      respostasPositivas: getField(row, 'Respostas positivas')||'',
      observacoes: getField(row, 'Observações')|| getField(row, 'Observa')||'',
      conversei: getField(row, 'Conversei')||'',
      disciplinar: getField(row, 'Disciplinar')||'',
      educacional: getField(row, 'Educacional')||'',
      comunicado: getField(row, 'Comunicado')||'',
      tirei: getField(row, 'Tirei de sala')||'',
      naoIntervim: getField(row, 'Não realizei')|| getField(row, 'Nao realizei')||'',
      reforco: getField(row, 'Encaminhado para aula')|| getField(row, 'reforço')|| getField(row, 'reforco')|| getField(row, 'Reforço de conteúdo')||'',
      apoio: getField(row, 'Apoio')|| getField(row, 'socioemocional')||'',
      familia: getField(row, 'Família')|| getField(row, 'Familia')|| getField(row, 'Conversa com família')||'',
      motivo: getField(row, 'Motivo')||'',
    }
    const has = Object.values(dados).some(v=> String(v).trim()!=='')
    if(!has) continue
    upsertResposta({ turma, componente, trimestre: trimestre||'2TRI', alunoNumero: String(numeroFinal), alunoNome: nome.toUpperCase(), dados })
    count++
  }
  return count
}



export function getProfessores(){
  try { return JSON.parse(localStorage.getItem(KEYS.professores) || '[]') } catch { return [] }
}
export function setProfessores(v){ localStorage.setItem(KEYS.professores, JSON.stringify(v)) }
export function generateProfessorToken(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let t=''
  for(let i=0;i<6;i++) t+= chars[Math.floor(Math.random()*chars.length)]
  return t + '-' + Date.now().toString(36).toUpperCase()
}
export function addProfessor({ nome, componente, turmas }){
  const all = getProfessores()
  const token = generateProfessorToken()
  const prof = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), nome: nome.trim(), componente: componente.trim().toUpperCase(), turmas: [...turmas], token, createdAt: new Date().toISOString() }
  all.push(prof)
  setProfessores(all)
  if(!_skipSync){
    import('./supabase.js').then(m=> m.queueProfessorSync(prof)).catch(()=>{})
  }
  return prof
}
export function removeProfessor(id){
  setProfessores(getProfessores().filter(p=>p.id!==id))
}
export function getProfessorByToken(token){
  return getProfessores().find(p=>p.token===token)
}
export function getProfessoresByComponente(comp){
  return getProfessores().filter(p=>p.componente===comp)
}
// helpers para classificação de valores (para dashboard)
export function classifyValor(v){
  if(!v) return 'vazio'
  const s = String(v).trim().toUpperCase()
  if(['SIM','S','X','BOM','ÓTIMO','OTIMO','OK','EXCELENTE','BOA','ALTA'].includes(s)) return 'sim'
  if(['NÃO','NAO','N','BAIXO','BAIXA','FRACO','FRACA','RUIM','INSUFICIENTE','SEM'].includes(s)) return 'nao'
  if(['PARCIAL','REGULAR','MÉDIO','MEDIO','QUEDA','VARIADA','VARIADO','PARCIALMENTE','EM DESENVOLVIMENTO'].includes(s)) return 'parcial'
  // legacy custom like "CONVERSA", "DISPERSO" etc -> treat as nao? or custom
  return 'custom'
}
export function updateProfessor(id, patch){
  const all=getProfessores()
  const idx=all.findIndex(p=>p.id===id)
  if(idx>=0){ all[idx]={...all[idx], ...patch}; setProfessores(all)}
}

export function clearAll() {
  localStorage.removeItem(KEYS.alunos)
  localStorage.removeItem(KEYS.respostas)
  localStorage.removeItem(KEYS.professores)
  initStorage()
}
