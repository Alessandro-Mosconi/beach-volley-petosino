-- =====================================================
-- 010_update_group_standings_rules.sql
-- Regole classifica gironi:
-- - punti classifica = set vinti nei gironi
-- - 1-1 assegna quindi 1 punto a entrambe le squadre
-- - partite giocate conteggiate anche quando non c'e vincitore partita
-- - partite pareggiate = match giocati senza vittoria o sconfitta partita
-- - spareggi: punti, scontro diretto, differenza punti, punti fatti
-- =====================================================

create or replace view v_classifica as
select
    ps.torneo_id,
    ps.girone_codice,
    ps.fase_torneo_codice,
    ps.squadra_codice,
    count(*) filter (where ps.risultato_squadra in ('VINTA', 'PERSA') or ps.set_vinti + ps.set_persi > 0)::integer as partite_giocate,
    coalesce(sum(ps.partita_vinta), 0)::integer as partite_vinte,
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
    end as punti_classifica,
    count(*) filter (
        where ps.set_vinti + ps.set_persi > 0
          and ps.risultato_squadra not in ('VINTA', 'PERSA')
    )::integer as partite_pareggiate
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
        c.partite_perse,
        c.set_vinti,
        c.set_persi,
        c.punti_fatti,
        c.punti_subiti,
        c.differenza_set,
        c.differenza_punti,
        c.punti_classifica,
        c.partite_pareggiate
)
select
    c.torneo_id,
    c.girone_codice,
    c.fase_torneo_codice,
    c.squadra_codice,
    c.partite_giocate,
    c.partite_vinte,
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
    f.nome as fase_nome,
    c.partite_pareggiate
from classifica_con_scontro_diretto c
join squadra s on s.torneo_id = c.torneo_id and s.codice = c.squadra_codice
left join girone g on g.torneo_id = c.torneo_id and g.codice = c.girone_codice
left join fase_torneo f on f.codice = c.fase_torneo_codice;
