import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { DEPARTMENTS } from "./roles";
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
function resize(file: File, max = 320): Promise<string> {
  return new Promise((ok, no) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => no(new Error("This file is not a valid image."));
    img.src = url;
  });
}

const SOCIALS = ["facebook", "linkedin", "github", "twitter"];

function MemberForm({ ed, admin, onDone }: { ed: Partial<User>; admin: boolean; onDone: () => void }) {
  const depts = Object.keys(DEPARTMENTS);
  const [dept, setDept] = useState(ed.department && DEPARTMENTS[ed.department] ? ed.department : depts[0]);
  const [photo, setPhoto] = useState(ed.photo ?? "");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const roles = DEPARTMENTS[dept];
  const opts = ed.position && dept === ed.department && !roles.includes(ed.position) ? [ed.position, ...roles] : roles;

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) try { setPhoto(await resize(f)); } catch (x) { err(x); }
  }
  function gen() {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    setPw([...crypto.getRandomValues(new Uint32Array(12))].map((n) => c[n % c.length]).join(""));
    setShow(true);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = fd(e);
    const body: any = {
      name: f.name, email: f.email, phone: f.phone, photo, experience: f.experience, portfolio: f.portfolio,
      skills: String(f.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      social: Object.fromEntries(SOCIALS.map((s) => [s, f["s_" + s] ?? ""])),
    };
    if (admin) Object.assign(body, { department: dept, position: f.position, joined: f.joined, status: f.status, role: f.access });
    if (pw) body.password = pw;
    try { ed.id ? await api(`/members/${ed.id}`, "PUT", body) : await api("/members", "POST", body); onDone(); } catch (x) { err(x); }
  }

  return (
    <form className="card fgrid" onSubmit={submit}>
      <h3>{ed.id ? "Edit member" : "Add New Member"}</h3>
      <div className="photo-pick">
        {photo ? <img className="pic" style={{ width: 72, height: 72 }} src={photo} alt="" /> : <div className="pic" style={{ width: 72, height: 72 }}>📷</div>}
        <label className="btn ghost sm">Upload photo<input type="file" accept="image/*" hidden onChange={pick} /></label>
        {photo && <button type="button" className="btn ghost sm" onClick={() => setPhoto("")}>Remove</button>}
      </div>
      <input name="name" placeholder="Full Name" defaultValue={ed.name} required />
      <input name="email" type="email" placeholder="Email Address (also the login email)" defaultValue={ed.email} required />
      <input name="phone" placeholder="Phone Number" defaultValue={ed.phone} />
      {admin && <>
        <select value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select>
        <select name="position" key={dept} defaultValue={opts.includes(ed.position ?? "") ? ed.position : opts[0]}>{opts.map((r) => <option key={r}>{r}</option>)}</select>
      </>}
      <input name="skills" placeholder="Skills (comma separated: React, Node.js, Figma)" defaultValue={(ed.skills ?? []).join(", ")} />
      <input name="experience" placeholder="Experience (e.g. 3 years)" defaultValue={ed.experience} />
      <input name="portfolio" placeholder="Portfolio link" defaultValue={ed.portfolio} />
      {SOCIALS.map((s) => <input key={s} name={"s_" + s} placeholder={`${s[0].toUpperCase() + s.slice(1)} link`} defaultValue={ed.social?.[s]} />)}
      {admin && <>
        <label className="lbl">Joining date<input name="joined" type="date" defaultValue={(ed.joined ?? new Date().toISOString()).slice(0, 10)} /></label>
        <label className="lbl">Member status<select name="status" defaultValue={ed.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="lbl">Access level<select name="access" defaultValue={ed.role ?? "member"}><option value="member">Member (limited)</option><option value="admin">Admin (full access)</option></select></label>
      </>}
      <div className="pwrow">
        <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="new-password"
          placeholder={ed.id ? "New password (leave empty to keep)" : "Login password (min 8 characters)"} required={!ed.id} />
        <button type="button" className="btn ghost sm" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
        <button type="button" className="btn ghost sm" onClick={gen}>Generate</button>
      </div>
      <p className="mut">🔒 Passwords are stored encrypted (hashed) and can’t be viewed later. Share the password with the member privately.</p>
      <div className="acts"><button className="btn sm">{ed.id ? "Save changes" : "Add member"}</button><button type="button" className="btn ghost sm" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

export function Members({ me }: { me: User }) {
  const admin = me.role === "admin";
  const [list, reload] = useLoad<User[]>("/members", []);
  const [ed, setEd] = useState<Partial<User> | null>(null);
  const [dep, setDep] = useState("");
  const [q, setQ] = useState("");
  const shown = list.filter((m) => (!dep || m.department === dep) && `${m.name} ${m.position} ${m.skills.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const patch = (id: string, body: object) => api(`/members/${id}`, "PUT", body).then(reload).catch(err);
  return (
    <>
      <div className="ph-row"><h1 className="ph">Team Members</h1>{admin && <button className="btn sm" onClick={() => setEd({})}>+ Add New Member</button>}</div>
      {ed && <MemberForm key={ed.id ?? "new"} ed={ed} admin={admin} onDone={() => { setEd(null); reload(); }} />}
      <div className="tabs">
        <button className={!dep ? "on" : ""} onClick={() => setDep("")}>All ({list.length})</button>
        {Object.keys(DEPARTMENTS).map((d) => <button key={d} className={dep === d ? "on" : ""} onClick={() => setDep(d)}>{d} ({list.filter((m) => m.department === d).length})</button>)}
      </div>
      <input className="search" placeholder="Search name, role or skill…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid">
        {shown.map((m) => (
          <article className="card mem" key={m.id}>
            <div className="row"><Avatar u={m} size={56} /><div><b>{m.name}</b><small>{m.position}</small><small>{m.department}</small></div>
              <span className={`badge ${m.status}`}>{m.status}</span></div>
            <p className="mut">📧 {m.email || "—"}<br />📞 {m.phone || "—"}<br />📅 Joined {fmt(m.joined)}</p>
            <div className="chips">{m.skills.map((s) => <i key={s}>{s}</i>)}</div>
            <p className="mut">💼 {m.experience || "—"}</p>
            <p>
              {m.portfolio && <a className="lnk" href={m.portfolio} target="_blank" rel="noreferrer">🌐 Portfolio</a>}
              {SOCIALS.filter((s) => m.social?.[s]).map((s) => <a key={s} className="lnk" href={m.social[s]} target="_blank" rel="noreferrer">{s}</a>)}
            </p>
            {(admin || m.id === me.id) && <div className="acts">
              <button className="btn ghost sm" onClick={() => setEd(m)}>Edit</button>
              {admin && m.id !== me.id && <>
                <button className="btn ghost sm" onClick={() => patch(m.id, { status: m.status === "active" ? "inactive" : "active" })}>{m.status === "active" ? "Deactivate" : "Activate"}</button>
                <button className="del" onClick={() => confirm(`Delete ${m.name}?`) && api(`/members/${m.id}`, "DELETE").then(reload).catch(err)}>Delete</button>
              </>}
            </div>}
          </article>
        ))}
        {!shown.length && <p className="mut">No members found.</p>}
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
