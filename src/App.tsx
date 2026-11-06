import { FormEvent, useEffect, useState } from "react";

const services = [
  { icon: "🎨", title: "UI/UX Design", text: "Modern, clean interfaces that people enjoy using." },
  { icon: "⚛️", title: "React Development", text: "Fast single-page apps built with React and TypeScript." },
  { icon: "🟢", title: "Node.js Backend", text: "Secure APIs and servers with Node.js and Express." },
  { icon: "🛒", title: "E-commerce", text: "Online shops with carts, payments and admin panels." },
  { icon: "📱", title: "Responsive Sites", text: "Perfect on mobile, tablet and desktop." },
  { icon: "🛠️", title: "Maintenance", text: "Updates, bug fixes and ongoing support." },
];

const projects = [
  { name: "ShopBD", tag: "E-commerce", text: "Online store with cart and order tracking." },
  { name: "SchoolPortal", tag: "Web App", text: "Student results and notice management system." },
  { name: "FoodRush", tag: "Landing Page", text: "Restaurant website with online menu." },
];

const team = [
  { name: "Member One", role: "Frontend Developer" },
  { name: "Member Two", role: "Backend Developer" },
  { name: "Member Three", role: "UI/UX Designer" },
  { name: "Member Four", role: "Project Manager" },
];

const stats = [
  { n: "30+", l: "Projects done" },
  { n: "20+", l: "Happy clients" },
  { n: "4", l: "Team members" },
  { n: "24/7", l: "Support" },
];

export default function App() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus("ok");
        form.reset();
      } else {
        setError(json.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setError("Could not reach the server.");
      setStatus("error");
    }
  }

  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a href="#top" className="logo">&lt;Friend<span>Web</span>Developer/&gt;</a>
          <nav>
            <a href="#services">Services</a>
            <a href="#work">Work</a>
            <a href="#team">Team</a>
            <a href="#contact">Contact</a>
            <button className="toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme">
              {dark ? "☀️" : "🌙"}
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <span className="pill">Web Development Team · Bangladesh</span>
            <h1>We turn ideas into <em>beautiful websites</em>.</h1>
            <p>
              Friend Web Developer is a team of friends building fast, modern and
              reliable websites and web apps with React, TypeScript and Node.js.
            </p>
            <div className="cta">
              <a className="btn" href="#contact">Start a project</a>
              <a className="btn ghost" href="#work">See our work</a>
            </div>
          </div>
        </section>

        <section className="wrap stats">
          {stats.map((s) => (
            <div key={s.l}><b>{s.n}</b><span>{s.l}</span></div>
          ))}
        </section>

        <section id="services" className="wrap sec">
          <h2>Our services</h2>
          <p className="sub">Everything you need to get online and grow.</p>
          <div className="grid">
            {services.map((s) => (
              <article className="card" key={s.title}>
                <div className="ic">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="work" className="wrap sec">
          <h2>Recent work</h2>
          <p className="sub">A few things we have built.</p>
          <div className="grid">
            {projects.map((p) => (
              <article className="card proj" key={p.name}>
                <div className="thumb">{p.name[0]}</div>
                <span className="tag">{p.tag}</span>
                <h3>{p.name}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="team" className="wrap sec">
          <h2>Meet the team</h2>
          <p className="sub">Friends who love building for the web.</p>
          <div className="grid four">
            {team.map((m) => (
              <article className="card center" key={m.name}>
                <div className="av">{m.name.split(" ").map((w) => w[0]).join("")}</div>
                <h3>{m.name}</h3>
                <p>{m.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="wrap sec">
          <div className="contact">
            <div>
              <h2>Let’s work together</h2>
              <p className="sub">Tell us about your project and we will reply soon.</p>
              <p>📧 hello@yourteam.com<br />📞 +880 1XXX-XXXXXX<br />📍 Dhaka, Bangladesh</p>
            </div>
            <form onSubmit={submit}>
              <input name="name" placeholder="Your name" required />
              <input name="email" type="email" placeholder="Your email" required />
              <textarea name="message" rows={5} placeholder="Your message" required />
              <button className="btn" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send message"}
              </button>
              {status === "ok" && <p className="ok">Thanks! We got your message.</p>}
              {status === "error" && <p className="err">{error}</p>}
            </form>
          </div>
        </section>
      </main>

      <footer>© {new Date().getFullYear()} Friend Web Developer. All rights reserved.</footer>
    </>
  );
}
