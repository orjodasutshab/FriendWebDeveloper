import { ChangeEvent, FormEvent, Fragment, useEffect, useState } from "react";
import { api, can, useLoad, User, Row } from "./api";
import { Avatar, fd, fmt, err, resize } from "./pages";
import { CATEGORIES, MODULES, MODULE_LABEL, ROLE_LABEL, STAFF_ROLES } from "./roles";

const money = (n: number) => "৳" + Number(n || 0).toLocaleString();
const slug = (v: string) => String(v).toLowerCase().replace(/\W+/g, "_");
export const Pill = ({ v }: { v: string }) => <span className={`pill s-${slug(v)}`}>{String(v).replace(/_/g, " ")}</span>;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const PSTATUS = ["pending", "in_progress", "review", "completed", "on_hold"];
const PRIOS = ["Low", "Medium", "High", "Urgent"];
const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function printDoc(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to download the PDF.");
  w.document.write(`<html><head><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;padding:40px;max-width:720px;margin:auto;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.r{text-align:right}.big{font-size:1.4rem;font-weight:700}</style></head><body>${html}<p style="color:#777;margin-top:40px">Use “Save as PDF” in the print window.</p><script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
function printInvoice(i: Row, site: string) {
  printDoc(i.number, `<h1>${esc(site)}</h1><p>INVOICE <b>${esc(i.number)}</b><br>Date: ${fmt(i.issued)} · Due: ${fmt(i.dueDate)}</p><p><b>Bill to:</b> ${esc(i.clientName)}<br>Project: ${esc(i.projectTitle || "—")}</p><table><tr><th>Description</th><th class="r">Amount</th></tr><tr><td>${esc(i.note || i.projectTitle || "Services")}</td><td class="r">${money(i.amount)}</td></tr><tr><td class="r">Paid</td><td class="r">${money(i.paid)}</td></tr><tr><td class="r"><b>Due</b></td><td class="r big">${money(i.due)}</td></tr></table><p>Status: <b>${esc(i.status)}</b></p>`);
}
function printReceipt(p: Row, site: string) {
  printDoc("Receipt", `<h1>${esc(site)}</h1><p>PAYMENT RECEIPT</p><table><tr><td>Invoice</td><td>${esc(p.invoiceNumber)}</td></tr><tr><td>Client</td><td>${esc(p.clientName)}</td></tr><tr><td>Method</td><td>${esc(p.method)} ${esc(p.txn)}</td></tr><tr><td>Date</td><td>${fmt(p.date)}</td></tr><tr><td>Status</td><td>${esc(p.status)}</td></tr><tr><td><b>Amount</b></td><td class="big">${money(p.amount)}</td></tr></table>`);
}
function exportCsv(name: string, rows: Row[]) {
  if (!rows.length) return alert("Nothing to export.");
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = name + ".csv"; a.click();
}

function Bars({ data }: { data: Row[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.month} className="bcol"><div className="bpair">
          <i className="inc" style={{ height: `${(d.income / max) * 100}%` }} title={money(d.income)} />
          <i className="exp" style={{ height: `${(d.expense / max) * 100}%` }} title={money(d.expense)} />
        </div><small>{d.month.slice(5)}</small></div>
      ))}
      <div className="legend"><span><i className="inc" /> Income</span><span><i className="exp" /> Expense</span></div>
    </div>
  );
}
const Stat = ({ i, l, n }: { i: string; l: string; n: any }) => <div className="card stat"><span>{i}</span><b>{n ?? "–"}</b><small>{l}</small></div>;

/* ============ Dashboards ============ */
export function StaffDashboard({ me }: { me: User }) {
  const [s] = useLoad<Row>("/stats", {});
  const cards: [string, string, any][] = [["👥", "Total Members", s.totalMembers], ["🧑‍💼", "Total Clients", s.totalClients], ["📁", "Total Projects", s.totalProjects], ["🚀", "Active Projects", s.activeProjects], ["🏁", "Completed Projects", s.completedProjects], ["⏳", "Pending Tasks", s.pendingTasks]];
  if (s.revenue !== undefined) cards.push(["💰", "Total Revenue", money(s.revenue)], ["🧾", "Pending Payments", money(s.pendingPayments)]);
  if (s.pendingApplications !== undefined) cards.push(["📝", "Pending Applications", s.pendingApplications]);
  if (s.pendingTickets !== undefined) cards.push(["🎫", "Pending Tickets", s.pendingTickets]);
  if (s.pendingClients) cards.push(["🕒", "Clients awaiting approval", s.pendingClients]);
  return (
    <>
      <h1 className="ph">Welcome back, {me.name} 👋</h1>
      <div className="stat-grid">{cards.map(([i, l, n]) => <Stat key={l} i={i} l={l} n={n} />)}</div>
      <div className="two">
        {s.monthly && <div className="card"><h3>Revenue vs expense (6 months)</h3><Bars data={s.monthly} /></div>}
        {s.recent && <div className="card"><h3>Recent activities</h3>{s.recent.map((a: Row, k: number) => <div className="row" key={k}><div><b>{a.text}</b><small>{a.who} · {new Date(a.date).toLocaleString()}</small></div></div>)}{!s.recent.length && <p className="mut">Nothing yet.</p>}</div>}
      </div>
    </>
  );
}

export function ClientOverview({ me, go }: { me: User; go: (t: string) => void }) {
  const [s] = useLoad<Row>("/portal", { projects: [], upcoming: [] });
  return (
    <>
      <h1 className="ph">Hello, {me.name} 👋</h1>
      <div className="stat-grid">
        <Stat i="📁" l="Total Projects" n={s.total} /><Stat i="🚀" l="Active Projects" n={s.active} />
        <Stat i="🏁" l="Completed Projects" n={s.completed} /><Stat i="💳" l="Pending Payments" n={money(s.pendingPayments)} />
      </div>
      <h3>Active projects</h3>
      <div className="grid">
        {s.projects.map((p: Row) => (
          <article className="card proj" key={p.id}>
            <b>{p.title}</b><small className="mut">Due: {fmt(p.deadline)}</small>
            <div className="bar"><div style={{ width: `${p.progress}%` }} /></div>
            <div className="msg-top"><small>{p.progress}%</small><Pill v={p.status} /></div>
            <button className="btn ghost sm" onClick={() => go("projects")}>View Details</button>
          </article>
        ))}
        {!s.projects.length && <p className="mut">No active projects yet.</p>}
      </div>
      <h3>Upcoming deadlines</h3>
      <div className="card">{s.upcoming.map((p: Row) => <div className="row" key={p.id}><div><b>{p.title}</b><small>Deadline {fmt(p.deadline)} · Manager {p.managerName || "—"}</small></div></div>)}{!s.upcoming.length && <p className="mut">No upcoming deadlines.</p>}</div>
    </>
  );
}

/* ============ Projects (staff + client) ============ */
function Discussion({ id }: { id: string }) {
  const [list, reload] = useLoad<Row[]>(`/projects/${id}/comments`, []);
  async function send(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    if (!f.text) return;
    try { await api(`/projects/${id}/comments`, "POST", { text: f.text }); form.reset(); reload(); } catch (x) { err(x); }
  }
  return (
    <div className="disc"><b>Team discussion</b>
      {list.map((c) => <p key={c.id}><b>{c.name}:</b> {c.text} <small>{new Date(c.date).toLocaleString()}</small></p>)}
      <form className="inline" onSubmit={send}><input name="text" placeholder="Write a comment…" /><button className="btn sm">Send</button></form>
    </div>
  );
}

function ProjectDetail({ p, me, reload, files, reloadFiles }: { p: Row; me: User; reload: () => void; files: Row[]; reloadFiles: () => void }) {
  const client = me.role === "client", edit = can(me, "projects", "u");
  const upd = (body: object) => api(`/projects/${p.id}`, "PUT", body).then(reload).catch(err);
  async function addMs(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    await upd({ milestones: [...p.milestones, { id: uid(), title: f.title, due: f.due, done: false }] }); form.reset();
  }
  async function revise(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api(`/projects/${p.id}/revision`, "POST", { text: f.text }); form.reset(); reload(); } catch (x) { err(x); }
  }
  async function addFile(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api(`/projects/${p.id}/files`, "POST", { name: f.name, url: f.url, type: f.type, visible: f.visible === "on" }); form.reset(); reloadFiles(); } catch (x) { err(x); }
  }
  return (
    <div className="detail">
      <div className="dgrid">
        <div><small>Client</small><b>{p.clientName || "—"}</b></div><div><small>Project Manager</small><b>{p.managerName || "—"}</b></div>
        <div><small>Category</small><b>{p.category}</b></div><div><small>Budget</small><b>{money(p.budget)}</b></div>
        <div><small>Start date</small><b>{fmt(p.startDate)}</b></div><div><small>Deadline</small><b>{fmt(p.deadline)}</b></div>
        <div><small>Team</small><b>{p.memberNames.join(", ") || "—"}</b></div><div><small>Priority</small><Pill v={p.priority} /></div>
      </div>
      {p.description && <p className="mut">{p.description}</p>}
      {edit && <div className="acts">
        <select value={p.status} onChange={(e) => upd({ status: e.target.value })}>{PSTATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <select value={p.priority} onChange={(e) => upd({ priority: e.target.value })}>{PRIOS.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn ghost sm" onClick={() => upd({ archived: !p.archived })}>{p.archived ? "Unarchive" : "Archive"}</button>
        {can(me, "projects", "d") && <button className="del" onClick={() => confirm("Delete this project?") && api(`/projects/${p.id}`, "DELETE").then(reload).catch(err)}>Delete</button>}
      </div>}
      {edit && <label className="lbl">Progress {p.progress}%<input type="range" min={0} max={100} defaultValue={p.progress} onPointerUp={(e) => upd({ progress: Number(e.currentTarget.value) })} onKeyUp={(e) => upd({ progress: Number(e.currentTarget.value) })} /></label>}
      {client && p.status === "review" && <div className="callout"><b>Your approval is needed.</b> Review the delivered work, then approve or request a revision.<div className="acts"><button className="btn sm" onClick={() => confirm("Approve this project as completed?") && api(`/projects/${p.id}/approve`, "POST").then(reload).catch(err)}>✔ Approve project</button></div></div>}

      <h4>Milestones</h4>
      {p.milestones.map((m: Row) => (
        <label className="ms" key={m.id}><input type="checkbox" checked={m.done} disabled={!edit} onChange={() => upd({ milestones: p.milestones.map((x: Row) => (x.id === m.id ? { ...x, done: !x.done } : x)) })} /> {m.title} <small>{m.due && `· ${fmt(m.due)}`}</small></label>
      ))}
      {!p.milestones.length && <p className="mut">No milestones.</p>}
      {edit && <form className="inline" onSubmit={addMs}><input name="title" placeholder="New milestone" required /><input name="due" type="date" /><button className="btn ghost sm">Add</button></form>}

      <h4>Revision requests</h4>
      {p.revisions.map((r: Row) => <p key={r.id} className="rev"><Pill v={r.status} /> {r.text} <small>{fmt(r.date)}</small>{edit && r.status === "open" && <button className="btn ghost sm" onClick={() => upd({ revisions: p.revisions.map((x: Row) => (x.id === r.id ? { ...x, status: "resolved" } : x)) })}>Mark resolved</button>}</p>)}
      {!p.revisions.length && <p className="mut">None.</p>}
      {client && <form className="inline" onSubmit={revise}><input name="text" placeholder="Describe the change you need…" required /><button className="btn ghost sm">Request revision</button></form>}

      <h4>Files &amp; documents</h4>
      {files.map((f) => <div className="row" key={f.id}><div><a className="lnk" href={f.url} target="_blank" rel="noreferrer">📎 {f.name}</a><small>{f.type} · {fmt(f.date)} · {f.by}</small></div>{edit && <button className="del" onClick={() => api(`/files/${f.id}`, "DELETE").then(reloadFiles).catch(err)}>✕</button>}</div>)}
      {!files.length && <p className="mut">No files shared yet.</p>}
      {edit && <form className="fgrid" onSubmit={addFile}><input name="name" placeholder="File name" required /><input name="url" placeholder="Link (Google Drive, Dropbox…)" required /><select name="type"><option>Project Document</option><option>Design File</option><option>Website Screenshot</option><option>Source Code</option><option>Project Report</option><option>Contract</option></select><label className="ms"><input type="checkbox" name="visible" defaultChecked /> Visible to client</label><div className="acts"><button className="btn ghost sm">Add file</button></div></form>}
      {!client && <Discussion id={p.id} />}
    </div>
  );
}

export function Projects({ me }: { me: User }) {
  const client = me.role === "client", create = can(me, "projects", "c"), edit = can(me, "projects", "u");
  const [list, reload] = useLoad<Row[]>("/projects", []);
  const [files, reloadFiles] = useLoad<Row[]>("/files", []);
  const [staff] = useLoad<User[]>("/members", []);
  const [clients] = useLoad<Row[]>("/clients", []);
  const [open, setOpen] = useState("");
  const [flt, setFlt] = useState("");
  const [arch, setArch] = useState(false);
  async function add(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const members = [...form.querySelectorAll<HTMLInputElement>("input[name=m]:checked")].map((i) => i.value);
    const f = fd(e);
    try { await api("/projects", "POST", { ...f, members }); form.reset(); reload(); } catch (x) { err(x); }
  }
  const shown = list.filter((p) => (arch ? true : !p.archived) && (!flt || p.status === flt));
  return (
    <>
      <h1 className="ph">{client ? "My Projects" : "Projects"}</h1>
      {create && (
        <form className="card fgrid" onSubmit={add}>
          <h3>Create new project</h3>
          <input name="title" placeholder="Project title" required />
          <select name="clientId"><option value="">Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}</select>
          <select name="managerId"><option value="">Project manager…</option>{staff.map((m) => <option key={m.id} value={m.id}>{m.name} — {ROLE_LABEL[m.role]}</option>)}</select>
          <select name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select name="priority" defaultValue="Medium">{PRIOS.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="budget" type="number" min={0} placeholder="Budget (৳)" />
          <label className="lbl">Start date<input name="startDate" type="date" /></label>
          <label className="lbl">Deadline<input name="deadline" type="date" /></label>
          <textarea name="description" rows={2} placeholder="Description" />
          <div className="chips pick">{staff.map((m) => <label key={m.id}><input type="checkbox" name="m" value={m.id} /> {m.name}</label>)}</div>
          <div className="acts"><button className="btn sm">Create project</button></div>
        </form>
      )}
      <div className="toolbar">
        <select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">All statuses</option>{PSTATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        {edit && <label className="ms"><input type="checkbox" checked={arch} onChange={(e) => setArch(e.target.checked)} /> Show archived</label>}
      </div>
      <div className="tablewrap"><table className="tbl">
        <thead><tr><th>Project</th>{!client && <th>Client</th>}<th>Manager</th><th>Status</th><th>Priority</th><th>Deadline</th><th>Progress</th></tr></thead>
        <tbody>{shown.map((p) => (<Fragment key={p.id}>
          <tr key={p.id} className="click" onClick={() => setOpen(open === p.id ? "" : p.id)}>
            <td><b>{p.title}</b>{p.archived && " 🗄"}</td>{!client && <td>{p.clientName || "—"}</td>}<td>{p.managerName || "—"}</td>
            <td><Pill v={p.status} /></td><td><Pill v={p.priority} /></td><td>{fmt(p.deadline)}</td>
            <td><div className="bar"><div style={{ width: `${p.progress}%` }} /></div><small>{p.progress}%</small></td>
          </tr>
          {open === p.id && <tr key={p.id + "d"}><td colSpan={7}><ProjectDetail p={p} me={me} reload={reload} files={files.filter((f) => f.projectId === p.id)} reloadFiles={reloadFiles} /></td></tr>}
        </Fragment>))}</tbody>
      </table>{!shown.length && <p className="mut pad">No projects.</p>}</div>
    </>
  );
}

export function Files() {
  const [files] = useLoad<Row[]>("/files", []);
  return (
    <>
      <h1 className="ph">Files &amp; Documents</h1>
      <div className="tablewrap"><table className="tbl"><thead><tr><th>File name</th><th>Type</th><th>Project</th><th>Uploaded by</th><th>Date</th><th /></tr></thead>
        <tbody>{files.map((f) => <tr key={f.id}><td>📎 {f.name}</td><td>{f.type}</td><td>{f.projectTitle}</td><td>{f.by}</td><td>{fmt(f.date)}</td><td><a className="btn ghost sm" href={f.url} target="_blank" rel="noreferrer">Download</a></td></tr>)}</tbody>
      </table>{!files.length && <p className="mut pad">No files shared with you yet.</p>}</div>
    </>
  );
}

/* ============ Tasks (Kanban) ============ */
const COLS: [string, string][] = [["todo", "To Do"], ["in_progress", "In Progress"], ["review", "Review"], ["completed", "Completed"]];
export function Tasks({ me }: { me: User }) {
  const [tasks, reload] = useLoad<Row[]>("/tasks", []);
  const [staff] = useLoad<User[]>("/members", []);
  const [projects] = useLoad<Row[]>("/projects", []);
  async function add(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api("/tasks", "POST", f); form.reset(); reload(); } catch (x) { err(x); }
  }
  const set = (id: string, status: string) => api(`/tasks/${id}`, "PUT", { status }).then(reload).catch(err);
  return (
    <>
      <h1 className="ph">Tasks</h1>
      {can(me, "tasks", "c") && (
        <form className="card fgrid" onSubmit={add}>
          <h3>Assign a task</h3>
          <input name="title" placeholder="Task title" required />
          <select name="assignee" required><option value="">Assign to…</option>{staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select name="projectId"><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <select name="priority" defaultValue="Medium">{PRIOS.map((c) => <option key={c}>{c}</option>)}</select>
          <input name="deadline" type="date" />
          <textarea name="description" rows={2} placeholder="Description" />
          <div className="acts"><button className="btn sm">Assign</button></div>
        </form>
      )}
      <div className="kanban">
        {COLS.map(([k, l]) => (
          <div className="col" key={k}>
            <h4>{l} <span>{tasks.filter((t) => t.status === k).length}</span></h4>
            {tasks.filter((t) => t.status === k).map((t) => {
              const late = t.deadline && t.status !== "completed" && new Date(t.deadline) < new Date();
              return (
                <article className="card kt" key={t.id}>
                  <b>{t.title}</b>{t.description && <p className="mut">{t.description}</p>}
                  <small>{t.projectTitle || "No project"}</small>
                  <div className="msg-top"><small>👤 {t.assigneeName}</small><Pill v={t.priority} /></div>
                  <small className={late ? "late" : ""}>📅 {fmt(t.deadline)}{late && " · Overdue"}</small>
                  <select value={t.status} onChange={(e) => set(t.id, e.target.value)}>{COLS.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
                  {can(me, "tasks", "d") && <button className="del" onClick={() => api(`/tasks/${t.id}`, "DELETE").then(reload).catch(err)}>Delete</button>}
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/* ============ Messages ============ */
export function Chat({ me }: { me: User }) {
  const [users] = useLoad<Row[]>("/chat/users", []);
  const [unread, reloadUnread] = useLoad<Row>("/unread", {});
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const load = () => { if (to) api<Row[]>(`/dm/${to}`).then((r) => { setList(r); reloadUnread(); }).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(() => { load(); reloadUnread(); }, 4000); return () => clearInterval(t); }, [to]);
  async function send(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    if (!f.text) return;
    try { await api("/dm", "POST", { to, text: f.text }); form.reset(); load(); } catch (x) { err(x); }
  }
  const who = users.find((u) => u.id === to);
  return (
    <>
      <h1 className="ph">Messages</h1>
      <div className="chat2">
        <div className="card cl">
          <input placeholder="Search contact…" value={q} onChange={(e) => setQ(e.target.value)} />
          {users.filter((u) => u.name.toLowerCase().includes(q.toLowerCase())).map((u) => (
            <button key={u.id} className={u.id === to ? "on" : ""} onClick={() => setTo(u.id)}>
              <Avatar u={u as any} size={38} /><div><b>{u.name}</b><small>{ROLE_LABEL[u.role] ?? u.role}</small></div>
              {unread[u.id] > 0 && <span className="dot">{unread[u.id]}</span>}
            </button>
          ))}
        </div>
        <div className="card cv">
          {!who ? <p className="mut">Select someone to start chatting.</p> : (<>
            <div className="cvh"><Avatar u={who as any} size={40} /><div><b>{who.name}</b><small>{ROLE_LABEL[who.role] ?? who.role}</small></div></div>
            <div className="bubbles">{list.map((m) => <div key={m.id} className={m.from === me.id ? "b me" : "b"}>{m.text}<small>{new Date(m.date).toLocaleTimeString()} {m.from === me.id && (m.read ? "✓✓" : "✓")}</small></div>)}</div>
            <form className="inline" onSubmit={send}><input name="text" placeholder="Write your message…" autoComplete="off" maxLength={2000} /><button className="btn sm">Send</button></form>
          </>)}
        </div>
      </div>
    </>
  );
}

/* ============ Clients (staff) ============ */
export function Clients({ me }: { me: User }) {
  const [list, reload] = useLoad<Row[]>("/clients", []);
  const [staff] = useLoad<User[]>("/members", []);
  const [projects] = useLoad<Row[]>("/projects", []);
  const [invoices] = useLoad<Row[]>("/invoices", []);
  const [form, setForm] = useState<Row | null>(null);
  const [invite, setInvite] = useState("");
  const [open, setOpen] = useState("");
  const link = (p: string) => window.location.origin + p;
  async function save(e: FormEvent<HTMLFormElement>) {
    const f = fd(e);
    try {
      if (form?.id) await api(`/clients/${form.id}`, "PUT", f);
      else { const r = await api<Row>("/clients", "POST", f); setInvite(link(r.invite)); }
      setForm(null); reload();
    } catch (x) { err(x); }
  }
  const act = (id: string, path: string, method = "POST", body?: object) => api<Row>(`/clients/${id}${path}`, method, body).then((r) => { if (r.invite) setInvite(link(r.invite)); reload(); }).catch(err);
  return (
    <>
      <div className="ph-row"><h1 className="ph">Clients</h1>{can(me, "clients", "c") && <button className="btn sm" onClick={() => setForm({})}>+ Add client</button>}</div>
      {invite && <div className="callout"><b>Invitation link</b> (send this to the client so they can set their own password):<br /><input readOnly value={invite} onFocus={(e) => e.target.select()} /><div className="acts"><button className="btn ghost sm" onClick={() => navigator.clipboard.writeText(invite)}>Copy</button><button className="btn ghost sm" onClick={() => setInvite("")}>Close</button></div></div>}
      {form && (
        <form key={form.id ?? "new"} className="card fgrid" onSubmit={save}>
          <h3>{form.id ? "Edit client" : "Add client"}</h3>
          <input name="name" placeholder="Name" defaultValue={form.name} required />
          {!form.id && <input name="email" type="email" placeholder="Email" required />}
          <input name="phone" placeholder="Phone" defaultValue={form.phone} />
          <input name="company" placeholder="Company name" defaultValue={form.company} />
          <input name="address" placeholder="Company address" defaultValue={form.address} />
          <select name="managerId" defaultValue={form.managerId ?? ""}><option value="">Assign project manager…</option>{staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <div className="acts"><button className="btn sm">Save</button><button type="button" className="btn ghost sm" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <div className="tablewrap"><table className="tbl">
        <thead><tr><th>Client</th><th>Company</th><th>Manager</th><th>Projects</th><th>Due</th><th>Status</th><th /></tr></thead>
        <tbody>{list.map((c) => (<Fragment key={c.id}>
          <tr key={c.id}><td className="click" onClick={() => setOpen(open === c.id ? "" : c.id)}><div className="row"><Avatar u={c as any} size={34} /><div><b>{c.name}</b><small>{c.email}</small></div></div></td>
            <td>{c.company || "—"}</td><td>{c.managerName || "—"}</td><td>{c.projects}</td><td>{money(c.due)}</td><td><Pill v={c.status} /></td>
            <td className="acts">
              {c.status === "pending" && can(me, "clients", "a") && <><button className="btn sm" onClick={() => act(c.id, "/approve")}>Approve</button><button className="del" onClick={() => act(c.id, "/reject")}>Reject</button></>}
              {can(me, "clients", "u") && c.status !== "pending" && <>
                <button className="btn ghost sm" onClick={() => setForm(c)}>Edit</button>
                <button className="btn ghost sm" onClick={() => act(c.id, "", "PUT", { status: c.status === "blocked" ? "active" : "blocked" })}>{c.status === "blocked" ? "Unblock" : "Block"}</button>
                <button className="btn ghost sm" onClick={() => confirm("Reset password and create a new invitation link?") && act(c.id, "/reset")}>Reset password</button></>}
              {can(me, "clients", "d") && <button className="del" onClick={() => confirm(`Delete ${c.name}?`) && act(c.id, "", "DELETE")}>Delete</button>}
            </td></tr>
          {open === c.id && <tr key={c.id + "d"}><td colSpan={7}><div className="detail two">
            <div><h4>Projects</h4>{projects.filter((p) => p.clientId === c.id).map((p) => <div className="row" key={p.id}><div><b>{p.title}</b><small>{p.progress}%</small></div><Pill v={p.status} /></div>)}</div>
            <div><h4>Payments</h4>{invoices.filter((i) => i.clientId === c.id).map((i) => <div className="row" key={i.id}><div><b>{i.number}</b><small>{money(i.amount)} · paid {money(i.paid)}</small></div><Pill v={i.status} /></div>)}</div>
          </div></td></tr>}
        </Fragment>))}</tbody>
      </table>{!list.length && <p className="mut pad">No clients yet.</p>}</div>
    </>
  );
}

/* ============ Finance ============ */
export function Finance({ me }: { me: User }) {
  const [tab, setTab] = useState("overview");
  const [sum, r1] = useLoad<Row>("/finance/summary", { monthly: [] });
  const [invoices, r2] = useLoad<Row[]>("/invoices", []);
  const [payments, r3] = useLoad<Row[]>("/payments", []);
  const [expenses, r4] = useLoad<Row[]>("/expenses", []);
  const [clients] = useLoad<Row[]>("/clients", []);
  const [projects] = useLoad<Row[]>("/projects", []);
  const [site] = useLoad<Row>("/settings", { siteName: "" });
  const [cid, setCid] = useState("");
  const refresh = () => { r1(); r2(); r3(); r4(); };
  const run = (p: Promise<any>) => p.then(refresh).catch(err);
  async function post(path: string, e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api(path, "POST", f); form.reset(); refresh(); } catch (x) { err(x); }
  }
  const TABS = [["overview", "Overview"], ["invoices", "Invoices"], ["payments", "Payments"], ["expenses", "Expenses & Salary"]];
  return (
    <>
      <h1 className="ph">Finance &amp; Invoices</h1>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "overview" && <>
        <div className="stat-grid"><Stat i="💰" l="Total income" n={money(sum.income)} /><Stat i="📉" l="Total expense" n={money(sum.expense)} /><Stat i="📈" l="Profit / Loss" n={money(sum.profit)} /><Stat i="🧾" l="Due payments" n={money(sum.due)} /></div>
        <div className="card"><h3>Monthly revenue &amp; expense</h3><Bars data={sum.monthly ?? []} /></div>
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Month</th><th>Income</th><th>Expense</th><th>Profit / Loss</th></tr></thead>
          <tbody>{(sum.monthly ?? []).map((m: Row) => <tr key={m.month}><td>{m.month}</td><td>{money(m.income)}</td><td>{money(m.expense)}</td><td className={m.income - m.expense < 0 ? "late" : ""}>{money(m.income - m.expense)}</td></tr>)}</tbody></table></div>
      </>}
      {tab === "invoices" && <>
        {can(me, "finance", "c") && <form className="card fgrid" onSubmit={(e) => post("/invoices", e)}>
          <h3>Create invoice</h3>
          <select name="clientId" required onChange={(e) => setCid(e.target.value)}><option value="">Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select name="projectId"><option value="">Project (optional)</option>{projects.filter((p) => !cid || p.clientId === cid).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <input name="amount" type="number" min={1} placeholder="Amount (৳)" required />
          <label className="lbl">Due date<input name="dueDate" type="date" /></label>
          <input name="note" placeholder="Description / note" />
          <div className="acts"><button className="btn sm">Create invoice</button></div>
        </form>}
        <div className="acts"><button className="btn ghost sm" onClick={() => exportCsv("invoices", invoices)}>⬇ Export Excel (CSV)</button></div>
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th><th /></tr></thead>
          <tbody>{invoices.map((i) => <tr key={i.id}><td><b>{i.number}</b></td><td>{i.clientName}</td><td>{i.projectTitle || "—"}</td><td>{money(i.amount)}</td><td>{money(i.paid)}</td><td>{money(i.due)}</td><td><Pill v={i.status} /></td>
            <td className="acts"><button className="btn ghost sm" onClick={() => printInvoice(i, site.siteName)}>PDF</button>{can(me, "finance", "d") && <button className="del" onClick={() => confirm("Delete invoice?") && run(api(`/invoices/${i.id}`, "DELETE"))}>✕</button>}</td></tr>)}</tbody></table>
          {!invoices.length && <p className="mut pad">No invoices.</p>}</div>
      </>}
      {tab === "payments" && <>
        {can(me, "finance", "c") && <form className="card fgrid" onSubmit={(e) => post("/payments", e)}>
          <h3>Record a payment</h3>
          <select name="invoiceId" required><option value="">Invoice…</option>{invoices.filter((i) => i.due > 0).map((i) => <option key={i.id} value={i.id}>{i.number} — {i.clientName} (due {money(i.due)})</option>)}</select>
          <input name="amount" type="number" min={1} placeholder="Amount (৳)" required />
          <select name="method"><option>Cash</option><option>Bank Transfer</option><option>bKash</option><option>Nagad</option><option>Card</option></select>
          <input name="txn" placeholder="Transaction ID" />
          <div className="acts"><button className="btn sm">Save (marked verified)</button></div>
        </form>}
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Method</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>{payments.map((p) => <tr key={p.id}><td>{fmt(p.date)}</td><td>{p.invoiceNumber}</td><td>{p.clientName}</td><td>{p.method}<small> {p.txn}</small></td><td>{money(p.amount)}</td><td><Pill v={p.status === "pending" ? "pending_verification" : p.status} /></td>
            <td className="acts">{can(me, "finance", "a") && p.status === "pending" && <><button className="btn sm" onClick={() => run(api(`/payments/${p.id}/verify`, "POST"))}>Verify</button><button className="del" onClick={() => run(api(`/payments/${p.id}/reject`, "POST"))}>Reject</button></>}
              {can(me, "finance", "a") && p.status === "verified" && <button className="btn ghost sm" onClick={() => confirm("Refund this payment?") && run(api(`/payments/${p.id}/refund`, "POST"))}>Refund</button>}</td></tr>)}</tbody></table>
          {!payments.length && <p className="mut pad">No payments.</p>}</div>
      </>}
      {tab === "expenses" && <>
        {can(me, "finance", "c") && <form className="card fgrid" onSubmit={(e) => post("/expenses", e)}>
          <h3>Add expense</h3>
          <input name="title" placeholder="Title (e.g. May salary – Rahim)" required />
          <select name="category"><option>Salary</option><option>Software / Tools</option><option>Hosting</option><option>Marketing</option><option>Office</option><option>Other</option></select>
          <input name="amount" type="number" min={1} placeholder="Amount (৳)" required />
          <input name="date" type="date" />
          <div className="acts"><button className="btn sm">Add</button></div>
        </form>}
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th /></tr></thead>
          <tbody>{expenses.map((x) => <tr key={x.id}><td>{fmt(x.date)}</td><td>{x.title}</td><td>{x.category}</td><td>{money(x.amount)}</td><td>{can(me, "finance", "d") && <button className="del" onClick={() => run(api(`/expenses/${x.id}`, "DELETE"))}>✕</button>}</td></tr>)}</tbody></table>
          {!expenses.length && <p className="mut pad">No expenses.</p>}</div>
      </>}
    </>
  );
}

export function Billing() {
  const [invoices, r1] = useLoad<Row[]>("/invoices", []);
  const [payments, r2] = useLoad<Row[]>("/payments", []);
  const [site] = useLoad<Row>("/settings", { siteName: "" });
  const [pay, setPay] = useState<Row | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    const f = fd(e);
    try { await api("/payments", "POST", { ...f, invoiceId: pay!.id }); setPay(null); r1(); r2(); } catch (x) { err(x); }
  }
  const total = invoices.reduce((s, i) => s + i.amount, 0), paid = invoices.reduce((s, i) => s + i.paid, 0);
  return (
    <>
      <h1 className="ph">Payments &amp; Invoices</h1>
      <div className="stat-grid"><Stat i="📦" l="Total project cost" n={money(total)} /><Stat i="✅" l="Paid amount" n={money(paid)} /><Stat i="⏳" l="Due amount" n={money(total - paid)} /></div>
      {pay && <form className="card fgrid" onSubmit={submit}>
        <h3>Pay {pay.number} (due {money(pay.due)})</h3>
        <input name="amount" type="number" min={1} max={pay.due} defaultValue={pay.due} required />
        <select name="method"><option>bKash</option><option>Nagad</option><option>Bank Transfer</option><option>Card</option></select>
        <input name="txn" placeholder="Transaction ID / reference" required />
        <p className="mut">Send the money using your chosen method, then enter the transaction ID. We will verify it and update the invoice. (Automatic online gateway can be connected later.)</p>
        <div className="acts"><button className="btn sm">Submit payment</button><button type="button" className="btn ghost sm" onClick={() => setPay(null)}>Cancel</button></div>
      </form>}
      <div className="tablewrap"><table className="tbl"><thead><tr><th>Invoice</th><th>Project</th><th>Amount</th><th>Paid</th><th>Due</th><th>Due date</th><th>Status</th><th /></tr></thead>
        <tbody>{invoices.map((i) => <tr key={i.id}><td><b>{i.number}</b></td><td>{i.projectTitle || "—"}</td><td>{money(i.amount)}</td><td>{money(i.paid)}</td><td>{money(i.due)}</td><td>{fmt(i.dueDate)}</td><td><Pill v={i.status} /></td>
          <td className="acts"><button className="btn ghost sm" onClick={() => printInvoice(i, site.siteName)}>Download PDF</button>{i.due > 0 && <button className="btn sm" onClick={() => setPay(i)}>Pay</button>}</td></tr>)}</tbody></table>
        {!invoices.length && <p className="mut pad">No invoices yet.</p>}</div>
      <h3>Payment history</h3>
      <div className="tablewrap"><table className="tbl"><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Amount</th><th>Status</th><th /></tr></thead>
        <tbody>{payments.map((p) => <tr key={p.id}><td>{fmt(p.date)}</td><td>{p.invoiceNumber}</td><td>{p.method}<small> {p.txn}</small></td><td>{money(p.amount)}</td><td><Pill v={p.status === "pending" ? "pending_verification" : p.status} /></td>
          <td>{p.status === "verified" && <button className="btn ghost sm" onClick={() => printReceipt(p, site.siteName)}>Receipt</button>}</td></tr>)}</tbody></table>
        {!payments.length && <p className="mut pad">No payments yet.</p>}</div>
    </>
  );
}

/* ============ Support tickets ============ */
export function Tickets({ me }: { me: User }) {
  const client = me.role === "client", edit = can(me, "tickets", "u");
  const [list, reload] = useLoad<Row[]>("/tickets", []);
  const [shot, setShot] = useState("");
  const [open, setOpen] = useState("");
  const [flt, setFlt] = useState("");
  async function pick(e: ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) try { setShot(await resize(f, 800)); } catch (x) { err(x); } }
  async function create(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api("/tickets", "POST", { ...f, screenshot: shot }); form.reset(); setShot(""); reload(); } catch (x) { err(x); }
  }
  async function reply(id: string, e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api(`/tickets/${id}/reply`, "POST", { text: f.text }); form.reset(); reload(); } catch (x) { err(x); }
  }
  const setSt = (id: string, status: string) => api(`/tickets/${id}`, "PUT", { status }).then(reload).catch(err);
  return (
    <>
      <h1 className="ph">Support Tickets</h1>
      {client && <form className="card fgrid" onSubmit={create}>
        <h3>Create new ticket</h3>
        <input name="subject" placeholder="Subject" required />
        <select name="category"><option>Technical Issue</option><option>Billing</option><option>Project Question</option><option>Change Request</option><option>Other</option></select>
        <select name="priority" defaultValue="Medium">{PRIOS.map((p) => <option key={p}>{p}</option>)}</select>
        <textarea name="description" rows={3} placeholder="Describe the problem" required />
        <div className="photo-pick"><label className="btn ghost sm">📷 Attach screenshot<input type="file" accept="image/*" hidden onChange={pick} /></label>{shot && <img src={shot} alt="" className="thumb2" />}</div>
        <div className="acts"><button className="btn sm">Submit ticket</button></div>
      </form>}
      <div className="toolbar"><select value={flt} onChange={(e) => setFlt(e.target.value)}><option value="">All statuses</option>{["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
      <div className="stack">
        {list.filter((t) => !flt || t.status === flt).map((t) => (
          <article className="card" key={t.id}>
            <div className="msg-top click" onClick={() => setOpen(open === t.id ? "" : t.id)}><div><b>{t.subject}</b><small>{!client && `${t.clientName} · `}{t.category} · {fmt(t.created)}</small></div><div className="acts"><Pill v={t.priority} /><Pill v={t.status} /></div></div>
            {open === t.id && <div className="detail">
              <p>{t.description}</p>{t.screenshot && <img className="shot" src={t.screenshot} alt="screenshot" />}
              {t.replies.map((r: Row) => <p key={r.id} className={r.staff ? "rp staff" : "rp"}><b>{r.name}{r.staff ? " (Support)" : ""}:</b> {r.text} <small>{new Date(r.date).toLocaleString()}</small></p>)}
              {t.status !== "closed" && (client || edit) && <form className="inline" onSubmit={(e) => reply(t.id, e)}><input name="text" placeholder="Write a reply…" required /><button className="btn sm">Reply</button></form>}
              <div className="acts">
                {edit && <select value={t.status} onChange={(e) => setSt(t.id, e.target.value)}>{["open", "in_progress", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>}
                {client && t.status !== "closed" && <button className="btn ghost sm" onClick={() => setSt(t.id, "closed")}>Close ticket</button>}
              </div>
            </div>}
          </article>
        ))}
        {!list.length && <p className="mut">No tickets.</p>}
      </div>
    </>
  );
}

/* ============ Roles & permissions ============ */
export function Roles({ me }: { me: User }) {
  const [data] = useLoad<Row>("/roles", { perms: {} });
  const [perms, setPerms] = useState<Row>({});
  const [role, setRole] = useState("admin");
  useEffect(() => { if (data.perms) setPerms(JSON.parse(JSON.stringify(data.perms))); }, [data]);
  const editable = me.role === "super_admin";
  const ACTS: [string, string][] = [["c", "Create"], ["r", "Read"], ["u", "Update"], ["d", "Delete"], ["a", "Approve"]];
  const toggle = (m: string, a: string) => setPerms((p) => { const cur: string = p[role]?.[m] ?? ""; return { ...p, [role]: { ...p[role], [m]: cur.includes(a) ? cur.replace(a, "") : cur + a } }; });
  async function save() { try { await api("/roles", "PUT", { perms }); alert("Permissions saved ✔ (users get them on next login)"); } catch (x) { err(x); } }
  return (
    <>
      <h1 className="ph">Roles &amp; Permissions</h1>
      <p className="mut">Control exactly what each role can Create, Read, Update, Delete and Approve. Every request is checked on the server. Clients only ever see their own data.</p>
      <div className="toolbar"><select value={role} onChange={(e) => setRole(e.target.value)}>{STAFF_ROLES.filter((r) => r !== "super_admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        {editable ? <button className="btn sm" onClick={save}>Save permissions</button> : <small className="mut">Only the Super Admin can edit.</small>}</div>
      <div className="tablewrap"><table className="tbl"><thead><tr><th>Module</th>{ACTS.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody>{MODULES.map((m) => <tr key={m}><td><b>{MODULE_LABEL[m]}</b></td>{ACTS.map(([a]) => <td key={a}><input type="checkbox" disabled={!editable} checked={(perms[role]?.[m] ?? "").includes(a)} onChange={() => toggle(m, a)} /></td>)}</tr>)}</tbody></table></div>
      <p className="mut">Super Admin always has full access. Client accounts use the separate Client Portal.</p>
    </>
  );
}

/* ============ Reports ============ */
export function Reports() {
  const [r] = useLoad<Row>("/reports", { monthly: [] });
  const [logs] = useLoad<Row[]>("/logs", []);
  const [pays] = useLoad<Row[]>("/payments", []);
  const groups: [string, Row][] = [["Projects", r.projects], ["Tasks", r.tasks], ["Invoices", r.invoices], ["Payments", r.payments], ["Tickets", r.tickets], ["Clients", r.clients]];
  return (
    <>
      <h1 className="ph">Reports &amp; Activity Logs</h1>
      <div className="two">{groups.map(([l, o]) => <div className="card" key={l}><h3>{l}</h3><div className="chips">{Object.entries(o ?? {}).map(([k, v]) => <i key={k}>{k.replace("_", " ")}: {String(v)}</i>)}{!Object.keys(o ?? {}).length && <span className="mut">No data</span>}</div></div>)}</div>
      <div className="card"><h3>Revenue &amp; expense</h3><Bars data={r.monthly ?? []} /></div>
      <div className="acts"><button className="btn ghost sm" onClick={() => exportCsv("payments", pays)}>⬇ Payments (CSV)</button><button className="btn ghost sm" onClick={() => exportCsv("activity-log", logs)}>⬇ Activity log (CSV)</button></div>
      <h3>Activity log</h3>
      <div className="tablewrap"><table className="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>{logs.map((l) => <tr key={l.id}><td>{new Date(l.date).toLocaleString()}</td><td>{l.who}</td><td>{l.text}</td></tr>)}</tbody></table></div>
    </>
  );
}

/* ============ Profile & security ============ */
export function Profile({ me, refresh }: { me: User; refresh: () => void }) {
  const client = me.role === "client";
  const [photo, setPhoto] = useState(me.photo ?? "");
  async function pick(e: ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) try { setPhoto(await resize(f)); } catch (x) { err(x); } }
  async function save(e: FormEvent<HTMLFormElement>) {
    const f = fd(e);
    try { await api("/profile", "PUT", { ...f, photo }); refresh(); alert("Profile saved ✔"); } catch (x) { err(x); }
  }
  async function pw(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget; const f = fd(e);
    try { await api("/password", "POST", f); form.reset(); alert("Password changed ✔"); } catch (x) { err(x); }
  }
  return (
    <>
      <h1 className="ph">Profile &amp; Settings</h1>
      <form className="card fgrid" onSubmit={save}>
        <h3>Profile</h3>
        <div className="photo-pick">{photo ? <img className="pic" style={{ width: 72, height: 72 }} src={photo} alt="" /> : <div className="pic" style={{ width: 72, height: 72 }}>📷</div>}<label className="btn ghost sm">Upload photo<input type="file" accept="image/*" hidden onChange={pick} /></label></div>
        <input name="name" defaultValue={me.name} placeholder="Name" required />
        <input value={me.email} disabled />
        <input name="phone" defaultValue={me.phone} placeholder="Phone" />
        {client && <><input name="company" defaultValue={me.company} placeholder="Company name" /><input name="address" defaultValue={me.address} placeholder="Company address" /></>}
        <div className="acts"><button className="btn sm">Save profile</button></div>
      </form>
      <form className="card fgrid" onSubmit={pw}>
        <h3>Change password</h3>
        <input name="current" type="password" placeholder="Current password" required autoComplete="current-password" />
        <input name="password" type="password" minLength={8} placeholder="New password (min 8 characters)" required autoComplete="new-password" />
        <div className="acts"><button className="btn sm">Change password</button></div>
      </form>
      <div className="card"><h3>Security</h3>
        <p className="mut">Two-factor authentication: coming in a later phase.</p>
        <div className="acts"><button className="btn ghost sm" onClick={() => confirm("Log out from all devices?") && api("/logout-all", "POST").then(() => { sessionStorage.removeItem("fwd_token"); location.reload(); }).catch(err)}>Logout all devices</button></div>
        <h4>Login history</h4>
        {(me.loginHistory ?? []).map((l, k) => <div className="row" key={k}><div><b>{new Date(l.date).toLocaleString()}</b><small>{l.ip} · {l.device}</small></div></div>)}
      </div>
    </>
  );
}
