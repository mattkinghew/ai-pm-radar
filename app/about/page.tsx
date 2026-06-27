import { Header } from "@/components/Header";

const audience = [
  "Non-technical AI PM learners who want structured daily signals.",
  "NGO and education practitioners tracking applied AI developments.",
  "SME decision-makers who need a lightweight business-awareness layer.",
];

const principles = [
  "Static JSON input only in version 1.",
  "No backend and no API keys in the frontend.",
  "Simple scoring and transparent source links.",
  "Mobile-first reading experience.",
];

export default function AboutPage() {
  return (
    <>
      <Header currentPath="/about" />
      <main className="container section stack-xl">
        <section className="about-grid">
          <div className="stack-md">
            <p className="eyebrow">About</p>
            <h1>Why AI PM Radar exists</h1>
            <p>
              AI PM Radar is a static MVP for turning daily AI and business
              research into a readable front-end experience for non-technical
              readers.
            </p>
          </div>

          <div className="info-panel">
            <h2>Version 1 boundaries</h2>
            <p>
              The site is intentionally small: local JSON data, static export, and
              no user accounts, forms, or background jobs.
            </p>
          </div>
        </section>

        <section className="grid-two">
          <article className="info-panel">
            <h2>Primary audience</h2>
            <ul className="bullet-list">
              {audience.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="info-panel">
            <h2>Design and engineering principles</h2>
            <ul className="bullet-list">
              {principles.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </>
  );
}
