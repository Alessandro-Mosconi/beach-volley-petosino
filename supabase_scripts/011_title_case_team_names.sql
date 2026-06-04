-- =====================================================
-- 011_title_case_team_names.sql
-- Aggiorna i nomi squadra con iniziale maiuscola per ogni parola.
-- Non modifica i codici squadra.
-- =====================================================

update squadra
set nome = case codice
    when 'BEACH_ERINI' then 'Beach-Erini'
    when 'VOLTAREN' then 'Voltaren'
    when 'VOLLEY_UN_DLINK' then 'Volley Un Dlink'
    when 'POPZ' then 'Popz'
    when 'BARBONE' then 'Barbòne'
    when 'TETTE_BISCOTTATE' then 'Tette Biscottate'
    when 'TETTE_BISCOTTATE_1' then 'Tette Biscottate'
    when '4_PALLE_6_BOCCE' then '4 Palle 6 Bocce'
    when 'I_VINTAGE' then 'I Vintage'
    when 'GLI_IMPROVVISATI' then 'Gli Improvvisati'
    when 'BECCACCINI' then 'Beccaccini'
    when 'PAOLA_S_BABIES' then 'Paola''s Babies'
    when 'GLI_INSABBIATI' then 'Gli Insabbiati'
    when 'I_CHEZ' then 'I Chez'
    when 'UN_NOME_A_CASO' then 'Un Nome A Caso'
    when 'NEW_TEAM' then 'New Team'
    when 'I_LIMONI_SUL_GARDA' then 'I Limoni Sul Garda'
    when 'ALMENO_CI_ABBIAMO_PROVATO' then 'Almeno Ci Abbiamo Provato'
    when 'I_MINI_MISTER' then 'I Mini Mister'
    when 'I_QUATER_SALTI_IN_PADELA' then 'I Quater Salti In Padela'
    when 'COSTRETTI_MA_VOLENTEROSI' then 'Costretti Ma Volenterosi'
    else nome
end
where torneo_id = 1
  and codice in (
    'BEACH_ERINI',
    'VOLTAREN',
    'VOLLEY_UN_DLINK',
    'POPZ',
    'BARBONE',
    'TETTE_BISCOTTATE',
    'TETTE_BISCOTTATE_1',
    '4_PALLE_6_BOCCE',
    'I_VINTAGE',
    'GLI_IMPROVVISATI',
    'BECCACCINI',
    'PAOLA_S_BABIES',
    'GLI_INSABBIATI',
    'I_CHEZ',
    'UN_NOME_A_CASO',
    'NEW_TEAM',
    'I_LIMONI_SUL_GARDA',
    'ALMENO_CI_ABBIAMO_PROVATO',
    'I_MINI_MISTER',
    'I_QUATER_SALTI_IN_PADELA',
    'COSTRETTI_MA_VOLENTEROSI'
  );
