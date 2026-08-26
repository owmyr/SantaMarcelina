// Helpers for robust CSV handling (ISO-8859, nbsp, mangled accents)
export function normalizeKey(k){
  if(!k) return ''
  // remove BOM, nbsp, trim, lower
  return k.replace(/^\uFEFF/, '').replace(/\u00A0/g, ' ').trim()
}

export function normalizeRow(row){
  const nrow = {}
  for(const k in row){
    const nk = normalizeKey(k)
    nrow[nk] = row[k]
    // also store lower version for case-insensitive lookup if needed
    // keep original too? not needed
  }
  return nrow
}

export function getField(row, search){
  // search is like 'Aproveitamento' or 'Participa' etc.
  const s = search.toLowerCase()
  for(const k in row){
    const nk = normalizeKey(k).toLowerCase()
    if(nk.includes(s) || s.includes(nk)) return row[k]
    // also try without accents comparison: remove diacritics fallback
    const nk2 = nk.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const s2 = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    if(nk2.includes(s2)) return row[k]
  }
  return ''
}

export function detectTurmaFromHeader(row){
  // row keys normalized, first key that matches pattern 1A, 3A etc and value is numeric
  for(const k in row){
    const nk = normalizeKey(k)
    if(/^[0-9][A-Z]$/.test(nk)){
      const v = String(row[k]||'').trim()
      if(v && !isNaN(parseInt(v))){
        return nk
      }
    }
  }
  return null
}

export function extractAlunoInfo(row, fallbackTurma){
  const nrow = normalizeRow(row)
  let turma = fallbackTurma || ''
  let numero = ''
  let nome = getField(nrow, 'NOME DO ALUNO') || ''
  let trimestre = getField(nrow, 'Trimestre') || '2TRI'
  let componente = getField(nrow, 'Componente Curricular') || ''

  const detected = detectTurmaFromHeader(nrow)
  if(detected){
    turma = detected
    numero = String(nrow[detected]||'').trim()
  } else if (nrow['TURMA']){
    turma = String(nrow['TURMA']).trim()
    // numero may be missing in our export; try to keep empty and will fallback to lookup by nome
    if(!isNaN(parseInt(turma)) && fallbackTurma){
      // TURMA holds numero, not turma code
      numero = turma
      turma = fallbackTurma
    }
  } else if (fallbackTurma){
    turma = fallbackTurma
    // try first column value as numero if row has that
    const firstKey = Object.keys(nrow)[0]
    if(firstKey) {
      const v = String(nrow[firstKey]||'').trim()
      if(!isNaN(parseInt(v)) && firstKey!== 'NOME DO ALUNO'){
        numero = v
      }
    }
  }

  // fallback for numero if still empty: search any numeric value in row that looks like numero and not trimestre/componente
  if(!numero){
    for(const k in nrow){
      const v = String(nrow[k]||'').trim()
      const nk = normalizeKey(k)
      if(nk==='TURMA' || nk.includes('NOME') || nk.includes('Trimestre') || nk.includes('Componente')) continue
      if(/^[0-9]{1,3}$/.test(v) && !isNaN(parseInt(v))){
        // might be numero
        // check if key is TURMA-like? already handled
        // Use first numeric after fallback
        if(!numero) numero = v
      }
    }
  }

  return { turma: turma.toUpperCase().trim(), numero: String(numero).trim(), nome: String(nome).trim(), trimestre: String(trimestre).trim(), componente: String(componente).trim() }
}

export function extractDados(row){
  const nrow = normalizeRow(row)
  return {
    aproveitamento: getField(nrow, 'Aproveitamento')||'',
    participacao: getField(nrow, 'Participação')|| getField(nrow, 'Participa')||'',
    cumprimento: getField(nrow, 'Cumprimento')||'',
    progresso: getField(nrow, 'Progresso')||'',
    colaboracao: getField(nrow, 'Colaboração')|| getField(nrow, 'Colaboracao')||'',
    proatividade: getField(nrow, 'Proatividade')||'',
    concentracao: getField(nrow, 'Concentração')|| getField(nrow, 'Concentra')||'',
    necessidade: getField(nrow, 'Necessidade de intervenção')|| getField(nrow, 'Necessidade')||'',
    respostasPositivas: getField(nrow, 'Respostas positivas')||'',
    observacoes: getField(nrow, 'Observações')|| getField(nrow, 'Observa')||'',
    conversei: getField(nrow, 'Conversei')||'',
    disciplinar: getField(nrow, 'Disciplinar')||'',
    educacional: getField(nrow, 'Educacional')||'',
    comunicado: getField(nrow, 'Comunicado')||'',
    tirei: getField(nrow, 'Tirei de sala')||'',
    naoIntervim: getField(nrow, 'Não realizei')|| getField(nrow, 'Nao realizei')||'',
    reforco: getField(nrow, 'Encaminhado para aula')|| getField(nrow, 'reforço')|| getField(nrow, 'reforco')||'',
    motivo: getField(nrow, 'Motivo')||'',
  }
}
