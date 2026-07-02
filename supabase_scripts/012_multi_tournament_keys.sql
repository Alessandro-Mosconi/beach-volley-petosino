-- =====================================================
-- 012_multi_tournament_keys.sql
-- Migra le chiavi di campo, girone e squadra a (torneo_id, codice).
-- Popola torneo_id = 1 sulle tabelle che non lo avevano, per mantenere
-- compatibile il torneo gia' presente, e ricrea le view con join per torneo.
-- =====================================================

begin;

drop view if exists v_agenda_squadra cascade;
drop view if exists v_classifica_finale_silver cascade;
drop view if exists v_classifica_finale_gold cascade;
drop view if exists v_classifica_finale cascade;
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

alter table girone_squadra add column if not exists torneo_id integer;
alter table qualificazione_fase add column if not exists torneo_id integer;
alter table partita_set add column if not exists torneo_id integer;

update girone_squadra set torneo_id = 1 where torneo_id is null;
update qualificazione_fase set torneo_id = 1 where torneo_id is null;
update partita_set ps
set torneo_id = coalesce(p.torneo_id, 1)
from partita p
where ps.partita_id = p.id
  and ps.torneo_id is null;
update partita_set set torneo_id = 1 where torneo_id is null;

alter table girone_squadra alter column torneo_id set not null;
alter table qualificazione_fase alter column torneo_id set not null;
alter table partita_set alter column torneo_id set not null;

do $$
declare
    r record;
begin
    for r in
        select conrelid::regclass as table_name, conname
        from pg_constraint
        where contype = 'f'
          and conrelid in (
              'partita'::regclass,
              'partita_set'::regclass,
              'girone_squadra'::regclass,
              'qualificazione_fase'::regclass
          )
    loop
        execute format('alter table %s drop constraint %I', r.table_name, r.conname);
    end loop;
end $$;

alter table partita drop constraint if exists chk_partita_slot_tabellone_fase;
alter table partita add constraint chk_partita_slot_tabellone_fase
    check (
        slot_tabellone is null
        or fase_torneo_codice in ('GOLD', 'SILVER')
    );

alter table campo drop constraint if exists campo_pkey;
alter table girone drop constraint if exists girone_pkey;
alter table squadra drop constraint if exists squadra_pkey;

alter table campo add constraint campo_pkey primary key (torneo_id, codice);
alter table girone add constraint girone_pkey primary key (torneo_id, codice);
alter table squadra add constraint squadra_pkey primary key (torneo_id, codice);

alter table girone_squadra drop constraint if exists girone_squadra_girone_codice_squadra_codice_key;
alter table girone_squadra drop constraint if exists girone_squadra_torneo_girone_squadra_key;
alter table qualificazione_fase drop constraint if exists qualificazione_fase_fase_torneo_codice_squadra_codice_key;
alter table qualificazione_fase drop constraint if exists qualificazione_fase_torneo_fase_squadra_key;

alter table girone_squadra add constraint girone_squadra_torneo_girone_squadra_key unique (torneo_id, girone_codice, squadra_codice);
alter table qualificazione_fase add constraint qualificazione_fase_torneo_fase_squadra_key unique (torneo_id, fase_torneo_codice, squadra_codice);

alter table girone_squadra
    add constraint girone_squadra_torneo_id_fkey foreign key (torneo_id) references torneo(id) on delete cascade,
    add constraint girone_squadra_girone_fkey foreign key (torneo_id, girone_codice) references girone(torneo_id, codice) on delete cascade,
    add constraint girone_squadra_squadra_fkey foreign key (torneo_id, squadra_codice) references squadra(torneo_id, codice) on delete cascade;

alter table partita
    add constraint partita_torneo_id_fkey foreign key (torneo_id) references torneo(id) on delete cascade,
    add constraint partita_fase_torneo_codice_fkey foreign key (fase_torneo_codice) references fase_torneo(codice),
    add constraint partita_girone_fkey foreign key (torneo_id, girone_codice) references girone(torneo_id, codice) on delete set null,
    add constraint partita_campo_fkey foreign key (torneo_id, campo_codice) references campo(torneo_id, codice),
    add constraint partita_squadra_1_fkey foreign key (torneo_id, squadra_1_codice) references squadra(torneo_id, codice),
    add constraint partita_squadra_2_fkey foreign key (torneo_id, squadra_2_codice) references squadra(torneo_id, codice),
    add constraint partita_squadra_arbitro_fkey foreign key (torneo_id, squadra_arbitro_codice) references squadra(torneo_id, codice),
    add constraint partita_squadra_vincitrice_fkey foreign key (torneo_id, squadra_vincitrice_codice) references squadra(torneo_id, codice),
    add constraint partita_squadra_perdente_fkey foreign key (torneo_id, squadra_perdente_codice) references squadra(torneo_id, codice);

alter table partita_set
    add constraint partita_set_partita_id_fkey foreign key (partita_id) references partita(id) on delete cascade,
    add constraint partita_set_torneo_id_fkey foreign key (torneo_id) references torneo(id) on delete cascade,
    add constraint partita_set_squadra_vincitrice_fkey foreign key (torneo_id, squadra_vincitrice_codice) references squadra(torneo_id, codice);

alter table qualificazione_fase
    add constraint qualificazione_fase_torneo_id_fkey foreign key (torneo_id) references torneo(id) on delete cascade,
    add constraint qualificazione_fase_fase_torneo_codice_fkey foreign key (fase_torneo_codice) references fase_torneo(codice) on delete cascade,
    add constraint qualificazione_fase_squadra_fkey foreign key (torneo_id, squadra_codice) references squadra(torneo_id, codice) on delete cascade;

create or replace function trg_partita_set_auto_vincitore_fn()
returns trigger
language plpgsql
as $$
declare
    v_torneo_id integer;
    v_squadra_1 text;
    v_squadra_2 text;
begin
    select torneo_id, squadra_1_codice, squadra_2_codice
    into v_torneo_id, v_squadra_1, v_squadra_2
    from partita
    where id = new.partita_id;

    if v_squadra_1 is null then
        raise exception 'Partita % non trovata', new.partita_id;
    end if;

    new.torneo_id := v_torneo_id;

    if new.punteggio_squadra_1 > new.punteggio_squadra_2 then
        new.squadra_vincitrice_codice := v_squadra_1;
    else
        new.squadra_vincitrice_codice := v_squadra_2;
    end if;

    if new.squadra_vincitrice_codice not in (v_squadra_1, v_squadra_2) then
        raise exception 'La squadra vincitrice del set % non partecipa alla partita %', new.squadra_vincitrice_codice, new.partita_id;
    end if;

    return new;
end;
$$;;

create or replace view v_partita_risultato as
select
    p.id as partita_id,
    p.torneo_id,
    p.fase_torneo_codice,
    p.girone_codice,
    p.slot_tabellone,
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
join campo c on c.torneo_id = p.torneo_id and c.codice = p.campo_codice
join squadra s1 on s1.torneo_id = p.torneo_id and s1.codice = p.squadra_1_codice
join squadra s2 on s2.torneo_id = p.torneo_id and s2.codice = p.squadra_2_codice
left join squadra sa on sa.torneo_id = p.torneo_id and sa.codice = p.squadra_arbitro_codice
left join squadra sv on sv.torneo_id = p.torneo_id and sv.codice = p.squadra_vincitrice_codice
left join squadra sp on sp.torneo_id = p.torneo_id and sp.codice = p.squadra_perdente_codice
left join partita_set ps on ps.partita_id = p.id
group by
    p.id, p.torneo_id, p.fase_torneo_codice, p.girone_codice, p.slot_tabellone, p.campo_codice,
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
    r.slot_tabellone,
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
    r.slot_tabellone,
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
    case
        when ps.fase_torneo_codice = 'GIRONI' then coalesce(sum(ps.set_vinti), 0)::integer
        else (coalesce(sum(ps.partita_vinta), 0) * 3)::integer
    end as punti_classifica
from v_partita_squadra ps
where ps.risultato_squadra in ('VINTA', 'PERSA')
   or ps.set_vinti + ps.set_persi > 0
group by
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice;

create or replace view v_classifica_ordinata as
with classifica_con_scontro_diretto as (
    select
        c.*,
        coalesce(sum(ps.set_vinti), 0)::integer as scontro_diretto_punti
    from v_classifica c
    left join v_classifica altre
        on altre.torneo_id = c.torneo_id
       and altre.fase_torneo_codice = c.fase_torneo_codice
       and coalesce(altre.girone_codice, '') = coalesce(c.girone_codice, '')
       and altre.punti_classifica = c.punti_classifica
       and altre.squadra_codice <> c.squadra_codice
    left join v_partita_squadra ps
        on ps.torneo_id = c.torneo_id
       and ps.fase_torneo_codice = c.fase_torneo_codice
       and coalesce(ps.girone_codice, '') = coalesce(c.girone_codice, '')
       and ps.squadra_codice = c.squadra_codice
       and ps.avversaria_codice = altre.squadra_codice
    group by
        c.torneo_id,
        c.girone_codice,
        c.fase_torneo_codice,
        c.squadra_codice,
        c.partite_giocate,
        c.partite_vinte,
        c.partite_pareggiate,
        c.partite_perse,
        c.set_vinti,
        c.set_persi,
        c.punti_fatti,
        c.punti_subiti,
        c.differenza_set,
        c.differenza_punti,
        c.punti_classifica
)
select
    c.torneo_id,
    c.girone_codice,
    c.fase_torneo_codice,
    c.squadra_codice,
    c.partite_giocate,
    c.partite_vinte,
    c.partite_pareggiate,
    c.partite_perse,
    c.set_vinti,
    c.set_persi,
    c.punti_fatti,
    c.punti_subiti,
    c.differenza_set,
    c.differenza_punti,
    c.punti_classifica,
    row_number() over (
        partition by c.torneo_id, c.girone_codice, c.fase_torneo_codice
        order by
            c.punti_classifica desc,
            c.scontro_diretto_punti desc,
            c.differenza_punti desc,
            c.punti_fatti desc,
            s.nome asc
    )::integer as posizione,
    s.nome as squadra_nome,
    g.nome as girone_nome,
    f.nome as fase_nome
from classifica_con_scontro_diretto c
join squadra s on s.torneo_id = c.torneo_id and s.codice = c.squadra_codice
left join girone g on g.torneo_id = c.torneo_id and g.codice = c.girone_codice
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
-- VIEW CLASSIFICA FINALE TABELLONI
-- Disponibile quando finale e finalina hanno vincitore/perdente.
-- =====================================================

create or replace view v_classifica_finale as
with partite_finali as (
    select *
    from v_partita_risultato
    where fase_torneo_codice in ('GOLD', 'SILVER')
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
join campo c on c.torneo_id = p.torneo_id and c.codice = p.campo_codice
join squadra s1 on s1.torneo_id = p.torneo_id and s1.codice = p.squadra_1_codice
join squadra s2 on s2.torneo_id = p.torneo_id and s2.codice = p.squadra_2_codice
left join squadra sa on sa.torneo_id = p.torneo_id and sa.codice = p.squadra_arbitro_codice

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
join campo c on c.torneo_id = p.torneo_id and c.codice = p.campo_codice
join squadra s1 on s1.torneo_id = p.torneo_id and s1.codice = p.squadra_1_codice
join squadra s2 on s2.torneo_id = p.torneo_id and s2.codice = p.squadra_2_codice
left join squadra sa on sa.torneo_id = p.torneo_id and sa.codice = p.squadra_arbitro_codice

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
join campo c on c.torneo_id = p.torneo_id and c.codice = p.campo_codice
join squadra s1 on s1.torneo_id = p.torneo_id and s1.codice = p.squadra_1_codice
join squadra s2 on s2.torneo_id = p.torneo_id and s2.codice = p.squadra_2_codice
join squadra sa on sa.torneo_id = p.torneo_id and sa.codice = p.squadra_arbitro_codice
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

-- =====================================================

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
    v_classifica_finale,
    v_classifica_finale_gold,
    v_classifica_finale_silver,
    v_agenda_squadra
to anon, authenticated;

commit;
