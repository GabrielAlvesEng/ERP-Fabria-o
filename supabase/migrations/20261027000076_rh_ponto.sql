-- Ponto eletrônico por localização (decisão 115, docs/PLANEJAMENTO_PONTO.md).
-- O funcionário só bate o ponto dentro do raio de um local ativo (a empresa ou uma obra provisória);
-- a hora é a do servidor. Nada é apagado: correção é registro novo. Dia fora da tolerância só entra
-- no relatório oficial depois que o RH aprova ou abona. Só o RH (rh.ler) vê os dados de todos;
-- cada funcionário vê só os seus. Sócios ficam fora (funcionarios.bate_ponto).

-- Configuração (horários e tolerâncias), em configuracoes.ponto ---------------------------------
insert into public.configuracoes (chave, valor) values ('ponto', jsonb_build_object(
  'manha_inicio', '07:00', 'manha_fim', '11:30', 'tarde_inicio', '13:00', 'tarde_fim', '17:18',
  'dias_semana', jsonb_build_array(1, 2, 3, 4, 5),
  'tolerancia_batida_min', 5, 'tolerancia_atraso_dia_min', 10, 'precisao_max_m', 100,
  -- O ponto vale a partir do dia em que esta migration roda: os dias antes não viram falta.
  'inicio', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')
)) on conflict (chave) do nothing;

create or replace function public.ponto_salvar_config(p_config jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb := '{}'::jsonb; k text;
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Sem permissão para alterar o ponto.'; end if;
  foreach k in array array['manha_inicio', 'manha_fim', 'tarde_inicio', 'tarde_fim'] loop
    if coalesce(p_config->>k, '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Horário inválido: %.', k; end if;
    v := v || jsonb_build_object(k, p_config->>k);
  end loop;
  if not ((v->>'manha_inicio') < (v->>'manha_fim') and (v->>'manha_fim') <= (v->>'tarde_inicio') and (v->>'tarde_inicio') < (v->>'tarde_fim')) then
    raise exception 'Os horários precisam estar em ordem (entrada da manhã < saída < volta < saída da tarde).';
  end if;
  if jsonb_typeof(p_config->'dias_semana') <> 'array' then raise exception 'Escolha os dias de expediente.'; end if;
  v := v || jsonb_build_object('dias_semana', p_config->'dias_semana',
    'tolerancia_batida_min', least(greatest(coalesce((p_config->>'tolerancia_batida_min')::int, 5), 0), 30),
    'tolerancia_atraso_dia_min', least(greatest(coalesce((p_config->>'tolerancia_atraso_dia_min')::int, 10), 0), 60),
    'precisao_max_m', least(greatest(coalesce((p_config->>'precisao_max_m')::int, 100), 10), 2000));
  if coalesce(p_config->>'inicio', '') <> '' then
    v := v || jsonb_build_object('inicio', to_char((p_config->>'inicio')::date, 'YYYY-MM-DD'));
  end if;
  insert into configuracoes (chave, valor, atualizado_em) values ('ponto', v, now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
  return v;
end $$;

-- Quem bate ponto -------------------------------------------------------------------------------
alter table public.funcionarios add column if not exists bate_ponto boolean not null default true;
-- Resposta 8: os sócios (Gabriel e Fabiano) ficam fora.
update public.funcionarios set bate_ponto = false where nome in ('Gabriel Alves Silva', 'Gabriel Alves', 'Fabiano Alves da Silva');

-- Locais onde se pode bater o ponto (a empresa e obras provisórias) -----------------------------
create table public.ponto_locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  raio_m integer not null default 150 check (raio_m between 20 and 3000),
  inicio date,
  fim date,
  ativo boolean not null default true,
  observacoes text not null default '',
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid() references public.usuarios(id),
  constraint ponto_locais_datas check (fim is null or inicio is null or fim >= inicio)
);
-- Resposta 1: portão da Fabriaço pelo link do Google Maps (Mococa/SP).
insert into public.ponto_locais (nome, latitude, longitude, raio_m, criado_por)
values ('Fabriaço (sede)', -21.4687341, -47.0208632, 150, null);

-- Batidas ---------------------------------------------------------------------------------------
create table public.ponto_marcacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  momento timestamptz not null default now(),
  dia date not null,
  origem text not null default 'app' check (origem in ('app', 'ajuste', 'rh')),
  local_id uuid references public.ponto_locais(id),
  latitude double precision,
  longitude double precision,
  precisao_m double precision,
  distancia_m double precision,
  aparelho text not null default '',
  motivo text not null default '',
  ajuste_id uuid,
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  desconsiderada_em timestamptz,
  desconsiderada_por uuid references public.usuarios(id),
  desconsiderada_motivo text not null default ''
);
create index ponto_marcacoes_func_dia on public.ponto_marcacoes (funcionario_id, dia);

-- Pedidos de ajuste ("esqueci de bater") --------------------------------------------------------
create table public.ponto_ajustes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  dia date not null,
  hora time not null,
  motivo text not null check (length(trim(motivo)) between 3 and 500),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'aprovado', 'recusado')),
  resposta text not null default '',
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  decidido_por uuid references public.usuarios(id),
  decidido_em timestamptz
);
create index ponto_ajustes_pendentes on public.ponto_ajustes (situacao, dia);
alter table public.ponto_marcacoes add constraint ponto_marcacoes_ajuste foreign key (ajuste_id) references public.ponto_ajustes(id);

-- Justificativas do dia (atestado, férias, folga...) -------------------------------------------
create table public.ponto_justificativas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  inicio date not null,
  fim date not null,
  periodo text not null default 'dia' check (periodo in ('dia', 'manha', 'tarde')),
  tipo text not null check (tipo in ('Atestado médico', 'Férias', 'Folga', 'Afastamento', 'Compensação de horas', 'Falta justificada', 'Serviço externo', 'Outro')),
  observacao text not null default '',
  criado_por uuid default auth.uid() references public.usuarios(id),
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references public.usuarios(id),
  constraint ponto_justificativas_datas check (fim >= inicio and fim - inicio <= 366)
);
create index ponto_justificativas_func on public.ponto_justificativas (funcionario_id, inicio, fim);

-- Feriados --------------------------------------------------------------------------------------
create table public.feriados (
  data date primary key,
  nome text not null check (length(trim(nome)) between 2 and 80),
  abrangencia text not null default 'nacional' check (abrangencia in ('nacional', 'estadual', 'municipal', 'empresa')),
  ativo boolean not null default true
);
insert into public.feriados (data, nome, abrangencia) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'), ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'), ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-07-09', 'Revolução Constitucionalista', 'estadual'), ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'), ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'), ('2026-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'), ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'), ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-07-09', 'Revolução Constitucionalista', 'estadual'), ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'), ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'), ('2027-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2027-12-25', 'Natal', 'nacional')
on conflict (data) do nothing;

-- Decisão do RH sobre um dia fora da tolerância (resposta 5) ------------------------------------
create table public.ponto_decisoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  dia date not null,
  decisao text not null check (decisao in ('aprovado', 'abonado')),
  observacao text not null default '',
  decidido_por uuid default auth.uid() references public.usuarios(id),
  decidido_em timestamptz not null default now(),
  substituida_em timestamptz
);
create unique index ponto_decisoes_vigente on public.ponto_decisoes (funcionario_id, dia) where substituida_em is null;

-- Segurança -------------------------------------------------------------------------------------
create or replace function public.ponto_eh_meu(p_funcionario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from funcionarios where id = p_funcionario and usuario_id = auth.uid());
$$;
revoke all on function public.ponto_eh_meu(uuid) from public, anon;
grant execute on function public.ponto_eh_meu(uuid) to authenticated;

alter table public.ponto_locais enable row level security;
alter table public.ponto_marcacoes enable row level security;
alter table public.ponto_ajustes enable row level security;
alter table public.ponto_justificativas enable row level security;
alter table public.feriados enable row level security;
alter table public.ponto_decisoes enable row level security;

create policy ponto_locais_ler on public.ponto_locais for select to authenticated using (true);
create policy ponto_locais_criar on public.ponto_locais for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy ponto_locais_editar on public.ponto_locais for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));
create policy feriados_ler on public.feriados for select to authenticated using (true);
create policy feriados_criar on public.feriados for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy feriados_editar on public.feriados for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));
create policy ponto_marcacoes_ler on public.ponto_marcacoes for select to authenticated using (tem_permissao('rh', 'ler') or ponto_eh_meu(funcionario_id));
create policy ponto_ajustes_ler on public.ponto_ajustes for select to authenticated using (tem_permissao('rh', 'ler') or ponto_eh_meu(funcionario_id));
create policy ponto_decisoes_ler on public.ponto_decisoes for select to authenticated using (tem_permissao('rh', 'ler') or ponto_eh_meu(funcionario_id));
create policy ponto_justificativas_ler on public.ponto_justificativas for select to authenticated using (tem_permissao('rh', 'ler') or ponto_eh_meu(funcionario_id));
create policy ponto_justificativas_criar on public.ponto_justificativas for insert to authenticated with check (tem_permissao('rh', 'editar'));
create policy ponto_justificativas_editar on public.ponto_justificativas for update to authenticated using (tem_permissao('rh', 'editar')) with check (tem_permissao('rh', 'editar'));

revoke all on public.ponto_locais, public.ponto_marcacoes, public.ponto_ajustes, public.ponto_justificativas, public.feriados, public.ponto_decisoes from anon;
revoke all on public.ponto_locais, public.ponto_marcacoes, public.ponto_ajustes, public.ponto_justificativas, public.feriados, public.ponto_decisoes from authenticated;
grant select on public.ponto_locais, public.ponto_marcacoes, public.ponto_ajustes, public.ponto_justificativas, public.feriados, public.ponto_decisoes to authenticated;
grant insert, update on public.ponto_locais, public.ponto_justificativas, public.feriados to authenticated;

create trigger ponto_locais_auditoria after insert or update on public.ponto_locais for each row execute function registrar_auditoria();
create trigger ponto_marcacoes_auditoria after insert or update on public.ponto_marcacoes for each row execute function registrar_auditoria();
create trigger ponto_ajustes_auditoria after insert or update on public.ponto_ajustes for each row execute function registrar_auditoria();
create trigger ponto_justificativas_auditoria after insert or update on public.ponto_justificativas for each row execute function registrar_auditoria();
create trigger feriados_auditoria after insert or update on public.feriados for each row execute function registrar_auditoria();
create trigger ponto_decisoes_auditoria after insert or update on public.ponto_decisoes for each row execute function registrar_auditoria();

-- Mudou a batida ou a justificativa de um dia: a decisão do RH daquele dia deixa de valer (precisa decidir de novo).
create or replace function public.ponto_invalidar_decisao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'ponto_marcacoes' then
    update ponto_decisoes set substituida_em = now() where funcionario_id = new.funcionario_id and dia = new.dia and substituida_em is null;
  else
    update ponto_decisoes set substituida_em = now()
    where funcionario_id = new.funcionario_id and substituida_em is null
      and (dia between new.inicio and new.fim or (tg_op = 'UPDATE' and dia between old.inicio and old.fim));
  end if;
  return null;
end $$;
revoke execute on function public.ponto_invalidar_decisao() from public, anon, authenticated;
create trigger ponto_marcacoes_invalidar after insert or update on public.ponto_marcacoes for each row execute function ponto_invalidar_decisao();
create trigger ponto_justificativas_invalidar after insert or update on public.ponto_justificativas for each row execute function ponto_invalidar_decisao();

-- Distância em metros entre dois pontos (fórmula de haversine).
create or replace function public.ponto_distancia_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- Bater o ponto ---------------------------------------------------------------------------------
create or replace function public.ponto_bater(p_latitude double precision, p_longitude double precision, p_precisao double precision, p_aparelho text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f funcionarios;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  prec_max integer := coalesce((select (valor->>'precisao_max_m')::int from configuracoes where chave = 'ponto'), 100);
  l record;
  ultima ponto_marcacoes;
  qtd integer;
  m ponto_marcacoes;
begin
  select * into f from funcionarios where usuario_id = auth.uid();
  if f.id is null then raise exception 'Seu login não está ligado a uma ficha do RH. Fale com o RH.'; end if;
  if not f.bate_ponto then raise exception 'Você não precisa bater ponto.'; end if;
  if f.situacao <> 'ativo' then raise exception 'Sua ficha não está ativa no RH. Fale com o RH.'; end if;
  if p_latitude is null or p_longitude is null then raise exception 'Não foi possível ler a sua localização.'; end if;
  if p_precisao is null or p_precisao > prec_max then
    raise exception 'A localização está imprecisa (% m). Tente de novo ao ar livre ou pelo celular.', round(coalesce(p_precisao, 0));
  end if;

  select pl.id, pl.nome, pl.raio_m, ponto_distancia_m(pl.latitude, pl.longitude, p_latitude, p_longitude) as distancia into l
  from ponto_locais pl
  where pl.ativo and (pl.inicio is null or pl.inicio <= hoje) and (pl.fim is null or pl.fim >= hoje)
  order by ponto_distancia_m(pl.latitude, pl.longitude, p_latitude, p_longitude) - pl.raio_m
  limit 1;
  if l.id is null then raise exception 'Nenhum local de ponto está ativo. Fale com o RH.'; end if;
  if l.distancia > l.raio_m then
    raise exception 'Você está a % de % (o ponto só pode ser batido a até % m).',
      case when l.distancia >= 1000 then replace(to_char(l.distancia / 1000, 'FM999990.0'), '.', ',') || ' km' else round(l.distancia) || ' m' end,
      l.nome, l.raio_m;
  end if;

  -- Toque duplo: até 2 minutos depois da última batida, devolve a mesma.
  select * into ultima from ponto_marcacoes where funcionario_id = f.id and dia = hoje and desconsiderada_em is null order by momento desc limit 1;
  if ultima.id is not null and ultima.momento > now() - interval '2 minutes' then
    return jsonb_build_object('id', ultima.id, 'momento', ultima.momento, 'local', l.nome, 'repetida', true);
  end if;
  select count(*) into qtd from ponto_marcacoes where funcionario_id = f.id and dia = hoje and desconsiderada_em is null;
  if qtd >= 4 then raise exception 'Você já bateu as 4 batidas de hoje. Se precisar corrigir, peça um ajuste.'; end if;

  insert into ponto_marcacoes (funcionario_id, dia, origem, local_id, latitude, longitude, precisao_m, distancia_m, aparelho)
  values (f.id, hoje, 'app', l.id, p_latitude, p_longitude, p_precisao, l.distancia, left(coalesce(p_aparelho, ''), 300))
  returning * into m;
  return jsonb_build_object('id', m.id, 'momento', m.momento, 'local', l.nome, 'distancia', round(l.distancia), 'ordem', qtd + 1, 'repetida', false);
end $$;

-- Pedido de ajuste pelo próprio funcionário.
create or replace function public.ponto_pedir_ajuste(p_dia date, p_hora time, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare f funcionarios; v uuid;
begin
  select * into f from funcionarios where usuario_id = auth.uid();
  if f.id is null or not f.bate_ponto then raise exception 'Você não bate ponto.'; end if;
  if p_dia is null or p_hora is null then raise exception 'Informe o dia e a hora.'; end if;
  if p_dia > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Não dá para pedir ajuste de um dia futuro.'; end if;
  if p_dia < (now() at time zone 'America/Sao_Paulo')::date - 62 then raise exception 'Ajustes só até 2 meses atrás. Fale com o RH.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escreva o motivo.'; end if;
  insert into ponto_ajustes (funcionario_id, dia, hora, motivo) values (f.id, p_dia, p_hora, trim(p_motivo)) returning id into v;
  return v;
end $$;

-- Inclui uma batida (usada pelo RH e pela aprovação de ajuste). Máximo de 4 batidas válidas por dia.
create or replace function public.ponto_incluir_batida(p_funcionario uuid, p_dia date, p_hora time, p_origem text, p_motivo text, p_ajuste uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if (select count(*) from ponto_marcacoes where funcionario_id = p_funcionario and dia = p_dia and desconsiderada_em is null) >= 4 then
    raise exception 'Este dia já tem 4 batidas. Desconsidere uma antes de incluir outra.';
  end if;
  insert into ponto_marcacoes (funcionario_id, momento, dia, origem, motivo, ajuste_id)
  values (p_funcionario, (p_dia + p_hora) at time zone 'America/Sao_Paulo', p_dia, p_origem, coalesce(p_motivo, ''), p_ajuste)
  returning id into v;
  return v;
end $$;
revoke execute on function public.ponto_incluir_batida(uuid, date, time, text, text, uuid) from public, anon, authenticated;

create or replace function public.ponto_decidir_ajuste(p_ajuste uuid, p_aprovar boolean, p_resposta text default '') returns void
language plpgsql security definer set search_path = public as $$
declare a ponto_ajustes;
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH decide ajustes.'; end if;
  select * into a from ponto_ajustes where id = p_ajuste for update;
  if a.id is null then raise exception 'Pedido não encontrado.'; end if;
  if a.situacao <> 'pendente' then raise exception 'Este pedido já foi decidido.'; end if;
  if p_aprovar then
    perform ponto_incluir_batida(a.funcionario_id, a.dia, a.hora, 'ajuste', a.motivo, a.id);
  end if;
  update ponto_ajustes set situacao = case when p_aprovar then 'aprovado' else 'recusado' end, resposta = coalesce(p_resposta, ''),
    decidido_por = auth.uid(), decidido_em = now()
  where id = a.id;
end $$;

create or replace function public.ponto_lancar_batida(p_funcionario uuid, p_dia date, p_hora time, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH lança batidas.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escreva o motivo.'; end if;
  if p_dia > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Não dá para lançar batida em dia futuro.'; end if;
  return ponto_incluir_batida(p_funcionario, p_dia, p_hora, 'rh', trim(p_motivo), null);
end $$;

create or replace function public.ponto_desconsiderar(p_marcacao uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH desconsidera batidas.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escreva o motivo.'; end if;
  update ponto_marcacoes set desconsiderada_em = now(), desconsiderada_por = auth.uid(), desconsiderada_motivo = trim(p_motivo)
  where id = p_marcacao and desconsiderada_em is null;
  if not found then raise exception 'Batida não encontrada ou já desconsiderada.'; end if;
end $$;

-- Aprovar (vale o saldo calculado) ou abonar (o dia conta como normal) um dia fora da tolerância.
create or replace function public.ponto_decidir_dia(p_funcionario uuid, p_dia date, p_decisao text, p_observacao text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('rh', 'editar') then raise exception 'Só o RH aprova o ponto.'; end if;
  if p_decisao not in ('aprovado', 'abonado', 'desfazer') then raise exception 'Decisão inválida.'; end if;
  if p_decisao = 'abonado' and length(trim(coalesce(p_observacao, ''))) < 3 then raise exception 'Escreva o motivo do abono.'; end if;
  update ponto_decisoes set substituida_em = now() where funcionario_id = p_funcionario and dia = p_dia and substituida_em is null;
  if p_decisao <> 'desfazer' then
    insert into ponto_decisoes (funcionario_id, dia, decisao, observacao) values (p_funcionario, p_dia, p_decisao, trim(coalesce(p_observacao, '')));
  end if;
end $$;

revoke all on function public.ponto_salvar_config(jsonb), public.ponto_bater(double precision, double precision, double precision, text),
  public.ponto_pedir_ajuste(date, time, text), public.ponto_decidir_ajuste(uuid, boolean, text), public.ponto_lancar_batida(uuid, date, time, text),
  public.ponto_desconsiderar(uuid, text), public.ponto_decidir_dia(uuid, date, text, text), public.ponto_distancia_m(double precision, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.ponto_salvar_config(jsonb), public.ponto_bater(double precision, double precision, double precision, text),
  public.ponto_pedir_ajuste(date, time, text), public.ponto_decidir_ajuste(uuid, boolean, text), public.ponto_lancar_batida(uuid, date, time, text),
  public.ponto_desconsiderar(uuid, text), public.ponto_decidir_dia(uuid, date, text, text), public.ponto_distancia_m(double precision, double precision, double precision, double precision)
  to authenticated;
