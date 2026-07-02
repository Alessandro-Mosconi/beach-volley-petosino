-- =====================================================
-- 019_group_qualification_rules.sql
-- Regole badge qualificazione gironi per singolo torneo.
--
-- Il frontend legge torneo_regolamento.contenuto->'groupQualifications'.
-- Esempi:
-- - torneo con GOLD/SILVER: prime 2 Gold, 3a-4a Silver;
-- - torneo con fase unica TORNEO: prime 2 Qualificata.
-- =====================================================

begin;

update torneo_regolamento tr
set contenuto = jsonb_set(
    tr.contenuto,
    '{groupQualifications}',
    jsonb_build_array(
        jsonb_build_object(
            'minPosition', 1,
            'maxPosition', 2,
            'label', 'Gold',
            'variant', 'gold',
            'phaseCode', 'GOLD'
        ),
        jsonb_build_object(
            'minPosition', 3,
            'maxPosition', 4,
            'label', 'Silver',
            'variant', 'silver',
            'phaseCode', 'SILVER'
        )
    ),
    true
)
where exists (
    select 1
    from torneo_fase tf
    where tf.torneo_id = tr.torneo_id
      and tf.codice = 'GOLD'
)
and exists (
    select 1
    from torneo_fase tf
    where tf.torneo_id = tr.torneo_id
      and tf.codice = 'SILVER'
);

update torneo_regolamento tr
set contenuto = jsonb_set(
    tr.contenuto,
    '{groupQualifications}',
    jsonb_build_array(
        jsonb_build_object(
            'minPosition', 1,
            'maxPosition', 2,
            'label', 'Qualificata',
            'variant', 'qualified',
            'phaseCode', 'TORNEO'
        )
    ),
    true
)
where exists (
    select 1
    from torneo_fase tf
    where tf.torneo_id = tr.torneo_id
      and tf.codice = 'TORNEO'
)
and not exists (
    select 1
    from torneo_fase tf
    where tf.torneo_id = tr.torneo_id
      and tf.codice in ('GOLD', 'SILVER')
);

commit;
