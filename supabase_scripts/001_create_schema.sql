-- =====================================================
-- TORNEO BEACH VOLLEY
-- Schema PostgreSQL / Supabase
-- Questa è la definizione completa di tutte le tabelle
-- necessarie per gestire un torneo di beach volley
-- con gironi, fasi Gold/Silver, classifiche e partite.
-- =====================================================

-- TORNEO
create table if not exists torneo (
    id integer generated always as identity primary key,
    nome text not null,
    creato_il timestamp with time zone not null default now()
);

-- CAMPI (terreno di gioco)
create table if not exists campo (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    unique (torneo_id, nome)
);

-- SQUADRE
create table if not exists squadra (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    orario_pranzo time,
    creato_il timestamp with time zone not null default now(),
    unique (torneo_id, nome)
);

-- GIRONI
create table if not exists girone (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    ordine integer not null default 0,
    unique (torneo_id, nome)
);

-- ASSOCIAZIONE SQUADRE-GIRONI
create table if not exists girone_squadra (
    id integer generated always as identity primary key,
    girone_id integer not null references girone(id) on delete cascade,
    squadra_id integer not null references squadra(id) on delete cascade,
    unique (girone_id, squadra_id)
);

-- FASI DEL TORNEO (Gironi, Gold, Silver)
create table if not exists fase_torneo (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    descrizione text,
    unique (torneo_id, nome)
);

-- PARTITE
create table if not exists partita (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    girone_id integer references girone(id) on delete set null,
    fase_torneo_id integer references fase_torneo(id) on delete set null,
    campo_id integer not null references campo(id),
    numero_partita integer,
    orario_inizio timestamp with time zone not null,
    squadra_1_id integer not null references squadra(id),
    squadra_2_id integer not null references squadra(id),
    squadra_arbitro_id integer references squadra(id),
    stato text not null default 'programmata' check (stato in ('programmata','in_corso','terminata','annullata')),
    note text,
    constraint chk_squadre_diverse check (squadra_1_id <> squadra_2_id),
    constraint chk_arbitro_diverso check (
        squadra_arbitro_id is null
        or (squadra_arbitro_id <> squadra_1_id and squadra_arbitro_id <> squadra_2_id)
    )
);

-- SET DELLE PARTITE
create table if not exists partita_set (
    id integer generated always as identity primary key,
    partita_id integer not null references partita(id) on delete cascade,
    numero_set integer not null,
    punteggio_squadra_1 integer not null default 0,
    punteggio_squadra_2 integer not null default 0,
    unique (partita_id, numero_set)
);

-- CLASSIFICHE
create table if not exists classifica (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    girone_id integer references girone(id) on delete cascade,
    fase_torneo_id integer references fase_torneo(id) on delete cascade,
    squadra_id integer not null references squadra(id) on delete cascade,
    posizione integer,
    partite_giocate integer not null default 0,
    partite_vinte integer not null default 0,
    partite_perse integer not null default 0,
    set_vinti integer not null default 0,
    set_persi integer not null default 0,
    punti_fatti integer not null default 0,
    punti_subiti integer not null default 0,
    punti_classifica integer not null default 0,
    unique (torneo_id, girone_id, fase_torneo_id, squadra_id)
);

-- QUALIFICAZIONI (collegamento tra gironi e fasi finali)
create table if not exists qualificazione_fase (
    id integer generated always as identity primary key,
    fase_torneo_id integer not null references fase_torneo(id) on delete cascade,
    squadra_id integer not null references squadra(id) on delete cascade,
    girone_origine_id integer references girone(id),
    posizione_nel_girone integer,
    testa_di_serie integer,
    unique (fase_torneo_id, squadra_id)
);

-- INSERIMENTO FASI DI BASE (Gironi, Gold, Silver)
-- Nota: sostituire 1 con l'ID del torneo creato manualmente
insert into fase_torneo (torneo_id, nome, descrizione)
values
    (1, 'GIRONI', 'Fase a gironi iniziale'),
    (1, 'GOLD', 'Fase finale gold'),
    (1, 'SILVER', 'Fase finale silver')
on conflict (torneo_id, nome) do nothing;

-- INSERIMENTO CAMPI DI ESEMPIO (tre campi)
insert into campo (torneo_id, nome)
values
    (1, 'Campo 1'),
    (1, 'Campo 2'),
    (1, 'Campo 3')
on conflict (torneo_id, nome) do nothing;