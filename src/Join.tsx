import { FormEvent, useState } from "react";

export default function Join() {
  const [st, setSt] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSt("sending");
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const j = await res.json();
      if (j.ok) { setSt("ok"); form.reset(); } else { setError(j.error); setSt("error"); }
    } catch { setError("Could not reach the server."); setSt("error"); }
  }
  return (
    <section id="join" className="wrap sec">
      <h2>Join our team</h2>
      <p className="sub">Want to work with us? Send your application, we will review it.</p>
      <form className="card fgrid join" onSubmit={submit}>
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="phone" placeholder="Phone" />
        <input name="skills" placeholder="Skills (React, Node.js, UI/UX…)" />
        <input name="cv" placeholder="CV link (Google Drive / Dropbox)" />
        <input name="portfolio" placeholder="Portfolio / GitHub link" />
        <textarea name="message" rows={3} placeholder="Tell us about yourself" />
        <div className="acts"><button className="btn" disabled={st === "sending"}>{st === "sending" ? "Sending…" : "Apply now"}</button></div>
        {st === "ok" && <p className="ok">Thanks! Your application was received.</p>}
        {st === "error" && <p className="err">{error}</p>}
      </form>
    </section>
  );
}
