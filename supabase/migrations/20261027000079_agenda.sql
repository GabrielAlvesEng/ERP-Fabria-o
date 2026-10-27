-- Agenda de compromissos (docs/PLANEJAMENTO_AGENDA.md, aprovado em 27/10/2026, decisão 118).
-- Cada pessoa com login tem a sua agenda. Um compromisso tem quem criou e os participantes (quem criou sempre participa).
-- Só quem criou muda ou cancela; o participante pode sair. Os detalhes só aparecem para quem participa; na agenda de
-- outra pessoa os horários aparecem como "Ocupado" (resposta 1). Quem é chamado já entra na agenda, sem aceitar
-- (resposta 2). Compromissos podem se repetir (resposta 3): a repetição fica guardada como regra e a tela calcula os dias.

create table public.compromissos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  inicio timestamptz not null,
  fim timestamptz not null,
  dia_inteiro boolean not null default false,
  local text,
  descricao text,
  cor text not null default 'roxo' check (cor in ('roxo', 'azul', 'verde', 'amarelo', 'vermelho', 'cinza')),
  -- Repetição: nula = não se repete. "A cada N" dias/semanas/meses/anos; na semanal, os dias da semana (0 = domingo).
  repeticao text check (repeticao in ('diaria', 'semanal', 'mensal', 'anual')),
  repetir_intervalo smallint not null default 1 check (repetir_intervalo between 1 and 99),
  repetir_dias smallint[],
  repetir_ate date,
  -- Dias (no horário de Brasília) em que a repetição não acontece: "cancelar só este" ou "mudar só este".
  excecoes date[] not null default '{}',
  criado_por uuid not null default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em timestamptz,
  check (fim > inicio)
);
create index compromissos_inicio_idx on public.compromissos (inicio) where excluido_em is null;

create table public.compromisso_participantes (
  compromisso_id uuid not null references public.compromissos(id),
  usuario_id uuid not null references public.usuarios(id),
  adicionado_em timestamptz not null default now(),
  -- Quando a pessoa viu que foi chamada (número de novos no menu).
  visto_em timestamptz,
  -- Saiu ou foi tirada por quem criou.
  removido_em timestamptz,
  primary key (compromisso_id, usuario_id)
);
create index compromisso_participantes_usuario_idx on public.compromisso_participantes (usuario_id) where removido_em is null;

create trigger compromissos_atualizado before update on public.compromissos for each row execute function tocar_atualizado_em();
create trigger compromissos_auditoria after insert or update on public.compromissos for each row execute function registrar_auditoria();

-- Regras -------------------------------------------------------------------------------------------------------

create or replace function public.agenda_participa(p_compromisso uuid, p_usuario uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from compromisso_participantes
    where compromisso_id = p_compromisso and usuario_id = p_usuario and removido_em is null);
$$;

-- O compromisso (não cancelado) de quem criou e está logado; senão, erro.
create or replace function public.compromisso_meu(p_id uuid) returns compromissos
language plpgsql stable security definer set search_path = public as $fn$
declare c compromissos;
begin
  perform tarefa_exigir_login();
  select * into c from compromissos where id = p_id and excluido_em is null;
  if not found then raise exception 'Compromisso não encontrado.'; end if;
  if c.criado_por <> auth.uid() then raise exception 'Só quem marcou o compromisso pode alterar.'; end if;
  return c;
end;
$fn$;

-- Deixa os participantes iguais à lista (quem criou sempre fica). Quem entra de novo volta a contar como novo.
create or replace function public.agenda_definir_participantes(p_id uuid, p_lista uuid[]) returns void
language plpgsql security definer set search_path = public as $fn$
declare v_lista uuid[] := array(select distinct x from unnest(coalesce(p_lista, '{}') || auth.uid()) x);
begin
  if exists (select 1 from unnest(v_lista) x where not exists (select 1 from usuarios where id = x and ativo)) then
    raise exception 'Uma das pessoas não tem login ativo no ERP.';
  end if;
  update compromisso_participantes set removido_em = now()
  where compromisso_id = p_id and removido_em is null and usuario_id <> all (v_lista);
  insert into compromisso_participantes (compromisso_id, usuario_id, visto_em)
  select p_id, x, case when x = auth.uid() then now() end from unnest(v_lista) x
  on conflict (compromisso_id, usuario_id) do update
    set removido_em = null, adicionado_em = case when compromisso_participantes.removido_em is not null then now() else compromisso_participantes.adicionado_em end,
        visto_em = case when compromisso_participantes.removido_em is not null and excluded.usuario_id <> auth.uid() then null else compromisso_participantes.visto_em end;
end;
$fn$;

-- Criar (p_id nulo) ou mudar. Num compromisso que se repete, p_modo diz o que muda a partir do dia p_data:
-- 'todos' (a série inteira), 'este' (só esse dia vira um compromisso avulso) ou 'seguintes' (a série antiga para
-- no dia anterior e começa uma nova).
create or replace function public.compromisso_salvar(
  p_id uuid, p_titulo text, p_inicio timestamptz, p_fim timestamptz, p_dia_inteiro boolean, p_local text, p_descricao text,
  p_cor text, p_repeticao text, p_intervalo integer, p_dias smallint[], p_ate date, p_participantes uuid[],
  p_modo text default 'todos', p_data date default null
) returns uuid
language plpgsql security definer set search_path = public as $fn$
declare c compromissos; v_id uuid; v_novo boolean := p_id is null;
begin
  perform tarefa_exigir_login();
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Escreva o nome do compromisso.'; end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then raise exception 'O fim precisa ser depois do início.'; end if;
  if p_repeticao = 'semanal' and coalesce(array_length(p_dias, 1), 0) = 0 then raise exception 'Escolha os dias da semana.'; end if;
  if p_ate is not null and p_ate < (p_inicio at time zone 'America/Sao_Paulo')::date then
    raise exception 'O "repetir até" precisa ser depois do início.';
  end if;

  if not v_novo then
    c := compromisso_meu(p_id);
    if c.repeticao is not null and p_modo in ('este', 'seguintes') and p_data is null then raise exception 'Informe o dia.'; end if;
    if c.repeticao is not null and p_modo = 'este' then
      update compromissos set excecoes = array(select distinct x from unnest(excecoes || p_data) x order by x) where id = p_id;
      v_novo := true;
      p_repeticao := null;
    elsif c.repeticao is not null and p_modo = 'seguintes' and p_data > (c.inicio at time zone 'America/Sao_Paulo')::date then
      update compromissos set repetir_ate = p_data - 1 where id = p_id;
      v_novo := true;
    end if;
  end if;

  if v_novo then
    insert into compromissos (titulo, inicio, fim, dia_inteiro, local, descricao, cor, repeticao, repetir_intervalo, repetir_dias, repetir_ate)
    values (trim(p_titulo), p_inicio, p_fim, coalesce(p_dia_inteiro, false), nullif(trim(p_local), ''), nullif(trim(p_descricao), ''),
      coalesce(p_cor, 'roxo'), p_repeticao, coalesce(p_intervalo, 1), case when p_repeticao = 'semanal' then p_dias end,
      case when p_repeticao is not null then p_ate end)
    returning id into v_id;
  else
    v_id := p_id;
    update compromissos set titulo = trim(p_titulo), inicio = p_inicio, fim = p_fim, dia_inteiro = coalesce(p_dia_inteiro, false),
      local = nullif(trim(p_local), ''), descricao = nullif(trim(p_descricao), ''), cor = coalesce(p_cor, 'roxo'),
      repeticao = p_repeticao, repetir_intervalo = coalesce(p_intervalo, 1),
      repetir_dias = case when p_repeticao = 'semanal' then p_dias end,
      repetir_ate = case when p_repeticao is not null then p_ate end,
      excecoes = case when p_repeticao is null then '{}' else excecoes end
    where id = v_id;
  end if;
  perform agenda_definir_participantes(v_id, p_participantes);
  return v_id;
end;
$fn$;

-- Cancelar: 'todos', 'este' (só o dia p_data) ou 'seguintes' (do dia p_data em diante).
create or replace function public.compromisso_cancelar(p_id uuid, p_modo text default 'todos', p_data date default null) returns void
language plpgsql security definer set search_path = public as $fn$
declare c compromissos;
begin
  c := compromisso_meu(p_id);
  if c.repeticao is null or p_modo = 'todos' or p_data is null
     or (p_modo = 'seguintes' and p_data <= (c.inicio at time zone 'America/Sao_Paulo')::date) then
    update compromissos set excluido_em = now() where id = p_id;
  elsif p_modo = 'este' then
    update compromissos set excecoes = array(select distinct x from unnest(excecoes || p_data) x order by x) where id = p_id;
  else
    update compromissos set repetir_ate = p_data - 1 where id = p_id;
  end if;
end;
$fn$;

-- Quem foi chamado pode sair (quem criou cancela).
create or replace function public.compromisso_sair(p_id uuid) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  perform tarefa_exigir_login();
  if exists (select 1 from compromissos where id = p_id and criado_por = auth.uid()) then
    raise exception 'Você marcou este compromisso: para sair, cancele.';
  end if;
  update compromisso_participantes set removido_em = now()
  where compromisso_id = p_id and usuario_id = auth.uid() and removido_em is null;
  if not found then raise exception 'Você não está neste compromisso.'; end if;
end;
$fn$;

create or replace function public.agenda_marcar_vistos() returns void
language sql security definer set search_path = public as $$
  update compromisso_participantes set visto_em = now() where usuario_id = auth.uid() and visto_em is null and removido_em is null;
$$;

-- A agenda de uma pessoa entre duas datas. Os compromissos que se repetem vêm com a regra (a tela calcula os dias).
-- Se quem está olhando não participa, vem só o horário ("Ocupado"), sem nome, local, descrição nem participantes.
create or replace function public.agenda_listar(p_usuario uuid, p_de timestamptz, p_ate timestamptz)
returns table (
  id uuid, titulo text, inicio timestamptz, fim timestamptz, dia_inteiro boolean, local text, descricao text, cor text,
  repeticao text, repetir_intervalo smallint, repetir_dias smallint[], repetir_ate date, excecoes date[],
  criado_por uuid, criador_nome text, participantes jsonb, detalhes boolean, novo boolean
)
language plpgsql stable security definer set search_path = public as $fn$
begin
  perform tarefa_exigir_login();
  return query
  select c.id, case when v.ve then c.titulo end, c.inicio, c.fim, c.dia_inteiro,
    case when v.ve then c.local end, case when v.ve then c.descricao end, case when v.ve then c.cor else 'cinza' end,
    c.repeticao, c.repetir_intervalo, c.repetir_dias, c.repetir_ate, c.excecoes,
    case when v.ve then c.criado_por end, case when v.ve then u.nome end,
    case when v.ve then (select coalesce(jsonb_agg(jsonb_build_object('id', pu.id, 'nome', pu.nome) order by pu.nome), '[]')
      from compromisso_participantes pp join usuarios pu on pu.id = pp.usuario_id
      where pp.compromisso_id = c.id and pp.removido_em is null) else '[]'::jsonb end,
    v.ve,
    exists (select 1 from compromisso_participantes pn where pn.compromisso_id = c.id and pn.usuario_id = auth.uid()
      and pn.removido_em is null and pn.visto_em is null)
  from compromissos c
  join compromisso_participantes p on p.compromisso_id = c.id and p.usuario_id = p_usuario and p.removido_em is null
  join usuarios u on u.id = c.criado_por
  cross join lateral (select agenda_participa(c.id) as ve) v
  where c.excluido_em is null and c.inicio < p_ate
    and ((c.repeticao is null and c.fim > p_de)
      or (c.repeticao is not null and (c.repetir_ate is null or c.repetir_ate >= (p_de at time zone 'America/Sao_Paulo')::date - 1)));
end;
$fn$;

-- Segurança ----------------------------------------------------------------------------------------------------
-- Leitura direta (usada pelo "ao vivo"): só os compromissos de que a pessoa participa. Nada de escrita direta.

alter table public.compromissos enable row level security;
alter table public.compromisso_participantes enable row level security;
create policy compromissos_ler on public.compromissos for select to authenticated using (agenda_participa(id));
create policy compromisso_participantes_ler on public.compromisso_participantes for select to authenticated
  using (usuario_id = auth.uid() or agenda_participa(compromisso_id));
revoke all on public.compromissos, public.compromisso_participantes from anon, authenticated;
grant select on public.compromissos, public.compromisso_participantes to authenticated;

do $$
declare f text;
begin
  foreach f in array array['agenda_participa(uuid, uuid)', 'compromisso_meu(uuid)', 'agenda_definir_participantes(uuid, uuid[])',
    'compromisso_salvar(uuid, text, timestamptz, timestamptz, boolean, text, text, text, text, integer, smallint[], date, uuid[], text, date)',
    'compromisso_cancelar(uuid, text, date)', 'compromisso_sair(uuid)', 'agenda_marcar_vistos()',
    'agenda_listar(uuid, timestamptz, timestamptz)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Estas só são chamadas por dentro das outras.
revoke execute on function public.compromisso_meu(uuid) from authenticated;
revoke execute on function public.agenda_definir_participantes(uuid, uuid[]) from authenticated;

-- Ao vivo: a agenda atualiza sozinha quando alguém marca, muda ou cancela um compromisso com você.
alter publication supabase_realtime add table public.compromissos, public.compromisso_participantes;
