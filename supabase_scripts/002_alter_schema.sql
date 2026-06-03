-- =====================================================
-- Script di aggiornamento
-- Questa patch aggiorna lo schema esistente per adeguarsi
-- alle modifiche introdotte dal nuovo modello:
--  - rende obbligatorio il riferimento al campo nelle partite
--  - crea la tabella `campo` se non esiste
--  - aggiunge un vincolo di unicità su (torneo_id, nome) per i campi
--  - inserisce tre campi di base se non presenti
-- =====================================================

-- Crea la tabella `campo` se non esiste già
create table if not exists campo (
    id integer generated always as identity primary key,
    torneo_id integer not null references torneo(id) on delete cascade,
    nome text not null,
    unique (torneo_id, nome)
);

-- Assicura che ogni partita abbia un campo associato
alter table partita
    alter column campo_id set not null;

-- Vincolo di unicità sul nome del campo per torneo (aggiunto solo se non esiste)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campo_torneo_nome_key'
  ) then
    alter table campo
      add constraint campo_torneo_nome_key unique (torneo_id, nome);
  end if;
end $$;

-- Inserisce tre campi di esempio per il torneo con id=1 se non esistono
insert into campo (torneo_id, nome)
values
    (1, 'Campo 1'),
    (1, 'Campo 2'),
    (1, 'Campo 3')
on conflict (torneo_id, nome) do nothing;