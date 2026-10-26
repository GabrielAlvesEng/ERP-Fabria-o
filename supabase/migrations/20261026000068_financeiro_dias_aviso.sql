-- Financeiro: prazo do aviso "vence em breve" editável, padrão 7 dias (decisão 109).
-- Fica em configuracoes ('financeiro_dias_aviso'); quem tem financeiro.editar muda pela função abaixo,
-- já que a tabela configuracoes só aceita escrita da Administração.

insert into public.configuracoes (chave, valor) values ('financeiro_dias_aviso', '7'::jsonb)
on conflict (chave) do nothing;

create or replace function public.fin_definir_dias_aviso(p_dias integer)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('financeiro', 'editar') then
    raise exception 'Sem permissão para alterar o aviso de vencimento.';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then
    raise exception 'O aviso deve ficar entre 1 e 60 dias.';
  end if;
  insert into configuracoes (chave, valor, atualizado_em) values ('financeiro_dias_aviso', to_jsonb(p_dias), now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
  return p_dias;
end $$;

revoke all on function public.fin_definir_dias_aviso(integer) from public, anon;
grant execute on function public.fin_definir_dias_aviso(integer) to authenticated;
