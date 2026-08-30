import { classifyValor } from '../lib/storage'

const OPCOES_SEGMENTED = [
  { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
  { value: 'SIM', label: 'Sim', desc: 'Adequado', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
  { value: 'PARCIAL', label: 'Parcial', desc: 'Em desenvolvimento', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
  { value: 'NÃO', label: 'Não', desc: 'Atenção', cls: 'bg-red-500 text-white border-red-500 shadow' },
]

const OPCOES_POR_CAMPO = {
  aproveitamento: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Bom', desc: 'Adequado', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Regular', desc: 'Em desenvolvimento', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Baixo', desc: 'Atenção', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
  engajamento: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Engajado', desc: 'Ativo', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Oscila', desc: 'Às vezes', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Apático', desc: 'Desengajado', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
  organizacao: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Em dia', desc: 'Organizado', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Irregular', desc: 'Oscila', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Atrasado', desc: 'Não entrega', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
  concentracao: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Focado', desc: 'Mantém', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Oscila', desc: 'Intermitente', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Disperso', desc: 'Disperso', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
  assiduidade: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Assíduo', desc: 'Frequente', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Irregular', desc: 'Oscila', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Faltante', desc: 'Faltas', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
  convivencia: [
    { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
    { value: 'SIM', label: 'Boa', desc: 'Respeitosa', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
    { value: 'PARCIAL', label: 'Parcial', desc: 'Oscila', cls: 'bg-amber-400 text-slate-900 border-amber-400 shadow' },
    { value: 'NÃO', label: 'Conflituosa', desc: 'Atenção', cls: 'bg-red-500 text-white border-red-500 shadow' },
  ],
}
const OPCOES_EVOLUCAO = [
  { value: '', label: '—', desc: 'Não avaliado', cls: 'bg-white border-slate-200 text-slate-500' },
  { value: 'MELHOROU', label: 'Melhorou', desc: 'Evoluiu', cls: 'bg-emerald-500 text-white border-emerald-500 shadow' },
  { value: 'ESTAVEL', label: 'Estável', desc: 'Manteve', cls: 'bg-sky-500 text-white border-sky-500 shadow' },
  { value: 'PIOROU', label: 'Piorou', desc: 'Piora', cls: 'bg-red-500 text-white border-red-500 shadow' },
]
const OPCOES_BEM_ESTAR = [
  { value: '', label: '— Nenhum sinal relevante' },
  { value: 'ANSIEDADE', label: 'Ansiedade / insegurança' },
  { value: 'APATIA', label: 'Apatia / desmotivação' },
  { value: 'AGITACAO', label: 'Agitação / inquietude' },
  { value: 'SONOLENCIA', label: 'Sonolência / fadiga' },
  { value: 'ISOLAMENTO', label: 'Isolamento / pouca interação' },
  { value: 'OUTRO', label: 'Outro (descrever nas observações)' },
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
function normalizeEvolucaoValue(v){
  if(!v || String(v).trim()==='') return ''
  const s = String(v).trim().toUpperCase()
  if(['MELHOROU','MELHOR','EVOLUIU','PROGREDIU','SIM'].includes(s)) return 'MELHOROU'
  if(['ESTAVEL','ESTÁVEL','MANTEVE','ESTAVEL ','MÉDIO','MEDIO','REGULAR','PARCIAL'].includes(s)) return 'ESTAVEL'
  if(['PIOROU','PIORA','PIOR','REGREDIU','NÃO','NAO','QUEDA','VARIADA'].includes(s)) return 'PIOROU'
  const c = classifyValor(v)
  if(c==='sim') return 'MELHOROU'
  if(c==='parcial') return 'ESTAVEL'
  if(c==='nao') return 'PIOROU'
  return s
}

export function SegmentedField({ label, hint, value, onChange, required=false, fieldKey }) {
  const norm = normalizeSegmentValue(value)
  const isCustomLegacy = value && norm!==String(value).trim().toUpperCase() && !['SIM','NÃO','PARCIAL',''].includes(String(value).trim().toUpperCase())
  const opcoes = (fieldKey && OPCOES_POR_CAMPO[fieldKey]) || OPCOES_SEGMENTED
  return (
    <div className={`p-3 rounded-xl border-2 transition ${norm ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-2.5">
        <div className="text-sm font-medium text-slate-800">{label} {required && <span className="text-red-500">*</span>}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
        {isCustomLegacy && <div className="text-[11px] text-amber-700 mt-1">Legado: <span className="font-mono bg-amber-100 px-1 rounded">{value}</span> → {norm}</div>}
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={label}>
        {opcoes.map(op=>{
          const active = norm===op.value
          return (
            <button key={op.value} type="button" aria-pressed={active} onClick={()=>onChange(op.value)} className={`px-2 py-2 rounded-xl border-2 text-xs font-semibold transition flex flex-col items-center gap-0.5 ${active ? op.cls : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span>{op.label}</span><span className={`text-[10px] leading-none ${active ? (op.value==='PARCIAL' ? 'text-slate-800 font-medium' : 'text-white/90') : 'text-slate-400'}`}>{op.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function EvolucaoField({ label, hint, value, onChange }) {
  const norm = normalizeEvolucaoValue(value)
  return (
    <div className={`p-3 rounded-xl border-2 transition ${norm ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-2.5">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={label}>
        {OPCOES_EVOLUCAO.map(op=>{
          const active = norm===op.value
          return (
            <button key={op.value} type="button" aria-pressed={active} onClick={()=>onChange(op.value)} className={`px-2 py-2 rounded-xl border-2 text-xs font-semibold transition flex flex-col items-center gap-0.5 ${active ? op.cls : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span>{op.label}</span><span className={`text-[10px] leading-none ${active ? 'text-white/90' : 'text-slate-400'}`}>{op.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BemEstarField({ label, hint, value, onChange }) {
  const v = (value || '').toString().trim().toUpperCase()
  return (
    <div className={`p-3 rounded-xl border-2 transition ${v ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="mb-2">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <select value={v} onChange={e=>onChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
        {OPCOES_BEM_ESTAR.map(op=> <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {v && <div className="text-[11px] text-violet-700 mt-2">Sinal marcado: <span className="font-medium">{OPCOES_BEM_ESTAR.find(o=>o.value===v)?.label}</span> — detalhe nas observações se necessário.</div>}
    </div>
  )
}

export function BinaryField({ label, hint, value, onChange, polarity='positive' }) {
  const opcoes = polarity==='negative' ? OPCOES_BINARIO_NEGATIVA : OPCOES_BINARIO_POSITIVA
  const norm = normalizeSegmentValue(value)
  const activeValue = (norm==='PARCIAL' ? 'SIM' : norm)
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
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={label}>
        {opcoes.map(op=>{
          const active = activeValue===op.value
          return (
            <button key={op.value} type="button" aria-pressed={active} onClick={()=>onChange(op.value)} className={`px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition flex flex-col items-center gap-0.5 ${active ? op.cls : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
              <span>{op.label}</span><span className={`text-[10px] leading-none ${active ? 'text-white/90' : 'text-slate-400'}`}>{op.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CheckBox({ label, checked, onChange }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${checked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked ? 'X' : '')} className="w-5 h-5 rounded border-slate-300 text-amber-600" />
      <span className={`text-sm font-medium ${checked?'text-amber-900':'text-slate-700'}`}>{label}</span>
      {checked && <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">X</span>}
    </label>
  )
}
