-- =====================================================
-- 007_count_sets_before_match_winner.sql
-- La classifica deve contare set vinti/persi anche quando una partita
-- non ha ancora un vincitore, per esempio dopo un parziale 1-1.
-- Partite vinte/perse e punti classifica restano conteggiati solo quando
-- la partita ha un vincitore/perdente.
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

grant select on v_classifica to anon, authenticated;
