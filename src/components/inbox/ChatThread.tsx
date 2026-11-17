"use client";

import { useEffect, useRef, useState } from "react";
import {
  bubbleClass,
  formatStatus,
  formatTime,
  senderLabel,
  type SolarConversation,
  type SolarMessage,
} from "@/lib/dashboard";

interface Props {
  conversation: SolarConversation | null;
  messages: SolarMessage[];
  sending: boolean;
  closing: boolean;
  onSend: (text: string) => Promise<boolean>;
  onClose: () => void;
  onBack: () => void;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function ChatThread({
  conversation,
  messages,
  sending,
  closing,
  onSend,
  onClose,
  onBack,
}: Props) {
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    stickToBottom.current = true;
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
    setText("");
  }, [conversation?.id]);

  useEffect(() => {
    const box = boxRef.current;
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [messages]);

  async function submit() {
    const value = text.trim();
    if (!value || sending) return;
    if (await onSend(value)) setText("");
  }

  const lastInAt = messages.reduce(
    (latest, message) =>
      message.dir === "in" && message.at > latest ? message.at : latest,
    0
  );
  const inWindow = lastInAt > 0 && Date.now() - lastInAt < WINDOW_MS;
  const note = !conversation
    ? ""
    : inWindow || !lastInAt
      ? "Sends straight to the customer. Does not change the team handoff or alerts."
      : "⚠ Customer last messaged over 24h ago — WhatsApp may reject a free-text reply.";

  return (
    <section id="chat">
      <div id="chead">
        <button type="button" className="ghost back" onClick={onBack}>
          ←
        </button>
        <div id="ctitle" style={{ flex: 1 }}>
          {conversation ? (
            <>
              <b>{conversation.name || "Customer"}</b>{" "}
              <span className={`tag ${conversation.status}`}>
                {formatStatus(conversation.status)}
              </span>
              <br />
              <small>
                {`+${conversation.phone}${
                  conversation.reason ? ` · ${conversation.reason}` : ""
                }`}
              </small>
            </>
          ) : (
            <b>Select a chat</b>
          )}
        </div>
        {conversation?.hasOpen && (
          <button
            type="button"
            className="ghost"
            onClick={onClose}
            disabled={closing}
          >
            Close chat
          </button>
        )}
      </div>

      <div
        id="msgs"
        ref={boxRef}
        onScroll={(event) => {
          const box = event.currentTarget;
          stickToBottom.current =
            box.scrollHeight - box.scrollTop - box.clientHeight < 80;
        }}
      >
        {!conversation ? (
          <div className="empty">Pick a conversation from the list.</div>
        ) : messages.length ? (
          messages.map((message) => (
            <div key={message.id} className={`m ${bubbleClass(message)}`}>
              {message.text}
              <small>
                {`${senderLabel(message.kind)} · ${formatTime(message.at)}`}
              </small>
            </div>
          ))
        ) : (
          <div className="empty">No recorded messages for this chat yet.</div>
        )}
      </div>

      <div id="note">{note}</div>

      <div id="compose">
        <textarea
          id="txt"
          placeholder="Reply to customer…"
          value={text}
          disabled={!conversation}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          id="send"
          type="button"
          disabled={!conversation || sending}
          onClick={() => void submit()}
        >
          Send
        </button>
      </div>
    </section>
  );
}
