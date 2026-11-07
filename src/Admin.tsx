import { FormEvent, useEffect, useState } from "react";
import { api, getToken, User } from "./api";
import * as P from "./pages";

const MENU: [string, string, string, boolean][] = [
  ["dashboard", "📊", "Dashboard", false], ["members", "👥", "Team Members", false],
  ["applications", "📝", "Applications", true], ["projects", "📁", "Projects", false],
  ["tasks", "✅", "Tasks", false], ["notices", "📢", "Notice Board", false],
  ["chat", "💬", "Messages", false], ["inbox", "📧", "Contact Inbox", true], ["settings", "⚙️", "Settings", true],
];

export default function Admin() {
  const [me, setMe] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api<User>("/me").then(setMe).catch(() => sessionStorage.removeItem("fwd_token")).finally(() => setReady(true));
  }, []);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{ token: string; user: User }>("/login", "POST", f);
      sessionStorage.setItem("fwd_token", r.token);
      setMe(r.user);
    } catch (x: any) { setError(x.message); }
  }
  async function logout() {
    await api("/logout", "POST").catch(() => {});
    sessionStorage.removeItem("fwd_token");
    setMe(null);
  }

  if (!ready) return null;
  if (!me) {
    return (
      <div className="login-page">
        <div className="blob b1" /><div className="blob b2" />
        <form className="login-card" onSubmit={login}>
          <div className="logo big">&lt;Friend<span>Web</span>Developer/&gt;</div>
          <h2>Team Login</h2>
          <p className="sub">Sign in to your workspace.</p>
          <input name="username" placeholder="Username" autoComplete="username" required />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
          <button className="btn">Sign in</button>
          {error && <p className="err">{error}</p>}
          <a className="back" href="#top">← Back to website</a>
        </form>
      </div>
    );
  }

  const isAdmin = me.role === "admin";
  const views: Record<string, JSX.Element> = {
    dashboard: <P.Dashboard me={me} />, members: <P.Members me={me} />, applications: <P.Applications />,
    projects: <P.Projects me={me} />, tasks: <P.Tasks me={me} />, notices: <P.Notices me={me} />,
    chat: <P.Chat me={me} />, inbox: <P.Inbox />, settings: <P.SettingsPage />,
  };
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">&lt;Friend<span>Web</span>Developer/&gt;</div>
        <div className="me"><P.Avatar u={me} size={40} /><div><b>{me.name}</b><small>{me.role}</small></div></div>
        <nav className="menu">
          {MENU.filter(([, , , a]) => isAdmin || !a).map(([k, i, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{i} {l}</button>))}
        </nav>
        <a className="btn ghost sm" href="#top">View website</a>
        <button className="btn sm" onClick={logout}>Logout</button>
      </aside>
      <main className="main">{views[tab]}</main>
    </div>
  );
}
