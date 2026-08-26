# Santa Marcelina — Pré-Conselho

Sistema para substituir a planilha de 22 colunas do pré-conselho por UX moderna: **1 link por professor** com todas as turmas, campos `Sim/Não/Parcial`, e dashboard **GERAL** por turma com opção de visão geral.

**Stack:** Vite + React 19 + Tailwind 3 + React Router + Papaparse + Supabase (opcional, fallback BroadcastChannel)

## Rodar

```bash
npm install
npm run dev # http://localhost:5173
npm run build && npm run preview
```

Mock automático: sem CSVs, ao abrir já cria 6 turmas, 21 componentes, ~126 alunos e 21 professores (1 por matéria) `src/lib/mockData.js:50`. Em `/admin` → Config → *Mock Data* você pode gerar/popular `GERAL` (densidade 0.4, ~1000 fichas).

## Links (mantém `token=` na URL como solicitado)

- Professor hub: `/prof/<token>?tri=2TRI` — 1 professor vê N turmas por abas.
- Agregado por componente: `/hub?comp=GEO&tri=2TRI&token=santa2026` — 1 matéria para todas as turmas.
- Legado: `/p?turma=1A&comp=HIS%20ART&tri=2TRI&token=santa2026` — 1 turma.

Gerados em `/admin` → Professores / Links.

## Cores

- **Intervenção pedagógica** `src/pages/ProfessorHub.jsx:31`: `Necessidade SIM` = vermelho (precisa apoio, sem Parcial), `Respostas positivas SIM` = verde.
- **GERAL** `src/pages/Geral.jsx:153`: `Map` index para performance, default **por turma** com toggle *Visão geral (todas)*. Célula: `ótima` (tudo `SIM` sem alertas) = verde, `mediana` (algum `PARCIAL`) = amarelo, `ruim` (`NÃO`) ou alerta (`necessidade SIM` / `comportamento` / `reforço`) = vermelho. Mock `densidade 0.4`.

## Sync Tempo Real

- **Sem backend:** funciona local + entre abas via `BroadcastChannel` `src/lib/supabase.js:1` (mantém `token=`).
- **Com Supabase:** crie projeto em supabase.com, execute `supabase/schema.sql`, copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Deploy na Vercel com mesmas envs. `src/App.jsx:12` hidrata e subscreve `respostas` em realtime; `src/lib/storage.js:80` faz queue debounced (400ms).

## Deploy Vercel

Conecte o repo `https://github.com/owmyr/SantaMarcelina` → Import → adicione envs do Supabase (opcional) → Deploy. Sem envs, app roda em modo local.

## Estrutura

- `src/lib/storage.js` — turmas/alunos/professores/respostas em `localStorage` + `classifyValor`
- `src/lib/helpers.js` — robustez CSV ISO-8859
- `src/pages/Admin.jsx` — abas Professores/Links/Turmas&Alunos/Config
- `src/pages/ProfessorHub.jsx` — hub multi-turmas
- `src/pages/Geral.jsx` — matriz/ lista, export GERAL.csv
