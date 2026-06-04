-- =====================================================
-- 006_fix_set_winner_recalculation.sql
-- Ricalcola sempre il vincitore del set quando cambiano i punteggi.
-- Prima il trigger lo faceva solo se squadra_vincitrice_codice era NULL,
-- quindi modificare un set poteva lasciare il vincitore precedente.
-- =====================================================

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

    return new;
end;
$$;

update partita_set ps
set squadra_vincitrice_codice = case
    when ps.punteggio_squadra_1 > ps.punteggio_squadra_2 then p.squadra_1_codice
    else p.squadra_2_codice
end
from partita p
where p.id = ps.partita_id;

do $$
declare
    v_partita_id integer;
begin
    for v_partita_id in
        select distinct partita_id
        from partita_set
    loop
        perform ricalcola_risultato_partita(v_partita_id);
    end loop;
end $$;
