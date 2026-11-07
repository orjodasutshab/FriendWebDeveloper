import express, { NextFunction, Request, Response } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FILE = path.resolve("data.json");
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "admin123";
app.use(express.json({ limit: "1mb" }));

type User = { id: string; username: string; pass: string; name: string; email: string; phone: string; photo: string; skills: string[]; experience: string; portfolio: string; social: Record<string, string>; position: string; department: string; status: "active" | "inactive"; role: "admin" | "member"; joined: string };
type Project = { id: string; title: string; description: string; deadline: string; progress: number; status: "active" | "completed"; members: string[]; created: string; completedAt?: string };
type Task = { id: string; title: string; projectId: string; assignee: string; deadline: string; status: "pending" | "in_progress" | "completed" };
type Notice = { id: string; title: string; body: string; kind: "notice" | "announcement"; date: string; author: string };
type DM = { id: string; from: string; to: string; text: string; date: string };
type Comment = { id: string; projectId: string; userId: string; text: string; date: string };
type Application = { id: string; name: string; email: string; phone: string; skills: string; cv: string; portfolio: string; message: string; status: "pending" | "approved" | "rejected"; date: string };
type Contact = { id: string; name: string; email: string; message: string; date: string };
type Settings = { siteName: string; tagline: string; email: string; phone: string; address: string };
type DB = { users: User[]; projects: Project[]; tasks: Task[]; notices: Notice[]; dms: DM[]; comments: Comment[]; applications: Application[]; contacts: Contact[]; settings: Settings };

const empty: DB = {
  users: [], projects: [], tasks: [], notices: [], dms: [], comments: [], applications: [], contacts: [],
  settings: { siteName: "Friend Web Developer", tagline: "We turn ideas into beautiful websites.", email: "hello@yourteam.com", phone: "+880 1XXX-XXXXXX", address: "Dhaka, Bangladesh" },
};
const db: DB = fs.existsSync(FILE) ? { ...empty, ...JSON.parse(fs.readFileSync(FILE, "utf8")) } : empty;
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const now = () => new Date().toISOString();

const hash = (p: string) => { const s = randomBytes(16).toString("hex"); return s + ":" + scryptSync(p, s, 32).toString("hex"); };
const check = (p: string, h: string) => {
  const [s, k] = h.split(":");
  const a = Buffer.from(k, "hex"), b = scryptSync(p, s, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};
const pub = (u: User) => { const { pass, ...rest } = u; return rest; };
const fail = (res: Response, code: number, error: string) => res.status(code).json({ ok: false, error });
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

if (!db.users.length) {
  db.users.push({ id: randomUUID(), username: ADMIN_USER, pass: hash(ADMIN_PASS), name: "Admin", email: "", phone: "", photo: "", skills: [], experience: "", portfolio: "", social: {}, position: "Team Lead", department: "Management", status: "active", role: "admin", joined: now() });
  save();
}

const sessions = new Map<string, string>();
const me = (res: Response) => res.locals.user as User;
function auth(req: Request, res: Response, next: NextFunction) {
  const id = sessions.get((req.headers.authorization ?? "").replace("Bearer ", ""));
  const user = db.users.find((u) => u.id === id && u.status === "active");
  if (!user) return fail(res, 401, "Please log in.");
  res.locals.user = user;
  next();
}
function admin(_req: Request, res: Response, next: NextFunction) {
  if (me(res).role !== "admin") return fail(res, 403, "Admin only.");
  next();
}

// ---------- Auth ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};
  const id = String(username ?? "").toLowerCase().trim();
  const u = db.users.find((x) => x.username === id || (x.email && x.email.toLowerCase() === id));
  if (!u || !check(String(password ?? ""), u.pass)) return fail(res, 401, "Wrong username or password.");
  if (u.status !== "active") return fail(res, 403, "Your account is inactive.");
  const token = randomUUID();
  sessions.set(token, u.id);
  res.json({ ok: true, token, user: pub(u) });
});
app.post("/api/logout", auth, (req, res) => { sessions.delete((req.headers.authorization ?? "").replace("Bearer ", "")); res.json({ ok: true }); });
app.get("/api/me", auth, (_q, res) => res.json(pub(me(res))));

// ---------- Public ----------
app.get("/api/settings", (_q, res) => res.json(db.settings));
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body ?? {};
  if (!name || !message || !/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Please fill all fields correctly.");
  db.contacts.push({ id: randomUUID(), name, email, message, date: now() });
  save();
  res.json({ ok: true });
});
app.post("/api/apply", (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !/^\S+@\S+\.\S+$/.test(String(b.email))) return fail(res, 400, "Name and a valid email are required.");
  db.applications.push({ id: randomUUID(), name: b.name, email: b.email, phone: b.phone ?? "", skills: b.skills ?? "", cv: b.cv ?? "", portfolio: b.portfolio ?? "", message: b.message ?? "", status: "pending", date: now() });
  save();
  res.json({ ok: true });
});

// ---------- Stats ----------
app.get("/api/stats", auth, (_q, res) => {
  const month = Date.now() - 30 * 864e5;
  res.json({
    totalMembers: db.users.length,
    activeProjects: db.projects.filter((p) => p.status === "active").length,
    completedProjects: db.projects.filter((p) => p.status === "completed").length,
    pendingTasks: db.tasks.filter((t) => t.status === "pending").length,
    newMembers: db.users.filter((u) => +new Date(u.joined) > month).length,
  });
});

// ---------- Members ----------
const PROFILE = ["name", "email", "phone", "photo", "skills", "experience", "portfolio", "social"];
const ADMINF = [...PROFILE, "position", "department", "status", "role", "joined"];
app.get("/api/members", auth, (_q, res) => res.json(db.users.map(pub)));
app.post("/api/members", auth, admin, (req, res) => {
  const b = req.body ?? {};
  const email = String(b.email ?? "").toLowerCase().trim();
  if (!b.name || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Name and a valid email are required.");
  if (String(b.password ?? "").length < 8) return fail(res, 400, "Password must be at least 8 characters.");
  if (db.users.some((u) => u.username === email || u.email.toLowerCase() === email)) return fail(res, 400, "This email is already used.");
  const d = new Date(b.joined);
  const u: User = { id: randomUUID(), username: email, pass: hash(String(b.password)), name: b.name, email, phone: b.phone ?? "", photo: b.photo ?? "", skills: b.skills ?? [], experience: b.experience ?? "", portfolio: b.portfolio ?? "", social: b.social ?? {}, position: b.position || "Member", department: b.department || "Development Team", status: b.status === "inactive" ? "inactive" : "active", role: b.role === "admin" ? "admin" : "member", joined: b.joined && !isNaN(+d) ? d.toISOString() : now() };
  db.users.push(u);
  save();
  res.json(pub(u));
});
app.put("/api/members/:id", auth, (req, res) => {
  const user = me(res);
  const t = db.users.find((u) => u.id === req.params.id);
  if (!t) return fail(res, 404, "Not found.");
  const isAdmin = user.role === "admin";
  if (!isAdmin && t.id !== user.id) return fail(res, 403, "Not allowed.");
  const patch: any = pick(req.body ?? {}, isAdmin ? ADMINF : PROFILE);
  if (t.id === user.id) { delete patch.status; delete patch.role; }
  if (patch.email !== undefined) {
    patch.email = String(patch.email).toLowerCase().trim();
    if (patch.email && db.users.some((u) => u.id !== t.id && u.email.toLowerCase() === patch.email)) return fail(res, 400, "This email is already used.");
  }
  if (patch.joined) { const d = new Date(patch.joined); if (isNaN(+d)) delete patch.joined; else patch.joined = d.toISOString(); }
  if (req.body?.password) {
    if (String(req.body.password).length < 8) return fail(res, 400, "Password must be at least 8 characters.");
    t.pass = hash(String(req.body.password));
  }
  Object.assign(t, patch);
  save();
  res.json(pub(t));
});
app.delete("/api/members/:id", auth, admin, (req, res) => {
  if (req.params.id === me(res).id) return fail(res, 400, "You cannot delete yourself.");
  db.users = db.users.filter((u) => u.id !== req.params.id);
  db.projects.forEach((p) => (p.members = p.members.filter((m) => m !== req.params.id)));
  db.tasks = db.tasks.filter((t) => t.assignee !== req.params.id);
  save();
  res.json({ ok: true });
});

// ---------- Applications ----------
app.get("/api/applications", auth, admin, (_q, res) => res.json([...db.applications].reverse()));
app.post("/api/applications/:id/approve", auth, admin, (req, res) => {
  const a = db.applications.find((x) => x.id === req.params.id);
  if (!a || a.status !== "pending") return fail(res, 404, "Application not found.");
  let username = a.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  while (db.users.some((u) => u.username === username)) username += Math.floor(Math.random() * 10);
  const password = randomBytes(4).toString("hex");
  db.users.push({ id: randomUUID(), username, pass: hash(password), name: a.name, email: a.email, phone: a.phone, photo: "", skills: a.skills.split(",").map((s) => s.trim()).filter(Boolean), experience: "", portfolio: a.portfolio, social: {}, position: "Member", department: "Development Team", status: "active", role: "member", joined: now() });
  a.status = "approved";
  save();
  res.json({ ok: true, username, password });
});
app.post("/api/applications/:id/reject", auth, admin, (req, res) => {
  const a = db.applications.find((x) => x.id === req.params.id);
  if (!a) return fail(res, 404, "Not found.");
  a.status = "rejected";
  save();
  res.json({ ok: true });
});

// ---------- Projects ----------
const canSee = (p: Project, u: User) => u.role === "admin" || p.members.includes(u.id);
app.get("/api/projects", auth, (_q, res) => res.json(db.projects.filter((p) => canSee(p, me(res)))));
app.post("/api/projects", auth, admin, (req, res) => {
  const b = req.body ?? {};
  if (!b.title) return fail(res, 400, "Title is required.");
  const p: Project = { id: randomUUID(), title: b.title, description: b.description ?? "", deadline: b.deadline ?? "", progress: 0, status: "active", members: b.members ?? [], created: now() };
  db.projects.push(p);
  save();
  res.json(p);
});
app.put("/api/projects/:id", auth, admin, (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p) return fail(res, 404, "Not found.");
  Object.assign(p, pick(req.body ?? {}, ["title", "description", "deadline", "progress", "status", "members"]));
  if (p.status === "completed") { p.progress = 100; p.completedAt = p.completedAt ?? now(); } else delete p.completedAt;
  save();
  res.json(p);
});
app.delete("/api/projects/:id", auth, admin, (req, res) => {
  db.projects = db.projects.filter((p) => p.id !== req.params.id);
  db.tasks = db.tasks.filter((t) => t.projectId !== req.params.id);
  db.comments = db.comments.filter((c) => c.projectId !== req.params.id);
  save();
  res.json({ ok: true });
});
app.get("/api/projects/:id/comments", auth, (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p || !canSee(p, me(res))) return fail(res, 404, "Not found.");
  res.json(db.comments.filter((c) => c.projectId === p.id));
});
app.post("/api/projects/:id/comments", auth, (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p || !canSee(p, me(res)) || !req.body?.text) return fail(res, 400, "Cannot post.");
  db.comments.push({ id: randomUUID(), projectId: p.id, userId: me(res).id, text: String(req.body.text), date: now() });
  save();
  res.json({ ok: true });
});

// ---------- Tasks ----------
const STATUS = ["pending", "in_progress", "completed"];
app.get("/api/tasks", auth, (_q, res) => res.json(db.tasks.filter((t) => me(res).role === "admin" || t.assignee === me(res).id)));
app.post("/api/tasks", auth, admin, (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.assignee) return fail(res, 400, "Title and assignee are required.");
  const t: Task = { id: randomUUID(), title: b.title, projectId: b.projectId ?? "", assignee: b.assignee, deadline: b.deadline ?? "", status: "pending" };
  db.tasks.push(t);
  save();
  res.json(t);
});
app.put("/api/tasks/:id", auth, (req, res) => {
  const u = me(res);
  const t = db.tasks.find((x) => x.id === req.params.id);
  if (!t || (u.role !== "admin" && t.assignee !== u.id)) return fail(res, 403, "Not allowed.");
  const patch: any = pick(req.body ?? {}, u.role === "admin" ? ["title", "projectId", "assignee", "deadline", "status"] : ["status"]);
  if (patch.status && !STATUS.includes(patch.status)) return fail(res, 400, "Bad status.");
  Object.assign(t, patch);
  save();
  res.json(t);
});
app.delete("/api/tasks/:id", auth, admin, (req, res) => { db.tasks = db.tasks.filter((t) => t.id !== req.params.id); save(); res.json({ ok: true }); });

// ---------- Notices ----------
app.get("/api/notices", auth, (_q, res) => res.json([...db.notices].reverse()));
app.post("/api/notices", auth, admin, (req, res) => {
  const b = req.body ?? {};
  if (!b.title) return fail(res, 400, "Title is required.");
  db.notices.push({ id: randomUUID(), title: b.title, body: b.body ?? "", kind: b.kind === "announcement" ? "announcement" : "notice", date: now(), author: me(res).name });
  save();
  res.json({ ok: true });
});
app.delete("/api/notices/:id", auth, admin, (req, res) => { db.notices = db.notices.filter((n) => n.id !== req.params.id); save(); res.json({ ok: true }); });

// ---------- Direct messages ----------
app.get("/api/dm/:other", auth, (req, res) => {
  const a = me(res).id, b = req.params.other;
  res.json(db.dms.filter((m) => (m.from === a && m.to === b) || (m.from === b && m.to === a)));
});
app.post("/api/dm", auth, (req, res) => {
  const { to, text } = req.body ?? {};
  if (!text || !db.users.some((u) => u.id === to)) return fail(res, 400, "Cannot send.");
  db.dms.push({ id: randomUUID(), from: me(res).id, to, text: String(text), date: now() });
  save();
  res.json({ ok: true });
});

// ---------- Settings + contact inbox ----------
app.put("/api/settings", auth, admin, (req, res) => {
  Object.assign(db.settings, pick(req.body ?? {}, ["siteName", "tagline", "email", "phone", "address"]));
  save();
  res.json(db.settings);
});
app.get("/api/contacts", auth, admin, (_q, res) => res.json([...db.contacts].reverse()));
app.delete("/api/contacts/:id", auth, admin, (req, res) => { db.contacts = db.contacts.filter((c) => c.id !== req.params.id); save(); res.json({ ok: true }); });

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
