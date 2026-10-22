-- Meu perfil (decisão 68, 22/10/2026): cada usuário, em qualquer módulo, edita os próprios dados pessoais
-- (nome, telefone, nascimento) e a foto. A foto fica no espaço privado "perfis", numa pasta com o id do usuário;
-- todos os logados podem ver as fotos (aparecem nos cartões), mas cada um só grava na própria pasta.
set lock_timeout = '10s';

alter table public.usuarios add column telefone text not null default '';
alter table public.usuarios add column nascimento date;
alter table public.usuarios add column foto_caminho text;
alter table public.usuarios add column foto_atualizada_em timestamptz;

create or replace function public.salvar_meu_perfil(p_nome text, p_telefone text, p_nascimento date) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then raise exception 'Informe o seu nome (ao menos 3 letras).'; end if;
  if length(trim(p_nome)) > 80 or length(coalesce(p_telefone, '')) > 30 then raise exception 'Nome ou telefone grande demais.'; end if;
  if p_nascimento is not null and (p_nascimento < date '1920-01-01' or p_nascimento > current_date) then raise exception 'Data de nascimento inválida.'; end if;
  update usuarios set nome = trim(p_nome), telefone = trim(coalesce(p_telefone, '')), nascimento = p_nascimento where id = auth.uid();
end;
$fn$;

-- Registra a foto já enviada para perfis/{id do usuário}/…; null tira a foto.
create or replace function public.salvar_minha_foto(p_caminho text) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_caminho is not null and (split_part(p_caminho, '/', 1) <> auth.uid()::text
      or not exists (select 1 from storage.objects where bucket_id = 'perfis' and name = p_caminho)) then
    raise exception 'Foto não encontrada.';
  end if;
  update usuarios set foto_caminho = p_caminho, foto_atualizada_em = now() where id = auth.uid();
end;
$fn$;

revoke execute on function public.salvar_meu_perfil(text, text, date) from public, anon;
revoke execute on function public.salvar_minha_foto(text) from public, anon;
grant execute on function public.salvar_meu_perfil(text, text, date) to authenticated;
grant execute on function public.salvar_minha_foto(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfis', 'perfis', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy perfis_ler on storage.objects for select to authenticated using (bucket_id = 'perfis');
create policy perfis_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text);
create policy perfis_trocar on storage.objects for update to authenticated
  using (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'perfis' and (storage.foldername(name))[1] = auth.uid()::text);
