-- Almoxarifado → Solicitações (decisão 110): pedido de compra de qualquer item, do cadastro ou digitado, para Compras
-- organizar (compras_solicitar com origem 'almoxarifado'), e o acompanhamento de cada item.
set lock_timeout = '10s';

-- p_itens = [{bib_tipo?, bib_id?, descricao?, grupo?, unidade?, quantidade, observacoes?}]. Produto do cadastro leva
-- descrição e grupo do cadastro; item digitado vai só com descrição, grupo e unidade (o comprador liga ao cadastro depois).
create or replace function public.alm_solicitar_itens(p_itens jsonb, p_necessario_em date, p_prioridade text, p_observacoes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_itens jsonb := '[]'; v_req uuid; v_qtd numeric; v_desc text; v_grupo text; v_tipo text; v_bib uuid; v_un text; v_n integer := 0;
begin
  if not (tem_permissao('almoxarifado', 'criar') or tem_permissao('almoxarifado', 'editar')) then raise exception 'Sem permissão para solicitar compras pelo Almoxarifado.'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  for x in select * from jsonb_array_elements(p_itens) loop
    v_qtd := nullif(x->>'quantidade', '')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida.'; end if;
    v_tipo := nullif(x->>'bib_tipo', ''); v_bib := nullif(x->>'bib_id', '')::uuid;
    v_un := coalesce(nullif(trim(x->>'unidade'), ''), 'un');
    if v_bib is not null then
      select descricao, grupo into v_desc, v_grupo from (
        select descricao, grupo from bib_itens where v_tipo = 'item' and id = v_bib
        union all select descricao, 'Chapas' from bib_chapas where v_tipo = 'chapa' and id = v_bib
        union all select descricao, 'Perfis' from bib_perfis where v_tipo = 'perfil' and id = v_bib) p;
      if v_desc is null then raise exception 'Produto não encontrado no cadastro.'; end if;
    else
      v_tipo := null;
      v_desc := trim(coalesce(x->>'descricao', ''));
      if length(v_desc) < 2 then raise exception 'Descreva o item.'; end if;
      v_grupo := coalesce(nullif(x->>'grupo', ''), 'Outros');
      if v_grupo not in ('Chapas', 'Perfis', 'Comerciais', 'Fixadores', 'Consumíveis', 'Serviços', 'Outros') then v_grupo := 'Outros'; end if;
    end if;
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('grupo', v_grupo, 'descricao', v_desc, 'quantidade', v_qtd, 'unidade', v_un,
      'bib_tipo', v_tipo, 'bib_id', v_bib, 'observacoes', coalesce(trim(x->>'observacoes'), '')));
    v_n := v_n + 1;
  end loop;
  v_req := compras_solicitar('almoxarifado', jsonb_build_object(
    'titulo', left(case when v_n = 1 then 'Almoxarifado: ' || (v_itens->0->>'descricao') else format('Almoxarifado: %s itens', v_n) end, 200),
    'necessario_em', p_necessario_em, 'prioridade', coalesce(nullif(p_prioridade, ''), 'normal'), 'observacoes', coalesce(p_observacoes, '')), v_itens);
  -- Produto que já está no estoque fica marcado como "compra solicitada" no Estoque.
  insert into alm_solicitacoes (item_id, requisicao_id, quantidade)
  select a.id, v_req, (e->>'quantidade')::numeric from jsonb_array_elements(v_itens) e
  join alm_itens a on a.bib_tipo = e->>'bib_tipo' and a.bib_id = nullif(e->>'bib_id', '')::uuid;
  return v_req;
end;
$$;

-- Pedidos do Almoxarifado em Compras, com a situação de cada item (em cotação = à comprar com preço de fornecedor).
create or replace function public.alm_minhas_solicitacoes(p_desde date default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.o order by x.criado_em desc), '[]') from (
    select r.criado_em, jsonb_build_object('id', r.id, 'codigo', r.codigo, 'titulo', r.titulo, 'status', r.status, 'prioridade', r.prioridade,
      'necessario_em', r.necessario_em, 'observacoes', r.observacoes, 'criado_em', r.criado_em, 'solicitante', u.nome,
      'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'descricao', i.descricao, 'grupo', i.grupo, 'quantidade', i.quantidade,
          'unidade', i.unidade, 'cadastrado', i.bib_id is not null, 'observacoes', i.observacoes,
          'situacao', case when i.status = 'a_comprar' and exists (select 1 from compras_cotacao_precos cp where cp.item_id = i.id) then 'em_cotacao' else i.status end,
          'pedido', (select p.codigo from compras_pedido_itens pi join compras_pedidos p on p.id = pi.pedido_id where pi.item_id = i.id and p.status <> 'cancelada' order by p.emitido_em desc limit 1),
          'recebida', (select coalesce(sum(pi.quantidade_recebida), 0) from compras_pedido_itens pi join compras_pedidos p on p.id = pi.pedido_id where pi.item_id = i.id and p.status <> 'cancelada'))
          order by i.ordem), '[]') from compras_requisicao_itens i where i.requisicao_id = r.id)) o
    from compras_requisicoes r left join usuarios u on u.id = r.solicitante_id
    where tem_permissao('almoxarifado', 'ler') and r.origem = 'almoxarifado' and (p_desde is null or r.criado_em >= p_desde)
  ) x;
$$;

revoke execute on function public.alm_solicitar_itens(jsonb, date, text, text) from public, anon;
grant execute on function public.alm_solicitar_itens(jsonb, date, text, text) to authenticated;
revoke execute on function public.alm_minhas_solicitacoes(date) from public, anon;
grant execute on function public.alm_minhas_solicitacoes(date) to authenticated;
