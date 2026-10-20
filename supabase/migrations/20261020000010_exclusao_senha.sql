-- Exclusão de proposta com senha administrativa (Documento Mestre 8.9; planejamento 4.8).
-- Sempre lógica. Rascunho nunca enviado: permissão vendas.excluir + justificativa.
-- Já enviada: também senha "Excluir Proposta". Aprovada ou com projeto: não pode.
-- A senha fica com hash bcrypt no banco e nunca volta para a tela. Limite de 5 tentativas erradas a cada 15 minutos.

create table public.senhas_administrativas (
  acao text primary key check (acao in ('excluir_proposta')),
  hash text not null,
  atualizado_por uuid default auth.uid() references public.usuarios(id),
  atualizado_em timestamptz not null default now()
);

create table public.senha_tentativas (
  id bigint generated always as identity primary key,
  usuario_id uuid default auth.uid() references public.usuarios(id),
  acao text not null,
  sucesso boolean not null,
  criado_em timestamptz not null default now()
);
create index senha_tentativas_idx on public.senha_tentativas (usuario_id, acao, criado_em);

alter table public.senhas_administrativas enable row level security;
alter table public.senha_tentativas enable row level security;
-- Sem políticas de leitura: ninguém lê hash nem tentativas pela API (só as funções abaixo).

create or replace function public.definir_senha_administrativa(p_acao text, p_senha text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not tem_permissao('admin','editar') then raise exception 'Somente a Administração define senhas.'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres.'; end if;
  insert into senhas_administrativas (acao, hash, atualizado_por, atualizado_em)
  values (p_acao, crypt(p_senha, gen_salt('bf')), auth.uid(), now())
  on conflict (acao) do update set hash = excluded.hash, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  insert into auditoria (tabela, registro_id, acao, depois) values ('senhas_administrativas', p_acao, 'SENHA_DEFINIDA', jsonb_build_object('acao', p_acao));
end;
$$;

create or replace function public.situacao_senha(p_acao text) returns table (definida boolean, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select exists (select 1 from senhas_administrativas where acao = p_acao), (select atualizado_em from senhas_administrativas where acao = p_acao)
  where tem_permissao('vendas','ler');
$$;

create or replace function public.conferir_senha(p_acao text, p_senha text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text; erros integer; ok boolean;
begin
  select count(*) into erros from senha_tentativas
   where usuario_id = auth.uid() and acao = p_acao and not sucesso and criado_em > now() - interval '15 minutes';
  if erros >= 5 then raise exception 'Muitas tentativas erradas. Aguarde 15 minutos.'; end if;
  select hash into h from senhas_administrativas where acao = p_acao;
  if h is null then raise exception 'A senha administrativa ainda não foi definida (Administração → Senhas).'; end if;
  ok := crypt(coalesce(p_senha, ''), h) = h;
  insert into senha_tentativas (usuario_id, acao, sucesso) values (auth.uid(), p_acao, ok);
  return ok;
end;
$$;
revoke execute on function public.conferir_senha(text, text) from public, anon, authenticated;

-- Precisa de senha? (para a tela saber se pede o campo)
create or replace function public.exclusao_exige_senha(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from proposta_revisoes where proposta_id = p_id and status = 'enviada');
$$;

-- Retorna 'ok' ou 'senha_incorreta' (sem erro, para a tentativa errada ficar registrada e contar no limite).
create or replace function public.excluir_proposta(p_id uuid, p_justificativa text, p_senha text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v propostas; enviada boolean;
begin
  if not tem_permissao('vendas','excluir') then raise exception 'Sem permissão para excluir propostas.'; end if;
  select * into v from propostas where id = p_id and excluido_em is null for update;
  if not found then raise exception 'Proposta não encontrada.'; end if;
  if v.status in ('Aprovado','Finalizado','Emitido NF','Pago') then raise exception 'Proposta aprovada não pode ser excluída.'; end if;
  if exists (select 1 from projetos where proposta_id = v.id) then raise exception 'A proposta tem projeto de Engenharia e não pode ser excluída.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 5 then raise exception 'Informe a justificativa da exclusão.'; end if;
  enviada := exclusao_exige_senha(v.id);
  if enviada and not conferir_senha('excluir_proposta', p_senha) then return 'senha_incorreta'; end if;
  perform set_config('erp.rpc', 'on', true);
  update propostas set excluido_em = now(), excluido_por = auth.uid() where id = v.id;
  perform registrar_evento(v.id, 'exclusao', v.status, null, 'Proposta excluída' || case when enviada then ' (com senha administrativa)' else '' end || '. Justificativa: ' || trim(p_justificativa));
  perform set_config('erp.rpc', 'off', true);
  return 'ok';
end;
$$;

-- Administração: listar e restaurar excluídas.
create or replace function public.propostas_excluidas() returns table (id uuid, codigo text, titulo text, status text, empresa text, excluido_em timestamptz, excluido_por text, justificativa text)
language sql stable security definer set search_path = public as $$
  select p.id, p.codigo, p.titulo, p.status, e.nome_fantasia, p.excluido_em, u.nome,
    (select descricao from proposta_eventos ev where ev.proposta_id = p.id and ev.tipo = 'exclusao' order by criado_em desc limit 1)
  from propostas p join empresas e on e.id = p.empresa_id left join usuarios u on u.id = p.excluido_por
  where p.excluido_em is not null and tem_permissao('admin','editar')
  order by p.excluido_em desc;
$$;

create or replace function public.restaurar_proposta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('admin','editar') then raise exception 'Somente a Administração restaura propostas.'; end if;
  perform set_config('erp.rpc', 'on', true);
  update propostas set excluido_em = null, excluido_por = null where id = p_id and excluido_em is not null;
  perform registrar_evento(p_id, 'restauracao', null, null, 'Proposta restaurada pela Administração.');
  perform set_config('erp.rpc', 'off', true);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.definir_senha_administrativa(text, text)', 'public.situacao_senha(text)', 'public.exclusao_exige_senha(uuid)',
    'public.excluir_proposta(uuid, text, text)', 'public.propostas_excluidas()', 'public.restaurar_proposta(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
