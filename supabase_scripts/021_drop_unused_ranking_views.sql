-- =====================================================
-- 021_drop_unused_ranking_views.sql
-- Rimuove viste wrapper non piu usate dal frontend.
--
-- Restano:
-- - v_classifica_ordinata: classifica generale filtrabile per fase/girone;
-- - v_classifica_finale: classifica finale tabelloni.
-- =====================================================

begin;

drop view if exists v_classifica_finale_silver cascade;
drop view if exists v_classifica_finale_gold cascade;
drop view if exists v_classifica_silver cascade;
drop view if exists v_classifica_gold cascade;
drop view if exists v_classifica_girone_d cascade;
drop view if exists v_classifica_girone_c cascade;
drop view if exists v_classifica_girone_b cascade;
drop view if exists v_classifica_girone_a cascade;
drop view if exists v_classifica_gironi cascade;

commit;
