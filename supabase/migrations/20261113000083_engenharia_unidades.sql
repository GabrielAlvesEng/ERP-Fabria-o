-- Unidade de medida predefinida na lista de materiais da Engenharia (pedido do Gabriel de 13/11/2026, decisão 127):
-- "a unidade de medida tem que ser já pré-definida, sendo un, mt, kg, mm por enquanto".
-- Itens já gravados com outra unidade ficam como estão (revisões enviadas não mudam); ao copiar para uma nova revisão,
-- a unidade é convertida (m/metro → mt; pç, peça, barra e demais → un).

create or replace function public.eng_unidade(p text) returns text
language sql immutable set search_path = public as $$
  select case lower(trim(coalesce(p, '')))
    when 'kg' then 'kg' when 'mm' then 'mm'
    when 'mt' then 'mt' when 'm' then 'mt' when 'metro' then 'mt' when 'metros' then 'mt'
    else 'un' end;
$$;

create or replace function public.eng_item_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.lista_id <> old.lista_id then raise exception 'O item não muda de revisão.'; end if;
  if not eng_lista_rascunho(new.lista_id) and coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    raise exception 'Esta revisão já foi enviada para Compras e está travada. Abra uma nova revisão.';
  end if;
  if new.unidade not in ('un', 'mt', 'kg', 'mm') and (tg_op = 'INSERT' or new.unidade is distinct from old.unidade)
     and coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    raise exception 'Unidade inválida: use un, mt, kg ou mm.';
  end if;
  return new;
end;
$$;

create or replace function public.eng_nova_revisao(p_projeto uuid, p_copiar boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare pj projetos; rev integer; nova uuid; anterior uuid;
begin
  if not tem_permissao('engenharia', 'editar') then raise exception 'Sem permissão para editar a lista de materiais.'; end if;
  select * into pj from projetos where id = p_projeto and excluido_em is null for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if pj.status = 'cancelado' then raise exception 'Projeto cancelado.'; end if;
  if exists (select 1 from eng_listas where projeto_id = pj.id and status = 'rascunho') then
    raise exception 'Já existe uma revisão em rascunho neste projeto.';
  end if;
  select greatest(coalesce((select max(revisao) from eng_listas where projeto_id = pj.id), -1),
                  coalesce((select max(engenharia_revisao) from compras_requisicoes where projeto_id = pj.id), -1)) + 1 into rev;
  insert into eng_listas (projeto_id, revisao) values (pj.id, rev) returning id into nova;
  if p_copiar then
    select id into anterior from eng_listas where projeto_id = pj.id and status = 'enviada' order by revisao desc limit 1;
    insert into eng_lista_itens (lista_id, ordem, grupo, descricao, quantidade, unidade, bib_tipo, bib_id, observacoes, link, imagem)
    select nova, ordem, grupo, descricao, quantidade, eng_unidade(unidade), bib_tipo, bib_id, observacoes, link, imagem
    from eng_lista_itens where lista_id = anterior and excluido_em is null;
  end if;
  return nova;
end;
$$;

-- Rascunhos abertos: converte as unidades fora da lista.
update public.eng_lista_itens i set unidade = public.eng_unidade(i.unidade)
where i.excluido_em is null and i.unidade not in ('un', 'mt', 'kg', 'mm')
  and exists (select 1 from public.eng_listas l where l.id = i.lista_id and l.status = 'rascunho');

revoke execute on function public.eng_unidade(text) from public, anon;
grant execute on function public.eng_unidade(text) to authenticated;
