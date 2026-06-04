-- =====================================================
-- 004_remove_turno_partita.sql
-- Rimuove il campo descrittivo turno dalla tabella partita e ricrea le view.
-- Eseguire su database esistenti dopo gli script precedenti.
-- =====================================================

drop view if exists v_agenda_squadra cascade;
drop view if exists v_classifica_silver cascade;
drop view if exists v_classifica_gold cascade;
drop view if exists v_classifica_girone_d cascade;
drop view if exists v_classifica_girone_c cascade;
drop view if exists v_classifica_girone_b cascade;
drop view if exists v_classifica_girone_a cascade;
drop view if exists v_classifica_gironi cascade;
drop view if exists v_classifica_ordinata cascade;
drop view if exists v_classifica cascade;
drop view if exists v_partita_squadra cascade;
drop view if exists v_partita_risultato cascade;

alter table partita
drop column if exists turno;
-- =====================================================
-- VIEW RISULTATO PARTITA
-- =====================================================

create or replace view v_partita_risultato as
select
    p.id as partita_id,
    p.torneo_id,
    p.fase_torneo_codice,
    p.girone_codice,
    p.campo_codice,
    c.nome as campo_nome,
    p.orario_inizio,
    p.squadra_1_codice,
    s1.nome as squadra_1_nome,
    p.squadra_2_codice,
    s2.nome as squadra_2_nome,
    p.squadra_arbitro_codice,
    sa.nome as squadra_arbitro_nome,
    case when p.squadra_arbitro_codice is null then true else false end as arbitro_organizzazione,
    p.squadra_vincitrice_codice,
    sv.nome as squadra_vincitrice_nome,
    p.squadra_perdente_codice,
    sp.nome as squadra_perdente_nome,
    p.stato,
    p.note,

    count(ps.id)::integer as set_giocati,
    coalesce(sum(case when ps.squadra_vincitrice_codice = p.squadra_1_codice then 1 else 0 end), 0)::integer as set_vinti_squadra_1,
    coalesce(sum(case when ps.squadra_vincitrice_codice = p.squadra_2_codice then 1 else 0 end), 0)::integer as set_vinti_squadra_2,
    coalesce(sum(ps.punteggio_squadra_1), 0)::integer as punti_squadra_1,
    coalesce(sum(ps.punteggio_squadra_2), 0)::integer as punti_squadra_2,

    concat(
        coalesce(sum(case when ps.squadra_vincitrice_codice = p.squadra_1_codice then 1 else 0 end), 0),
        '-',
        coalesce(sum(case when ps.squadra_vincitrice_codice = p.squadra_2_codice then 1 else 0 end), 0)
    ) as risultato_set

from partita p
join campo c on c.codice = p.campo_codice
join squadra s1 on s1.codice = p.squadra_1_codice
join squadra s2 on s2.codice = p.squadra_2_codice
left join squadra sa on sa.codice = p.squadra_arbitro_codice
left join squadra sv on sv.codice = p.squadra_vincitrice_codice
left join squadra sp on sp.codice = p.squadra_perdente_codice
left join partita_set ps on ps.partita_id = p.id
group by
    p.id, p.torneo_id, p.fase_torneo_codice, p.girone_codice, p.campo_codice,
    c.nome, p.orario_inizio,
    p.squadra_1_codice, s1.nome, p.squadra_2_codice, s2.nome,
    p.squadra_arbitro_codice, sa.nome,
    p.squadra_vincitrice_codice, sv.nome,
    p.squadra_perdente_codice, sp.nome,
    p.stato, p.note;

-- =====================================================
-- VIEW PARTITA PER SQUADRA
-- risultato_squadra: VINTA, PERSA, DA_GIOCARE, ANNULLATA
-- =====================================================

create or replace view v_partita_squadra as
select
    r.partita_id,
    r.torneo_id,
    r.fase_torneo_codice,
    r.girone_codice,
    r.campo_codice,
    r.campo_nome,
    r.orario_inizio,
    r.squadra_1_codice as squadra_codice,
    r.squadra_1_nome as squadra_nome,
    r.squadra_2_codice as avversaria_codice,
    r.squadra_2_nome as avversaria_nome,
    r.set_vinti_squadra_1 as set_vinti,
    r.set_vinti_squadra_2 as set_persi,
    r.punti_squadra_1 as punti_fatti,
    r.punti_squadra_2 as punti_subiti,
    case when r.squadra_vincitrice_codice = r.squadra_1_codice then 1 else 0 end as partita_vinta,
    case when r.squadra_perdente_codice = r.squadra_1_codice then 1 else 0 end as partita_persa,
    case
        when r.stato = 'annullata' then 'ANNULLATA'
        when r.squadra_vincitrice_codice = r.squadra_1_codice then 'VINTA'
        when r.squadra_perdente_codice = r.squadra_1_codice then 'PERSA'
        else 'DA_GIOCARE'
    end as risultato_squadra
from v_partita_risultato r

union all

select
    r.partita_id,
    r.torneo_id,
    r.fase_torneo_codice,
    r.girone_codice,
    r.campo_codice,
    r.campo_nome,
    r.orario_inizio,
    r.squadra_2_codice as squadra_codice,
    r.squadra_2_nome as squadra_nome,
    r.squadra_1_codice as avversaria_codice,
    r.squadra_1_nome as avversaria_nome,
    r.set_vinti_squadra_2 as set_vinti,
    r.set_vinti_squadra_1 as set_persi,
    r.punti_squadra_2 as punti_fatti,
    r.punti_squadra_1 as punti_subiti,
    case when r.squadra_vincitrice_codice = r.squadra_2_codice then 1 else 0 end as partita_vinta,
    case when r.squadra_perdente_codice = r.squadra_2_codice then 1 else 0 end as partita_persa,
    case
        when r.stato = 'annullata' then 'ANNULLATA'
        when r.squadra_vincitrice_codice = r.squadra_2_codice then 'VINTA'
        when r.squadra_perdente_codice = r.squadra_2_codice then 'PERSA'
        else 'DA_GIOCARE'
    end as risultato_squadra
from v_partita_risultato r;

-- =====================================================
-- VIEW CLASSIFICA
-- Non esiste tabella classifica: tutto viene computato.
-- =====================================================

create or replace view v_classifica as
select
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice,
    count(*) filter (where ps.risultato_squadra in ('VINTA', 'PERSA'))::integer as partite_giocate,
    coalesce(sum(ps.partita_vinta), 0)::integer as partite_vinte,
    coalesce(sum(ps.partita_persa), 0)::integer as partite_perse,
    coalesce(sum(ps.set_vinti), 0)::integer as set_vinti,
    coalesce(sum(ps.set_persi), 0)::integer as set_persi,
    coalesce(sum(ps.punti_fatti), 0)::integer as punti_fatti,
    coalesce(sum(ps.punti_subiti), 0)::integer as punti_subiti,
    (coalesce(sum(ps.set_vinti), 0) - coalesce(sum(ps.set_persi), 0))::integer as differenza_set,
    (coalesce(sum(ps.punti_fatti), 0) - coalesce(sum(ps.punti_subiti), 0))::integer as differenza_punti,
    (coalesce(sum(ps.partita_vinta), 0) * 3)::integer as punti_classifica
from v_partita_squadra ps
where ps.risultato_squadra in ('VINTA', 'PERSA')
   or ps.set_vinti + ps.set_persi > 0
group by
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice;

create or replace view v_classifica_ordinata as
select
    c.*,
    row_number() over (
        partition by c.torneo_id, c.girone_codice, c.fase_torneo_codice
        order by
            c.punti_classifica desc,
            c.partite_vinte desc,
            c.differenza_set desc,
            c.differenza_punti desc,
            c.punti_fatti desc,
            s.nome asc
    )::integer as posizione,
    s.nome as squadra_nome,
    g.nome as girone_nome,
    f.nome as fase_nome
from v_classifica c
join squadra s on s.codice = c.squadra_codice
left join girone g on g.codice = c.girone_codice
left join fase_torneo f on f.codice = c.fase_torneo_codice;

-- =====================================================
-- VIEW CLASSIFICHE SPECIFICHE
-- Comode per il frontend: puoi leggere direttamente
-- la classifica richiesta senza filtrare ogni volta.
-- =====================================================

create or replace view v_classifica_gironi as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'GIRONI'
order by girone_codice, posizione;

create or replace view v_classifica_girone_a as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_A'
order by posizione;

create or replace view v_classifica_girone_b as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_B'
order by posizione;

create or replace view v_classifica_girone_c as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_C'
order by posizione;

create or replace view v_classifica_girone_d as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_D'
order by posizione;

create or replace view v_classifica_gold as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'GOLD'
order by posizione;

create or replace view v_classifica_silver as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'SILVER'
order by posizione;

-- =====================================================
-- VIEW AGENDA SQUADRA
-- Include:
-- - partite da giocare
-- - turni da arbitro
-- - pranzo
-- =====================================================

create or replace view v_agenda_squadra as

-- =====================================================
-- PARTITE GIOCATE
-- =====================================================

select
    p.torneo_id,
    p.squadra_1_codice as squadra_codice,
    s1.nome as squadra_nome,
    'PARTITA' as tipo_evento,
    p.id as partita_id,
    p.fase_torneo_codice,
    p.girone_codice,
    p.campo_codice,
    c.nome as campo_nome,
    p.orario_inizio,
    p.squadra_1_codice,
    s1.nome as squadra_1_nome,
    p.squadra_2_codice,
    s2.nome as squadra_2_nome,
    p.squadra_arbitro_codice,
    sa.nome as squadra_arbitro_nome,
    p.squadra_2_codice as squadra_avversaria_codice,
    s2.nome as squadra_avversaria_nome,
    p.stato,
    p.note
from partita p
join campo c on c.codice = p.campo_codice
join squadra s1 on s1.codice = p.squadra_1_codice
join squadra s2 on s2.codice = p.squadra_2_codice
left join squadra sa on sa.codice = p.squadra_arbitro_codice

union all

select
    p.torneo_id,
    p.squadra_2_codice as squadra_codice,
    s2.nome as squadra_nome,
    'PARTITA' as tipo_evento,
    p.id as partita_id,
    p.fase_torneo_codice,
    p.girone_codice,
    p.campo_codice,
    c.nome as campo_nome,
    p.orario_inizio,
    p.squadra_1_codice,
    s1.nome as squadra_1_nome,
    p.squadra_2_codice,
    s2.nome as squadra_2_nome,
    p.squadra_arbitro_codice,
    sa.nome as squadra_arbitro_nome,
    p.squadra_1_codice as squadra_avversaria_codice,
    s1.nome as squadra_avversaria_nome,
    p.stato,
    p.note
from partita p
join campo c on c.codice = p.campo_codice
join squadra s1 on s1.codice = p.squadra_1_codice
join squadra s2 on s2.codice = p.squadra_2_codice
left join squadra sa on sa.codice = p.squadra_arbitro_codice

-- =====================================================
-- PARTITE ARBITRATE
-- =====================================================

union all

select
    p.torneo_id,
    p.squadra_arbitro_codice as squadra_codice,
    sa.nome as squadra_nome,
    'ARBITRAGGIO' as tipo_evento,
    p.id as partita_id,
    p.fase_torneo_codice,
    p.girone_codice,
    p.campo_codice,
    c.nome as campo_nome,
    p.orario_inizio,
    p.squadra_1_codice,
    s1.nome as squadra_1_nome,
    p.squadra_2_codice,
    s2.nome as squadra_2_nome,
    p.squadra_arbitro_codice,
    sa.nome as squadra_arbitro_nome,
    null::text as squadra_avversaria_codice,
    null::text as squadra_avversaria_nome,
    p.stato,
    p.note
from partita p
join campo c on c.codice = p.campo_codice
join squadra s1 on s1.codice = p.squadra_1_codice
join squadra s2 on s2.codice = p.squadra_2_codice
join squadra sa on sa.codice = p.squadra_arbitro_codice
where p.squadra_arbitro_codice is not null

-- =====================================================
-- PRANZO
-- =====================================================

union all

select
    s.torneo_id,
    s.codice as squadra_codice,
    s.nome as squadra_nome,
    'PRANZO' as tipo_evento,
    null::integer as partita_id,
    null::text as fase_torneo_codice,
    null::text as girone_codice,
    null::text as campo_codice,
    null::text as campo_nome,
    (t.data_torneo::timestamp + s.orario_pranzo) at time zone 'Europe/Rome' as orario_inizio,
    null::text as squadra_1_codice,
    null::text as squadra_1_nome,
    null::text as squadra_2_codice,
    null::text as squadra_2_nome,
    null::text as squadra_arbitro_codice,
    null::text as squadra_arbitro_nome,
    null::text as squadra_avversaria_codice,
    null::text as squadra_avversaria_nome,
    'programmata' as stato,
    'Pranzo squadra' as note
from squadra s
join torneo t
    on t.id = s.torneo_id
where s.orario_pranzo is not null;

grant select on
    v_partita_risultato,
    v_partita_squadra,
    v_classifica,
    v_classifica_ordinata,
    v_classifica_gironi,
    v_classifica_girone_a,
    v_classifica_girone_b,
    v_classifica_girone_c,
    v_classifica_girone_d,
    v_classifica_gold,
    v_classifica_silver,
    v_agenda_squadra
to anon, authenticated;


