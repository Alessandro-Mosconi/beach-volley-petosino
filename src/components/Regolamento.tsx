const groupRules = [
  'Il torneo prevede 4 gironi da 5 squadre.',
  'Le partite dei gironi si giocano su 2 set al 15.',
  'Non e previsto tie-break nella fase a gironi.',
  'Ogni set vinto vale 1 punto in classifica.',
  'Una partita finita 1-1 assegna quindi 1 punto a entrambe le squadre.',
  'Le prime 2 squadre di ogni girone accedono al tabellone Gold.',
  'La 3a e la 4a squadra di ogni girone accedono al tabellone Silver.'
];

const rankingRules = [
  'Punti classifica',
  'Scontro diretto tra squadre a pari punti',
  'Differenza punti fatti/subiti'
];

const bracketRules = [
  {
    title: 'Gold',
    items: [
      'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
      'Quarti e semifinali: 2 set al 21 con eventuale tie-break al 15.',
      'Finale e finalina: 2 set al 25 con eventuale tie-break al 15.'
    ]
  },
  {
    title: 'Silver',
    items: [
      'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
      'Quarti e semifinali: 1 set al 21.',
      'Finale: 2 set al 21 con eventuale tie-break al 15.',
      'Finalina: 1 set al 25.'
    ]
  }
];

const timingRules = [
  'Presentarsi nella zona dei campi qualche minuto prima dell\'orario previsto.',
  'Non iniziare la partita prima dell\'orario previsto.'
];

const refereeingRules = [
  'La fase a gironi si svolge in auto-arbitraggio: ogni squadra arbitrera una o due partite di altre squadre.',
  'Prima della partita da arbitrare va ritirato all\'INFO POINT il foglio per l\'arbitraggio.',
  'Il foglio va riconsegnato all\'INFO POINT a partita finita.',
  'Le fasi finali saranno arbitrate dagli organizzatori del torneo.'
];

const groupRefereeingRules = [
  'Fischiare tassativamente invasioni, tetto e linea pestata in battuta.',
  'Fischiare le accompagnate solo se troppo evidenti; in linea di massima lasciare correre dove si puo.',
  'Non fischiare doppie, pallonetti e palleggi in nessuna situazione.'
];

const lunchRules = [
  'All\'orario assegnato per il pranzo, recarsi alla cucina e consegnare il biglietto del pranzo.',
  'La bevanda si ritira alla postazione dedicata consegnando il biglietto della bevanda.',
  'La cucina apre alle 12:00 ed e possibile acquistare piatti extra ordinando al momento.',
  'Ogni squadra avra almeno 45 minuti a disposizione per pranzare.',
  'Il ghiacciolo si ritira al bar in qualsiasi momento consegnando il biglietto del ghiacciolo.'
];

const lockerRoomRules = [
  'Gli spogliatoi saranno disponibili tutto il giorno.',
  'Per evitare sprechi, fare la doccia solo dopo aver terminato tutte le proprie partite.'
];

export default function Regolamento() {
  return (
    <div className="rules-view">
      <div className="rules-heading">
        <h2>Regolamento</h2>
      </div>

      <section className="rules-grid">
        <article className="rules-card rules-card-primary">
          <span>Fase iniziale</span>
          <h3>Gironi</h3>
          <ul>
            {groupRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="rules-card">
          <span>Classifica</span>
          <h3>Criteri di ordinamento</h3>
          <ol>
            {rankingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="rules-brackets">
        {bracketRules.map((bracket) => (
          <article key={bracket.title} className={`rules-card rules-card-${bracket.title.toLowerCase()}`}>
            <span>Tabellone</span>
            <h3>{bracket.title}</h3>
            <ul>
              {bracket.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rules-grid">
        <article className="rules-card">
          <span>Orari</span>
          <h3>Prima della partita</h3>
          <ul>
            {timingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="rules-card">
          <span>Arbitraggio</span>
          <h3>Auto-arbitraggio</h3>
          <ul>
            {refereeingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rules-grid">
        <article className="rules-card">
          <span>Gironi</span>
          <h3>Regole di arbitraggio</h3>
          <ul>
            {groupRefereeingRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="rules-card">
          <span>Servizi</span>
          <h3>Pranzo e ghiacciolo</h3>
          <ul>
            {lunchRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rules-grid">
        <article className="rules-card">
          <span>Servizi</span>
          <h3>Spogliatoi</h3>
          <ul>
            {lockerRoomRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
