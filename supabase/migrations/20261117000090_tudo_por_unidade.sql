-- Decisão 140 (substitui a 127, que fica registrada): a lista de materiais da Engenharia é toda em unidade (un), com a medida
-- na descrição ("Tubo 3" SCH 40 barra 6 m", "Chapa 4,76 x 1500 x 3000 (304)"). Item novo, ou com a unidade trocada, só
-- aceita "un". Itens antigos em mt, kg ou mm continuam como estão (o Gabriel troca à mão) e são copiados assim para a
-- próxima revisão, para não virarem "un" com a quantidade em metros.

create or replace function public.eng_item_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.lista_id <> old.lista_id then raise exception 'O item não muda de revisão.'; end if;
  if not eng_lista_rascunho(new.lista_id) and coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    raise exception 'Esta revisão já foi enviada para Compras e está travada. Abra uma nova revisão.';
  end if;
  if new.unidade <> 'un' and (tg_op = 'INSERT' or new.unidade is distinct from old.unidade)
     and coalesce(current_setting('erp.rpc', true), '') <> 'on' then
    raise exception 'A lista é em unidade (un): escreva a medida na descrição, ex.: "barra 6 m".';
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
    -- A cópia mantém a unidade antiga (mt, kg, mm) para a Engenharia trocar por unidades com a medida certa.
    perform set_config('erp.rpc', 'on', true);
    insert into eng_lista_itens (lista_id, ordem, grupo, descricao, quantidade, unidade, bib_tipo, bib_id, observacoes, link, imagem)
    select nova, ordem, grupo, descricao, quantidade, eng_unidade(unidade), bib_tipo, bib_id, observacoes, link, imagem
    from eng_lista_itens where lista_id = anterior and excluido_em is null;
    perform set_config('erp.rpc', '', true);
  end if;
  return nova;
end;
$$;
