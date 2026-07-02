import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Send } from "lucide-react";
import { sfx } from "@/lib/game/sfx";

type ChatMsg = {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  at: number;
};

type Props = {
  channel: RealtimeChannel | null;
  myUserId: string;
  myName: string;
  myColor: string;
  canSend: boolean; // dead players cannot send
};

export function MeetingChat({ channel, myUserId, myName, myColor, canSend }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channel) return;
    const handler = (payload: { payload: ChatMsg }) => {
      setMessages((prev) => [...prev.slice(-49), payload.payload]);
      if (payload.payload.userId !== myUserId) sfx.chat();
    };
    channel.on("broadcast", { event: "chat" }, handler);
    // No off() for a specific handler — the parent tears the channel down.
  }, [channel, myUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send() {
    const t = text.trim();
    if (!t || !channel || !canSend) return;
    const msg: ChatMsg = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      name: myName,
      color: myColor,
      text: t.slice(0, 200),
      at: Date.now(),
    };
    channel.send({ type: "broadcast", event: "chat", payload: msg });
    setMessages((prev) => [...prev.slice(-49), msg]);
    setText("");
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-black/40 flex flex-col h-56">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            No messages yet. Accuse. Defend. Deceive.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="leading-snug">
            <span className="font-semibold" style={{ color: m.color }}>
              {m.name}:
            </span>{" "}
            <span className="text-foreground/90">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-2 border-t border-border">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          disabled={!canSend}
          placeholder={canSend ? "Speak your mind…" : "The dead cannot speak"}
          maxLength={200}
          className="flex-1 bg-secondary/40 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blood disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!canSend || !text.trim()}
          className="px-3 rounded bg-blood text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
