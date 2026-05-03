export default function Home() {
  return (
    <div className='page home-page'>
      <h1 className='home-page__title'>
        GenreUI: A Dataset for Understanding, Generating, and Evaluating
        Incremental UI Design
      </h1>
      <section className='home-page__description' aria-label='Project description'>
        <p>
          GenreUI is a research project focused on understanding, generating,
          and evaluating incremental UI design, the process of revising and
          improving existing interfaces rather than creating them from scratch.
          While recent models have shown strong performance in 0-to-1 UI
          generation, they struggle with real-world design workflows that
          involve small, iterative changes.
        </p>
        <p>
          This project builds a dataset and evaluation framework grounded in how
          designers and developers actually approach UI revisions. Through user
          studies and structured case studies, we collect high-quality examples
          of UI changes, including suggested revisions, rationale, and
          evaluations of model-generated outputs. These signals are used to
          benchmark and improve systems that aim to assist with practical UI
          iteration tasks.
        </p>
        <p>
          GenreUI is developed as part of a Master's capstone project at UCLA in
          collaboration with the HCI research lab, under the guidance of
          Professor Anthony Chen. The project is currently focused on data
          collection, evaluation design, and early experimentation, with the goal
          of supporting future research in human-centered UI generation and
          design tools.
        </p>
      </section>
      <style>{`
        .home-page {
          padding-top: 0;
          text-align: center;
        }

        .home-page__title {
          max-width: 980px;
          margin: 0 auto;
          font-size: clamp(2rem, 5vw, 4rem);
          font-weight: 700;
          line-height: 1.08;
        }

        .home-page__description {
          max-width: 800px;
          margin: 2rem auto 0;
          color: var(--muted);
          font-size: clamp(1rem, 1.6vw, 1.125rem);
          line-height: 1.75;
          text-align: left;
        }

        .home-page__description p {
          margin: 0 0 1.25rem;
        }

        .home-page__description p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
