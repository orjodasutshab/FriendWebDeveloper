import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, can, getToken, Row, User } from "./api";
import * as P from "./pages";
import * as Q from "./pages2";

type Item = [string, string, string, (m: User) => boolean];
const any = () => true;
const STAFF: [string, Item[]][] = [
  ["Main", [["dashboard", "📊", "Dashboard", any]]],
  ["Team", [["members", "👥", "Team Members", any], ["recruitment", "📝", "Recruitment", (m) => can(m, "recruitment", "r")], ["notices", "📢", "Notice Board", any]]],
  ["Clients & Projects", [["clients", "🧑‍💼", "Clients", (m) => can(m, "clients", "r")], ["projects", "📁", "Projects", (m) => can(m, "projects", "r")], ["tasks", "✅", "Tasks", (m) => can(m, "tasks", "r")]]],
  ["Finance", [["finance", "💰", "Finance & Invoices", (m) => can(m, "finance", "r")]]],
  ["Communication", [["chat", "💬", "Messages", any], ["tickets", "🎫", "Support Tickets", (m) => can(m, "tickets", "r")], ["inbox", "📧", "Contact Inbox", (m) => can(m, "settings", "r")]]],
  ["Admin", [["reports", "📈", "Reports & Logs", (m) => can(m, "reports", "r")], ["roles", "🔐", "Roles & Permissions", (m) => can(m, "roles", "r")], ["settings", "⚙️", "Website Settings", (m) => can(m, "settings", "r")], ["profile", "🙍", "My Profile", any]]],
];
const CLIENT: [string, Item[]][] = [
  ["", [["overview", "🏠", "Overview", any], ["projects", "📁", "My Projects", any], ["files", "📄", "Files & Documents", any], ["billing", "🧾", "Payments & Invoices", any], ["chat", "💬", "Messages", any], ["tickets", "🎫", "Support Tickets", any], ["profile", "⚙️", "Profile & Settings", any]]],
];

export default function Admin() {
  const [me, setMe] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Row>({ unread: 0, items: [] });
  const [bell, setBell] = useState(false);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => { api<User>("/me").then(setMe).catch(() => {}); }, []);
  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api<User>("/me").then(setMe).catch(() => sessionStorage.removeItem("fwd_token")).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!me) return;
    const poll = () => {
      api<Row>("/notifications").then(setNotes).catch(() => {});
      api<Row>("/unread").then((o) => setUnread(Object.values(o).reduce((a: number, b: any) => a + Number(b), 0))).catch(() => {});
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [me?.id]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{ token: string; user: User }>("/login", "POST", f);
      sessionStorage.setItem("fwd_token", r.token);
      setMe(r.user); setTab("");
    } catch (x: any) { setError(x.message); }
  }
  async function logout() {
    await api("/logout", "POST").catch(() => {});
    sessionStorage.removeItem("fwd_token");
    setMe(null);
  }
  async function openBell() {
    setBell(!bell);
    if (!bell && notes.unread) { await api("/notifications/read", "POST").catch(() => {}); setTimeout(() => setNotes((n) => ({ ...n, unread: 0 })), 1500); }
  }

  if (!ready) return null;
  if (!me) {
    return (
      <div className="login-page">
        <div className="blob b1" /><div className="blob b2" />
        <form className="login-card" onSubmit={login}>
          <div className="logo big">&lt;Friend<span>Web</span>Developer/&gt;</div>
          <h2>Welcome back</h2>
          <p className="sub">Sign in as team member or client.</p>
          <input name="username" placeholder="Email or username" autoComplete="username" required />
          <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
          <button className="btn">Sign in</button>
          {error && <p className="err">{error}</p>}
          <a className="back" href="#/register">New client? Create an account</a>
          <a className="back" href="#top">← Back to website</a>
        </form>
      </div>
    );
  }

  const client = me.role === "client";
  const groups = client ? CLIENT : STAFF;
  const cur = tab || (client ? "overview" : "dashboard");
  const go = (t: string) => { setTab(t); setBell(false); };
  const views: Record<string, JSX.Element> = {
    dashboard: <Q.StaffDashboard me={me} />, overview: <Q.ClientOverview me={me} go={go} />,
    members: <P.Members me={me} />, recruitment: <P.Applications />, notices: <P.Notices me={me} />,
    clients: <Q.Clients me={me} />, projects: <Q.Projects me={me} />, tasks: <Q.Tasks me={me} />, files: <Q.Files />,
    finance: <Q.Finance me={me} />, billing: <Q.Billing />, chat: <Q.Chat me={me} />, tickets: <Q.Tickets me={me} />,
    inbox: <P.Inbox />, reports: <Q.Reports />, roles: <Q.Roles me={me} />, settings: <P.SettingsPage />, profile: <Q.Profile me={me} refresh={refresh} />,
  };
  return (
    <div className="shell">
      <aside className={`side ${client ? "navy" : ""}`}>
        <div className="logo">&lt;Friend<span>Web</span>Developer/&gt;</div>
        <nav className="menu">
          {groups.map(([g, items]) => {
            const vis = items.filter(([, , , ok]) => ok(me));
            return vis.length ? (
              <div key={g}>{g && <h6>{g}</h6>}
                {vis.map(([k, i, l]) => (
                  <button key={k} className={cur === k ? "on" : ""} onClick={() => go(k)}>{i} {l}{k === "chat" && unread > 0 && <span className="dot">{unread}</span>}</button>))}
              </div>
            ) : null;
          })}
        </nav>
        <div className="me"><P.Avatar u={me} size={38} /><div><b>{me.name}</b><small>{client ? "Client" : me.position}</small></div></div>
        <div className="acts"><a className="btn ghost sm" href="#top">Website</a><button className="btn sm" onClick={logout}>Logout</button></div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div><b>{client ? (me.company || "Client Portal") : "Agency Admin"}</b></div>
          <div className="tb-r">
            <div className="bellwrap">
              <button className="bell" onClick={openBell} aria-label="Notifications">🔔{notes.unread > 0 && <span className="dot">{notes.unread}</span>}</button>
              {bell && <div className="drop card">
                <b>Notifications</b>
                {notes.items.map((n: Row) => <p key={n.id} className={n.read ? "" : "unr"}>{n.text}<small>{new Date(n.date).toLocaleString()}</small></p>)}
                {!notes.items.length && <p className="mut">No notifications.</p>}
              </div>}
            </div>
            <button className="who" onClick={() => go("profile")}><P.Avatar u={me} size={34} /><span>{me.name}</span></button>
          </div>
        </header>
        <main className="content">{views[cur]}</main>
      </div>
    </div>
  );
}
