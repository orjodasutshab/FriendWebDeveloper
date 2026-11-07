import { FormEvent, useEffect, useState } from "react";
import { api, useLoad, User, Project, Task, Notice, Application, Contact, Settings } from "./api";

const fd = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, any>; };
const fmt = (d: string) => (d ? new Date(d).toLocaleDateString() : "—");
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const err = (e: any) => alert(e.message ?? "Error");
const STATUS: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

export function Avatar({ u, size = 44 }: { u?: User; size?: number }) {
  const st = { width: size, height: size };
  return u?.photo ? <img className="pic" style={st} src={u.photo} alt={u.name} /> : <div className="pic" style={st}>{u ? ini(u.name) : "?"}</div>;
}

/* ---------------- 1. Dashboard ---------------- */
export function Dashboard({ me }: { me: User }) {
  const [s] = useLoad<any>("/stats", {});
  const [members] = useLoad<User[]>("/members", []);
  const [notices] = useLoad<Notice[]>("/notices", []);
  const cards = [["👥", "Total Members", s.totalMembers], ["🚀", "Active Projects", s.activeProjects], ["🏁", "Completed Projects", s.completedProjects], ["⏳", "Pending Tasks", s.pendingTasks], ["🆕", "New Members (30 days)", s.newMembers]];
  const recent = [...members].sort((a, b) => +new Date(b.joined) - +new Date(a.joined)).slice(0, 5);
  return (
    <>
      <h1 className="ph">Welcome, {me.name} 👋</h1>
      <div className="stat-grid">
        {cards.map(([i, l, n]) => (<div className="card stat" key={l as string}><span>{i}</span><b>{n ?? "–"}</b><small>{l}</small></div>))}
      </div>
      <div className="two">
        <div className="card"><h3>New members</h3>
          {recent.map((m) => (<div className="row" key={m.id}><Avatar u={m} size={36} /><div><b>{m.name}</b><small>{m.position} · joined {fmt(m.joined)}</small></div></div>))}
        </div>
        <div className="card"><h3>Latest notices</h3>
          {notices.slice(0, 4).map((n) => (<div className="row" key={n.id}><div><b>{n.kind === "announcement" ? "📣 " : "📌 "}{n.title}</b><small>{fmt(n.date)}</small></div></div>))}
          {!notices.length && <p className="mut">No notices yet.</p>}
        </div>
      </div>
    </>
  );
}

/* ---------------- 2. Team Members ---------------- */
export function Members({ me }: { me: User }) {
  const admin = me.role === "admin";
  const [list, reload] = useLoad<User[]>("/members", []);
  const [ed, setEd] = useState<Partial<User> | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = fd(e);
    f.skills = String(f.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!f.password) delete f.password;
    try { ed?.id ? await api(`/members/${ed.id}`, "PUT", f) : await api("/members", "POST", f); setEd(null); reload(); } catch (x) { err(x); }
  }
  const patch = (id: string, body: object) => api(`/members/${id}`, "PUT", body).then(reload).catch(err);
  return (
    <>
      <div className="ph-row"><h1 className="ph">Team Members</h1>{admin && <button className="btn sm" onClick={() => setEd({})}>+ Add member</button>}</div>
      {ed && (
        <form key={ed.id ?? "new"} className="card fgrid" onSubmit={submit}>
          <h3>{ed.id ? "Edit profile" : "Add member"}</h3>
          <input name="name" placeholder="Full name" defaultValue={ed.name} required />
          {admin && !ed.id && <input name="username" placeholder="Username" required />}
          <input name="password" type="password" placeholder={ed.id ? "New password (optional)" : "Password"} required={!ed.id} />
          <input name="email" type="email" placeholder="Email" defaultValue={ed.email} />
          <input name="phone" placeholder="Phone" defaultValue={ed.phone} />
          <input name="photo" placeholder="Photo URL" defaultValue={ed.photo} />
          <input name="skills" placeholder="Skills (comma separated)" defaultValue={(ed.skills ?? []).join(", ")} />
          <input name="experience" placeholder="Experience (e.g. 3 years React)" defaultValue={ed.experience} />
          {admin && <>
            <input name="position" placeholder="Position" defaultValue={ed.position} />
            <input name="department" placeholder="Department" defaultValue={ed.department} />
            <select name="role" defaultValue={ed.role ?? "member"}><option value="member">Role: Member</option><option value="admin">Role: Admin</option></select>
            <select name="status" defaultValue={ed.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </>}
          <div className="acts"><button className="btn sm">Save</button><button type="button" className="btn ghost sm" onClick={() => setEd(null)}>Cancel</button></div>
        </form>
      )}
      <div className="grid">
        {list.map((m) => (
          <article className="card mem" key={m.id}>
            <div className="row"><Avatar u={m} size={56} /><div><b>{m.name}</b><small>{m.position} · {m.department}</small></div>
              <span className={`badge ${m.status}`}>{m.status}</span></div>
            <p className="mut">📧 {m.email || "—"}<br />📞 {m.phone || "—"}</p>
            <div className="chips">{m.skills.map((s) => <i key={s}>{s}</i>)}</div>
            <p className="mut">💼 {m.experience || "—"}</p>
            {(admin || m.id === me.id) && <div className="acts">
              <button className="btn ghost sm" onClick={() => setEd(m)}>Edit</button>
              {admin && m.id !== me.id && <>
                <button className="btn ghost sm" onClick={() => patch(m.id, { status: m.status === "active" ? "inactive" : "active" })}>{m.status === "active" ? "Deactivate" : "Activate"}</button>
                <button className="del" onClick={() => confirm(`Delete ${m.name}?`) && api(`/members/${m.id}`, "DELETE").then(reload).catch(err)}>Delete</button>
              </>}
            </div>}
          </article>
        ))}
      </div>
    </>
  );
}

/* ---------------- 3. Applications ---------------- */
export function Applications() {
  const [list, reload] = useLoad<Application[]>("/applications", []);
  async function approve(id: string) {
    try {
      const r = await api<any>(`/applications/${id}/approve`, "POST");
      alert(`Member account created!\n\nUsername: ${r.username}\nPassword: ${r.password}\n\nShare these with the new member.`);
      reload();
    } catch (x) { err(x); }
  }
  return (
    <>
      <h1 className="ph">Join Applications</h1>
      {!list.length && <p className="mut">No applications yet.</p>}
      <div className="stack">
        {list.map((a) => (
          <article className="card" key={a.id}>
            <div className="msg-top"><div><b>{a.name}</b> <span className={`badge ${a.status}`}>{a.status}</span></div><time>{fmt(a.date)}</time></div>
            <p className="mut">📧 {a.email} · 📞 {a.phone || "—"}<br />🛠 {a.skills || "—"}</p>
            <p>{a.message}</p>
            <p>{a.cv && <a className="lnk" href={a.cv} target="_blank" rel="noreferrer">📄 CV</a>} {a.portfolio && <a className="lnk" href={a.portfolio} target="_blank" rel="noreferrer">🌐 Portfolio</a>}</p>
            {a.status === "pending" && <div className="acts"><button className="btn sm" onClick={() => approve(a.id)}>Approve</button><button className="del" onClick={() => api(`/applications/${a.id}/reject`, "POST").then(reload).catch(err)}>Reject</button></div>}
          </article>
        ))}
      </div>
    </>
  );
}

/* ---------------- 4. Projects ---------------- */
function Discussion({ id, members }: { id: string; members: User[] }) {
  const [list, reload] = useLoad<any[]>(`/projects/${id}/comments`, []);
  async function send(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    if (!f.text) return;
    try { await api(`/projects/${id}/comments`, "POST", { text: f.text }); form.reset(); reload(); } catch (x) { err(x); }
  }
  return (
    <div className="disc">
      {list.map((c) => (<p key={c.id}><b>{members.find((m) => m.id === c.userId)?.name ?? "?"}:</b> {c.text} <small>{new Date(c.date).toLocaleString()}</small></p>))}
      <form className="inline" onSubmit={send}><input name="text" placeholder="Write a comment…" /><button className="btn sm">Send</button></form>
    </div>
  );
}

export function Projects({ me }: { me: User }) {
  const admin = me.role === "admin";
  const [projects, reload] = useLoad<Project[]>("/projects", []);
  const [members] = useLoad<User[]>("/members", []);
  const [open, setOpen] = useState("");
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  async function create(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const sel = [...form.querySelectorAll<HTMLInputElement>("input[name=m]:checked")].map((i) => i.value);
    const f = fd(e);
    try { await api("/projects", "POST", { title: f.title, description: f.description, deadline: f.deadline, members: sel }); form.reset(); reload(); } catch (x) { err(x); }
  }
  const upd = (id: string, body: object) => api(`/projects/${id}`, "PUT", body).then(reload).catch(err);
  const Card = (p: Project) => (
    <article className="card" key={p.id}>
      <div className="msg-top"><b>{p.title}</b><span className={`badge ${p.status}`}>{p.status}</span></div>
      <p className="mut">{p.description}</p>
      <p className="mut">📅 Deadline: {fmt(p.deadline)} {p.completedAt && `· ✅ Completed ${fmt(p.completedAt)}`}</p>
      <div className="bar"><div style={{ width: `${p.progress}%` }} /></div><small>{p.progress}% complete</small>
      {admin && p.status === "active" && <input type="range" min={0} max={100} defaultValue={p.progress} onPointerUp={(e) => upd(p.id, { progress: Number(e.currentTarget.value) })} onKeyUp={(e) => upd(p.id, { progress: Number(e.currentTarget.value) })} />}
      <div className="chips">{p.members.map((id) => <i key={id}>👤 {name(id)}</i>)}</div>
      <div className="acts">
        <button className="btn ghost sm" onClick={() => setOpen(open === p.id ? "" : p.id)}>💬 Discussion</button>
        {admin && p.status === "active" && <button className="btn sm" onClick={() => upd(p.id, { status: "completed" })}>Mark complete</button>}
        {admin && <button className="del" onClick={() => confirm("Delete project?") && api(`/projects/${p.id}`, "DELETE").then(reload).catch(err)}>Delete</button>}
      </div>
      {open === p.id && <Discussion id={p.id} members={members} />}
    </article>
  );
  return (
    <>
      <h1 className="ph">Projects</h1>
      {admin && (
        <form className="card fgrid" onSubmit={create}>
          <h3>New project</h3>
          <input name="title" placeholder="Project title" required />
          <input name="deadline" type="date" />
          <textarea name="description" placeholder="Description" rows={2} />
          <div className="chips pick">{members.map((m) => <label key={m.id}><input type="checkbox" name="m" value={m.id} /> {m.name}</label>)}</div>
          <div className="acts"><button className="btn sm">Create &amp; assign</button></div>
        </form>
      )}
      <h3>Active</h3><div className="stack">{projects.filter((p) => p.status === "active").map(Card)}</div>
      <h3>Completed history</h3><div className="stack">{projects.filter((p) => p.status === "completed").map(Card)}</div>
    </>
  );
}

/* ---------------- 5. Tasks ---------------- */
export function Tasks({ me }: { me: User }) {
  const admin = me.role === "admin";
  const [tasks, reload] = useLoad<Task[]>("/tasks", []);
  const [members] = useLoad<User[]>("/members", []);
  const [projects] = useLoad<Project[]>("/projects", []);
  const [filter, setFilter] = useState("");
  async function create(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api("/tasks", "POST", f); form.reset(); reload(); } catch (x) { err(x); }
  }
  const shown = tasks.filter((t) => !filter || t.status === filter);
  return (
    <>
      <h1 className="ph">Tasks</h1>
      {admin && (
        <form className="card fgrid" onSubmit={create}>
          <h3>Assign a task</h3>
          <input name="title" placeholder="Task title" required />
          <select name="assignee" required><option value="">Assign to…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select name="projectId"><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <input name="deadline" type="date" />
          <div className="acts"><button className="btn sm">Assign</button></div>
        </form>
      )}
      <select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="stack">
        {shown.map((t) => {
          const late = t.deadline && t.status !== "completed" && new Date(t.deadline) < new Date();
          return (
            <article className="card task" key={t.id}>
              <div><b>{t.title}</b><small>{members.find((m) => m.id === t.assignee)?.name} · {projects.find((p) => p.id === t.projectId)?.title ?? "No project"}</small>
                <small className={late ? "late" : ""}>📅 {fmt(t.deadline)} {late && "· Overdue"}</small></div>
              <select value={t.status} onChange={(e) => api(`/tasks/${t.id}`, "PUT", { status: e.target.value }).then(reload).catch(err)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {admin && <button className="del" onClick={() => api(`/tasks/${t.id}`, "DELETE").then(reload).catch(err)}>✕</button>}
            </article>
          );
        })}
        {!shown.length && <p className="mut">No tasks.</p>}
      </div>
    </>
  );
}

/* ---------------- 6. Notices + Chat ---------------- */
export function Notices({ me }: { me: User }) {
  const [list, reload] = useLoad<Notice[]>("/notices", []);
  async function post(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api("/notices", "POST", f); form.reset(); reload(); } catch (x) { err(x); }
  }
  return (
    <>
      <h1 className="ph">Notice Board</h1>
      {me.role === "admin" && (
        <form className="card fgrid" onSubmit={post}>
          <input name="title" placeholder="Title" required />
          <select name="kind"><option value="notice">📌 Notice</option><option value="announcement">📣 Announcement</option></select>
          <textarea name="body" placeholder="Details" rows={3} />
          <div className="acts"><button className="btn sm">Post</button></div>
        </form>
      )}
      <div className="stack">
        {list.map((n) => (
          <article className="card" key={n.id}>
            <div className="msg-top"><b>{n.kind === "announcement" ? "📣" : "📌"} {n.title}</b><time>{fmt(n.date)} · {n.author}</time></div>
            <p>{n.body}</p>
            {me.role === "admin" && <button className="del" onClick={() => api(`/notices/${n.id}`, "DELETE").then(reload).catch(err)}>Delete</button>}
          </article>
        ))}
      </div>
    </>
  );
}

export function Chat({ me }: { me: User }) {
  const [members] = useLoad<User[]>("/members", []);
  const [to, setTo] = useState("");
  const [list, setList] = useState<any[]>([]);
  const load = () => { if (to) api<any[]>(`/dm/${to}`).then(setList).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [to]);
  async function send(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    if (!f.text) return;
    try { await api("/dm", "POST", { to, text: f.text }); form.reset(); load(); } catch (x) { err(x); }
  }
  return (
    <>
      <h1 className="ph">Messages</h1>
      <div className="chat">
        <div className="card people">{members.filter((m) => m.id !== me.id).map((m) => (
          <button key={m.id} className={m.id === to ? "on" : ""} onClick={() => setTo(m.id)}><Avatar u={m} size={30} /> {m.name}</button>))}</div>
        <div className="card convo">
          {!to ? <p className="mut">Select a member to start chatting.</p> : (<>
            <div className="bubbles">{list.map((m) => <div key={m.id} className={m.from === me.id ? "b me" : "b"}>{m.text}<small>{new Date(m.date).toLocaleTimeString()}</small></div>)}</div>
            <form className="inline" onSubmit={send}><input name="text" placeholder="Type a message…" autoComplete="off" /><button className="btn sm">Send</button></form>
          </>)}
        </div>
      </div>
    </>
  );
}

/* ---------------- 7. Admin: inbox + settings ---------------- */
export function Inbox() {
  const [list, reload] = useLoad<Contact[]>("/contacts", []);
  return (
    <>
      <h1 className="ph">Contact Inbox</h1>
      {!list.length && <p className="mut">No messages yet.</p>}
      <div className="stack">{list.map((m) => (
        <article className="card" key={m.id}>
          <div className="msg-top"><div><b>{m.name}</b> <a className="lnk" href={`mailto:${m.email}`}>{m.email}</a></div><time>{new Date(m.date).toLocaleString()}</time></div>
          <p>{m.message}</p><button className="del" onClick={() => api(`/contacts/${m.id}`, "DELETE").then(reload).catch(err)}>Delete</button>
        </article>))}</div>
    </>
  );
}

export function SettingsPage() {
  const [s] = useLoad<Settings | null>("/settings", null);
  async function save(e: FormEvent<HTMLFormElement>) {
    try { await api("/settings", "PUT", fd(e)); alert("Saved ✔"); } catch (x) { err(x); }
  }
  if (!s) return null;
  return (
    <>
      <h1 className="ph">Website Settings</h1>
      <form className="card fgrid" onSubmit={save}>
        <input name="siteName" defaultValue={s.siteName} placeholder="Website name" />
        <input name="tagline" defaultValue={s.tagline} placeholder="Tagline" />
        <input name="email" defaultValue={s.email} placeholder="Contact email" />
        <input name="phone" defaultValue={s.phone} placeholder="Phone" />
        <input name="address" defaultValue={s.address} placeholder="Address" />
        <div className="acts"><button className="btn sm">Save settings</button></div>
      </form>
    </>
  );
}
