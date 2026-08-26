import { classifyValor } from '../lib/storage'

export const CAMPOS = {
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

export function normalizeSegmentValue(v){
  if(!v || String(v).trim()==='') return ''
  const c = classifyValor(v)
  if(c==='sim') return 'SIM'
  if(c==='parcial') return 'PARCIAL'
  if(c==='nao') return 'NÃO'
  if(String(v).trim().toUpperCase()==='X') return 'SIM'
  return String(v).trim().toUpperCase()
}

export function SegmentedField({ label, hint, value, onChange }) {
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
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={label}>
        {OPCOES_SEGMENTED.map(op=>{
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
