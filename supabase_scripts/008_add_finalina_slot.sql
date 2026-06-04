-- =====================================================
-- 008_add_finalina_slot.sql
-- Abilita lo slot FINALINA per la finale 3/4 posto nei tabelloni
-- GOLD e SILVER.
-- =====================================================

alter table partita
drop constraint if exists chk_partita_slot_tabellone_valido;

alter table partita
add constraint chk_partita_slot_tabellone_valido
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
);
