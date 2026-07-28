import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToMessages, sendMessage, markConversationRead, deleteOldMessages } from '../lib/firestore';
import type { Message } from '../types';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function ChatDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    deleteOldMessages(id).catch(console.error);
    const unsub = subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (id && user) {
      markConversationRead(id, user.uid);
    }
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !id || !user || sending) return;
    setSending(true);
    try {
      await sendMessage(id, user.uid, text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto h-[calc(100dvh-10rem)] flex flex-col pb-14 lg:pb-0">
      <Link to="/chat" className="text-sm text-primary hover:text-primary-hover mb-4 inline-block transition-colors">
        &larr; Back to Messages
      </Link>

      <div className="text-[11px] text-muted font-mono tracking-tight text-center mb-2">
        Messages are automatically deleted after 30 days
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              No messages yet. Send a message to start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-5 py-3 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-muted-bg text-charcoal rounded-bl-md'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.text}</p>
                    <div
                      className={`flex items-center gap-1.5 mt-1.5 ${
                        isMe ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono ${
                          isMe ? 'text-white/60' : 'text-muted'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMe && (
                        <svg
                          className={`w-3 h-3 ${msg.read ? 'text-white' : 'text-white/40'}`}
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-border">
          <form onSubmit={handleSend} className="flex gap-3">
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="px-5 py-2.5 bg-primary text-white rounded-[0.75rem] hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium active:scale-[0.97] cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </Card>
    </div>
    </AnimatedPage>
  );
}
