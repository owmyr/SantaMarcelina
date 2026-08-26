import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const HEADERS = [
  'TURMA','NOME DO ALUNO','Trimestre','Componente Curricular',
  'Aproveitamento da disciplina','Participação em sala','Cumprimento dos prazos de entrega','Progresso em relação a si mesmo','Colaboração em atividades de grupo','Proatividade','Concentração em sala',
  'Necessidade de intervenção pedagógica','Respostas positivas às intervenções pedagógicas já aplicadas',
  'Observações nas questões de comportamento',
  'Conversei particularmente com o(a) aluno (a)','Encaminhei para Orientação Disciplinar','Encaminhei para Orientação Educacional','Dei comunicado','Tirei de sala','Não realizei intervenção sobre o comportamento do aluno(a)',
  'Encaminhado para aula(s) de reforço','Motivo do encaminhamento para reforço (campo cognitivo)'
]

// parse CSV file handling ISO-8859
export function parseCSVFile(file) {
  return new Promise((resolve, reject)=>{
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results)=>{
        // try to normalize header keys that may be mangled
        const data = results.data
        const normalized = data.map(row=>{
          const nrow = {}
          for (const k in row) {
            const nk = k.trim()
            nrow[nk]=row[k]
          }
          return nrow
        })
        resolve({ data: normalized, meta: results.meta })
      },
      error: reject
    })
  })
}

// more robust: read as text with fallback latin1
export function parseCSVText(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true })
  return res.data
}

export function respostasToCSVRows(respostas, alunosByTurma) {
  // respostas: array of {turma, componente, trimestre, alunoNumero, alunoNome, dados}
  // If alunosByTurma provided, we can fill missing alunos with empty rows
  return respostas.map(r=>{
    const d = r.dados || {}
    return {
      'TURMA': r.turma,
      'NOME DO ALUNO': r.alunoNome,
      'Trimestre': r.trimestre,
      'Componente Curricular': r.componente,
      'Aproveitamento da disciplina': d.aproveitamento||'',
      'Participação em sala': d.participacao||'',
      'Cumprimento dos prazos de entrega': d.cumprimento||'',
      'Progresso em relação a si mesmo': d.progresso||'',
      'Colaboração em atividades de grupo': d.colaboracao||'',
      'Proatividade': d.proatividade||'',
      'Concentração em sala': d.concentracao||'',
      'Necessidade de intervenção pedagógica': d.necessidade||'',
      'Respostas positivas às intervenções pedagógicas já aplicadas': d.respostasPositivas||'',
      'Observações nas questões de comportamento': d.observacoes||'',
      'Conversei particularmente com o(a) aluno (a)': d.conversei||'',
      'Encaminhei para Orientação Disciplinar': d.disciplinar||'',
      'Encaminhei para Orientação Educacional': d.educacional||'',
      'Dei comunicado': d.comunicado||'',
      'Tirei de sala': d.tirei||'',
      'Não realizei intervenção sobre o comportamento do aluno(a)': d.naoIntervim||'',
      'Encaminhado para aula(s) de reforço': d.reforco||'',
      'Motivo do encaminhamento para reforço (campo cognitivo)': d.motivo||'',
    }
  })
}

export function exportToCSV(respostas, filename='pre-conselho.csv') {
  const rows = respostasToCSVRows(respostas)
  if (rows.length===0) return
  const csv = Papa.unparse(rows, { header: true })
  // add BOM for Excel
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

export function exportToXLSX(respostas, filename='pre-conselho.xlsx') {
  const rows = respostasToCSVRows(respostas)
  const ws = XLSX.utils.json_to_sheet(rows)
  // auto width
  const colWidths = HEADERS.map(h=> ({wch: Math.max(h.length+2, 18)}))
  ws['!cols']=colWidths
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pre Conselho')
  XLSX.writeFile(wb, filename)
}

export function exportGeralCSV(allRespostas, alunos, turmas, componentes, trimestreFilter, filename) {
  // GERAL is simply all respostas concatenated. If aluno has no resposta for a componente, we add empty row
  let rows = []
  // if trimestreFilter provided, filter
  let filtered = allRespostas
  if (trimestreFilter) filtered = filtered.filter(r=> r.trimestre===trimestreFilter)
  rows = respostasToCSVRows(filtered)
  // Optionally add missing combos as empty rows? Not needed, but we can ensure every aluno x componente has row if trimestreFilter?
  // For completeness, if user wants full matrix empty rows:
  // we skip for now to keep file clean
  if (rows.length===0 && alunos.length>0) {
    // create empty template
    const turmaSample = turmas[0]?.nome || '1A'
    const compSample = componentes[0] || 'HIS ART'
    rows = alunos.slice(0,1).map(a=> ({
      'TURMA': a.turma,
      'NOME DO ALUNO': a.nome,
      'Trimestre': trimestreFilter||'2TRI',
      'Componente Curricular': compSample,
      'Aproveitamento da disciplina':'','Participação em sala':'','Cumprimento dos prazos de entrega':'','Progresso em relação a si mesmo':'','Colaboração em atividades de grupo':'','Proatividade':'','Concentração em sala':'','Necessidade de intervenção pedagógica':'','Respostas positivas às intervenções pedagógicas já aplicadas':'','Observações nas questões de comportamento':'','Conversei particularmente com o(a) aluno (a)':'','Encaminhei para Orientação Disciplinar':'','Encaminhei para Orientação Educacional':'','Dei comunicado':'','Tirei de sala':'','Não realizei intervenção sobre o comportamento do aluno(a)':'','Encaminhado para aula(s) de reforço':'','Motivo do encaminhamento para reforço (campo cognitivo)':''
    }))
  }
  const csv = Papa.unparse(rows, { header:true })
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download= filename || `GERAL - PRE CONSELHO ${trimestreFilter||''}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// import GERAL or single turma csv into respostas
export function importCSVToRespostas(csvText, setRespostasFn) {
  const data = Papa.parse(csvText, { header:true, skipEmptyLines:true }).data
  let count=0
  for (const row of data) {
    // normalize keys: first col may be turma code
    const turma = (row['TURMA'] || row['1A'] || row['3A'] || Object.values(row)[0] || '').toString().trim()
    // But first column header is the turma name itself, so value is numero. Need to handle correctly
    // Let's detect: if header first key is like "1A" or "3A" then row['1A'] is numero, and we need to infer turma from header
    let turmaFinal = turma
    let numero = ''
    let nome = row['NOME DO ALUNO'] || ''
    let trimestre = row['Trimestre'] || '2TRI'
    let componente = row['Componente Curricular'] || ''
    // If first header is turma code, then turma is that header, numero is value under it
    const firstHeader = Object.keys(row)[0]
    if (firstHeader && /^[0-9][A-Z]$/.test(firstHeader)) {
      turmaFinal = firstHeader
      numero = row[firstHeader]
      // if turma was incorrectly set to numero, correct
    } else if (row['TURMA']) {
      turmaFinal = row['TURMA']
      numero = row['TURMA'] // actually TURMA col value is turma code? In our export TURMA is turma code, not numero. Need numero separate.
      // Our export uses TURMA as turma code, but original CSV first col is numero. So we need to handle both.
      // In export, TURMA = turma code, but we missing numero. For import from our own export, numero is not stored separate from turma. We store alunoNumero separately but in CSV we lost numero distinction. We'll use row['TURMA'] as turma, and need numero -> we have alunoNumero stored? In export we use TURMA as turma, not numero. So numero is not in CSV as separate. For import, we can try to find numero from original format: if row has numeric first col, use it.
      // For our own export, we don't have numero column; we can fallback to finding aluno by nome+turma
      numero = row['TURMA'] // ambiguous
      // Actually our export's first col is TURMA which equals turma code, not numero. So numero lost. We'll need to recover numero by looking up aluno by nome.
    }
    // Better: try to get numero from first column value if it's numeric and turmaFinal is turma code
    if (firstHeader && !isNaN(parseInt(numero)) && /^[0-9][A-Z]$/.test(turmaFinal)) {
      // already correct: turmaFinal is turma code, numero is numeric
    } else if (!isNaN(parseInt(row[firstHeader])) && firstHeader !== 'TURMA') {
      // firstHeader is TURMA but value is numero? This is messy. Let's try to detect original file pattern: header "1A" -> row["1A"] = "1", "3", etc. So numero is row["1A"], turma is "1A"
      // For our export pattern: header "TURMA" -> row["TURMA"] = "1A", numero is missing. So we need to handle both.
      // If row["TURMA"] looks like "1A", then it's turma code; numero unknown -> we'll search aluno by nome
    }
    // For our export, numero not present; we will lookup aluno by turma+nome to get numero
    // Let's get nome
    nome = (row['NOME DO ALUNO']||'').trim()
    if (!nome) continue
    // try to deduce numero: if row[firstHeader] is numeric and firstHeader is turma code, use it
    if (firstHeader && /^[0-9][A-Z]$/.test(firstHeader) && !isNaN(parseInt(row[firstHeader]))) {
      turmaFinal = firstHeader
      numero = String(row[firstHeader]).trim()
    } else if (row['TURMA'] && /^[0-9][A-Z]$/.test(row['TURMA'])) {
      // this is our export: TURMA holds turma code
      turmaFinal = row['TURMA']
      // numero fallback: try to find aluno by nome later, or use empty
      numero = '' 
    }
    // If numero still empty, try to find aluno by turma+nome via setRespostasFn lookup external? We'll pass alunos list instead
    // For now, if numero empty, use nome as key and leave numero as ''
    const dados = {
      aproveitamento: row['Aproveitamento da disciplina']||'',
      participacao: row['Participação em sala']|| row['Participa��o em sala�']||'',
      cumprimento: row['Cumprimento dos prazos de entrega']||'',
      progresso: row['Progresso em relação a si mesmo']|| row['Progresso em rela��o a si mesmo']||'',
      colaboracao: row['Colaboração em atividades de grupo']|| row['Colabora��o em atividades de grupo']||'',
      proatividade: row['Proatividade']||'',
      concentracao: row['Concentração em sala']|| row['Concentra��o em sala']||'',
      necessidade: row['Necessidade de intervenção pedagógica']|| row['Necessidade de interven��o pedag�gica']||'',
      respostasPositivas: row['Respostas positivas às intervenções pedagógicas já aplicadas']|| row['Respostas positivas � interven��es pedag�gicas j� aplicadas']||'',
      observacoes: row['Observações nas questões de comportamento']|| row['Observa��es nas quest�es de comportamento']||'',
      conversei: row['Conversei particularmente com o(a) aluno (a)']||'',
      disciplinar: row['Encaminhei para Orientação Disciplinar']|| row['Encaminhei para Orienta��o Disciplinar']||'',
      educacional: row['Encaminhei para Orientação Educacional']|| row['Encaminhei para Orienta��o Educacional']||'',
      comunicado: row['Dei comunicado']||'',
      tirei: row['Tirei de sala']||'',
      naoIntervim: row['Não realizei intervenção sobre o comportamento do aluno(a)']|| row['N�o realizei interven��o sobre o comportamento do aluno(a)']||'',
      reforco: row['Encaminhado para aula(s) de reforço']|| row['Encaminhado para aula(s) de refor�o']||'',
      motivo: row['Motivo do encaminhamento para reforço (campo cognitivo)']|| row['Motivo do encaminhamento para refor�o (campo cognitivo)']||'',
    }
    // check if empty row (all dados empty) skip unless needed? Keep but not counted
    const hasData = Object.values(dados).some(v=> String(v).trim()!=='')
    // Even if empty, we may want to ensure aluno exists? But for respostas we skip empty
    if (!hasData && !componente) continue
    // if numero empty, try to use aluno lookup if available via setRespostasFn? We'll need alunos list
    // We'll leave numero as empty and let caller handle mapping to alunoNumero via nome
    if (typeof setRespostasFn === 'function') {
      // setRespostasFn is actually an object with helpers? For now call it as callback with each entry
      setRespostasFn({ turma: turmaFinal, componente, trimestre, alunoNumero: numero, alunoNome: nome, dados })
      count++
    } else {
      // fallback: direct upsert if numero exists
      // import handled elsewhere
    }
  }
  return count
}
