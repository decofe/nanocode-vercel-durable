"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

type Item = { kind: "user" | "assistant" | "tool" | "note"; text: string };

type Saved = { session?: string; cursor?: string; items: Item[]; open?: boolean };

type Live = { type: string; delta?: string; name?: string; args?: unknown; status?: string; result?: string | { text?: string }; error?: unknown; message?: string; effect?: string };

const KEY = "nanocode-vercel-durable";

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [session, setSession] = useState<string>();
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const cursor = useRef<string | undefined>(undefined);

  const save = (next: Partial<Saved>) => {
    const saved: Saved = { items: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), ...next };
    localStorage.setItem(KEY, JSON.stringify(saved));
  };

  const update = (change: (items: Item[]) => Item[]) => setItems(current => {
    const next = change(current);
    save({ items: next });
    return next;
  });

  const apply = (event: Live) => {
    if (event.type === "text" && event.delta) update(current => current.at(-1)?.kind === "assistant" ? [...current.slice(0, -1), { kind: "assistant", text: current.at(-1)!.text + event.delta }] : [...current, { kind: "assistant", text: event.delta! }]);
    else if (event.type === "tool_start") update(current => [...current, { kind: "tool", text: `→ ${event.name} ${JSON.stringify(event.args)}` }]);
    else if (event.type === "tool_end") update(current => [...current, { kind: "tool", text: `← ${event.name} ${event.status}: ${typeof event.result === "string" ? event.result : event.result?.text ?? ""}` }]);
    else if (event.type === "turn" && event.status !== "completed") update(current => [...current, { kind: "note", text: `turn ${event.status}: ${JSON.stringify(event.error ?? "")}` }]);
    else if (event.type === "error") update(current => [...current, { kind: "note", text: `error: ${event.message ?? JSON.stringify(event)}` }]);
    else if (event.type === "chaos") update(current => [...current, { kind: "note", text: `the Function died during ${event.effect ?? "an effect"}: the next delivery resumes the turn from the log` }]);
  };

  const headers = (): HeadersInit => token ? { authorization: `Bearer ${token}` } : {};

  const follow = async (response: Response): Promise<boolean> => {
    if (!response.ok || !response.body) {
      const detail = await response.text();
      update(current => [...current, { kind: "note", text: `${response.status} ${detail}` }]);
      return true;
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffered = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return false;
      buffered += value;
      let end: number;
      while ((end = buffered.indexOf("\n\n")) >= 0) {
        const block = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        let name = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("id:")) {
            cursor.current = line.slice(3).trim() || cursor.current;
            save({ cursor: cursor.current });
          } else if (line.startsWith("event:")) name = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (name === "end") return true;
        if (data) apply(JSON.parse(data) as Live);
      }
    }
  };

  const reconnect = async (id: string) => {
    while (cursor.current) {
      const settled = await follow(await fetch(`/api/chat?sessionId=${encodeURIComponent(id)}&cursor=${encodeURIComponent(cursor.current)}`, { headers: headers() })).catch(() => false);
      if (settled) return;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  useEffect(() => {
    const saved: Saved = { items: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    setItems(saved.items);
    setSession(saved.session);
    cursor.current = saved.cursor;
    setToken(localStorage.getItem(`${KEY}:token`) ?? "");
    if (saved.open && saved.session) {
      setBusy(true);
      void reconnect(saved.session).finally(() => { save({ open: false }); setBusy(false); });
    }
  }, []);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    update(current => [...current, { kind: "user", text }]);
    save({ open: true });
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json", ...headers() }, body: JSON.stringify({ sessionId: session, text }) });
      const id = response.headers.get("x-session-id") ?? session;
      if (id && id !== session) {
        setSession(id);
        save({ session: id });
      }
      if (!(await follow(response)) && id) await reconnect(id);
    } finally {
      save({ open: false });
      setBusy(false);
    }
  };

  const crash = async () => {
    if (!session) return;
    const response = await fetch("/api/chaos", { method: "POST", headers: { "content-type": "application/json", ...headers() }, body: JSON.stringify({ sessionId: session, at: "tool" }) });
    update(current => [...current, { kind: "note", text: response.ok ? "armed: the next tool call kills its Function" : `${response.status} ${response.statusText}` }]);
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    cursor.current = undefined;
    setSession(undefined);
    setItems([]);
  };

  const colors: Record<Item["kind"], string> = { user: "#9ecbff", assistant: "#ededed", tool: "#a3a3a3", note: "#f5a524" };
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>nanocode on durable-harness</h1>
      <p style={{ color: "#a3a3a3", fontSize: 14 }}>Session {session ?? "not started"}. Every SQL commit of the nanocode agent is a step in this session&apos;s Workflow run: kill the Function mid-turn and the next delivery continues from the log.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="access token (CHAT_TOKEN)" value={token} onChange={event => { setToken(event.target.value); localStorage.setItem(`${KEY}:token`, event.target.value); }} style={{ flex: 1, padding: 6 }} />
        <button onClick={crash} disabled={!session}>Kill the next tool call</button>
        <button onClick={reset} disabled={busy}>New session</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
        {items.map((item, index) => <div key={index} style={{ color: colors[item.kind], whiteSpace: "pre-wrap" }}>{item.kind === "user" ? "> " : ""}{item.text}</div>)}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder={busy ? "working…" : "Ask nanocode"} style={{ flex: 1, padding: 8 }} />
        <button type="submit" disabled={busy}>Send</button>
      </form>
    </main>
  );
}
