-- Almoxarifado (decisão 104): a retirada para um setor falhava (registro do projeto vazio). Projeto vai para variáveis de texto.
-- Retirada: vários itens para um funcionário, com destino (projeto ou setor). p_itens = [{item_id, quantidade}].
create or replace function public.alm_registrar_retirada(p_funcionario uuid, p_destino_tipo text, p_projeto uuid, p_setor text,
  p_observacao text, p_itens jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare f record; v_cod text := ''; v_tit text := ''; r alm_retiradas; x jsonb; v_qtd numeric;
begin
  if not tem_permissao('almoxarifado', 'criar') then raise exception 'Sem permissão para registrar retiradas.'; end if;
  select id, nome into f from funcionarios where id = p_funcionario and situacao <> 'desligado';
  if not found then raise exception 'Funcionário não encontrado ou desligado.'; end if;
  if p_destino_tipo = 'projeto' then
    select codigo, titulo into v_cod, v_tit from projetos where id = p_projeto and excluido_em is null;
    if not found then raise exception 'Projeto não encontrado.'; end if;
  elsif p_destino_tipo = 'setor' then
    if length(trim(coalesce(p_setor, ''))) < 2 then raise exception 'Informe o setor ou o uso.'; end if;
  else raise exception 'Informe onde o material vai ser usado.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Inclua pelo menos um item.'; end if;
  insert into alm_retiradas (codigo, funcionario_id, funcionario_nome, destino_tipo, projeto_id, projeto_codigo, projeto_titulo, setor, observacao)
  values (alm_proximo_codigo('RT'), f.id, f.nome, p_destino_tipo, case when p_destino_tipo = 'projeto' then p_projeto end,
    v_cod, v_tit, case when p_destino_tipo = 'setor' then trim(p_setor) else '' end, coalesce(trim(p_observacao), ''))
  returning * into r;
  for x in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (x->>'quantidade')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida.'; end if;
    perform alm_movimentar((x->>'item_id')::uuid, 'retirada', -v_qtd, null, r.id);
  end loop;
  return r.id;
end;
$$;
