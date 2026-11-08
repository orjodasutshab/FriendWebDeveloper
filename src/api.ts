import { useCallback, useEffect, useState } from "react";

export type Row = Record<string, any>;
export type User = { id: string; username: string; name: string; email: string; phone: string; photo: string; skills: string[]; experience: string; portfolio: string; social: Record<string, string>; position: string; department: string; status: string; role: string; joined: string; company?: string; address?: string; managerId?: string; perms?: Record<string, string>; loginHistory?: Row[] };
export type Project = Row;
export type Task = Row;
export type Notice = { id: string; title: string; body: string; kind: "notice" | "announcement"; date: string; author: string };
export type Application = { id: string; name: string; email: string; phone: string; skills: string; cv: string; portfolio: string; message: string; status: "pending" | "approved" | "rejected"; date: string };
export type Contact = { id: string; name: string; email: string; message: string; date: string };
export type Settings = { siteName: string; tagline: string; email: string; phone: string; address: string };

export const can = (u: User | null | undefined, m: string, a: string) => !!u && (u.role === "super_admin" || (u.perms?.[m] ?? "").includes(a));
export const getToken = () => sessionStorage.getItem("fwd_token") ?? "";

export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j as T;
}

export function useLoad<T>(path: string, init: T) {
  const [data, setData] = useState<T>(init);
  const reload = useCallback(() => { api<T>(path).then(setData).catch(() => {}); }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return [data, reload] as const;
}
