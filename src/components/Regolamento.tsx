const groupRules = [
  'Le partite dei gironi si giocano su 2 set al 15.',
  'Ogni set vinto vale 1 punto in classifica.',
  'Una partita finita 1-1 assegna quindi 1 punto a entrambe le squadre.',
  'Le prime 2 squadre di ogni girone accedono al tabellone Gold.',
  'La 3a e la 4a squadra di ogni girone accedono al tabellone Silver.'
];

const rankingRules = [
  'Punti classifica',
  'Scontro diretto tra squadre a pari punti',
  'Differenza punti fatti/subiti',
  'Punti fatti'
];

const bracketRules = [
  {
    title: 'Gold',
    items: [
      'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
      'Quarti e semifinali: 2 set al 21 con eventuale tie-break al 15.',
      'Finale e finalina: 2 set al 25 con eventuale tie-break al 15.',
      'La classifica finale Gold e determinata da finale e finalina.'
    ]
  },
  {
    title: 'Silver',
    items: [
      'Tabellone a eliminazione diretta con quarti, semifinali, finale e finalina 3/4 posto.',
      'Quarti e semifinali: 1 set al 21.',
      'Finale e finalina: 1 set al 25.',
      'La classifica finale Silver e determinata da finale e finalina.'
    ]
  }
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
    </div>
  );
}
