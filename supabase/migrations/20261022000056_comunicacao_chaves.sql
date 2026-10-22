-- Comunicação: chaves VAPID do aviso no celular. A Edge Function comunicacao-envio cria o par na primeira vez e guarda
-- aqui; só a service_role (dentro da função) lê e grava. Ninguém logado no ERP consegue ver a chave privada.
create table public.segredos_servidor (
  nome text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
alter table public.segredos_servidor enable row level security;
revoke all on public.segredos_servidor from anon, authenticated;
grant select, insert on public.segredos_servidor to service_role;
