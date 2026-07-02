-- =====================================================
-- 013_populate_psk_tournament.sql
-- Nuovo torneo PSK multi-giorno da PSK-STRUTTURA-DEFINITIVQ.pdf
--
-- Note:
-- - inserisce un nuovo torneo separato dal precedente;
-- - riusa codici naturali per campi, gironi e squadre;
--   la migrazione 012 rende le chiavi composite per torneo;
-- - rende visibile questo torneo: il trigger su torneo nasconde gli altri;
-- - non inserisce partite tabellone con placeholder "1 Girone A",
--   perche' la tabella partita richiede squadre reali gia' note.
-- =====================================================

begin;

insert into fase_torneo (codice, nome, descrizione, ordine) values
    ('GIRONI', 'Gironi', 'Fase iniziale a gironi', 1)
on conflict (codice) do nothing;

do $$
declare
    v_torneo_id integer;
begin
    delete from torneo
    where nome = 'PSK 2026';

    insert into torneo (nome, data_torneo, visibile)
    values ('PSK 2026', '2026-07-02', true)
    returning id into v_torneo_id;

    insert into campo (torneo_id, codice, nome, ordine) values
        (v_torneo_id, 'CAMPO_A', 'Campo A', 1),
        (v_torneo_id, 'CAMPO_B', 'Campo B', 2);

    insert into girone (torneo_id, codice, nome, ordine) values
        (v_torneo_id, 'GIRONE_A', 'A', 1),
        (v_torneo_id, 'GIRONE_B', 'B', 2),
        (v_torneo_id, 'GIRONE_C', 'C', 3),
        (v_torneo_id, 'GIRONE_D', 'D', 4);

    insert into squadra (torneo_id, codice, nome) values
        (v_torneo_id, 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'falsa,strafalsa, falisssima e michele'),
        (v_torneo_id, 'BECCACCINI', 'BECCACCINI'),
        (v_torneo_id, 'QUATER_SALTI', 'quater salti'),
        (v_torneo_id, 'GLI_SPIAGGIATI', 'Gli spiaggiati'),
        (v_torneo_id, 'I_CHEZ', 'I CHEZ'),
        (v_torneo_id, 'SPRITZ_TEAM', 'SPRITZ TEAM'),
        (v_torneo_id, 'FC_EDILIZIA_IMPIANTI', 'fc edilizia&impianti'),
        (v_torneo_id, 'PROCIONI_INFURIATI', 'Procioni infuriati'),
        (v_torneo_id, 'I_PRIVILEGIATI', 'I privilegiati'),
        (v_torneo_id, 'MA_CHE_CI_FACCIAMO_QUI', 'Ma che ci facciamo qui?'),
        (v_torneo_id, 'COLPA_DEL_SOLE', 'COLPA DEL SOLE'),
        (v_torneo_id, 'SCHIACCIATINE', 'SCHIACCIATINE'),
        (v_torneo_id, 'LUMACHE_AGGUERRITE', 'Lumache Agguerrite'),
        (v_torneo_id, 'AL_MASSIMO_DOSSI', 'al massimo....dossi'),
        (v_torneo_id, 'GLI_INSABBIATI', 'Gli insabbiati'),
        (v_torneo_id, 'QUELLI_DELL_ULTIMO_MINUTO', 'Quelli dell''ultimo minuto');

    insert into girone_squadra (torneo_id, girone_codice, squadra_codice) values
        (v_torneo_id, 'GIRONE_A', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE'),
        (v_torneo_id, 'GIRONE_A', 'BECCACCINI'),
        (v_torneo_id, 'GIRONE_A', 'QUATER_SALTI'),
        (v_torneo_id, 'GIRONE_A', 'GLI_SPIAGGIATI'),
        (v_torneo_id, 'GIRONE_B', 'I_CHEZ'),
        (v_torneo_id, 'GIRONE_B', 'SPRITZ_TEAM'),
        (v_torneo_id, 'GIRONE_B', 'FC_EDILIZIA_IMPIANTI'),
        (v_torneo_id, 'GIRONE_B', 'PROCIONI_INFURIATI'),
        (v_torneo_id, 'GIRONE_C', 'I_PRIVILEGIATI'),
        (v_torneo_id, 'GIRONE_C', 'MA_CHE_CI_FACCIAMO_QUI'),
        (v_torneo_id, 'GIRONE_C', 'COLPA_DEL_SOLE'),
        (v_torneo_id, 'GIRONE_C', 'SCHIACCIATINE'),
        (v_torneo_id, 'GIRONE_D', 'LUMACHE_AGGUERRITE'),
        (v_torneo_id, 'GIRONE_D', 'AL_MASSIMO_DOSSI'),
        (v_torneo_id, 'GIRONE_D', 'GLI_INSABBIATI'),
        (v_torneo_id, 'GIRONE_D', 'QUELLI_DELL_ULTIMO_MINUTO');

    insert into partita (
        torneo_id,
        fase_torneo_codice,
        girone_codice,
        campo_codice,
        orario_inizio,
        squadra_1_codice,
        squadra_2_codice,
        squadra_arbitro_codice,
        stato,
        note
    ) values
        -- GIORNO 1 - 02/07
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_A', '2026-07-02 21:00:00+02', 'COLPA_DEL_SOLE', 'MA_CHE_CI_FACCIAMO_QUI', 'AL_MASSIMO_DOSSI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_B', '2026-07-02 21:00:00+02', 'I_CHEZ', 'SPRITZ_TEAM', 'QUELLI_DELL_ULTIMO_MINUTO', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_A', '2026-07-02 22:00:00+02', 'QUATER_SALTI', 'GLI_SPIAGGIATI', 'COLPA_DEL_SOLE', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_B', '2026-07-02 22:00:00+02', 'QUELLI_DELL_ULTIMO_MINUTO', 'LUMACHE_AGGUERRITE', 'I_PRIVILEGIATI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_A', '2026-07-02 23:00:00+02', 'I_PRIVILEGIATI', 'SCHIACCIATINE', 'QUATER_SALTI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_B', '2026-07-02 23:00:00+02', 'AL_MASSIMO_DOSSI', 'LUMACHE_AGGUERRITE', 'I_CHEZ', 'programmata', null),

        -- GIORNO 2 - 03/07
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_A', '2026-07-03 21:00:00+02', 'FC_EDILIZIA_IMPIANTI', 'PROCIONI_INFURIATI', 'MA_CHE_CI_FACCIAMO_QUI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_B', '2026-07-03 21:00:00+02', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'GLI_SPIAGGIATI', 'SCHIACCIATINE', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_A', '2026-07-03 22:00:00+02', 'COLPA_DEL_SOLE', 'I_PRIVILEGIATI', 'I_CHEZ', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_B', '2026-07-03 22:00:00+02', 'SCHIACCIATINE', 'MA_CHE_CI_FACCIAMO_QUI', 'PROCIONI_INFURIATI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_A', '2026-07-03 23:00:00+02', 'FC_EDILIZIA_IMPIANTI', 'I_CHEZ', 'MA_CHE_CI_FACCIAMO_QUI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_B', '2026-07-03 23:00:00+02', 'PROCIONI_INFURIATI', 'SPRITZ_TEAM', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'programmata', null),

        -- GIORNO 3 - 06/07
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_A', '2026-07-06 21:00:00+02', 'LUMACHE_AGGUERRITE', 'GLI_INSABBIATI', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_B', '2026-07-06 21:00:00+02', 'BECCACCINI', 'QUATER_SALTI', 'AL_MASSIMO_DOSSI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_A', '2026-07-06 22:00:00+02', 'QUELLI_DELL_ULTIMO_MINUTO', 'AL_MASSIMO_DOSSI', null, 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_B', '2026-07-06 22:00:00+02', 'BECCACCINI', 'GLI_SPIAGGIATI', 'QUELLI_DELL_ULTIMO_MINUTO', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_A', '2026-07-06 23:00:00+02', 'GLI_INSABBIATI', 'AL_MASSIMO_DOSSI', 'LUMACHE_AGGUERRITE', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_B', '2026-07-06 23:00:00+02', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'QUATER_SALTI', 'I_PRIVILEGIATI', 'programmata', null),

        -- GIORNO 4 - 07/07
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_A', '2026-07-07 21:00:00+02', 'I_PRIVILEGIATI', 'MA_CHE_CI_FACCIAMO_QUI', 'SPRITZ_TEAM', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_D', 'CAMPO_B', '2026-07-07 21:00:00+02', 'QUELLI_DELL_ULTIMO_MINUTO', 'GLI_INSABBIATI', 'COLPA_DEL_SOLE', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_A', '2026-07-07 22:00:00+02', 'FC_EDILIZIA_IMPIANTI', 'SPRITZ_TEAM', 'QUATER_SALTI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_C', 'CAMPO_B', '2026-07-07 22:00:00+02', 'COLPA_DEL_SOLE', 'SCHIACCIATINE', 'I_CHEZ', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_B', 'CAMPO_A', '2026-07-07 23:00:00+02', 'I_CHEZ', 'PROCIONI_INFURIATI', 'MA_CHE_CI_FACCIAMO_QUI', 'programmata', null),
        (v_torneo_id, 'GIRONI', 'GIRONE_A', 'CAMPO_B', '2026-07-07 23:00:00+02', 'FALSA_STRAFALSA_FALISSSIMA_E_MICHELE', 'BECCACCINI', 'GLI_INSABBIATI', 'programmata', null);

    if to_regclass('public.torneo_fase') is not null then
        insert into fase_torneo (codice, nome, descrizione, ordine) values
            ('TORNEO', 'Torneo', 'Tabellone finale', 2)
        on conflict (codice) do update
        set nome = excluded.nome,
            descrizione = excluded.descrizione,
            ordine = excluded.ordine;

        insert into torneo_fase (torneo_id, fase_torneo_codice, ordine) values
            (v_torneo_id, 'GIRONI', 1),
            (v_torneo_id, 'TORNEO', 2)
        on conflict (torneo_id, fase_torneo_codice) do update
        set ordine = excluded.ordine,
            visibile = true;
    end if;

    if to_regclass('public.torneo_regolamento') is not null then
        insert into torneo_regolamento (torneo_id, contenuto)
        values (
            v_torneo_id,
            jsonb_build_object(
                'title', 'Regolamento',
                'sections', jsonb_build_array(
                    jsonb_build_object(
                        'eyebrow', 'Fase iniziale',
                        'title', 'Gironi',
                        'variant', 'primary',
                        'listType', 'ul',
                        'items', jsonb_build_array(
                            'Il torneo prevede una fase iniziale a gironi.',
                            'Le partite dei gironi si giocano nelle serate indicate dal calendario.',
                            'La classifica dei gironi determina l''accesso al tabellone finale.'
                        )
                    ),
                    jsonb_build_object(
                        'eyebrow', 'Tabellone',
                        'title', 'Torneo',
                        'listType', 'ul',
                        'items', jsonb_build_array(
                            'Le squadre qualificate accedono al tabellone a eliminazione diretta.',
                            'Il tabellone prevede quarti, semifinali, finale e finalina 3/4 posto.'
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
                            'Le partite senza squadra arbitro indicata vengono gestite dall''organizzazione.'
                        )
                    )
                )
            )
        )
        on conflict (torneo_id) do update
        set contenuto = excluded.contenuto;
    end if;
end $$;

-- =====================================================
-- Schema tabellone dal PDF, da creare quando le classificate sono note.
--
-- QUARTI - GIORNO 6 (09/07)
-- QUARTI_1: 1 Girone A vs 2 Girone B
-- QUARTI_2: 2 Girone C vs 1 Girone D
-- QUARTI_3: 1 Girone C vs 2 Girone A
-- QUARTI_4: 1 Girone B vs 2 Girone D
--
-- SEMIFINALI - GIORNO 7 (10/07)
-- SEMIFINALE_1: vincente QUARTI_1 vs vincente QUARTI_2
-- SEMIFINALE_2: vincente QUARTI_3 vs vincente QUARTI_4
--
-- FINALE - GIORNO 8 (12/07)
-- FINALINA: perdenti semifinali, ore 20:30
-- FINALE: vincente SEMIFINALE_1 vs vincente SEMIFINALE_2, ore 21:30
-- =====================================================

commit;
