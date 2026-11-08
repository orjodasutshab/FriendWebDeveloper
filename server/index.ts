import express, { NextFunction, Request, Response } from "express";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FILE = path.resolve("data.json");
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "admin123";
app.disable("x-powered-by");
app.use((_q, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" }); next(); });
app.use(express.json({ limit: "2mb" }));

type Row = Record<string, any>;
type User = { id: string; username: string; pass: string; name: string; email: string; phone: string; photo: string; skills: string[]; experience: string; portfolio: string; social: Record<string, string>; position: string; department: string; status: string; role: string; joined: string; company?: string; address?: string; managerId?: string; inviteToken?: string; loginHistory?: Row[] };
type DB = { users: User[]; projects: Row[]; tasks: Row[]; notices: Row[]; dms: Row[]; comments: Row[]; applications: Row[]; contacts: Row[]; invoices: Row[]; payments: Row[]; expenses: Row[]; tickets: Row[]; files: Row[]; notifications: Row[]; logs: Row[]; perms: Record<string, Record<string, string>>; settings: Row };

// ---------- Roles & permissions (c=create r=read u=update d=delete a=approve) ----------
const MODULES = ["members", "clients", "projects", "tasks", "finance", "tickets", "recruitment", "reports", "notices", "settings", "roles"];
const STAFF_ROLES = ["super_admin", "admin", "hr", "pm", "leader", "member", "accountant", "support"];
const all = (m: string[]) => Object.fromEntries(m.map((x) => [x, "cruda"]));
const DEFAULT_PERMS: Record<string, Record<string, string>> = {
  admin: { ...all(MODULES.filter((m) => m !== "roles")), roles: "r" },
  hr: { members: "cru", recruitment: "cruda", notices: "cru", reports: "r", tasks: "r" },
  pm: { clients: "r", projects: "crua", tasks: "cruda", tickets: "r", reports: "r", notices: "r" },
  leader: { projects: "r", tasks: "crua", notices: "r" },
  member: { projects: "r", tasks: "r", notices: "r" },
  accountant: { finance: "cruda", clients: "r", projects: "r", reports: "r" },
  support: { tickets: "crua", clients: "r", projects: "r", notices: "r" },
};

const empty: DB = {
  users: [], projects: [], tasks: [], notices: [], dms: [], comments: [], applications: [], contacts: [], invoices: [], payments: [], expenses: [], tickets: [], files: [], notifications: [], logs: [], perms: {},
  settings: { siteName: "Friend Web Developer", tagline: "We turn ideas into beautiful websites.", email: "hello@yourteam.com", phone: "+880 1XXX-XXXXXX", address: "Dhaka, Bangladesh" },
};
const db: DB = { ...empty, ...(fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {}) };
db.perms = { ...DEFAULT_PERMS, ...db.perms };
const save = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const now = () => new Date().toISOString();

const hash = (p: string) => { const s = randomBytes(16).toString("hex"); return s + ":" + scryptSync(p, s, 32).toString("hex"); };
const check = (p: string, h: string) => {
  if (!h.includes(":")) return false;
  const [s, k] = h.split(":");
  const a = Buffer.from(k, "hex"), b = scryptSync(p, s, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};
const newUser = (p: Partial<User>): User => ({ id: randomUUID(), username: "", pass: "", name: "", email: "", phone: "", photo: "", skills: [], experience: "", portfolio: "", social: {}, position: "Member", department: "Development Team", status: "active", role: "member", joined: now(), loginHistory: [], ...p });
const pub = (u: User) => { const { pass, inviteToken, loginHistory, ...rest } = u; return rest; };
const isStaff = (u: User) => u.role !== "client";
const can = (u: User, m: string, a: string) => u.role === "super_admin" || (db.perms[u.role]?.[m] ?? "").includes(a);
const meOut = (u: User) => ({ ...pub(u), loginHistory: u.loginHistory ?? [], perms: u.role === "super_admin" ? all(MODULES) : db.perms[u.role] ?? {} });
const fail = (res: Response, code: number, error: string) => res.status(code).json({ ok: false, error });
const ok = (res: Response, extra: Row = {}) => res.json({ ok: true, ...extra });
const pick = (o: any, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const nameOf = (id?: string) => db.users.find((u) => u.id === id)?.name ?? "";
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

// ---------- Migration of older data ----------
if (!db.users.length) db.users.push(newUser({ username: ADMIN_USER, pass: hash(ADMIN_PASS), name: "Super Admin", position: "Founder / Owner", department: "Management Team", role: "super_admin" }));
if (!db.users.some((u) => u.role === "super_admin")) { const a = db.users.find((u) => u.role === "admin"); if (a) a.role = "super_admin"; }
db.users.forEach((u) => { u.loginHistory ??= []; u.skills ??= []; u.social ??= {}; u.portfolio ??= ""; });
db.projects.forEach((p) => { if (p.status === "active") p.status = "in_progress"; p.milestones ??= []; p.revisions ??= []; p.members ??= []; p.priority ??= "Medium"; p.category ??= "Business Website"; p.clientId ??= ""; p.managerId ??= ""; p.budget ??= 0; p.startDate ??= ""; });
db.tasks.forEach((t) => { if (t.status === "pending") t.status = "todo"; t.priority ??= "Medium"; t.description ??= ""; });
db.dms.forEach((m) => { m.read ??= true; });
save();

// ---------- Helpers: notify / log / auth ----------
const notify = (userId: string | undefined, text: string) => { if (userId) db.notifications.push({ id: randomUUID(), userId, text, date: now(), read: false }); };
const notifyPerm = (m: string, a: string, text: string) => db.users.forEach((u) => { if (u.status === "active" && isStaff(u) && can(u, m, a)) notify(u.id, text); });
const log = (userId: string, text: string) => { db.logs.push({ id: randomUUID(), userId, text, date: now() }); if (db.logs.length > 500) db.logs.shift(); };

const sessions = new Map<string, { id: string; exp: number }>();
const tokenOf = (req: Request) => (req.headers.authorization ?? "").replace("Bearer ", "");
const me = (res: Response) => res.locals.user as User;
function auth(req: Request, res: Response, next: NextFunction) {
  const s = sessions.get(tokenOf(req));
  const user = s && s.exp > Date.now() ? db.users.find((u) => u.id === s.id && u.status === "active") : undefined;
  if (!user) return fail(res, 401, "Please log in.");
  res.locals.user = user;
  next();
}
const staff = (_q: Request, res: Response, next: NextFunction) => (isStaff(me(res)) ? next() : fail(res, 403, "Staff only."));
const need = (m: string, a: string) => (_q: Request, res: Response, next: NextFunction) => (can(me(res), m, a) ? next() : fail(res, 403, "You do not have permission."));
const clientOr = (m: string) => (_q: Request, res: Response, next: NextFunction) => (me(res).role === "client" || can(me(res), m, "r") ? next() : fail(res, 403, "You do not have permission."));

const tries = new Map<string, { n: number; t: number }>();
const limited = (k: string) => { const r = tries.get(k); return !!r && Date.now() - r.t < 15 * 6e4 && r.n >= 8; };
const bump = (k: string, good: boolean) => {
  if (good) return void tries.delete(k);
  const r = tries.get(k);
  if (!r || Date.now() - r.t >= 15 * 6e4) tries.set(k, { n: 1, t: Date.now() }); else r.n++;
};

// ---------- Auth ----------
app.post("/api/login", (req, res) => {
  const id = String(req.body?.username ?? "").toLowerCase().trim();
  const key = req.ip + "|" + id;
  if (limited(key)) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
  const u = db.users.find((x) => x.username === id || (x.email && x.email.toLowerCase() === id));
  if (!u || !u.pass || !check(String(req.body?.password ?? ""), u.pass)) { bump(key, false); return fail(res, 401, "Wrong email/username or password."); }
  if (u.status === "pending") return fail(res, 403, "Your account is waiting for admin approval.");
  if (u.status !== "active") return fail(res, 403, `Your account is ${u.status}. Please contact the admin.`);
  bump(key, true);
  const token = randomUUID();
  sessions.set(token, { id: u.id, exp: Date.now() + 7 * 864e5 });
  u.loginHistory = [{ date: now(), ip: req.ip ?? "", device: String(req.headers["user-agent"] ?? "").slice(0, 90) }, ...(u.loginHistory ?? [])].slice(0, 10);
  log(u.id, "Logged in");
  save();
  res.json({ ok: true, token, user: meOut(u) });
});
app.post("/api/logout", auth, (req, res) => { sessions.delete(tokenOf(req)); ok(res); });
app.post("/api/logout-all", auth, (_q, res) => { for (const [t, s] of sessions) if (s.id === me(res).id) sessions.delete(t); ok(res); });
app.get("/api/me", auth, (_q, res) => res.json(meOut(me(res))));
app.post("/api/password", auth, (req, res) => {
  const u = me(res);
  if (!check(String(req.body?.current ?? ""), u.pass)) return fail(res, 400, "Current password is wrong.");
  if (String(req.body?.password ?? "").length < 8) return fail(res, 400, "New password must be at least 8 characters.");
  u.pass = hash(String(req.body.password));
  log(u.id, "Changed password"); save(); ok(res);
});
app.put("/api/profile", auth, (req, res) => { Object.assign(me(res), pick(req.body ?? {}, ["name", "phone", "photo", "company", "address"])); save(); res.json(meOut(me(res))); });

// ---------- Public ----------
app.get("/api/settings", (_q, res) => res.json(db.settings));
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body ?? {};
  if (!name || !message || !/^\S+@\S+\.\S+$/.test(String(email))) return fail(res, 400, "Please fill all fields correctly.");
  db.contacts.push({ id: randomUUID(), name, email, message, date: now() }); save(); ok(res);
});
app.post("/api/apply", (req, res) => {
  const b = req.body ?? {};
  if (!b.name || !/^\S+@\S+\.\S+$/.test(String(b.email))) return fail(res, 400, "Name and a valid email are required.");
  db.applications.push({ id: randomUUID(), name: b.name, email: b.email, phone: b.phone ?? "", skills: b.skills ?? "", cv: b.cv ?? "", portfolio: b.portfolio ?? "", message: b.message ?? "", status: "pending", date: now() });
  notifyPerm("recruitment", "a", `New team application: ${b.name}`); save(); ok(res);
});
app.post("/api/client/register", (req, res) => {
  const b = req.body ?? {};
  const email = String(b.email ?? "").toLowerCase().trim();
  if (!b.name || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Name and a valid email are required.");
  if (String(b.password ?? "").length < 8) return fail(res, 400, "Password must be at least 8 characters.");
  if (db.users.some((u) => u.username === email || u.email.toLowerCase() === email)) return fail(res, 400, "This email is already registered.");
  db.users.push(newUser({ username: email, pass: hash(String(b.password)), name: b.name, email, phone: b.phone ?? "", company: b.company ?? "", role: "client", status: "pending", position: "Client", department: "Clients" }));
  notifyPerm("clients", "a", `New client registration: ${b.name}`); save(); ok(res);
});
app.get("/api/invite/:t", (req, res) => {
  const u = db.users.find((x) => x.inviteToken === req.params.t);
  if (!u) return fail(res, 404, "This invitation link is invalid or already used.");
  res.json({ name: u.name, email: u.email });
});
app.post("/api/invite/:t", (req, res) => {
  const u = db.users.find((x) => x.inviteToken === req.params.t);
  if (!u) return fail(res, 404, "This invitation link is invalid or already used.");
  if (String(req.body?.password ?? "").length < 8) return fail(res, 400, "Password must be at least 8 characters.");
  u.pass = hash(String(req.body.password)); delete u.inviteToken; u.status = "active";
  log(u.id, "Set password from invitation"); save(); ok(res);
});

// ---------- Derived finance data ----------
const paidOf = (i: Row) => sum(db.payments.filter((p) => p.invoiceId === i.id && p.status === "verified").map((p) => p.amount));
const invStatus = (i: Row) => {
  const paid = paidOf(i), ps = db.payments.filter((p) => p.invoiceId === i.id);
  if (paid >= i.amount) return "Paid";
  if (paid > 0) return "Partial";
  if (ps.some((p) => p.status === "pending")) return "Pending Verification";
  if (ps.some((p) => p.status === "refunded")) return "Refunded";
  return "Unpaid";
};
const invOut = (i: Row) => { const paid = paidOf(i); return { ...i, paid, due: Math.max(0, i.amount - paid), status: invStatus(i), clientName: nameOf(i.clientId), projectTitle: db.projects.find((p) => p.id === i.projectId)?.title ?? "" }; };
const projOut = (p: Row) => ({ ...p, clientName: nameOf(p.clientId), managerName: nameOf(p.managerId), memberNames: (p.members as string[]).map(nameOf) });
const SEE_ALL = ["super_admin", "admin", "accountant", "support", "hr"];
const visible = (p: Row, u: User) => (u.role === "client" ? p.clientId === u.id : SEE_ALL.includes(u.role) || p.managerId === u.id || p.members.includes(u.id));
const monthly = () => Array.from({ length: 6 }, (_, k) => {
  const d = new Date(); d.setMonth(d.getMonth() - (5 - k), 1);
  const m = d.toISOString().slice(0, 7);
  return { month: m, income: sum(db.payments.filter((p) => p.status === "verified" && String(p.date).startsWith(m)).map((p) => p.amount)), expense: sum(db.expenses.filter((e) => String(e.date).startsWith(m)).map((e) => e.amount)) };
});

// ---------- Dashboards ----------
app.get("/api/stats", auth, staff, (_q, res) => {
  const u = me(res), month = Date.now() - 30 * 864e5;
  const ps = db.projects.filter((p) => !p.archived);
  const out: Row = {
    totalMembers: db.users.filter(isStaff).length, totalClients: db.users.filter((x) => x.role === "client").length,
    totalProjects: ps.length, activeProjects: ps.filter((p) => p.status !== "completed").length, completedProjects: ps.filter((p) => p.status === "completed").length,
    pendingTasks: db.tasks.filter((t) => t.status === "todo").length, newMembers: db.users.filter((x) => isStaff(x) && +new Date(x.joined) > month).length,
  };
  if (can(u, "finance", "r")) { out.revenue = sum(db.payments.filter((p) => p.status === "verified").map((p) => p.amount)); out.pendingPayments = sum(db.invoices.map((i) => invOut(i).due)); out.monthly = monthly(); }
  if (can(u, "recruitment", "r")) out.pendingApplications = db.applications.filter((a) => a.status === "pending").length;
  if (can(u, "tickets", "r")) out.pendingTickets = db.tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  if (can(u, "clients", "r")) out.pendingClients = db.users.filter((x) => x.role === "client" && x.status === "pending").length;
  if (can(u, "reports", "r")) out.recent = db.logs.slice(-8).reverse().map((l) => ({ text: l.text, date: l.date, who: nameOf(l.userId) }));
  res.json(out);
});
app.get("/api/portal", auth, (_q, res) => {
  const u = me(res);
  if (u.role !== "client") return fail(res, 403, "Clients only.");
  const ps = db.projects.filter((p) => p.clientId === u.id && !p.archived).map(projOut);
  const act = ps.filter((p) => p.status !== "completed");
  res.json({ total: ps.length, active: act.length, completed: ps.length - act.length, pendingPayments: sum(db.invoices.filter((i) => i.clientId === u.id).map((i) => invOut(i).due)), projects: act, upcoming: act.filter((p) => p.deadline).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))).slice(0, 5) });
});

// ---------- Team members ----------
const PROFILE = ["name", "email", "phone", "photo", "skills", "experience", "portfolio", "social"];
const ADMINF = [...PROFILE, "position", "department", "status", "role", "joined"];
app.get("/api/members", auth, staff, (_q, res) => res.json(db.users.filter(isStaff).map(pub)));
app.post("/api/members", auth, staff, need("members", "c"), (req, res) => {
  const b = req.body ?? {}, u0 = me(res);
  const email = String(b.email ?? "").toLowerCase().trim();
  if (!b.name || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Name and a valid email are required.");
  if (String(b.password ?? "").length < 8) return fail(res, 400, "Password must be at least 8 characters.");
  if (db.users.some((u) => u.username === email || u.email.toLowerCase() === email)) return fail(res, 400, "This email is already used.");
  let role = STAFF_ROLES.includes(b.role) ? b.role : "member";
  if (role === "super_admin" && u0.role !== "super_admin") role = "member";
  const d = new Date(b.joined);
  const u = newUser({ username: email, pass: hash(String(b.password)), name: b.name, email, phone: b.phone ?? "", photo: b.photo ?? "", skills: b.skills ?? [], experience: b.experience ?? "", portfolio: b.portfolio ?? "", social: b.social ?? {}, position: b.position || "Member", department: b.department || "Development Team", status: b.status === "inactive" ? "inactive" : "active", role, joined: b.joined && !isNaN(+d) ? d.toISOString() : now() });
  db.users.push(u); log(u0.id, `Added member ${u.name}`); save(); res.json(pub(u));
});
app.put("/api/members/:id", auth, staff, (req, res) => {
  const user = me(res);
  const t = db.users.find((u) => u.id === req.params.id && isStaff(u));
  if (!t) return fail(res, 404, "Not found.");
  const isAdmin = can(user, "members", "u");
  if (!isAdmin && t.id !== user.id) return fail(res, 403, "Not allowed.");
  const patch: any = pick(req.body ?? {}, isAdmin ? ADMINF : PROFILE);
  if (t.id === user.id) { delete patch.status; delete patch.role; }
  if (patch.role && (!STAFF_ROLES.includes(patch.role) || !["super_admin", "admin"].includes(user.role) || (patch.role === "super_admin" && user.role !== "super_admin"))) delete patch.role;
  if (t.role === "super_admin" && user.role !== "super_admin") { delete patch.role; delete patch.status; }
  if (patch.email !== undefined) {
    patch.email = String(patch.email).toLowerCase().trim();
    if (patch.email && db.users.some((u) => u.id !== t.id && u.email.toLowerCase() === patch.email)) return fail(res, 400, "This email is already used.");
  }
  if (patch.joined) { const d = new Date(patch.joined); if (isNaN(+d)) delete patch.joined; else patch.joined = d.toISOString(); }
  if (req.body?.password) {
    if (String(req.body.password).length < 8) return fail(res, 400, "Password must be at least 8 characters.");
    t.pass = hash(String(req.body.password));
  }
  Object.assign(t, patch); log(user.id, `Updated member ${t.name}`); save(); res.json(pub(t));
});
app.delete("/api/members/:id", auth, staff, need("members", "d"), (req, res) => {
  const t = db.users.find((u) => u.id === req.params.id && isStaff(u));
  if (!t || t.id === me(res).id || (t.role === "super_admin" && me(res).role !== "super_admin")) return fail(res, 400, "You cannot delete this member.");
  db.users = db.users.filter((u) => u.id !== t.id);
  db.projects.forEach((p) => { p.members = p.members.filter((m: string) => m !== t.id); if (p.managerId === t.id) p.managerId = ""; });
  db.tasks = db.tasks.filter((x) => x.assignee !== t.id);
  log(me(res).id, `Deleted member ${t.name}`); save(); ok(res);
});

// ---------- Recruitment ----------
app.get("/api/applications", auth, staff, need("recruitment", "r"), (_q, res) => res.json([...db.applications].reverse()));
app.post("/api/applications/:id/approve", auth, staff, need("recruitment", "a"), (req, res) => {
  const a = db.applications.find((x) => x.id === req.params.id);
  if (!a || a.status !== "pending") return fail(res, 404, "Application not found.");
  const email = String(a.email).toLowerCase();
  if (db.users.some((u) => u.username === email || u.email.toLowerCase() === email)) return fail(res, 400, "A user with this email already exists.");
  const password = randomBytes(5).toString("hex");
  db.users.push(newUser({ username: email, pass: hash(password), name: a.name, email, phone: a.phone, skills: String(a.skills).split(",").map((s) => s.trim()).filter(Boolean), portfolio: a.portfolio }));
  a.status = "approved"; log(me(res).id, `Approved application of ${a.name}`); save();
  res.json({ ok: true, username: email, password });
});
app.post("/api/applications/:id/reject", auth, staff, need("recruitment", "a"), (req, res) => {
  const a = db.applications.find((x) => x.id === req.params.id);
  if (!a) return fail(res, 404, "Not found.");
  a.status = "rejected"; save(); ok(res);
});

// ---------- Clients ----------
const clientOut = (u: User) => ({ ...pub(u), managerName: nameOf(u.managerId), projects: db.projects.filter((p) => p.clientId === u.id).length, due: sum(db.invoices.filter((i) => i.clientId === u.id).map((i) => invOut(i).due)) });
const findClient = (id: string) => db.users.find((u) => u.id === id && u.role === "client");
app.get("/api/clients", auth, staff, need("clients", "r"), (_q, res) => res.json(db.users.filter((u) => u.role === "client").map(clientOut)));
app.post("/api/clients", auth, staff, need("clients", "c"), (req, res) => {
  const b = req.body ?? {};
  const email = String(b.email ?? "").toLowerCase().trim();
  if (!b.name || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Name and a valid email are required.");
  if (db.users.some((u) => u.username === email || u.email.toLowerCase() === email)) return fail(res, 400, "This email is already registered.");
  const inviteToken = randomBytes(16).toString("hex");
  db.users.push(newUser({ username: email, name: b.name, email, phone: b.phone ?? "", company: b.company ?? "", address: b.address ?? "", managerId: b.managerId ?? "", role: "client", status: "active", position: "Client", department: "Clients", inviteToken }));
  log(me(res).id, `Added client ${b.name}`); save();
  res.json({ ok: true, invite: `/#/invite/${inviteToken}` });
});
app.put("/api/clients/:id", auth, staff, need("clients", "u"), (req, res) => {
  const c = findClient(req.params.id);
  if (!c) return fail(res, 404, "Not found.");
  const patch: any = pick(req.body ?? {}, ["name", "phone", "company", "address", "managerId", "status"]);
  if (patch.status && !["active", "inactive", "blocked"].includes(patch.status)) delete patch.status;
  Object.assign(c, patch);
  if (patch.status && patch.status !== "active") for (const [t, s] of sessions) if (s.id === c.id) sessions.delete(t);
  log(me(res).id, `Updated client ${c.name}`); save(); res.json(clientOut(c));
});
app.post("/api/clients/:id/approve", auth, staff, need("clients", "a"), (req, res) => {
  const c = findClient(req.params.id);
  if (!c || c.status !== "pending") return fail(res, 404, "Not found.");
  c.status = "active"; notify(c.id, "Your account was approved. Welcome!"); log(me(res).id, `Approved client ${c.name}`); save(); ok(res);
});
app.post("/api/clients/:id/reject", auth, staff, need("clients", "a"), (req, res) => {
  const c = findClient(req.params.id);
  if (!c || c.status !== "pending") return fail(res, 404, "Not found.");
  db.users = db.users.filter((u) => u.id !== c.id); log(me(res).id, `Rejected client ${c.name}`); save(); ok(res);
});
app.post("/api/clients/:id/reset", auth, staff, need("clients", "u"), (req, res) => {
  const c = findClient(req.params.id);
  if (!c) return fail(res, 404, "Not found.");
  c.inviteToken = randomBytes(16).toString("hex"); c.pass = "";
  for (const [t, s] of sessions) if (s.id === c.id) sessions.delete(t);
  log(me(res).id, `Reset password of ${c.name}`); save();
  res.json({ ok: true, invite: `/#/invite/${c.inviteToken}` });
});
app.delete("/api/clients/:id", auth, staff, need("clients", "d"), (req, res) => {
  const c = findClient(req.params.id);
  if (!c) return fail(res, 404, "Not found.");
  db.users = db.users.filter((u) => u.id !== c.id); log(me(res).id, `Deleted client ${c.name}`); save(); ok(res);
});

// ---------- Projects ----------
const PF = ["title", "description", "clientId", "managerId", "members", "budget", "deadline", "startDate", "priority", "category", "status", "progress", "milestones", "revisions", "archived"];
app.get("/api/projects", auth, clientOr("projects"), (_q, res) => res.json(db.projects.filter((p) => visible(p, me(res))).map(projOut)));
app.post("/api/projects", auth, staff, need("projects", "c"), (req, res) => {
  const b = req.body ?? {};
  if (!b.title) return fail(res, 400, "Title is required.");
  const p: Row = { id: randomUUID(), title: b.title, description: b.description ?? "", clientId: b.clientId ?? "", managerId: b.managerId ?? "", members: b.members ?? [], budget: Number(b.budget) || 0, deadline: b.deadline ?? "", startDate: b.startDate ?? "", priority: b.priority ?? "Medium", category: b.category ?? "Business Website", status: "pending", progress: 0, milestones: [], revisions: [], created: now() };
  db.projects.push(p); notify(p.clientId, `New project created for you: ${p.title}`);
  p.members.forEach((m: string) => notify(m, `You were added to project: ${p.title}`));
  log(me(res).id, `Created project ${p.title}`); save(); res.json(projOut(p));
});
app.put("/api/projects/:id", auth, staff, need("projects", "u"), (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p || !visible(p, me(res))) return fail(res, 404, "Not found.");
  const old = p.status;
  Object.assign(p, pick(req.body ?? {}, PF));
  if (p.status === "completed") { p.progress = 100; p.completedAt ??= now(); } else delete p.completedAt;
  if (p.status !== old) { notify(p.clientId, `Project "${p.title}" is now ${String(p.status).replace("_", " ")}`); log(me(res).id, `Project ${p.title}: ${old} → ${p.status}`); }
  save(); res.json(projOut(p));
});
app.delete("/api/projects/:id", auth, staff, need("projects", "d"), (req, res) => {
  db.projects = db.projects.filter((p) => p.id !== req.params.id);
  db.tasks = db.tasks.filter((t) => t.projectId !== req.params.id);
  db.comments = db.comments.filter((c) => c.projectId !== req.params.id);
  db.files = db.files.filter((f) => f.projectId !== req.params.id);
  log(me(res).id, "Deleted a project"); save(); ok(res);
});
app.post("/api/projects/:id/revision", auth, (req, res) => {
  const u = me(res), p = db.projects.find((x) => x.id === req.params.id);
  if (u.role !== "client" || !p || p.clientId !== u.id || !req.body?.text) return fail(res, 400, "Cannot send revision request.");
  p.revisions.push({ id: randomUUID(), text: String(req.body.text), date: now(), status: "open" });
  if (p.status === "review" || p.status === "completed") { p.status = "in_progress"; delete p.completedAt; p.progress = Math.min(p.progress, 90); }
  notify(p.managerId, `Revision requested on "${p.title}"`); notifyPerm("projects", "u", `Revision requested on "${p.title}"`);
  log(u.id, `Requested revision on ${p.title}`); save(); ok(res);
});
app.post("/api/projects/:id/approve", auth, (req, res) => {
  const u = me(res), p = db.projects.find((x) => x.id === req.params.id);
  if (u.role !== "client" || !p || p.clientId !== u.id || p.status !== "review") return fail(res, 400, "This project is not waiting for your approval.");
  p.approved = true; p.approvedAt = now(); p.status = "completed"; p.progress = 100; p.completedAt = now();
  notify(p.managerId, `Client approved "${p.title}" 🎉`); notifyPerm("projects", "u", `Client approved "${p.title}"`);
  log(u.id, `Approved project ${p.title}`); save(); ok(res);
});
app.get("/api/projects/:id/comments", auth, staff, (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p || !visible(p, me(res))) return fail(res, 404, "Not found.");
  res.json(db.comments.filter((c) => c.projectId === p.id).map((c) => ({ ...c, name: nameOf(c.userId) })));
});
app.post("/api/projects/:id/comments", auth, staff, (req, res) => {
  const p = db.projects.find((x) => x.id === req.params.id);
  if (!p || !visible(p, me(res)) || !req.body?.text) return fail(res, 400, "Cannot post.");
  db.comments.push({ id: randomUUID(), projectId: p.id, userId: me(res).id, text: String(req.body.text), date: now() }); save(); ok(res);
});
// project files (links)
app.get("/api/files", auth, (_q, res) => {
  const u = me(res);
  res.json(db.files.filter((f) => { const p = db.projects.find((x) => x.id === f.projectId); return p && visible(p, u) && (u.role !== "client" || f.visible); }).map((f) => ({ ...f, projectTitle: db.projects.find((x) => x.id === f.projectId)?.title, by: nameOf(f.by) })).reverse());
});
app.post("/api/projects/:id/files", auth, staff, need("projects", "u"), (req, res) => {
  const b = req.body ?? {};
  if (!db.projects.some((p) => p.id === req.params.id) || !b.name || !/^https?:\/\//.test(String(b.url))) return fail(res, 400, "Name and a valid http(s) link are required.");
  db.files.push({ id: randomUUID(), projectId: req.params.id, name: b.name, url: b.url, type: b.type ?? "Document", visible: b.visible !== false, by: me(res).id, date: now() });
  const p = db.projects.find((x) => x.id === req.params.id)!;
  if (b.visible !== false) notify(p.clientId, `New file "${b.name}" in project "${p.title}"`);
  save(); ok(res);
});
app.delete("/api/files/:id", auth, staff, need("projects", "u"), (req, res) => { db.files = db.files.filter((f) => f.id !== req.params.id); save(); ok(res); });

// ---------- Tasks ----------
const TS = ["todo", "in_progress", "review", "completed"];
const taskOut = (t: Row) => ({ ...t, assigneeName: nameOf(t.assignee), projectTitle: db.projects.find((p) => p.id === t.projectId)?.title ?? "" });
app.get("/api/tasks", auth, staff, need("tasks", "r"), (_q, res) => res.json(db.tasks.filter((t) => me(res).role !== "member" || t.assignee === me(res).id).map(taskOut)));
app.post("/api/tasks", auth, staff, need("tasks", "c"), (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.assignee) return fail(res, 400, "Title and assignee are required.");
  const t: Row = { id: randomUUID(), title: b.title, description: b.description ?? "", projectId: b.projectId ?? "", assignee: b.assignee, deadline: b.deadline ?? "", priority: b.priority ?? "Medium", status: "todo" };
  db.tasks.push(t); notify(t.assignee, `New task assigned: ${t.title}`); log(me(res).id, `Created task ${t.title}`); save(); res.json(taskOut(t));
});
app.put("/api/tasks/:id", auth, staff, (req, res) => {
  const u = me(res), t = db.tasks.find((x) => x.id === req.params.id);
  if (!t) return fail(res, 404, "Not found.");
  const full = can(u, "tasks", "u");
  if (!full && t.assignee !== u.id) return fail(res, 403, "Not allowed.");
  const patch: any = pick(req.body ?? {}, full ? ["title", "description", "projectId", "assignee", "deadline", "priority", "status"] : ["status"]);
  if (patch.status && !TS.includes(patch.status)) return fail(res, 400, "Bad status.");
  if (patch.status === "completed" && !can(u, "tasks", "a")) return fail(res, 403, "Move it to Review. A leader/manager approves completion.");
  if (patch.status === "review") notifyPerm("tasks", "a", `Task "${t.title}" is ready for review`);
  Object.assign(t, patch); save(); res.json(taskOut(t));
});
app.delete("/api/tasks/:id", auth, staff, need("tasks", "d"), (req, res) => { db.tasks = db.tasks.filter((t) => t.id !== req.params.id); save(); ok(res); });

// ---------- Notices ----------
app.get("/api/notices", auth, staff, (_q, res) => res.json([...db.notices].reverse()));
app.post("/api/notices", auth, staff, need("notices", "c"), (req, res) => {
  const b = req.body ?? {};
  if (!b.title) return fail(res, 400, "Title is required.");
  db.notices.push({ id: randomUUID(), title: b.title, body: b.body ?? "", kind: b.kind === "announcement" ? "announcement" : "notice", date: now(), author: me(res).name });
  db.users.forEach((u) => { if (isStaff(u) && u.id !== me(res).id) notify(u.id, `📢 ${b.title}`); });
  save(); ok(res);
});
app.delete("/api/notices/:id", auth, staff, need("notices", "d"), (req, res) => { db.notices = db.notices.filter((n) => n.id !== req.params.id); save(); ok(res); });

// ---------- Chat ----------
const CLIENT_CAN_CHAT = ["super_admin", "admin", "pm", "support"];
const allowed = (a: User, b: User) => (a.role === "client" ? CLIENT_CAN_CHAT.includes(b.role) : b.role === "client" ? CLIENT_CAN_CHAT.includes(a.role) : true);
app.get("/api/chat/users", auth, (_q, res) => res.json(db.users.filter((u) => u.id !== me(res).id && u.status === "active" && allowed(me(res), u)).map(({ id, name, photo, role, position }) => ({ id, name, photo, role, position }))));
app.get("/api/unread", auth, (_q, res) => {
  const o: Row = {};
  db.dms.filter((m) => m.to === me(res).id && !m.read).forEach((m) => (o[m.from] = (o[m.from] ?? 0) + 1));
  res.json(o);
});
app.get("/api/dm/:other", auth, (req, res) => {
  const a = me(res), b = db.users.find((u) => u.id === req.params.other);
  if (!b || !allowed(a, b)) return fail(res, 403, "Not allowed.");
  db.dms.forEach((m) => { if (m.from === b.id && m.to === a.id) m.read = true; });
  res.json(db.dms.filter((m) => (m.from === a.id && m.to === b.id) || (m.from === b.id && m.to === a.id)));
});
app.post("/api/dm", auth, (req, res) => {
  const a = me(res), b = db.users.find((u) => u.id === req.body?.to);
  if (!b || !req.body?.text || !allowed(a, b)) return fail(res, 400, "Cannot send.");
  db.dms.push({ id: randomUUID(), from: a.id, to: b.id, text: String(req.body.text).slice(0, 2000), date: now(), read: false }); save(); ok(res);
});

// ---------- Finance ----------
app.get("/api/invoices", auth, clientOr("finance"), (_q, res) => { const u = me(res); res.json(db.invoices.filter((i) => u.role !== "client" || i.clientId === u.id).map(invOut).reverse()); });
app.post("/api/invoices", auth, staff, need("finance", "c"), (req, res) => {
  const b = req.body ?? {}, amount = Number(b.amount);
  if (!findClient(b.clientId) || !(amount > 0)) return fail(res, 400, "Choose a client and enter a valid amount.");
  const i: Row = { id: randomUUID(), number: `INV-${String(db.invoices.length + 1).padStart(4, "0")}`, clientId: b.clientId, projectId: b.projectId ?? "", amount, dueDate: b.dueDate ?? "", note: b.note ?? "", issued: now() };
  db.invoices.push(i); notify(i.clientId, `New invoice ${i.number}`); log(me(res).id, `Created invoice ${i.number}`); save(); res.json(invOut(i));
});
app.delete("/api/invoices/:id", auth, staff, need("finance", "d"), (req, res) => {
  db.invoices = db.invoices.filter((i) => i.id !== req.params.id); db.payments = db.payments.filter((p) => p.invoiceId !== req.params.id); save(); ok(res);
});
const payOut = (p: Row) => ({ ...p, clientName: nameOf(p.clientId), invoiceNumber: db.invoices.find((i) => i.id === p.invoiceId)?.number });
app.get("/api/payments", auth, clientOr("finance"), (_q, res) => { const u = me(res); res.json(db.payments.filter((p) => u.role !== "client" || p.clientId === u.id).map(payOut).reverse()); });
app.post("/api/payments", auth, (req, res) => {
  const u = me(res), b = req.body ?? {}, inv = db.invoices.find((i) => i.id === b.invoiceId), amount = Number(b.amount);
  if (!inv || !(amount > 0) || amount > invOut(inv).due) return fail(res, 400, "Invalid invoice or amount (cannot exceed the due amount).");
  const isClient = u.role === "client";
  if (isClient ? inv.clientId !== u.id : !can(u, "finance", "c")) return fail(res, 403, "Not allowed.");
  const p: Row = { id: randomUUID(), invoiceId: inv.id, clientId: inv.clientId, amount, method: b.method ?? "Bank Transfer", txn: b.txn ?? "", date: now(), status: isClient ? "pending" : "verified" };
  db.payments.push(p);
  if (isClient) notifyPerm("finance", "a", `Payment of ৳${amount} awaiting verification (${inv.number})`);
  log(u.id, `${isClient ? "Submitted" : "Recorded"} payment ৳${amount} for ${inv.number}`); save(); res.json(payOut(p));
});
const setPay = (status: string) => (req: Request, res: Response) => {
  const p = db.payments.find((x) => x.id === req.params.id);
  if (!p) return fail(res, 404, "Not found.");
  p.status = status; notify(p.clientId, `Your payment was ${status}`); log(me(res).id, `Payment ${status}`); save(); ok(res);
};
app.post("/api/payments/:id/verify", auth, staff, need("finance", "a"), setPay("verified"));
app.post("/api/payments/:id/reject", auth, staff, need("finance", "a"), setPay("rejected"));
app.post("/api/payments/:id/refund", auth, staff, need("finance", "a"), setPay("refunded"));
app.get("/api/expenses", auth, staff, need("finance", "r"), (_q, res) => res.json([...db.expenses].reverse()));
app.post("/api/expenses", auth, staff, need("finance", "c"), (req, res) => {
  const b = req.body ?? {}, amount = Number(b.amount);
  if (!b.title || !(amount > 0)) return fail(res, 400, "Title and amount are required.");
  db.expenses.push({ id: randomUUID(), title: b.title, category: b.category ?? "Other", amount, date: b.date || now() }); save(); ok(res);
});
app.delete("/api/expenses/:id", auth, staff, need("finance", "d"), (req, res) => { db.expenses = db.expenses.filter((e) => e.id !== req.params.id); save(); ok(res); });
app.get("/api/finance/summary", auth, staff, need("finance", "r"), (_q, res) => {
  const income = sum(db.payments.filter((p) => p.status === "verified").map((p) => p.amount)), expense = sum(db.expenses.map((e) => e.amount));
  res.json({ income, expense, profit: income - expense, due: sum(db.invoices.map((i) => invOut(i).due)), monthly: monthly() });
});

// ---------- Support tickets ----------
const ticketOut = (t: Row) => ({ ...t, clientName: nameOf(t.clientId), replies: t.replies.map((r: Row) => ({ ...r, name: nameOf(r.userId), staff: isStaff(db.users.find((u) => u.id === r.userId) ?? ({ role: "client" } as User)) })) });
app.get("/api/tickets", auth, clientOr("tickets"), (_q, res) => { const u = me(res); res.json(db.tickets.filter((t) => u.role !== "client" || t.clientId === u.id).map(ticketOut).reverse()); });
app.post("/api/tickets", auth, (req, res) => {
  const u = me(res), b = req.body ?? {};
  if (u.role !== "client" || !b.subject || !b.description) return fail(res, 400, "Subject and description are required.");
  if (String(b.screenshot ?? "").length > 900000) return fail(res, 400, "Screenshot is too large.");
  db.tickets.push({ id: randomUUID(), clientId: u.id, subject: b.subject, category: b.category ?? "General", priority: b.priority ?? "Medium", description: b.description, screenshot: b.screenshot ?? "", status: "open", replies: [], created: now() });
  notifyPerm("tickets", "u", `New support ticket: ${b.subject}`); log(u.id, `Opened ticket ${b.subject}`); save(); ok(res);
});
app.post("/api/tickets/:id/reply", auth, (req, res) => {
  const u = me(res), t = db.tickets.find((x) => x.id === req.params.id);
  if (!t || !req.body?.text || (u.role === "client" ? t.clientId !== u.id : !can(u, "tickets", "u"))) return fail(res, 403, "Not allowed.");
  t.replies.push({ id: randomUUID(), userId: u.id, text: String(req.body.text), date: now() });
  if (u.role !== "client") { if (t.status === "open") t.status = "in_progress"; notify(t.clientId, `Support replied to "${t.subject}"`); } else notifyPerm("tickets", "u", `Client replied on ticket "${t.subject}"`);
  save(); ok(res);
});
app.put("/api/tickets/:id", auth, (req, res) => {
  const u = me(res), t = db.tickets.find((x) => x.id === req.params.id), s = String(req.body?.status);
  if (!t || !["open", "in_progress", "resolved", "closed"].includes(s)) return fail(res, 400, "Bad request.");
  if (u.role === "client" ? t.clientId !== u.id || s !== "closed" : !can(u, "tickets", "u")) return fail(res, 403, "Not allowed.");
  t.status = s; if (u.role !== "client") notify(t.clientId, `Ticket "${t.subject}" is now ${s}`); save(); ok(res);
});

// ---------- Notifications, logs, reports ----------
app.get("/api/notifications", auth, (_q, res) => {
  const mine = db.notifications.filter((n) => n.userId === me(res).id);
  res.json({ unread: mine.filter((n) => !n.read).length, items: mine.slice(-30).reverse() });
});
app.post("/api/notifications/read", auth, (_q, res) => { db.notifications.forEach((n) => { if (n.userId === me(res).id) n.read = true; }); save(); ok(res); });
app.get("/api/logs", auth, staff, need("reports", "r"), (_q, res) => res.json(db.logs.slice(-100).reverse().map((l) => ({ ...l, who: nameOf(l.userId) }))));
app.get("/api/reports", auth, staff, need("reports", "r"), (_q, res) => {
  const count = (a: Row[], k: string) => a.reduce((o: Row, x) => { o[x[k]] = (o[x[k]] ?? 0) + 1; return o; }, {});
  res.json({ projects: count(db.projects, "status"), tasks: count(db.tasks, "status"), payments: count(db.payments, "status"), tickets: count(db.tickets, "status"), invoices: count(db.invoices.map(invOut), "status"), clients: count(db.users.filter((u) => u.role === "client"), "status"), monthly: monthly() });
});

// ---------- Roles & settings ----------
app.get("/api/roles", auth, staff, need("roles", "r"), (_q, res) => res.json({ perms: db.perms, modules: MODULES }));
app.put("/api/roles", auth, staff, (req, res) => {
  if (me(res).role !== "super_admin") return fail(res, 403, "Only the Super Admin can change permissions.");
  const next: Row = {};
  for (const r of STAFF_ROLES.filter((x) => x !== "super_admin")) {
    next[r] = {};
    for (const m of MODULES) next[r][m] = String(req.body?.perms?.[r]?.[m] ?? "").split("").filter((c, i, a) => "crud a".includes(c) && c !== " " && a.indexOf(c) === i).join("");
  }
  db.perms = next; log(me(res).id, "Updated role permissions"); save(); ok(res);
});
app.put("/api/settings", auth, staff, need("settings", "u"), (req, res) => { Object.assign(db.settings, pick(req.body ?? {}, ["siteName", "tagline", "email", "phone", "address"])); save(); res.json(db.settings); });
app.get("/api/contacts", auth, staff, need("settings", "r"), (_q, res) => res.json([...db.contacts].reverse()));
app.delete("/api/contacts/:id", auth, staff, need("settings", "d"), (req, res) => { db.contacts = db.contacts.filter((c) => c.id !== req.params.id); save(); ok(res); });

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
