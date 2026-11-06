import express from "express";
import fs from "node:fs";
import path from "node:path";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const FILE = path.resolve("messages.json");

app.use(express.json());

type Message = { name: string; email: string; message: string; date: string };

const load = (): Message[] =>
  fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];

app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body ?? {};
  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please fill all fields correctly." });
  }
  const all = load();
  all.push({ name, email, message, date: new Date().toISOString() });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  res.json({ ok: true });
});

const dist = path.resolve("dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
