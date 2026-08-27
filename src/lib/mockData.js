import { getTurmas, getComponentes, getAlunos, setAlunos, getProfessores, setProfessores, addProfessor, upsertResposta, getAlunosByTurma, initStorage } from './storage.js'

// Brazilian first names and last names for realistic mock
const PRIMEIROS_NOMES = [
  "ANA","BEATRIZ","CARLOS","DANIEL","EDUARDA","FELIPE","GABRIELA","HENRIQUE","ISABELA","JOÃO",
  "LARISSA","MARCOS","NATHALIA","OTÁVIO","PIETRO","RAFAELA","SOPHIA","THIAGO","VALENTINA","VITOR",
  "YASMIN","LUCAS","MARIANA","PEDRO","JULIA","GUSTAVO","LAVÍNIA","ENZO","MANUELA","ARTHUR",
  "HELENA","DAVI","LUNA","MIGUEL","ALICE","BERNARDO","CECÍLIA","HEITOR","CLARA","THEO",
  "LORENA","GAEL","GIOVANA","RAVI","ESTER","BENJAMIM","SARA","NICOLAS","ANTONELLA","SAMUEL",
  "CAMILA","LORENZO","VITÓRIA","BENÍCIO","MELISSA","JOAQUIM","REBECA","MURILO","CATARINA","LEONARDO",
  "BIANCA","GUILHERME","LARA","MATHEUS","LETÍCIA","RAFAEL","ISIS","CAIO","MAITÊ","EMANUEL",
  "SOFIA","JOÃO PEDRO","MARIA CLARA","MARIA EDUARDA","MARIA CECÍLIA","MARIA HELENA","MARIA JULIA","ENZO GABRIEL","JOÃO MIGUEL","ARTHUR MIGUEL"
]

const SOBRENOMES = [
  "SILVA","SANTOS","OLIVEIRA","SOUZA","LIMA","FERREIRA","COSTA","PEREIRA","RODRIGUES","ALMEIDA",
  "NASCIMENTO","ARAÚJO","MELO","BARBOSA","CARDOSO","CUNHA","RIBEIRO","MARTINS","GOMES","FREITAS",
  "MOURA","CARVALHO","LOPES","SOARES","MENDES","MONTEIRO","DIAS","NUNES","MOREIRA","CORREIA",
  "CASTRO","ROCHA","TEIXEIRA","CAVALCANTI","VIEIRA","ANDRADE","XAVIER","CORREIA","DUARTE","CAMPOS",
  "BATISTA","FARIAS","CALDEIRA","AZEVEDO","MORAES","REIS","MACHADO","NOGUEIRA","MIRANDA","MARQUES",
  "LAGE","DERI","STUCCHI","VACELLE","MINC","ARIZA","TONELLI","BARRY","CONCEIÇÃO","FOGAÇA",
  "SCHNEIDER","GRUBER","JUNES","DIB","SANCHES","MAIA","BAGGIO","VICENTE","LINHARES","HADDAD"
]

const NOMES_PROFESSORES = [
  "Adriana Silva","Bruno Costa","Carolina Mendes","Daniel Oliveira","Elaine Martins","Fábio Ribeiro",
  "Gisele Almeida","Henrique Lima","Isabela Duarte","Jorge Nascimento","Karina Vieira","Leandro Santos",
  "Marina Lopes","Nelson Freitas","Patrícia Gomes","Ricardo Andrade","Simone Barbosa","Tiago Moreira",
  "Vanessa Teixeira","Wagner Moura","Zélia Cardoso"
]

function randomInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function gerarNomeCompleto(usados){
  for(let tentativa=0; tentativa<50; tentativa++){
    const primeiro = pick(PRIMEIROS_NOMES)
    const segundoSobrenome = pick(SOBRENOMES)
    const terceiroSobrenome = Math.random()>0.6 ? ` ${pick(SOBRENOMES)}` : ""
    // para nomes compostos como JOÃO PEDRO, manter
    const nome = `${primeiro} ${segundoSobrenome}${terceiroSobrenome}`
    if(!usados.has(nome)) {
      usados.add(nome)
      return nome
    }
  }
  return `${pick(PRIMEIROS_NOMES)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`
}

export function gerarMockAlunosPorTurma(qtdPorTurma = null){
  const turmas = getTurmas()
  const existentes = getAlunos()
  if(existentes.length > 0) return { criados: 0, total: existentes.length, mensagem: "Já existem alunos, mantendo." }

  const usados = new Set(existentes.map(a=>a.nome))
  const novos=[]
  for(const turma of turmas){
    const qtd = qtdPorTurma || randomInt(18, 28)
    for(let i=1; i<=qtd; i++){
      const nome = gerarNomeCompleto(usados)
      novos.push({
        id: `${turma.nome}-${i}-${Date.now()}-${Math.random()}`,
        turma: turma.nome,
        numero: String(i),
        nome
      })
    }
  }
  setAlunos(novos)
  // sync para Supabase se configurado (fire-and-forget)
  import('./supabase.js').then(m=>{
    for(const al of novos) m.queueAlunoSync(al)
  }).catch(()=>{})
  return { criados: novos.length, total: novos.length }
}

export function gerarMockProfessoresUmPorMateria(){
  const existentes = getProfessores()
  if(existentes.length > 0) return { criados: 0, total: existentes.length, mensagem: "Já existem professores." }
  const turmas = getTurmas().map(t=>t.nome)
  const componentes = getComponentes()
  let idx=0
  for(const comp of componentes){
    const nome = NOMES_PROFESSORES[idx % NOMES_PROFESSORES.length]
    // 1 professor por matéria com todas as turmas (para o automático solicitado)
    // Se houver muitas matérias, distribuir turmas para variar: mas por enquanto todas
    addProfessor({ nome, componente: comp, turmas: [...turmas] })
    idx++
  }
  return { criados: componentes.length, total: getProfessores().length }
}

export function seedMockDataCompleto({ comAmostra = true } = {}){
  const rAlunos = gerarMockAlunosPorTurma()
  const rProfs = gerarMockProfessoresUmPorMateria()
  let rAmostra = 0
  if(comAmostra) rAmostra = gerarMockRespostasAmostra()
  return { alunos: rAlunos, professores: rProfs, amostra: rAmostra }
}

export function resetMockData(){
  localStorage.removeItem('sm_alunos')
  localStorage.removeItem('sm_respostas')
  localStorage.removeItem('sm_professores')
  initStorage()
  return seedMockDataCompleto({ comAmostra: true })
}

// Gera amostra leve: 2 turmas x 3 componentes x 3 alunos (18) — cores verde/amarelo/vermelho (novo modelo)
export function gerarMockRespostasAmostra(){
  const turmas = getTurmas().slice(0,2)
  const componentes = getComponentes().slice(0,3)
  const alunos = getAlunos()
  let total=0
  for(const turma of turmas){
    const alTurma = alunos.filter(a=>a.turma===turma.nome).slice(0,3)
    for(const comp of componentes){
      for(let i=0; i<alTurma.length; i++){
        const a = alTurma[i]
        let dados
        if(i===0){
          dados = {
            aproveitamento:'SIM', engajamento:'SIM', organizacao:'SIM', concentracao:'SIM', assiduidade:'SIM', convivencia:'SIM', evolucao:'MELHOROU', bemEstar:'',
            observacoes:'', conversei:'', disciplinar:'', educacional:'', comunicado:'', reforco:'', apoio:'', familia:'', motivo:'',
            // legado para compat
            participacao:'SIM', cumprimento:'SIM', progresso:'SIM', colaboracao:'SIM', proatividade:'SIM', necessidade:'NÃO', respostasPositivas:'SIM', tirei:'', naoIntervim:''
          }
        } else if(i===1){
          dados = {
            aproveitamento:'SIM', engajamento:'PARCIAL', organizacao:'SIM', concentracao:'PARCIAL', assiduidade:'SIM', convivencia:'SIM', evolucao:'ESTAVEL', bemEstar:'',
            observacoes:'', conversei:'', disciplinar:'', educacional:'', comunicado:'', reforco:'', apoio:'', familia:'', motivo:'',
            participacao:'PARCIAL', cumprimento:'SIM', progresso:'PARCIAL', colaboracao:'SIM', proatividade:'SIM', necessidade:'NÃO', respostasPositivas:'', tirei:'', naoIntervim:''
          }
        } else {
          dados = {
            aproveitamento:'NÃO', engajamento:'NÃO', organizacao:'PARCIAL', concentracao:'NÃO', assiduidade:'PARCIAL', convivencia:'NÃO', evolucao:'PIOROU', bemEstar:'ANSIEDADE',
            observacoes:'Conversa em excesso, dispersa e falta de rotina', conversei:'X', disciplinar:'', educacional:'', comunicado:'X', reforco:'X', apoio:'X', familia:'', motivo:'Dificuldade em interpretação e resultados em provas.',
            participacao:'NÃO', cumprimento:'PARCIAL', progresso:'NÃO', colaboracao:'PARCIAL', proatividade:'NÃO', necessidade:'SIM', respostasPositivas:'NÃO', tirei:'', naoIntervim:''
          }
        }
        upsertResposta({ turma: turma.nome, componente: comp, trimestre: '2TRI', alunoNumero: a.numero, alunoNome: a.nome, dados })
        total++
      }
    }
  }
  return total
}

// Gera população completa para GERAL: todas turmas x todos componentes x 40% dos alunos com distribuição realista (reduzido para 0.4 como solicitado)
export function gerarMockRespostasGeralCompleto({ densidade = 0.4, trimestre = '2TRI' } = {}){
  const turmas = getTurmas()
  const componentes = getComponentes()
  const alunos = getAlunos()
  const obsExemplos = [
    "Conversa em excesso, dispersa",
    "Muita dificuldade em matemática, mas muito esforço",
    "Mantém grandes dificuldades na escrita e interpretação",
    "Atenção varia muito, ora concentrada ora prostrada",
    "Insegurança e nervosismo em provas",
    "Falta rotina de estudos, entrega atrasada",
    "Não entrega atividades online, baixa concentração",
    "Excelente participação, ótimo progresso",
    ""
  ]
  let total=0
  const randTier = ()=>{
    const r = Math.random()
    if(r < 0.42) return 'otima'   // 42% ótima (verde)
    if(r < 0.72) return 'mediana' // 30% mediana (amarelo)
    return 'ruim'                  // 28% ruim (vermelho)
  }
  for(const turma of turmas){
    const alTurma = alunos.filter(a=>a.turma===turma.nome)
    for(const comp of componentes){
      for(const a of alTurma){
        if(Math.random() > densidade) continue // pula para não preencher 100%
        const tier = randTier()
        let dados
        if(tier==='otima'){
          dados = {
            aproveitamento:'SIM', engajamento:'SIM', organizacao:'SIM', concentracao:'SIM', assiduidade:'SIM', convivencia:'SIM', evolucao:'MELHOROU', bemEstar: Math.random()>0.9 ? pick(['','ANSIEDADE']) : '',
            observacoes: Math.random()>0.85 ? pick(obsExemplos.slice(0,3)) : '', conversei:'', disciplinar:'', educacional:'', comunicado:'', reforco:'', apoio:'', familia:'', motivo:'',
            participacao:'SIM', cumprimento:'SIM', progresso:'SIM', colaboracao:'SIM', proatividade:'SIM', necessidade:'NÃO', respostasPositivas: Math.random()>0.5 ? 'SIM' : '', tirei:'', naoIntervim:''
          }
        } else if(tier==='mediana'){
          dados = {
            aproveitamento:'SIM', engajamento: Math.random()>0.5?'PARCIAL':'SIM', organizacao:'SIM', concentracao: Math.random()>0.5?'PARCIAL':'SIM', assiduidade: Math.random()>0.7?'PARCIAL':'SIM', convivencia:'SIM', evolucao:'ESTAVEL', bemEstar: Math.random()>0.8 ? pick(['ANSIEDADE','APATIA','']) : '',
            observacoes: Math.random()>0.7 ? pick(obsExemplos) : '', conversei: Math.random()>0.8 ? 'X' : '', disciplinar:'', educacional:'', comunicado:'', reforco:'', apoio:'', familia:'', motivo:'',
            participacao: Math.random()>0.5?'PARCIAL':'SIM', cumprimento:'SIM', progresso:'ESTAVEL', colaboracao:'SIM', proatividade:'SIM', necessidade:'NÃO', respostasPositivas:'', tirei:'', naoIntervim:''
          }
        } else {
          const temReforco = Math.random()>0.45
          const temApoio = Math.random()>0.5
          const temFamilia = Math.random()>0.7
          const temComp = Math.random()>0.5
          const bem = Math.random()>0.4 ? pick(['ANSIEDADE','APATIA','AGITACAO','SONOLENCIA','ISOLAMENTO']) : ''
          dados = {
            aproveitamento: Math.random()>0.3 ? 'NÃO' : 'PARCIAL',
            engajamento: Math.random()>0.4 ? 'NÃO' : 'PARCIAL',
            organizacao: Math.random()>0.5 ? 'PARCIAL' : 'NÃO',
            concentracao: Math.random()>0.3 ? 'NÃO' : 'PARCIAL',
            assiduidade: Math.random()>0.5 ? 'NÃO' : 'PARCIAL',
            convivencia: Math.random()>0.5 ? 'NÃO' : 'SIM',
            evolucao: Math.random()>0.4 ? 'PIOROU' : 'ESTAVEL',
            bemEstar: bem,
            observacoes: pick(obsExemplos),
            conversei: temComp && Math.random()>0.5 ? 'X' : '',
            disciplinar: temComp && Math.random()>0.85 ? 'X' : '',
            educacional: temComp && Math.random()>0.85 ? 'X' : '',
            comunicado: Math.random()>0.9 ? 'X' : '',
            reforco: temReforco ? 'X' : '',
            apoio: temApoio ? 'X' : '',
            familia: temFamilia ? 'X' : '',
            motivo: (temReforco||temApoio||temFamilia) ? pick(['Dificuldade em interpretação','Resultados em provas','Falta rotina de estudos','Baixa concentração','Ansiedade em provas']) : '',
            participacao: Math.random()>0.4 ? 'NÃO' : 'PARCIAL', cumprimento: Math.random()>0.5 ? 'PARCIAL' : 'NÃO', progresso: Math.random()>0.4 ? 'PIOROU' : 'PARCIAL', colaboracao: Math.random()>0.5 ? 'SIM' : 'PARCIAL', proatividade: Math.random()>0.5 ? 'NÃO' : 'PARCIAL', necessidade: temApoio ? 'SIM' : 'NÃO', respostasPositivas: '', tirei: Math.random()>0.92 ? 'X' : '', naoIntervim:''
          }
        }
        upsertResposta({ turma: turma.nome, componente: comp, trimestre, alunoNumero: a.numero, alunoNome: a.nome, dados })
        total++
      }
    }
  }
  return total
}
