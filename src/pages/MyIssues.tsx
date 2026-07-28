import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { addIssueReply } from '../lib/firestore';
import type { IssueReport } from '../types';
import { CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';
import { TiltCard } from '../components/motion/TiltCard';

export default function MyIssues() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'issueReports'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IssueReport));
      setIssues(items);
      setLoading(false);
    }, (err) => {
      console.error('Issue reports subscription error:', err);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, issues]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 rounded-[2.5rem]" />
        <div className="skeleton h-32 rounded-[2.5rem]" />
      </div>
    );
  }

  const totalIssues = issues.length;
  const adminReplied = issues.filter((r) => (r.replies ?? []).some((reply) => reply.authorRole === 'admin' || reply.authorRole === 'super_admin')).length;
  const closedIssues = issues.filter((r) => r.status === 'resolved').length;

  return (
    <AnimatedPage>
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="rounded-card bg-gradient-to-br from-primary/5 via-primary-light/5 to-success/5 border border-primary/10 shadow-card px-4 py-3 text-center">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">SB Connect</p>
          <h1 className="text-fluid-h1 font-bold gradient-text tracking-tight">My Reports</h1>
          <p className="text-steel text-sm">Track your issue reports and admin replies</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Issues Reported</p>
              <p className="text-lg font-bold gradient-text">{totalIssues}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Admin Replied</p>
              <p className="text-lg font-bold text-primary">{adminReplied}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Issues Closed</p>
              <p className="text-lg font-bold text-success">{closedIssues}</p>
            </div>
          </div>
        </div>

        {issues.length === 0 ? (
          <TiltCard>
          <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card">
          <CardContent className="p-14 text-center">
              <p className="text-muted">No reports yet. Use the Report Issue button on any page to submit feedback.</p>
          </CardContent>
          </div>
          </TiltCard>
        ) : (
          <StaggerList className="space-y-3">
            {issues.map((r) => {
              const ticketId = `#${r.id.slice(0, 8)}`;
              const adminReplies = (r.replies ?? []).filter(
                (reply) => reply.authorRole === 'admin' || reply.authorRole === 'super_admin',
              );
              const unreadReply = adminReplies.length > 0 && adminReplies.some(
                (reply) => reply.createdAt > (r.updatedAt || r.createdAt),
              );
              return (
                <StaggerItem key={r.id}>
                  <TiltCard>
                  <div
                    ref={r.id === highlightId ? highlightRef : undefined}
                    className={`stat-accent-top rounded-card bg-surface border shadow-card transition-all duration-300 ${
                      r.id === highlightId ? 'border-primary ring-2 ring-primary-ring' : 'border-border'
                    }`}
                  >
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'open' ? 'bg-danger' : 'bg-success'}`} />
                            <p className="text-sm font-semibold text-charcoal">{r.subject}</p>
                            <span className="text-[10px] font-mono text-muted bg-muted-bg px-1.5 py-0.5 rounded shrink-0">{ticketId}</span>
                            {unreadReply && (
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" title="New admin reply" />
                            )}
                          </div>
                          <p className="text-xs text-steel">{r.description}</p>
                          <p className="text-[10px] text-muted font-mono">
                            {new Date(r.createdAt).toLocaleString('en-IN')}
                            {r.page && ` · on ${r.page}`}
                          </p>
                        </div>
                        <Badge variant={r.status === 'open' ? 'danger' : 'success'} className="shrink-0">
                          {r.status}
                        </Badge>
                      </div>

                      {(r.replies ?? []).length > 0 && (
                        <div className="space-y-2 pl-3 border-l-2 border-border">
                          {(r.replies ?? []).map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <span className={`text-[11px] font-semibold shrink-0 mt-0.5 ${
                                reply.authorRole === 'super_admin' || reply.authorRole === 'admin'
                                  ? 'text-primary'
                                  : 'text-steel'
                              }`}>
                                {reply.authorRole === 'super_admin' || reply.authorRole === 'admin'
                                  ? 'Admin'
                                  : reply.authorName}
                                {reply.authorRole !== 'user' && (
                                  <span className="ml-1 px-1 py-0.5 text-[9px] font-medium rounded bg-primary-light text-primary">Staff</span>
                                )}
                              </span>
                              <p className="text-xs text-charcoal">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {r.status === 'open' && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Type a reply..."
                            className="flex-1 min-w-0 rounded-[0.75rem] border border-border px-3 py-2 text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-ring"
                            value={replyTexts[r.id] ?? ''}
                            onChange={(e) => setReplyTexts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          />
                          <Button
                            size="xs"
                            variant="primary"
                            loading={replyingId === r.id}
                            onClick={async () => {
                              const text = replyTexts[r.id]?.trim();
                              if (!text) return;
                              setReplyingId(r.id);
                              try {
                                const reply = await addIssueReply(r.id, text, user!.uid, profile?.displayName || user?.displayName || 'You', 'user');
                                setIssues((prev) => prev.map((x) => x.id === r.id ? { ...x, replies: [...(x.replies ?? []), reply] } : x));
                                setReplyTexts((prev) => ({ ...prev, [r.id]: '' }));
                              } catch {}
                              setReplyingId(null);
                            }}
                          >
                            Send
                          </Button>
                        </div>
                      )}

                      {r.adminNote && (
                        <p className="text-[11px] text-muted italic border-t border-border pt-2 mt-1">
                          Admin note: {r.adminNote}
                        </p>
                      )}
                    </CardContent>
                  </div>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
      </div>
    </AnimatedPage>
  );
}