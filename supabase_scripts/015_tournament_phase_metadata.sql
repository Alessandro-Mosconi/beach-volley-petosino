-- =====================================================
-- 015_tournament_phase_metadata.sql
-- Metadata fasi per mostrare dinamicamente i bottoni corretti.
--
-- Aggiunge:
-- - fase_torneo.tipo: GIRONE, ELIMINAZIONE_DIRETTA, ALTRO
-- - torneo_fase: associa le fasi abilitate per ogni torneo
-- - v_torneo_fase: view comoda per frontend
-- - torneo_regolamento: regolamento JSON specifico per torneo
-- =====================================================

begin;

alter table fase_torneo
    add column if not exists tipo text not null default 'ELIMINAZIONE_DIRETTA';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_fase_torneo_tipo'
          and conrelid = 'fase_torneo'::regclass
    ) then
        alter table fase_torneo
            add constraint chk_fase_torneo_tipo
            check (tipo in ('GIRONE', 'ELIMINAZIONE_DIRETTA', 'ALTRO'));
    end if;
end $$;

insert into fase_torneo (codice, nome, descrizione, ordine, tipo) values
    ('GIRONI', 'Gironi', 'Fase iniziale a gironi', 1, 'GIRONE'),
    ('GOLD', 'Gold', 'Tabellone Gold', 2, 'ELIMINAZIONE_DIRETTA'),
    ('SILVER', 'Silver', 'Tabellone Silver', 3, 'ELIMINAZIONE_DIRETTA'),
    ('TORNEO', 'Torneo', 'Tabellone finale', 2, 'ELIMINAZIONE_DIRETTA')
on conflict (codice) do update
set nome = excluded.nome,
    descrizione = excluded.descrizione,
    ordine = excluded.ordine,
    tipo = excluded.tipo;

create table if not exists torneo_fase (
    torneo_id integer not null references torneo(id) on delete cascade,
    fase_torneo_codice text not null references fase_torneo(codice) on delete cascade,
    ordine integer not null default 0,
    nome_override text,
    visibile boolean not null default true,
    primary key (torneo_id, fase_torneo_codice)
);

insert into torneo_fase (torneo_id, fase_torneo_codice, ordine)
select t.id, f.codice, f.ordine
from torneo t
join fase_torneo f on f.codice in ('GIRONI', 'GOLD', 'SILVER')
where t.id = 1
on conflict (torneo_id, fase_torneo_codice) do update
set ordine = excluded.ordine,
    visibile = true;

insert into torneo_fase (torneo_id, fase_torneo_codice, ordine)
select t.id, f.codice, f.ordine
from torneo t
join fase_torneo f on f.codice in ('GIRONI', 'TORNEO')
where t.nome = 'PSK 2026'
on conflict (torneo_id, fase_torneo_codice) do update
set ordine = excluded.ordine,
    visibile = true;

insert into torneo_fase (torneo_id, fase_torneo_codice, ordine)
select distinct p.torneo_id, p.fase_torneo_codice, f.ordine
from partita p
join fase_torneo f on f.codice = p.fase_torneo_codice
on conflict (torneo_id, fase_torneo_codice) do nothing;

-- Rete di sicurezza: ogni torneo che ha gironi configurati mostra la fase GIRONI
-- anche se non ha ancora partite inserite.
insert into torneo_fase (torneo_id, fase_torneo_codice, ordine)
select distinct g.torneo_id, 'GIRONI', f.ordine
from girone g
join fase_torneo f on f.codice = 'GIRONI'
on conflict (torneo_id, fase_torneo_codice) do update
set ordine = excluded.ordine,
    visibile = true;

create or replace view v_torneo_fase as
select
    tf.torneo_id,
    ft.codice,
    coalesce(tf.nome_override, ft.nome) as nome,
    ft.descrizione,
    ft.tipo,
    coalesce(nullif(tf.ordine, 0), ft.ordine) as ordine,
    tf.visibile
from torneo_fase tf
join fase_torneo ft on ft.codice = tf.fase_torneo_codice
where tf.visibile = true;

alter table torneo_fase enable row level security;

drop policy if exists public_read_torneo_fase on torneo_fase;
create policy public_read_torneo_fase on torneo_fase for select to anon, authenticated using (true);

create table if not exists torneo_regolamento (
    torneo_id integer primary key references torneo(id) on delete cascade,
    contenuto jsonb not null,
    aggiornato_il timestamp with time zone not null default now(),
    constraint chk_torneo_regolamento_contenuto_object check (jsonb_typeof(contenuto) = 'object')
);

create or replace function trg_torneo_regolamento_updated_at_fn()
returns trigger
language plpgsql
as $$
begin
    new.aggiornato_il := now();
    return new;
end;
$$;

drop trigger if exists trg_torneo_regolamento_updated_at on torneo_regolamento;
create trigger trg_torneo_regolamento_updated_at
before update on torneo_regolamento
for each row
execute function trg_torneo_regolamento_updated_at_fn();

insert into torneo_regolamento (torneo_id, contenuto)
select t.id, jsonb_build_object(
    'title', 'Regolamento',
    'sections', jsonb_build_array(
        jsonb_build_object(
            'eyebrow', 'Fase iniziale',
            'title', 'Gironi',
            'variant', 'primary',
            'listType', 'ul',
            'items', jsonb_build_array(
                'Il torneo prevede una fase iniziale a gironi.',
                'Le partite dei gironi assegnano punti classifica in base ai set vinti.',
                'La classifica viene ordinata da punti, scontro diretto e differenza punti.'
            )
        ),
        jsonb_build_object(
            'eyebrow', 'Tabellone',
            'title', 'Torneo',
            'variant', 'bracket',
            'listType', 'ul',
            'items', jsonb_build_array(
                'Le squadre qualificate accedono alla fase a eliminazione diretta.',
                'Il tabellone prevede quarti, semifinali, finale e finalina quando configurati.'
            )
        ),
        jsonb_build_object(
            'eyebrow', 'Orari',
            'title', 'Prima della partita',
            'listType', 'ul',
            'items', jsonb_build_array(
                'Presentarsi nella zona dei campi qualche minuto prima dell''orario previsto.',
                'Non iniziare la partita prima dell''orario previsto.'
            )
        ),
        jsonb_build_object(
            'eyebrow', 'Arbitraggio',
            'title', 'Gestione arbitri',
            'listType', 'ul',
            'items', jsonb_build_array(
                'Quando indicata, la squadra arbitro gestisce la partita assegnata.',
                'Le fasi finali possono essere arbitrate dagli organizzatori.'
            )
        )
    )
)
from torneo t
where t.nome = 'PSK 2026'
on conflict (torneo_id) do nothing;

alter table torneo_regolamento enable row level security;

drop policy if exists public_read_torneo_regolamento on torneo_regolamento;
create policy public_read_torneo_regolamento on torneo_regolamento for select to anon, authenticated using (true);

grant select on torneo_fase, v_torneo_fase, torneo_regolamento to anon, authenticated;

do $$ begin alter publication supabase_realtime add table torneo_fase; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table torneo_regolamento; exception when duplicate_object then null; end $$;

commit;
