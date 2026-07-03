-- =====================================================
-- 020_group_scoring_rules.sql
-- Regole configurabili di calcolo punti classifica per torneo/fase.
--
-- Le regole vivono nella tabella torneo_punteggio_regola.
-- Default se manca la configurazione:
-- - GIRONI: punti = set vinti
-- - altre fasi: 3 punti per partita vinta
--
-- Per il torneo 2 nei gironi:
-- - 2-0: squadra A 3 punti, squadra B 0
-- - 2-1: squadra A 2 punti, squadra B 1
-- Per il torneo 1 nei gironi:
-- - 2-0: squadra A 2 punti, squadra B 0
-- - 1-1: 1 punto a entrambe
-- =====================================================

begin;

create table if not exists torneo_punteggio_regola (
    torneo_id integer not null,
    fase_torneo_codice text not null,
    set_vinti_squadra_a integer not null,
    set_vinti_squadra_b integer not null,
    punti_squadra_a integer not null,
    punti_squadra_b integer not null,
    primary key (torneo_id, fase_torneo_codice, set_vinti_squadra_a, set_vinti_squadra_b),
    foreign key (torneo_id, fase_torneo_codice) references torneo_fase(torneo_id, codice) on delete cascade,
    constraint chk_torneo_punteggio_regola_set_a check (set_vinti_squadra_a >= 0),
    constraint chk_torneo_punteggio_regola_set_b check (set_vinti_squadra_b >= 0),
    constraint chk_torneo_punteggio_regola_punti_a check (punti_squadra_a >= 0),
    constraint chk_torneo_punteggio_regola_punti_b check (punti_squadra_b >= 0),
    constraint chk_torneo_punteggio_regola_set_uguali_punti_uguali
        check (set_vinti_squadra_a <> set_vinti_squadra_b or punti_squadra_a = punti_squadra_b)
);

create or replace function calcola_punti_classifica_partita(
    p_torneo_id integer,
    p_fase_torneo_codice text,
    p_risultato_squadra text,
    p_set_vinti integer,
    p_set_persi integer,
    p_partita_vinta integer
) returns integer
language plpgsql
stable
as $$
declare
    v_punti integer;
begin
    if coalesce(p_set_vinti, 0) + coalesce(p_set_persi, 0) = 0
       and p_risultato_squadra not in ('VINTA', 'PERSA') then
        return 0;
    end if;

    select r.punti_squadra_a
    into v_punti
    from torneo_punteggio_regola r
    where r.torneo_id = p_torneo_id
      and r.fase_torneo_codice = p_fase_torneo_codice
      and r.set_vinti_squadra_a = coalesce(p_set_vinti, 0)
      and r.set_vinti_squadra_b = coalesce(p_set_persi, 0);

    if found then
        return v_punti;
    end if;

    select r.punti_squadra_b
    into v_punti
    from torneo_punteggio_regola r
    where r.torneo_id = p_torneo_id
      and r.fase_torneo_codice = p_fase_torneo_codice
      and r.set_vinti_squadra_a = coalesce(p_set_persi, 0)
      and r.set_vinti_squadra_b = coalesce(p_set_vinti, 0);

    if found then
        return v_punti;
    end if;

    if p_fase_torneo_codice = 'GIRONI' then
        return coalesce(p_set_vinti, 0);
    end if;

    return coalesce(p_partita_vinta, 0) * 3;
end;
$$;

insert into torneo_punteggio_regola (
    torneo_id,
    fase_torneo_codice,
    set_vinti_squadra_a,
    set_vinti_squadra_b,
    punti_squadra_a,
    punti_squadra_b
)
values
    (1, 'GIRONI', 2, 0, 2, 0),
    (1, 'GIRONI', 1, 1, 1, 1),
    (2, 'GIRONI', 2, 0, 3, 0),
    (2, 'GIRONI', 2, 1, 2, 1)
on conflict (torneo_id, fase_torneo_codice, set_vinti_squadra_a, set_vinti_squadra_b)
do update set
    punti_squadra_a = excluded.punti_squadra_a,
    punti_squadra_b = excluded.punti_squadra_b;

create or replace view v_classifica as
select
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice,
    count(*) filter (where ps.risultato_squadra in ('VINTA', 'PERSA') or ps.set_vinti + ps.set_persi > 0)::integer as partite_giocate,
    coalesce(sum(ps.partita_vinta), 0)::integer as partite_vinte,
    count(*) filter (
        where ps.set_vinti + ps.set_persi > 0
          and ps.risultato_squadra not in ('VINTA', 'PERSA')
    )::integer as partite_pareggiate,
    coalesce(sum(ps.partita_persa), 0)::integer as partite_perse,
    coalesce(sum(ps.set_vinti), 0)::integer as set_vinti,
    coalesce(sum(ps.set_persi), 0)::integer as set_persi,
    coalesce(sum(ps.punti_fatti), 0)::integer as punti_fatti,
    coalesce(sum(ps.punti_subiti), 0)::integer as punti_subiti,
    (coalesce(sum(ps.set_vinti), 0) - coalesce(sum(ps.set_persi), 0))::integer as differenza_set,
    (coalesce(sum(ps.punti_fatti), 0) - coalesce(sum(ps.punti_subiti), 0))::integer as differenza_punti,
    coalesce(sum(calcola_punti_classifica_partita(
        ps.torneo_id,
        ps.fase_torneo_codice,
        ps.risultato_squadra,
        ps.set_vinti,
        ps.set_persi,
        ps.partita_vinta
    )), 0)::integer as punti_classifica
from v_partita_squadra ps
where ps.risultato_squadra in ('VINTA', 'PERSA')
   or ps.set_vinti + ps.set_persi > 0
group by
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice;

alter table torneo_punteggio_regola enable row level security;

drop policy if exists public_read_torneo_punteggio_regola on torneo_punteggio_regola;
create policy public_read_torneo_punteggio_regola on torneo_punteggio_regola
for select to anon, authenticated using (true);

drop policy if exists operator_insert_torneo_punteggio_regola on torneo_punteggio_regola;
create policy operator_insert_torneo_punteggio_regola on torneo_punteggio_regola
for insert to authenticated
with check (puo_modificare_risultati());

drop policy if exists operator_update_torneo_punteggio_regola on torneo_punteggio_regola;
create policy operator_update_torneo_punteggio_regola on torneo_punteggio_regola
for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

drop policy if exists operator_delete_torneo_punteggio_regola on torneo_punteggio_regola;
create policy operator_delete_torneo_punteggio_regola on torneo_punteggio_regola
for delete to authenticated
using (puo_modificare_risultati());

grant select on torneo_punteggio_regola to anon, authenticated;
grant insert, update, delete on torneo_punteggio_regola to authenticated;
grant execute on function calcola_punti_classifica_partita(integer, text, text, integer, integer, integer) to anon, authenticated;
grant select on v_classifica to anon, authenticated;

do $$ begin alter publication supabase_realtime add table torneo_punteggio_regola; exception when duplicate_object then null; end $$;

commit;
