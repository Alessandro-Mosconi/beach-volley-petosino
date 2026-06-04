-- =====================================================
-- 002_seed_base_from_excel_finale_v3.sql
-- Dati base ricavati da calendario_torneo_20_squadre.xlsx
-- Popola torneo, campi, fasi, gironi, squadre e partite programmate. Compatibile con DDL v2. I codici squadra vengono generati automaticamente dal nome.
-- Arbitro NULL = organizzatori.
-- Nessuna classifica manuale: le classifiche sono calcolate dalle view.
-- =====================================================

truncate table partita_set, qualificazione_fase, partita, girone_squadra, squadra, girone, campo, fase_torneo, torneo restart identity cascade;

insert into torneo (nome, data_torneo, visibile) values ('Torneo Beach Volley Petosino 2026', '2026-06-07', true);

insert into campo (codice, torneo_id, nome, ordine) values
    ('CAMPO_1', 1, 'Campo A', 1),
    ('CAMPO_2', 1, 'Campo B', 2),
    ('CAMPO_3', 1, 'Campo C', 3);

insert into fase_torneo (codice, nome, descrizione, ordine) values
    ('GIRONI', 'Gironi', 'Fase iniziale a gironi', 1),
    ('GOLD', 'Gold', 'Tabellone Gold', 2),
    ('SILVER', 'Silver', 'Tabellone Silver', 3);

insert into girone (codice, torneo_id, nome, ordine) values
    ('GIRONE_A', 1, 'A', 1),
    ('GIRONE_B', 1, 'B', 2),
    ('GIRONE_C', 1, 'C', 3),
    ('GIRONE_D', 1, 'D', 4);

insert into squadra (torneo_id, nome, orario_pranzo) values
    (1, 'Beach-Erini', '12:45:00'),
    (1, 'Voltaren', '12:45:00'),
    (1, 'Volley Un Dlink', '12:00:00'),
    (1, 'Popz', '13:10:00'),
    (1, 'Barbòne', '12:20:00'),
    (1, 'Tette Biscottate', '12:45:00'),
    (1, '4 Palle 6 Bocce', '12:00:00'),
    (1, 'I Vintage', '13:10:00'),
    (1, 'Gli Improvvisati', '12:45:00'),
    (1, 'Beccaccini', '12:45:00'),
    (1, 'Paola''s Babies', '12:20:00'),
    (1, 'Gli Insabbiati', '13:10:00'),
    (1, 'I Chez', '12:20:00'),
    (1, 'Un Nome A Caso', '12:45:00'),
    (1, 'New Team', '13:10:00'),
    (1, 'I Limoni Sul Garda', '12:20:00'),
    (1, 'Almeno Ci Abbiamo Provato', '12:20:00'),
    (1, 'I Mini Mister', '12:00:00'),
    (1, 'I Quater Salti In Padela', '13:10:00'),
    (1, 'Costretti Ma Volenterosi', '12:00:00');

insert into girone_squadra (girone_codice, squadra_codice) values
    ('GIRONE_A', 'BEACH_ERINI'),
    ('GIRONE_B', 'VOLTAREN'),
    ('GIRONE_C', 'VOLLEY_UN_DLINK'),
    ('GIRONE_D', 'POPZ'),
    ('GIRONE_A', 'BARBONE'),
    ('GIRONE_B', 'TETTE_BISCOTTATE'),
    ('GIRONE_C', '4_PALLE_6_BOCCE'),
    ('GIRONE_D', 'I_VINTAGE'),
    ('GIRONE_A', 'GLI_IMPROVVISATI'),
    ('GIRONE_B', 'BECCACCINI'),
    ('GIRONE_C', 'PAOLA_S_BABIES'),
    ('GIRONE_D', 'GLI_INSABBIATI'),
    ('GIRONE_A', 'I_CHEZ'),
    ('GIRONE_B', 'UN_NOME_A_CASO'),
    ('GIRONE_C', 'NEW_TEAM'),
    ('GIRONE_D', 'I_LIMONI_SUL_GARDA'),
    ('GIRONE_A', 'ALMENO_CI_ABBIAMO_PROVATO'),
    ('GIRONE_B', 'I_MINI_MISTER'),
    ('GIRONE_C', 'I_QUATER_SALTI_IN_PADELA'),
    ('GIRONE_D', 'COSTRETTI_MA_VOLENTEROSI');

insert into partita (torneo_id, fase_torneo_codice, girone_codice, campo_codice, orario_inizio, squadra_1_codice, squadra_2_codice, squadra_arbitro_codice, stato, note) values
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_1', '2026-06-07 09:00:00+02', 'BARBONE', 'ALMENO_CI_ABBIAMO_PROVATO', 'BECCACCINI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_2', '2026-06-07 09:00:00+02', 'GLI_IMPROVVISATI', 'I_CHEZ', 'I_QUATER_SALTI_IN_PADELA', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_3', '2026-06-07 09:00:00+02', 'TETTE_BISCOTTATE', 'I_MINI_MISTER', 'NEW_TEAM', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_1', '2026-06-07 09:25:00+02', 'BECCACCINI', 'UN_NOME_A_CASO', 'COSTRETTI_MA_VOLENTEROSI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_2', '2026-06-07 09:25:00+02', '4_PALLE_6_BOCCE', 'I_QUATER_SALTI_IN_PADELA', 'GLI_INSABBIATI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_3', '2026-06-07 09:25:00+02', 'PAOLA_S_BABIES', 'NEW_TEAM', 'BEACH_ERINI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_1', '2026-06-07 09:50:00+02', 'I_VINTAGE', 'COSTRETTI_MA_VOLENTEROSI', 'GLI_IMPROVVISATI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_2', '2026-06-07 09:50:00+02', 'GLI_INSABBIATI', 'I_LIMONI_SUL_GARDA', 'I_MINI_MISTER', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_3', '2026-06-07 09:50:00+02', 'BEACH_ERINI', 'ALMENO_CI_ABBIAMO_PROVATO', 'VOLTAREN', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_1', '2026-06-07 10:15:00+02', 'BARBONE', 'GLI_IMPROVVISATI', 'VOLLEY_UN_DLINK', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_2', '2026-06-07 10:15:00+02', 'VOLTAREN', 'I_MINI_MISTER', 'PAOLA_S_BABIES', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_3', '2026-06-07 10:15:00+02', 'TETTE_BISCOTTATE', 'BECCACCINI', 'POPZ', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_1', '2026-06-07 10:40:00+02', 'VOLLEY_UN_DLINK', 'I_QUATER_SALTI_IN_PADELA', 'I_LIMONI_SUL_GARDA', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_2', '2026-06-07 10:40:00+02', 'BEACH_ERINI', 'I_CHEZ', '4_PALLE_6_BOCCE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_3', '2026-06-07 10:40:00+02', 'POPZ', 'COSTRETTI_MA_VOLENTEROSI', 'UN_NOME_A_CASO', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_1', '2026-06-07 11:05:00+02', 'I_VINTAGE', 'GLI_INSABBIATI', 'VOLTAREN', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_2', '2026-06-07 11:05:00+02', '4_PALLE_6_BOCCE', 'PAOLA_S_BABIES', 'BECCACCINI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_3', '2026-06-07 11:05:00+02', 'ALMENO_CI_ABBIAMO_PROVATO', 'GLI_IMPROVVISATI', 'TETTE_BISCOTTATE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_1', '2026-06-07 11:30:00+02', 'VOLTAREN', 'UN_NOME_A_CASO', 'I_CHEZ', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_2', '2026-06-07 11:30:00+02', 'I_MINI_MISTER', 'BECCACCINI', 'I_LIMONI_SUL_GARDA', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_3', '2026-06-07 11:30:00+02', 'VOLLEY_UN_DLINK', 'NEW_TEAM', 'BARBONE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_1', '2026-06-07 11:55:00+02', 'I_QUATER_SALTI_IN_PADELA', 'PAOLA_S_BABIES', 'ALMENO_CI_ABBIAMO_PROVATO', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_2', '2026-06-07 11:55:00+02', 'POPZ', 'I_LIMONI_SUL_GARDA', 'BEACH_ERINI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_3', '2026-06-07 11:55:00+02', 'I_CHEZ', 'BARBONE', 'GLI_INSABBIATI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_1', '2026-06-07 12:20:00+02', 'VOLTAREN', 'BECCACCINI', null, 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_2', '2026-06-07 12:20:00+02', 'BEACH_ERINI', 'GLI_IMPROVVISATI', 'NEW_TEAM', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_3', '2026-06-07 12:20:00+02', 'UN_NOME_A_CASO', 'TETTE_BISCOTTATE', 'I_VINTAGE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_1', '2026-06-07 12:45:00+02', 'COSTRETTI_MA_VOLENTEROSI', 'GLI_INSABBIATI', null, 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_2', '2026-06-07 12:45:00+02', 'NEW_TEAM', 'I_QUATER_SALTI_IN_PADELA', null, 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_3', '2026-06-07 12:45:00+02', 'POPZ', 'I_VINTAGE', null, 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_1', '2026-06-07 13:10:00+02', 'VOLLEY_UN_DLINK', '4_PALLE_6_BOCCE', 'BARBONE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_2', '2026-06-07 13:10:00+02', 'I_CHEZ', 'ALMENO_CI_ABBIAMO_PROVATO', 'I_MINI_MISTER', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_1', '2026-06-07 13:35:00+02', 'UN_NOME_A_CASO', 'I_MINI_MISTER', 'PAOLA_S_BABIES', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_A', 'CAMPO_2', '2026-06-07 13:35:00+02', 'BEACH_ERINI', 'BARBONE', 'GLI_IMPROVVISATI', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_3', '2026-06-07 13:35:00+02', 'I_LIMONI_SUL_GARDA', 'COSTRETTI_MA_VOLENTEROSI', 'TETTE_BISCOTTATE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_1', '2026-06-07 14:00:00+02', 'VOLLEY_UN_DLINK', 'PAOLA_S_BABIES', 'I_VINTAGE', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_C', 'CAMPO_2', '2026-06-07 14:00:00+02', 'NEW_TEAM', '4_PALLE_6_BOCCE', 'POPZ', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_B', 'CAMPO_3', '2026-06-07 14:00:00+02', 'VOLTAREN', 'TETTE_BISCOTTATE', 'I_CHEZ', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_1', '2026-06-07 14:25:00+02', 'I_LIMONI_SUL_GARDA', 'I_VINTAGE', 'UN_NOME_A_CASO', 'programmata', null),
    (1, 'GIRONI', 'GIRONE_D', 'CAMPO_2', '2026-06-07 14:25:00+02', 'POPZ', 'GLI_INSABBIATI', 'I_QUATER_SALTI_IN_PADELA', 'programmata', null);
