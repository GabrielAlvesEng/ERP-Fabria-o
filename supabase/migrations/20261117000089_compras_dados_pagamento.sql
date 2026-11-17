-- Decisão 137: Compras preenche os dados de pagamento do fornecedor (banco, PIX, titular, prazo depois da entrega) no
-- cadastro do fornecedor, para a OC já chegar ao Financeiro com eles. A tabela é a mesma da decisão 105; o Financeiro
-- continua vendo e corrigindo. Antes só o Financeiro lia e editava.
drop policy fornecedores_pagamento_ler on public.fornecedores_pagamento;
drop policy fornecedores_pagamento_criar on public.fornecedores_pagamento;
drop policy fornecedores_pagamento_editar on public.fornecedores_pagamento;
create policy fornecedores_pagamento_ler on public.fornecedores_pagamento for select to authenticated
  using (tem_permissao('financeiro', 'ler') or tem_permissao('compras', 'ler'));
create policy fornecedores_pagamento_criar on public.fornecedores_pagamento for insert to authenticated
  with check (tem_permissao('financeiro', 'editar') or tem_permissao('compras', 'editar'));
create policy fornecedores_pagamento_editar on public.fornecedores_pagamento for update to authenticated
  using (tem_permissao('financeiro', 'editar') or tem_permissao('compras', 'editar'))
  with check (tem_permissao('financeiro', 'editar') or tem_permissao('compras', 'editar'));
