-- =====================================================
-- 003_operatori_risultati.sql
-- Abilita la modifica di partite, set e punteggi solo agli operatori.
-- Tabella minimale e globale: una riga per email autorizzata.
-- =====================================================

create table if not exists operatore_app (
    id integer generated always as identity primary key,
    email text not null,
    nome text,
    puo_modificare boolean not null default true,
    attivo boolean not null default true,
    creato_il timestamp with time zone not null default now(),
    constraint chk_operatore_app_email_non_vuota check (btrim(email) <> '')
);

create unique index if not exists uq_operatore_app_email
on operatore_app (lower(email));

create or replace function puo_modificare_risultati()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from operatore_app operatore
        where operatore.attivo = true
          and operatore.puo_modificare = true
          and lower(operatore.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and auth.role() = 'authenticated'
    );
$$;

alter table operatore_app enable row level security;
alter table partita enable row level security;
alter table partita_set enable row level security;

drop policy if exists own_operatore_app on operatore_app;
create policy own_operatore_app on operatore_app for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists operator_insert_partita on partita;
create policy operator_insert_partita on partita for insert to authenticated
with check (puo_modificare_risultati());

drop policy if exists operator_update_partita on partita;
create policy operator_update_partita on partita for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

drop policy if exists operator_delete_partita on partita;
create policy operator_delete_partita on partita for delete to authenticated
using (puo_modificare_risultati());

drop policy if exists operator_insert_partita_set on partita_set;
create policy operator_insert_partita_set on partita_set for insert to authenticated
with check (puo_modificare_risultati());

drop policy if exists operator_update_partita_set on partita_set;
create policy operator_update_partita_set on partita_set for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

drop policy if exists operator_delete_partita_set on partita_set;
create policy operator_delete_partita_set on partita_set for delete to authenticated
using (puo_modificare_risultati());

grant select on operatore_app to authenticated;
grant insert, update, delete on partita, partita_set to authenticated;
grant usage, select on sequence partita_id_seq, partita_set_id_seq to authenticated;

-- Autorizza una persona:
-- insert into operatore_app (email, nome)
-- values ('nome@example.com', 'Nome Cognome');
--
-- Revoca accesso:
-- update operatore_app
-- set attivo = false
-- where lower(email) = lower('nome@example.com');
