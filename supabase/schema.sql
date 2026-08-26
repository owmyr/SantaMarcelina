-- Santa Marcelina — Supabase schema para sync tempo real
-- Execute no SQL Editor do Supabase. Mantém token= na URL (sem auth JWT), por isso RLS é permissivo para MVP.
-- Para produção, ative RLS restritivo e valide token via Edge Function.

-- 1. Turmas (opcional, espelha DEFAULT_TURMAS)
create table if not exists public.turmas (
  nome text primary key,
  ano text
);

-- 2. Alunos
create table if not exists public.alunos (
  id text primary key,
  turma text not null references public.turmas(nome) on delete cascade,
  numero text not null,
  nome text not null,
  created_at timestamptz default now(),
  unique (turma, numero),
  unique (turma, nome)
);
create index if not exists idx_alunos_turma on public.alunos(turma);

-- 3. Professores (1 por matéria, N turmas)
create table if not exists public.professores (
  id text primary key,
  nome text not null,
  componente text not null,
  turmas text[] not null default '{}',
  token text unique not null,
  created_at timestamptz default now()
);
create index if not exists idx_professores_token on public.professores(token);
create index if not exists idx_professores_componente on public.professores(componente);

-- 4. Respostas — chave composta (turma, componente, trimestre, aluno_numero)
create table if not exists public.respostas (
  turma text not null,
  componente text not null,
  trimestre text not null,
  aluno_numero text not null,
  aluno_nome text not null,
  dados jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (turma, componente, trimestre, aluno_numero)
);
create index if not exists idx_respostas_turma on public.respostas(turma);
create index if not exists idx_respostas_componente on public.respostas(componente);
create index if not exists idx_respostas_trimestre on public.respostas(trimestre);

-- RLS: para MVP, permitir anon read/write (mantém token= na URL, sem JWT)
alter table public.turmas enable row level security;
alter table public.alunos enable row level security;
alter table public.professores enable row level security;
alter table public.respostas enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='allow_all_turmas') then
    create policy allow_all_turmas on public.turmas for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='allow_all_alunos') then
    create policy allow_all_alunos on public.alunos for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='allow_all_professores') then
    create policy allow_all_professores on public.professores for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname='allow_all_respostas') then
    create policy allow_all_respostas on public.respostas for all using (true) with check (true);
  end if;
end $$;

-- Realtime: habilitar publicação
alter publication supabase_realtime add table public.respostas;
alter publication supabase_realtime add table public.alunos;
alter publication supabase_realtime add table public.professores;

-- Seed turmas padrão
insert into public.turmas (nome, ano) values
  ('9A','9º Ano'), ('9B','9º Ano'), ('1A','1ª Série EM'), ('1B','1ª Série EM'), ('2A','2ª Série EM'), ('3A','3ª Série EM')
on conflict (nome) do nothing;
