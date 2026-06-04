-- =====================================================
-- 005_add_slot_tabellone.sql
-- Aggiunge uno slot strutturato per posizionare le partite GOLD/SILVER
-- nel tabellone: QUARTI_1, SEMIFINALE_2, FINALE, ecc.
-- =====================================================

alter table partita
add column if not exists slot_tabellone text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'chk_partita_slot_tabellone_fase'
    ) then
        alter table partita
        add constraint chk_partita_slot_tabellone_fase
        check (
            slot_tabellone is null
            or fase_torneo_codice in ('GOLD', 'SILVER')
        );
    end if;
end $$;

do $$
begin
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
end $$;

create unique index if not exists uq_partita_slot_tabellone
on partita (torneo_id, fase_torneo_codice, slot_tabellone)
where slot_tabellone is not null;

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
    ) as risultato_set,

    p.slot_tabellone

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
    p.stato, p.note, p.slot_tabellone;

grant select on v_partita_risultato to anon, authenticated;
