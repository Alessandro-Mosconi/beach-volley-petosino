-- =====================================================
-- 014_single_tournament_bracket_phase.sql
-- Aggiunge la fase unica TORNEO per i tornei senza Gold/Silver.
--
-- Da eseguire dopo:
-- - 012_multi_tournament_keys.sql
-- - 013_populate_psk_tournament.sql
--
-- Effetti:
-- - aggiunge fase_torneo TORNEO se non esiste;
-- - permette slot_tabellone anche per fase TORNEO;
-- - ricrea le view di classifica finale includendo TORNEO.
-- =====================================================

begin;

insert into fase_torneo (codice, nome, descrizione, ordine) values
    ('TORNEO', 'Torneo', 'Tabellone finale', 2)
on conflict (codice) do update
set nome = excluded.nome,
    descrizione = excluded.descrizione,
    ordine = excluded.ordine;

alter table partita drop constraint if exists chk_partita_slot_tabellone_fase;
alter table partita add constraint chk_partita_slot_tabellone_fase
    check (
        slot_tabellone is null
        or fase_torneo_codice in ('GOLD', 'SILVER', 'TORNEO')
    );

drop view if exists v_classifica_finale_silver cascade;
drop view if exists v_classifica_finale_gold cascade;
drop view if exists v_classifica_finale cascade;

create or replace view v_classifica_finale as
with partite_finali as (
    select *
    from v_partita_risultato
    where fase_torneo_codice in ('GOLD', 'SILVER', 'TORNEO')
      and slot_tabellone in ('FINALE', 'FINALINA')
      and squadra_vincitrice_codice is not null
      and squadra_perdente_codice is not null
),
finali as (
    select *
    from partite_finali
    where slot_tabellone = 'FINALE'
),
finaline as (
    select *
    from partite_finali
    where slot_tabellone = 'FINALINA'
)
select
    f.torneo_id,
    f.fase_torneo_codice,
    1::integer as posizione,
    f.squadra_vincitrice_codice as squadra_codice,
    f.squadra_vincitrice_nome as squadra_nome,
    f.partita_id,
    f.slot_tabellone,
    'Vincente finale'::text as descrizione
from finali f
join finaline ff
    on ff.torneo_id = f.torneo_id
   and ff.fase_torneo_codice = f.fase_torneo_codice

union all

select
    f.torneo_id,
    f.fase_torneo_codice,
    2::integer as posizione,
    f.squadra_perdente_codice as squadra_codice,
    f.squadra_perdente_nome as squadra_nome,
    f.partita_id,
    f.slot_tabellone,
    'Finalista'::text as descrizione
from finali f
join finaline ff
    on ff.torneo_id = f.torneo_id
   and ff.fase_torneo_codice = f.fase_torneo_codice

union all

select
    ff.torneo_id,
    ff.fase_torneo_codice,
    3::integer as posizione,
    ff.squadra_vincitrice_codice as squadra_codice,
    ff.squadra_vincitrice_nome as squadra_nome,
    ff.partita_id,
    ff.slot_tabellone,
    'Vincente finalina'::text as descrizione
from finaline ff
join finali f
    on f.torneo_id = ff.torneo_id
   and f.fase_torneo_codice = ff.fase_torneo_codice

union all

select
    ff.torneo_id,
    ff.fase_torneo_codice,
    4::integer as posizione,
    ff.squadra_perdente_codice as squadra_codice,
    ff.squadra_perdente_nome as squadra_nome,
    ff.partita_id,
    ff.slot_tabellone,
    'Quarto posto'::text as descrizione
from finaline ff
join finali f
    on f.torneo_id = ff.torneo_id
   and f.fase_torneo_codice = ff.fase_torneo_codice
order by torneo_id, fase_torneo_codice, posizione;

create or replace view v_classifica_finale_gold as
select *
from v_classifica_finale
where fase_torneo_codice = 'GOLD'
order by torneo_id, posizione;

create or replace view v_classifica_finale_silver as
select *
from v_classifica_finale
where fase_torneo_codice = 'SILVER'
order by torneo_id, posizione;

create or replace view v_classifica_finale_torneo as
select *
from v_classifica_finale
where fase_torneo_codice = 'TORNEO'
order by torneo_id, posizione;

grant select on
    v_classifica_finale,
    v_classifica_finale_gold,
    v_classifica_finale_silver,
    v_classifica_finale_torneo
to anon, authenticated;

commit;
