-- =====================================================
-- 002_seed_base_from_excel_finale_v3.sql
-- Dati base ricavati da calendario_torneo_20_squadre.xlsx
-- Popola torneo, campi, fasi, gironi, squadre e partite programmate. Compatibile con DDL v2. I codici squadra vengono generati automaticamente dal nome.
-- Arbitro NULL = organizzatori.
-- Nessuna classifica manuale: le classifiche sono calcolate dalle view.
-- =====================================================

truncate table partita_set, qualificazione_fase, partita, girone_squadra, squadra, girone, campo, torneo_fase, fase_torneo, torneo_regolamento, torneo restart identity cascade;

insert into torneo (nome, data_torneo, visibile) values ('Torneo Beach Volley Petosino 2026', '2026-06-07', true);

insert into campo (torneo_id, codice, nome, ordine) values
    (1, 'CAMPO_1', 'Campo A', 1),
    (1, 'CAMPO_2', 'Campo B', 2),
    (1, 'CAMPO_3', 'Campo C', 3);

insert into fase_torneo (codice, nome, descrizione, tipo, ordine) values
    ('GIRONI', 'Gironi', 'Fase iniziale a gironi', 'GIRONE', 1),
    ('GOLD', 'Gold', 'Tabellone Gold', 'ELIMINAZIONE_DIRETTA', 2),
    ('SILVER', 'Silver', 'Tabellone Silver', 'ELIMINAZIONE_DIRETTA', 3);

insert into torneo_fase (torneo_id, fase_torneo_codice, ordine) values
    (1, 'GIRONI', 1),
    (1, 'GOLD', 2),
    (1, 'SILVER', 3);

insert into torneo_regolamento (torneo_id, contenuto) values
    (1, '{
      "title": "Regolamento",
      "sections": [
        {
          "eyebrow": "Fase iniziale",
          "title": "Gironi",
          "variant": "primary",
          "listType": "ul",
          "items": [
            "Il torneo prevede 4 gironi da 5 squadre.",
            "Le partite dei gironi si giocano su 2 set al 15.",
            "Non e previsto tie-break nella fase a gironi.",
            "Ogni set vinto vale 1 punto in classifica.",
            "Una partita finita 1-1 assegna quindi 1 punto a entrambe le squadre.",
            "Le prime 2 squadre di ogni girone accedono al tabellone Gold.",
            "La 3a e la 4a squadra di ogni girone accedono al tabellone Silver."
          ]
        },
        {
          "eyebrow": "Classifica",
          "title": "Criteri di ordinamento",
          "listType": "ol",
          "items": [
            "Punti classifica",
            "Scontro diretto tra squadre a pari punti",
            "Differenza punti fatti/subiti"
          ]
        },
        {
          "eyebrow": "Tabellone",
          "title": "Gold",
          "variant": "gold",
          "listType": "ul",
          "items": [
            "Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.",
            "Quarti e semifinali: 2 set al 21 con eventuale tie-break al 15.",
            "Finale e finalina: 2 set al 25 con eventuale tie-break al 15."
          ]
        },
        {
          "eyebrow": "Tabellone",
          "title": "Silver",
          "variant": "silver",
          "listType": "ul",
          "items": [
            "Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.",
            "Quarti e semifinali: 1 set al 21.",
            "Finale: 2 set al 21 con eventuale tie-break al 15.",
            "Finalina: 1 set al 25."
          ]
        },
        {
          "eyebrow": "Orari",
          "title": "Prima della partita",
          "listType": "ul",
          "items": [
            "Presentarsi nella zona dei campi qualche minuto prima dell''orario previsto.",
            "Non iniziare la partita prima dell''orario previsto."
          ]
        },
        {
          "eyebrow": "Arbitraggio",
          "title": "Auto-arbitraggio",
          "listType": "ul",
          "items": [
            "La fase a gironi si svolge in auto-arbitraggio: ogni squadra arbitrera una o due partite di altre squadre.",
            "Prima della partita da arbitrare va ritirato all''INFO POINT il foglio per l''arbitraggio.",
            "Il foglio va riconsegnato all''INFO POINT a partita finita.",
            "Le fasi finali saranno arbitrate dagli organizzatori del torneo."
          ]
        },
        {
          "eyebrow": "Gironi",
          "title": "Regole di arbitraggio",
          "listType": "ul",
          "items": [
            "Fischiare tassativamente invasioni, tetto e linea pestata in battuta.",
            "Fischiare le accompagnate solo se troppo evidenti; in linea di massima lasciare correre dove si puo.",
            "Non fischiare doppie, pallonetti e palleggi in nessuna situazione."
          ]
        },
        {
          "eyebrow": "Servizi",
          "title": "Pranzo e ghiacciolo",
          "listType": "ul",
          "items": [
            "All''orario assegnato per il pranzo, recarsi alla cucina e consegnare il biglietto del pranzo.",
            "La bevanda si ritira alla postazione dedicata consegnando il biglietto della bevanda.",
            "La cucina apre alle 12:00 ed e possibile acquistare piatti extra ordinando al momento.",
            "Ogni squadra avra almeno 45 minuti a disposizione per pranzare.",
            "Il ghiacciolo si ritira al bar in qualsiasi momento consegnando il biglietto del ghiacciolo."
          ]
        },
        {
          "eyebrow": "Servizi",
          "title": "Spogliatoi",
          "listType": "ul",
          "items": [
            "Gli spogliatoi saranno disponibili tutto il giorno.",
            "Per evitare sprechi, fare la doccia solo dopo aver terminato tutte le proprie partite."
          ]
        }
      ]
    }'::jsonb);

insert into girone (torneo_id, codice, nome, ordine) values
    (1, 'GIRONE_A', 'A', 1),
    (1, 'GIRONE_B', 'B', 2),
    (1, 'GIRONE_C', 'C', 3),
    (1, 'GIRONE_D', 'D', 4);

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

insert into girone_squadra (torneo_id, girone_codice, squadra_codice) values
    (1, 'GIRONE_A', 'BEACH_ERINI'),
    (1, 'GIRONE_B', 'VOLTAREN'),
    (1, 'GIRONE_C', 'VOLLEY_UN_DLINK'),
    (1, 'GIRONE_D', 'POPZ'),
    (1, 'GIRONE_A', 'BARBONE'),
    (1, 'GIRONE_B', 'TETTE_BISCOTTATE'),
    (1, 'GIRONE_C', '4_PALLE_6_BOCCE'),
    (1, 'GIRONE_D', 'I_VINTAGE'),
    (1, 'GIRONE_A', 'GLI_IMPROVVISATI'),
    (1, 'GIRONE_B', 'BECCACCINI'),
    (1, 'GIRONE_C', 'PAOLA_S_BABIES'),
    (1, 'GIRONE_D', 'GLI_INSABBIATI'),
    (1, 'GIRONE_A', 'I_CHEZ'),
    (1, 'GIRONE_B', 'UN_NOME_A_CASO'),
    (1, 'GIRONE_C', 'NEW_TEAM'),
    (1, 'GIRONE_D', 'I_LIMONI_SUL_GARDA'),
    (1, 'GIRONE_A', 'ALMENO_CI_ABBIAMO_PROVATO'),
    (1, 'GIRONE_B', 'I_MINI_MISTER'),
    (1, 'GIRONE_C', 'I_QUATER_SALTI_IN_PADELA'),
    (1, 'GIRONE_D', 'COSTRETTI_MA_VOLENTEROSI');

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
