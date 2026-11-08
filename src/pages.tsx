import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { DEPARTMENTS, ROLE_LABEL, STAFF_ROLES } from "./roles";
import { api, can, useLoad, User, Notice, Application, Contact, Settings } from "./api";

export const fd = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, any>; };
export const fmt = (d: string) => (d ? new Date(d).toLocaleDateString() : "—");
const ini = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export const err = (e: any) => alert(e.message ?? "Error");
const STATUS: Record<string, string> = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

export function Avatar({ u, size = 44 }: { u?: User; size?: number }) {
  const st = { width: size, height: size };
  return u?.photo ? <img className="pic" style={st} src={u.photo} alt={u.name} /> : <div className="pic" style={st}>{u ? ini(u.name) : "?"}</div>;
}

/* ---------------- 2. Team Members ---------------- */
export function resize(file: File, max = 320): Promise<string> {
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
        <label className="lbl">Access level<select name="access" defaultValue={ed.role ?? "member"}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
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
  const admin = can(me, "members", "u");
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
      {can(me, "notices", "c") && (
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
            {can(me, "notices", "c") && <button className="del" onClick={() => api(`/notices/${n.id}`, "DELETE").then(reload).catch(err)}>Delete</button>}
          </article>
        ))}
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
