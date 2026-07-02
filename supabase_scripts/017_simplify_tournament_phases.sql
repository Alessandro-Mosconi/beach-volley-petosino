-- =====================================================
-- 017_simplify_tournament_phases.sql
-- Semplifica le fasi torneo:
-- - torneo_fase diventa la tabella unica delle fasi per torneo;
-- - fase_torneo viene scollegata e rimossa;
-- - le foreign key delle partite puntano a (torneo_id, codice) in torneo_fase;
-- - v_torneo_fase resta compatibile con il frontend.
-- =====================================================

begin;

drop view if exists v_classifica_silver cascade;
drop view if exists v_classifica_gold cascade;
drop view if exists v_classifica_girone_d cascade;
drop view if exists v_classifica_girone_c cascade;
drop view if exists v_classifica_girone_b cascade;
drop view if exists v_classifica_girone_a cascade;
drop view if exists v_classifica_gironi cascade;
drop view if exists v_classifica_ordinata cascade;
drop view if exists v_torneo_fase cascade;

do $$
declare
    r record;
begin
    if to_regclass('public.fase_torneo') is null then
        return;
    end if;

    for r in
        select conrelid::regclass as table_name, conname
        from pg_constraint
        where contype = 'f'
          and confrelid = 'fase_torneo'::regclass
          and conrelid in (
              'partita'::regclass,
              'qualificazione_fase'::regclass,
              'torneo_fase'::regclass
          )
    loop
        execute format('alter table %s drop constraint %I', r.table_name, r.conname);
    end loop;
end $$;

do $$
declare
    r record;
begin
    for r in
        select conrelid::regclass as table_name, conname
        from pg_constraint
        where contype = 'f'
          and confrelid = 'torneo_fase'::regclass
          and conrelid in (
              'partita'::regclass,
              'qualificazione_fase'::regclass
          )
    loop
        execute format('alter table %s drop constraint %I', r.table_name, r.conname);
    end loop;
end $$;

alter table torneo_fase add column if not exists codice text;
alter table torneo_fase add column if not exists nome text;
alter table torneo_fase add column if not exists descrizione text;
alter table torneo_fase add column if not exists tipo text;

do $$
begin
    if to_regclass('public.fase_torneo') is not null
       and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'torneo_fase'
             and column_name = 'fase_torneo_codice'
       ) then
        update torneo_fase tf
        set codice = coalesce(tf.codice, tf.fase_torneo_codice),
            nome = coalesce(tf.nome, tf.nome_override, ft.nome, tf.fase_torneo_codice),
            descrizione = coalesce(tf.descrizione, ft.descrizione),
            tipo = coalesce(
                tf.tipo,
                ft.tipo,
                case when tf.fase_torneo_codice = 'GIRONI' then 'GIRONE' else 'ELIMINAZIONE_DIRETTA' end
            )
        from fase_torneo ft
        where ft.codice = tf.fase_torneo_codice;
    end if;
end $$;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'torneo_fase'
          and column_name = 'fase_torneo_codice'
    ) then
        update torneo_fase
        set codice = coalesce(codice, fase_torneo_codice),
            nome = coalesce(nome, nome_override, fase_torneo_codice),
            tipo = coalesce(tipo, case when fase_torneo_codice = 'GIRONI' then 'GIRONE' else 'ELIMINAZIONE_DIRETTA' end);
    else
        update torneo_fase
        set nome = coalesce(nome, codice),
            tipo = coalesce(tipo, case when codice = 'GIRONI' then 'GIRONE' else 'ELIMINAZIONE_DIRETTA' end);
    end if;
end $$;

alter table torneo_fase alter column codice set not null;
alter table torneo_fase alter column nome set not null;
alter table torneo_fase alter column tipo set not null;
alter table torneo_fase alter column visibile set default true;

alter table torneo_fase drop constraint if exists chk_torneo_fase_tipo;
alter table torneo_fase add constraint chk_torneo_fase_tipo
    check (tipo in ('GIRONE', 'ELIMINAZIONE_DIRETTA', 'ALTRO'));

alter table torneo_fase drop constraint if exists torneo_fase_pkey;
alter table torneo_fase add constraint torneo_fase_pkey primary key (torneo_id, codice);

alter table torneo_fase drop column if exists fase_torneo_codice;
alter table torneo_fase drop column if exists nome_override;

-- Se esistono partite con una fase non ancora dichiarata per torneo, la aggiungiamo.
insert into torneo_fase (torneo_id, codice, nome, descrizione, tipo, ordine, visibile)
select distinct
    p.torneo_id,
    p.fase_torneo_codice,
    p.fase_torneo_codice,
    null::text,
    case when p.fase_torneo_codice = 'GIRONI' then 'GIRONE' else 'ELIMINAZIONE_DIRETTA' end,
    0,
    true
from partita p
left join torneo_fase tf
    on tf.torneo_id = p.torneo_id
   and tf.codice = p.fase_torneo_codice
where tf.codice is null;

alter table partita drop constraint if exists partita_fase_torneo_fkey;
alter table partita
    add constraint partita_fase_torneo_fkey
    foreign key (torneo_id, fase_torneo_codice)
    references torneo_fase(torneo_id, codice);

alter table qualificazione_fase drop constraint if exists qualificazione_fase_torneo_fase_fkey;
alter table qualificazione_fase
    add constraint qualificazione_fase_torneo_fase_fkey
    foreign key (torneo_id, fase_torneo_codice)
    references torneo_fase(torneo_id, codice)
    on delete cascade;

drop table if exists fase_torneo cascade;

create or replace view v_torneo_fase as
select
    torneo_id,
    codice,
    nome,
    descrizione,
    tipo,
    ordine,
    visibile
from torneo_fase
where visibile = true;

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
    tf.nome as fase_nome
from classifica_con_scontro_diretto c
join squadra s on s.torneo_id = c.torneo_id and s.codice = c.squadra_codice
left join girone g on g.torneo_id = c.torneo_id and g.codice = c.girone_codice
left join torneo_fase tf on tf.torneo_id = c.torneo_id and tf.codice = c.fase_torneo_codice;

create or replace view v_classifica_gironi as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'GIRONI'
order by torneo_id, girone_codice, posizione;

create or replace view v_classifica_girone_a as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_A'
order by torneo_id, posizione;

create or replace view v_classifica_girone_b as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_B'
order by torneo_id, posizione;

create or replace view v_classifica_girone_c as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_C'
order by torneo_id, posizione;

create or replace view v_classifica_girone_d as
select *
from v_classifica_gironi
where girone_codice = 'GIRONE_D'
order by torneo_id, posizione;

create or replace view v_classifica_gold as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'GOLD'
order by torneo_id, posizione;

create or replace view v_classifica_silver as
select *
from v_classifica_ordinata
where fase_torneo_codice = 'SILVER'
order by torneo_id, posizione;

drop policy if exists public_read_torneo_fase on torneo_fase;
alter table torneo_fase enable row level security;
create policy public_read_torneo_fase on torneo_fase for select to anon, authenticated using (true);

grant select on torneo_fase, v_torneo_fase to anon, authenticated;
grant select on
    v_classifica_ordinata,
    v_classifica_gironi,
    v_classifica_girone_a,
    v_classifica_girone_b,
    v_classifica_girone_c,
    v_classifica_girone_d,
    v_classifica_gold,
    v_classifica_silver
to anon, authenticated;

do $$ begin alter publication supabase_realtime add table torneo_fase; exception when duplicate_object then null; end $$;

commit;
