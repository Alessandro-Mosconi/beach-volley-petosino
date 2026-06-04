-- =====================================================
-- 001_ddl_torneo_beach_volley_finale_v2.sql
-- DDL completo PostgreSQL / Supabase
--
-- Scelte principali:
-- - codici parlanti per campo, fase, girone e squadra
-- - arbitro nullable: NULL = organizzatori
-- - niente tabella classifica manuale
-- - classifiche calcolate da view
-- - vincitore salvabile su partita e su ogni set
-- - pranzo incluso nella view agenda
-- - qualificazione_fase semplificata: contiene solo fase + squadra
-- - view dedicate per classifiche gironi, Gold e Silver
-- =====================================================

-- =====================================================
-- DROP ORDINATO
-- =====================================================

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


drop function if exists ricalcola_risultato_partita(integer) cascade;
drop function if exists trg_partita_set_auto_vincitore_fn() cascade;
drop function if exists trg_partita_set_ricalcola_partita_fn() cascade;
drop function if exists trg_partita_validate_vincitore_fn() cascade;
drop function if exists puo_modificare_risultati() cascade;
drop function if exists puo_modificare_risultati_partita(integer) cascade;
drop function if exists puo_modificare_risultati_set(integer) cascade;
drop function if exists trg_squadra_codice_default_fn() cascade;
drop function if exists trg_torneo_visibile_unico_fn() cascade;
drop function if exists normalizza_codice(text) cascade;

drop table if exists qualificazione_fase cascade;
drop table if exists partita_set cascade;
drop table if exists partita cascade;
drop table if exists operatore_app cascade;
drop table if exists torneo_operatore cascade;
drop table if exists girone_squadra cascade;
drop table if exists squadra cascade;
drop table if exists girone cascade;
drop table if exists fase_torneo cascade;
drop table if exists campo cascade;
drop table if exists torneo cascade;

-- =====================================================
-- ESTENSIONI
-- =====================================================

create extension if not exists unaccent;

-- =====================================================
-- FUNZIONE NORMALIZZAZIONE CODICI
-- Esempio: 'Gli Squali Blu!' -> 'GLI_SQUALI_BLU'
-- =====================================================

create or replace function normalizza_codice(p_nome text)
returns text
language sql
immutable
as $$
    select trim(both '_' from regexp_replace(upper(unaccent(coalesce(p_nome, ''))), '[^A-Z0-9]+', '_', 'g'));
$$;

-- =====================================================
-- TORNEO
-- =====================================================

create table torneo (
    id integer generated always as identity primary key,
    nome text not null,
    data_torneo date,
    visibile boolean not null default false,
    creato_il timestamp with time zone not null default now()
);

create unique index uq_torneo_visibile_unico
on torneo (visibile)
where visibile;

create or replace function trg_torneo_visibile_unico_fn()
returns trigger
language plpgsql
as $$
begin
    if new.visibile then
        update torneo
        set visibile = false
        where id <> new.id
          and visibile = true;
    end if;

    return new;
end;
$$;

create trigger trg_torneo_visibile_unico
before insert or update of visibile on torneo
for each row
execute function trg_torneo_visibile_unico_fn();

-- =====================================================
-- OPERATORI AUTORIZZATI
-- Whitelist globale: gli utenti Supabase Auth presenti qui possono
-- inserire/modificare partite, set e punteggi dall'app.
-- =====================================================

create table operatore_app (
    id integer generated always as identity primary key,
    email text not null,
    nome text,
    puo_modificare boolean not null default true,
    attivo boolean not null default true,
    creato_il timestamp with time zone not null default now(),
    constraint chk_operatore_app_email_non_vuota check (btrim(email) <> '')
);

create unique index uq_operatore_app_email
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

-- =====================================================
-- CAMPO
-- Codici esempio: CAMPO_1, CAMPO_2, CAMPO_3
-- =====================================================

create table campo (
    codice text primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    ordine integer not null default 0,
    unique (torneo_id, nome)
);

-- =====================================================
-- FASE TORNEO
-- Codici esempio: GIRONI, GOLD, SILVER
-- =====================================================

create table fase_torneo (
    codice text primary key,
    nome text not null,
    descrizione text,
    ordine integer not null default 0
);

-- =====================================================
-- GIRONE
-- Codici esempio: GIRONE_A, GIRONE_B, GIRONE_C, GIRONE_D
-- =====================================================

create table girone (
    codice text primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    ordine integer not null default 0,
    unique (torneo_id, nome)
);

-- =====================================================
-- SQUADRA
-- codice può essere omesso: viene creato automaticamente dal nome.
-- Per l'Excel uso comunque codici A1, A2, B1, ecc.
-- =====================================================

create table squadra (
    codice text primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    orario_pranzo time,
    durata_pranzo_minuti integer not null default 60,
    creato_il timestamp with time zone not null default now(),
    unique (torneo_id, nome),
    check (durata_pranzo_minuti > 0)
);

-- Trigger codice squadra automatico
create or replace function trg_squadra_codice_default_fn()
returns trigger
language plpgsql
as $$
begin
    if new.codice is null or trim(new.codice) = '' then
        new.codice := normalizza_codice(new.nome);
    else
        new.codice := normalizza_codice(new.codice);
    end if;

    if new.codice is null or trim(new.codice) = '' then
        raise exception 'codice squadra non valido per nome=%', new.nome;
    end if;

    return new;
end;
$$;

create trigger trg_squadra_codice_default
before insert or update of codice, nome on squadra
for each row
execute function trg_squadra_codice_default_fn();

-- =====================================================
-- SQUADRE NEI GIRONI
-- Niente posizione_iniziale: la classifica è calcolata dai risultati.
-- =====================================================

create table girone_squadra (
    id integer generated always as identity primary key,
    girone_codice text not null references girone(codice) on delete cascade,
    squadra_codice text not null references squadra(codice) on delete cascade,
    unique (girone_codice, squadra_codice)
);

-- =====================================================
-- PARTITA
-- Arbitro nullable:
-- - squadra_arbitro_codice valorizzato = arbitra una squadra
-- - squadra_arbitro_codice null = arbitra l'organizzazione
--
-- squadra_vincitrice_codice / squadra_perdente_codice sono salvabili
-- e vengono aggiornati automaticamente quando inserisci/modifichi i set.
-- =====================================================

create table partita (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    fase_torneo_codice text not null references fase_torneo(codice),
    girone_codice text references girone(codice) on delete set null,
    slot_tabellone text,
    campo_codice text not null references campo(codice),
    orario_inizio timestamp with time zone not null,
    squadra_1_codice text not null references squadra(codice),
    squadra_2_codice text not null references squadra(codice),
    squadra_arbitro_codice text references squadra(codice),
    squadra_vincitrice_codice text references squadra(codice),
    squadra_perdente_codice text references squadra(codice),
    stato text default 'programmata',
    note text,

    constraint chk_partita_squadre_diverse
        check (squadra_1_codice <> squadra_2_codice),

    constraint chk_partita_slot_tabellone_fase
        check (
            slot_tabellone is null
            or fase_torneo_codice in ('GOLD', 'SILVER')
        ),

    constraint chk_partita_slot_tabellone_valido
        check (
            slot_tabellone is null
            or slot_tabellone in (
                'QUARTI_1',
                'QUARTI_2',
                'QUARTI_3',
                'QUARTI_4',
                'SEMIFINALE_1',
                'SEMIFINALE_2',
                'FINALE',
                'FINALINA'
            )
        ),

    constraint chk_partita_arbitro_non_giocatore
        check (
            squadra_arbitro_codice is null
            or (
                squadra_arbitro_codice <> squadra_1_codice
                and squadra_arbitro_codice <> squadra_2_codice
            )
        ),

    constraint chk_partita_vincitore_partecipante
        check (
            squadra_vincitrice_codice is null
            or squadra_vincitrice_codice = squadra_1_codice
            or squadra_vincitrice_codice = squadra_2_codice
        ),

    constraint chk_partita_perdente_partecipante
        check (
            squadra_perdente_codice is null
            or squadra_perdente_codice = squadra_1_codice
            or squadra_perdente_codice = squadra_2_codice
        ),

    constraint chk_partita_vincitore_perdente_diversi
        check (
            squadra_vincitrice_codice is null
            or squadra_perdente_codice is null
            or squadra_vincitrice_codice <> squadra_perdente_codice
    )
);

create unique index uq_partita_slot_tabellone
on partita (torneo_id, fase_torneo_codice, slot_tabellone)
where slot_tabellone is not null;

-- Trigger validazione vincitore/perdente partita
create or replace function trg_partita_validate_vincitore_fn()
returns trigger
language plpgsql
as $$
begin
    if new.squadra_vincitrice_codice is not null then
        if new.squadra_vincitrice_codice not in (new.squadra_1_codice, new.squadra_2_codice) then
            raise exception 'La squadra vincitrice % non partecipa alla partita %', new.squadra_vincitrice_codice, new.id;
        end if;

        if new.squadra_perdente_codice is null then
            if new.squadra_vincitrice_codice = new.squadra_1_codice then
                new.squadra_perdente_codice := new.squadra_2_codice;
            else
                new.squadra_perdente_codice := new.squadra_1_codice;
            end if;
        end if;
    end if;

    if new.squadra_perdente_codice is not null then
        if new.squadra_perdente_codice not in (new.squadra_1_codice, new.squadra_2_codice) then
            raise exception 'La squadra perdente % non partecipa alla partita %', new.squadra_perdente_codice, new.id;
        end if;
    end if;

    return new;
end;
$$;

create trigger trg_partita_validate_vincitore
before insert or update of squadra_vincitrice_codice, squadra_perdente_codice, squadra_1_codice, squadra_2_codice on partita
for each row
execute function trg_partita_validate_vincitore_fn();

-- =====================================================
-- SET PARTITA
-- Fonte dei punteggi reali.
-- squadra_vincitrice_codice è salvabile, ma se la ometti viene
-- calcolata automaticamente dai punteggi del set.
-- =====================================================

create table partita_set (
    id integer generated always as identity primary key,
    partita_id integer not null references partita(id) on delete cascade,
    numero_set integer not null,
    punteggio_squadra_1 integer not null default 0,
    punteggio_squadra_2 integer not null default 0,
    squadra_vincitrice_codice text references squadra(codice),

    unique (partita_id, numero_set),
    check (numero_set > 0),
    check (punteggio_squadra_1 >= 0),
    check (punteggio_squadra_2 >= 0),
    check (punteggio_squadra_1 <> punteggio_squadra_2)
);

-- Trigger set: auto-calcola e valida vincitore set
create or replace function trg_partita_set_auto_vincitore_fn()
returns trigger
language plpgsql
as $$
declare
    v_squadra_1 text;
    v_squadra_2 text;
begin
    select squadra_1_codice, squadra_2_codice
    into v_squadra_1, v_squadra_2
    from partita
    where id = new.partita_id;

    if v_squadra_1 is null then
        raise exception 'Partita % non trovata', new.partita_id;
    end if;

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
$$;

create trigger trg_partita_set_auto_vincitore
before insert or update of punteggio_squadra_1, punteggio_squadra_2, squadra_vincitrice_codice on partita_set
for each row
execute function trg_partita_set_auto_vincitore_fn();

-- =====================================================
-- FUNZIONE RICALCOLO VINCITORE PARTITA DA SET
-- =====================================================

create or replace function ricalcola_risultato_partita(p_partita_id integer)
returns void
language plpgsql
as $$
declare
    v_squadra_1 text;
    v_squadra_2 text;
    v_set_1 integer;
    v_set_2 integer;
begin
    select squadra_1_codice, squadra_2_codice
    into v_squadra_1, v_squadra_2
    from partita
    where id = p_partita_id;

    if v_squadra_1 is null then
        return;
    end if;

    select
        coalesce(sum(case when squadra_vincitrice_codice = v_squadra_1 then 1 else 0 end), 0)::integer,
        coalesce(sum(case when squadra_vincitrice_codice = v_squadra_2 then 1 else 0 end), 0)::integer
    into v_set_1, v_set_2
    from partita_set
    where partita_id = p_partita_id;

    if v_set_1 = 0 and v_set_2 = 0 then
        update partita
        set squadra_vincitrice_codice = null,
            squadra_perdente_codice = null
        where id = p_partita_id;
    elsif v_set_1 > v_set_2 then
        update partita
        set squadra_vincitrice_codice = v_squadra_1,
            squadra_perdente_codice = v_squadra_2
        where id = p_partita_id;
    elsif v_set_2 > v_set_1 then
        update partita
        set squadra_vincitrice_codice = v_squadra_2,
            squadra_perdente_codice = v_squadra_1
        where id = p_partita_id;
    else
        update partita
        set squadra_vincitrice_codice = null,
            squadra_perdente_codice = null
        where id = p_partita_id;
    end if;
end;
$$;

create or replace function trg_partita_set_ricalcola_partita_fn()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' then
        perform ricalcola_risultato_partita(old.partita_id);
        return old;
    else
        perform ricalcola_risultato_partita(new.partita_id);
        return new;
    end if;
end;
$$;

create trigger trg_partita_set_ricalcola_partita_aiud
after insert or update or delete on partita_set
for each row
execute function trg_partita_set_ricalcola_partita_fn();

-- =====================================================
-- QUALIFICAZIONI FASE
-- Per segnare chi entra in GOLD/SILVER.
-- =====================================================

create table qualificazione_fase (
    id integer generated always as identity primary key,
    fase_torneo_codice text not null references fase_torneo(codice) on delete cascade,
    squadra_codice text not null references squadra(codice) on delete cascade,

    -- Solo questo serve:
    -- indica che una squadra partecipa alla fase GOLD o SILVER.
    -- Girone di origine e posizione si calcolano dalle view di classifica.
    unique (fase_torneo_codice, squadra_codice)
);

-- =====================================================
-- VIEW RISULTATO PARTITA
-- =====================================================

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
join campo c on c.codice = p.campo_codice
join squadra s1 on s1.codice = p.squadra_1_codice
join squadra s2 on s2.codice = p.squadra_2_codice
left join squadra sa on sa.codice = p.squadra_arbitro_codice
left join squadra sv on sv.codice = p.squadra_vincitrice_codice
left join squadra sp on sp.codice = p.squadra_perdente_codice
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

-- =====================================================
-- POLICY LETTURA PUBBLICA SUPABASE
-- =====================================================

alter table torneo enable row level security;
alter table campo enable row level security;
alter table fase_torneo enable row level security;
alter table girone enable row level security;
alter table squadra enable row level security;
alter table girone_squadra enable row level security;
alter table operatore_app enable row level security;
alter table partita enable row level security;
alter table partita_set enable row level security;
alter table qualificazione_fase enable row level security;

create policy public_read_torneo on torneo for select to anon, authenticated using (true);
create policy public_read_campo on campo for select to anon, authenticated using (true);
create policy public_read_fase_torneo on fase_torneo for select to anon, authenticated using (true);
create policy public_read_girone on girone for select to anon, authenticated using (true);
create policy public_read_squadra on squadra for select to anon, authenticated using (true);
create policy public_read_girone_squadra on girone_squadra for select to anon, authenticated using (true);
create policy own_operatore_app on operatore_app for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy public_read_partita on partita for select to anon, authenticated using (true);
create policy public_read_partita_set on partita_set for select to anon, authenticated using (true);
create policy public_read_qualificazione_fase on qualificazione_fase for select to anon, authenticated using (true);

create policy operator_insert_partita on partita for insert to authenticated
with check (puo_modificare_risultati());

create policy operator_update_partita on partita for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

create policy operator_delete_partita on partita for delete to authenticated
using (puo_modificare_risultati());

create policy operator_insert_partita_set on partita_set for insert to authenticated
with check (puo_modificare_risultati());

create policy operator_update_partita_set on partita_set for update to authenticated
using (puo_modificare_risultati())
with check (puo_modificare_risultati());

create policy operator_delete_partita_set on partita_set for delete to authenticated
using (puo_modificare_risultati());

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on partita, partita_set to authenticated;
grant usage, select on sequence partita_id_seq, partita_set_id_seq to authenticated;
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

-- =====================================================
-- REALTIME SUPABASE
-- Usa blocchi sicuri per evitare errore se una tabella è già nella publication.
-- =====================================================

do $$ begin alter publication supabase_realtime add table torneo; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table campo; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table fase_torneo; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table girone; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table squadra; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table girone_squadra; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table partita; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table partita_set; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table qualificazione_fase; exception when duplicate_object then null; end $$;
