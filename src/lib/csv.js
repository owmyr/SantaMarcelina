import Papa from 'papaparse'
import { normalizeRow, extractAlunoInfo, extractDados } from './helpers.js'

export const HEADERS = [
  'TURMA','NOME DO ALUNO','Trimestre','Componente Curricular',
  'Aproveitamento','Engajamento e participação','Organização e entregas','Atenção e foco',
  'Frequência e pontualidade','Convivência e respeito',
  'Evolução no trimestre','Sinais de bem-estar observáveis',
  'Observações',
  'Conversei particularmente com o(a) aluno (a)','Dei comunicado','Encaminhei para Orientação Disciplinar','Encaminhei para Orientação Educacional','Tirei de sala',
  'Encaminhado para reforço de conteúdo','Apoio orientação / socioemocional','Conversa com família','Motivo do encaminhamento'
]

export function parseCSVFile(file) {
  return new Promise((resolve, reject)=>{
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results)=>{
        const normalized = results.data.map(row=>{
          const nrow = {}
          for (const k in row) {
            nrow[k.trim()] = row[k]
          }
          return nrow
        })
        resolve({ data: normalized, meta: results.meta })
      },
      error: reject
    })
  })
}

export function parseCSVText(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data
}

export function respostasToCSVRows(respostas) {
  return respostas.map(r=>{
    const d = r.dados || {}
    const engajamento = d.engajamento || d.participacao || d.proatividade || ''
    const organizacao = d.organizacao || d.cumprimento || d.colaboracao || ''
    const evolucao = d.evolucao || d.progresso || ''
    return {
      'TURMA': r.turma,
      'NOME DO ALUNO': r.alunoNome,
      'Trimestre': r.trimestre,
      'Componente Curricular': r.componente,
      'Aproveitamento': d.aproveitamento||'',
      'Engajamento e participação': engajamento,
      'Organização e entregas': organizacao,
      'Atenção e foco': d.concentracao||'',
      'Frequência e pontualidade': d.assiduidade||'',
      'Convivência e respeito': d.convivencia||'',
      'Evolução no trimestre': evolucao,
      'Sinais de bem-estar observáveis': d.bemEstar||'',
      'Observações': d.observacoes||'',
      'Conversei particularmente com o(a) aluno (a)': d.conversei||'',
      'Dei comunicado': d.comunicado||'',
      'Encaminhei para Orientação Disciplinar': d.disciplinar||'',
      'Encaminhei para Orientação Educacional': d.educacional||'',
      'Tirei de sala': d.tirei||'',
      'Encaminhado para reforço de conteúdo': d.reforco||'',
      'Apoio orientação / socioemocional': d.apoio||'',
      'Conversa com família': d.familia||'',
      'Motivo do encaminhamento': d.motivo||'',
    }
  })
}

export function exportToCSV(respostas, filename='pre-conselho.csv') {
  const rows = respostasToCSVRows(respostas)
  if (rows.length===0) return
  const csv = Papa.unparse(rows, { header: true })
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

/**
 * Exporta para XLSX via carregamento dinâmico (lazy import).
 * Evita carregar os ~400 kB do xlsx no bundle inicial.
 */
export async function exportToXLSX(respostas, filename='pre-conselho.xlsx') {
  const XLSX = await import('xlsx')
  const rows = respostasToCSVRows(respostas)
  const ws = XLSX.utils.json_to_sheet(rows)
  const colWidths = HEADERS.map(h=> ({wch: Math.max(h.length+2, 18)}))
  ws['!cols']=colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pre Conselho')
  XLSX.writeFile(wb, filename)
}

export function exportGeralCSV(allRespostas, alunos, turmas, componentes, trimestreFilter, filename) {
  let filtered = allRespostas
  if (trimestreFilter) filtered = filtered.filter(r=> r.trimestre===trimestreFilter)
  let rows = respostasToCSVRows(filtered)
  if (rows.length===0 && alunos.length>0) {
    const compSample = componentes[0] || 'HIS ART'
    rows = alunos.slice(0,1).map(a=> ({
      'TURMA': a.turma,
      'NOME DO ALUNO': a.nome,
      'Trimestre': trimestreFilter||'2TRI',
      'Componente Curricular': compSample,
      'Aproveitamento':'','Engajamento e participação':'','Organização e entregas':'','Atenção e foco':'','Frequência e pontualidade':'','Convivência e respeito':'','Evolução no trimestre':'','Sinais de bem-estar observáveis':'','Observações':'','Conversei particularmente com o(a) aluno (a)':'','Dei comunicado':'','Encaminhei para Orientação Disciplinar':'','Encaminhei para Orientação Educacional':'','Tirei de sala':'','Encaminhado para reforço de conteúdo':'','Apoio orientação / socioemocional':'','Conversa com família':'','Motivo do encaminhamento':''
    }))
  }
  const csv = Papa.unparse(rows, { header:true })
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download= filename || `GERAL - PRE CONSELHO ${trimestreFilter||''}.csv`; a.click()
  URL.revokeObjectURL(url)
}

/**
 * Importa CSV para respostas delegando para os helpers canônicos.
 * Elimina duplicações e tratamentos manuais de encoding corrompido.
 */
export function importCSVToRespostas(csvText, setRespostasFn) {
  if (typeof setRespostasFn !== 'function') return 0
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  let count = 0
  for (const rawRow of parsed.data) {
    const row = normalizeRow(rawRow)
    const info = extractAlunoInfo(row, null)
    if (!info || !info.nome) continue
    const dados = extractDados(row)
    const hasData = Object.values(dados).some(v => String(v).trim() !== '')
    if (!hasData) continue
    const componente = row['componente curricular'] || row['componente'] || ''
    const trimestre = row['trimestre'] || '2TRI'
    setRespostasFn({
      turma: info.turma || '',
      componente,
      trimestre,
      alunoNumero: info.numero || '',
      alunoNome: info.nome,
      dados
    })
    count++
  }
  return count
}
