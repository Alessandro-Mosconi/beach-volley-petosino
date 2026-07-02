-- =====================================================
-- 018_edit_tournament_rules_permissions.sql
-- Permette agli operatori autorizzati di modificare il regolamento torneo.
-- Usa la stessa funzione di autorizzazione gia' usata per risultati/partite.
-- =====================================================

begin;

alter table torneo_regolamento enable row level security;

drop policy if exists operator_insert_torneo_regolamento on torneo_regolamento;
create policy operator_insert_torneo_regolamento on torneo_regolamento
for insert to authenticated
with check (puo_modificare_risultati());

drop policy if exists operator_update_torneo_regolamento on torneo_regolamento;
create policy operator_update_torneo_regolamento on torneo_regolamento
for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

drop policy if exists operator_delete_torneo_regolamento on torneo_regolamento;
create policy operator_delete_torneo_regolamento on torneo_regolamento
for delete to authenticated
using (puo_modificare_risultati());

grant insert, update, delete on torneo_regolamento to authenticated;

commit;
