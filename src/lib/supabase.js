import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!url && !!anonKey

if(typeof window!=='undefined' && url && url.endsWith('/rest/v1')){
  console.warn('[sync] VITE_SUPABASE_URL deve ser https://SEU-PROJETO.supabase.co sem /rest/v1 — corrija na Vercel e redeploy')
}
if(typeof window!=='undefined' && anonKey && anonKey.startsWith('sb_secret_')){
  console.warn('[sync] VITE_SUPABASE_ANON_KEY está com sb_secret_ (service_role) — use sb_publishable_ no frontend. Troque na Vercel e redeploy')
}

export const supabase = isSupabaseConfigured ? createClient(url.replace(/\/rest\/v1\/?$/, ''), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null

// Simple queue with debounce and retry
let queue = []
let timer = null
let online = typeof navigator !== 'undefined' ? navigator.onLine : true

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online = true; flushQueue() })
  window.addEventListener('offline', () => { online = false })
}

function scheduleFlush(){
  if(timer) clearTimeout(timer)
  timer = setTimeout(flushQueue, 400)
}

async function flushQueue(){
  if(!isSupabaseConfigured || !online || queue.length===0) return
  const batch = [...queue]
  queue = []
  try{
    // group by table
    const byTable = batch.reduce((acc, item)=>{
      if(!acc[item.table]) acc[item.table]=[]
      acc[item.table].push(item.data)
      return acc
    }, {})
    for(const table in byTable){
      const rows = byTable[table]
      // respostas uses composite key via upsert, need to specify onConflict
      if(table==='respostas'){
        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'turma,componente,trimestre,aluno_numero' })
        if(error) throw error
      } else {
        const { error } = await supabase.from(table).upsert(rows)
        if(error) throw error
      }
    }
    // notify local listeners that sync succeeded
    window.dispatchEvent(new CustomEvent('sm-sync-status', { detail: { status: 'synced', count: batch.length } }))
  }catch(e){
    const details = { message: e.message, details: e.details, hint: e.hint, code: e.code, table: Object.keys(batch.reduce((a,b)=>{a[b.table]=true;return a},{})).join(',') }
    console.warn('[sync] flush failed, requeue', e, details, 'url:', url, 'key prefix:', anonKey ? anonKey.slice(0,12) : 'none')
    console.warn('[sync] batch sample:', JSON.stringify(batch[0]).slice(0,600))
    // requeue
    queue.unshift(...batch)
    window.dispatchEvent(new CustomEvent('sm-sync-status', { detail: { status: 'error', error: e.message, details: e.details, hint: e.hint, code: e.code } }))
    // retry in 3s
    setTimeout(flushQueue, 3000)
  }
}

export function queueSync(table, data){
  if(!isSupabaseConfigured){
    // fallback: broadcast to other tabs via BroadcastChannel
    try{
      if(typeof BroadcastChannel !== 'undefined'){
        const bc = new BroadcastChannel('sm-sync')
        bc.postMessage({ table, data })
        bc.close()
      }
      // also dispatch local event for same-tab listeners
      window.dispatchEvent(new CustomEvent('sm-sync-broadcast', { detail: { table, data } }))
    }catch{}
    return
  }
  queue.push({ table, data })
  window.dispatchEvent(new CustomEvent('sm-sync-status', { detail: { status: 'pending', queue: queue.length } }))
  scheduleFlush()
}

// Specific helpers
export function queueRespostaSync(entry){
  // entry: { turma, componente, trimestre, alunoNumero, alunoNome, dados, updatedAt }
  const row = {
    turma: entry.turma,
    componente: entry.componente,
    trimestre: entry.trimestre,
    aluno_numero: String(entry.alunoNumero),
    aluno_nome: entry.alunoNome,
    dados: entry.dados,
    updated_at: entry.updatedAt
  }
  queueSync('respostas', row)
}

export function queueAlunoSync(aluno){
  queueSync('alunos', { id: aluno.id, turma: aluno.turma, numero: String(aluno.numero), nome: aluno.nome })
}

export function queueProfessorSync(prof){
  queueSync('professores', { id: prof.id, nome: prof.nome, componente: prof.componente, turmas: prof.turmas, token: prof.token, created_at: prof.createdAt })
}

// Fetch all for hydration
export async function fetchAllFromSupabase(){
  if(!isSupabaseConfigured) return null
  try{
    const [respostas, alunos, professores, turmas] = await Promise.all([
      supabase.from('respostas').select('*').limit(5000),
      supabase.from('alunos').select('*').limit(5000),
      supabase.from('professores').select('*').limit(500),
      supabase.from('turmas').select('*').limit(100)
    ])
    if(respostas.error) console.warn('[sync] fetch respostas error', respostas.error, respostas)
    if(alunos.error) console.warn('[sync] fetch alunos error', alunos.error, alunos)
    if(professores.error) console.warn('[sync] fetch professores error', professores.error, professores)
    if(turmas.error) console.warn('[sync] fetch turmas error', turmas.error, turmas)
    return {
      respostas: respostas.data || [],
      alunos: alunos.data || [],
      professores: professores.data || [],
      turmas: turmas.data || []
    }
  }catch(e){
    console.warn('[sync] fetchAll failed', e)
    return null
  }
}

// Realtime subscription
let channel = null
export function subscribeRespostas(callback){
  if(!isSupabaseConfigured) {
    // fallback: listen to BroadcastChannel
    if(typeof BroadcastChannel !== 'undefined'){
      const bc = new BroadcastChannel('sm-sync')
      bc.onmessage = (ev)=>{
        const { table, data } = ev.data || {}
        if(table==='respostas') callback(data)
      }
      return ()=> bc.close()
    }
    // also listen to storage events (other tabs localStorage)
    const handler = (e)=>{
      if(e.key==='sm_respostas' && e.newValue){
        try{ callback(JSON.parse(e.newValue)) }catch{}
      }
    }
    window.addEventListener('storage', handler)
    return ()=> window.removeEventListener('storage', handler)
  }
  channel = supabase.channel('sm-respostas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas' }, payload=>{
      // payload.new is the row
      const row = payload.new
      if(row){
        // map to local format
        const entry = {
          turma: row.turma,
          componente: row.componente,
          trimestre: row.trimestre,
          alunoNumero: row.aluno_numero,
          alunoNome: row.aluno_nome,
          dados: row.dados,
          updatedAt: row.updated_at
        }
        callback(entry)
      }
    })
    .subscribe((status)=>{
      window.dispatchEvent(new CustomEvent('sm-sync-status', { detail: { status: status==='SUBSCRIBED' ? 'connected' : status } }))
    })
  return ()=>{
    if(channel) supabase.removeChannel(channel)
    channel=null
  }
}

// Listen to broadcast for immediate UI update (same-browser sync)
export function onBroadcast(callback){
  const handler = (e)=>{
    const { table, data } = e.detail || {}
    callback(table, data)
  }
  window.addEventListener('sm-sync-broadcast', handler)
  return ()=> window.removeEventListener('sm-sync-broadcast', handler)
}
