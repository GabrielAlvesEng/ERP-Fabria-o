-- Decisão 136: nota no preço da cotação. A importação do PDF (decisão 135) grava aqui quando converteu a unidade
-- (ex.: fornecedor cotou por barra e o item está em metro), e a comparação mostra o alerta para o comprador conferir.
alter table public.compras_cotacao_precos add column observacao text not null default '' check (length(observacao) <= 500);
