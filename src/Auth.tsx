import { FormEvent, useEffect, useState } from "react";

export default function Auth({ hash }: { hash: string }) {
  const invite = hash.startsWith("#/invite/") ? hash.slice(9) : "";
  const [info, setInfo] = useState<{ name: string; email: string } | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invite) return;
    fetch("/api/invite/" + invite).then(async (r) => (r.ok ? setInfo(await r.json()) : setError((await r.json()).error))).catch(() => setError("Could not reach the server."));
  }, [invite]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.password !== f.confirm) return setError("Passwords do not match.");
    try {
      const r = await fetch(invite ? "/api/invite/" + invite : "/api/client/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) return setError(j.error);
      setDone(invite ? "Password set! You can now sign in." : "Registration received! You can sign in after the admin approves your account.");
    } catch { setError("Could not reach the server."); }
  }

  return (
    <div className="login-page">
      <div className="blob b1" /><div className="blob b2" />
      <div className="login-card">
        <div className="logo big">&lt;Friend<span>Web</span>Developer/&gt;</div>
        {done ? (<><h2>🎉 Done</h2><p className="ok">{done}</p><a className="btn" href="#/admin">Go to login</a></>) : invite && !info ? (
          <><h2>Invitation</h2>{error ? <p className="err">{error}</p> : <p className="sub">Loading…</p>}<a className="back" href="#top">← Back to website</a></>
        ) : (
          <form onSubmit={submit} className="fcol">
            <h2>{invite ? `Welcome, ${info?.name}` : "Client registration"}</h2>
            <p className="sub">{invite ? `Set a password for ${info?.email}` : "Create your client account to track projects, invoices and messages."}</p>
            {!invite && <><input name="name" placeholder="Full name" required /><input name="email" type="email" placeholder="Email" required /><input name="phone" placeholder="Phone" /><input name="company" placeholder="Company name" /></>}
            <input name="password" type="password" minLength={8} placeholder="Password (min 8 characters)" required autoComplete="new-password" />
            <input name="confirm" type="password" minLength={8} placeholder="Confirm password" required autoComplete="new-password" />
            <button className="btn">{invite ? "Set password" : "Create account"}</button>
            {error && <p className="err">{error}</p>}
            <a className="back" href="#/admin">Already have an account? Sign in</a>
          </form>
        )}
      </div>
    </div>
  );
}
