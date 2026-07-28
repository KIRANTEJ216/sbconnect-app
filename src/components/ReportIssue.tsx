import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { reportIssue } from '../lib/firestore';

export default function ReportIssue() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim() || !user) return;
    setSending(true);
    try {
      await reportIssue({
        uid: user.uid,
        userEmail: user.email || '',
        userDisplayName: profile?.displayName || user.email?.split('@')[0] || '',
        companyName: profile?.displayName || '',
        page: location.pathname,
        subject: subject.trim(),
        description: description.trim(),
      });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setSubject(''); setDescription(''); }, 2000);
    } catch {
      // error tracked globally
    }
    setSending(false);
  };

  return (
    <>
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,.4); } 70% { box-shadow: 0 0 0 14px rgba(59,130,246,0); } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } }
        @keyframes wiggle { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-10deg); } 40% { transform: rotate(8deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(4deg); } }
        @keyframes antenna-l { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes antenna-r { 0%,100% { transform: rotate(5deg); } 50% { transform: rotate(-5deg); } }
        .issue-btn { animation: float 3s ease-in-out infinite, pulse-ring 2s ease-in-out infinite; }
        .issue-btn:hover { animation: wiggle 0.5s ease-in-out; }
        .ant-l { transform-origin: 8px 10px; animation: antenna-l 2s ease-in-out infinite; }
        .ant-r { transform-origin: 16px 10px; animation: antenna-r 2s ease-in-out infinite; }
      `}</style>
      <button
        onClick={() => setOpen(true)}
        className="issue-btn fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-btn hover:shadow-btn-hover transition-all duration-200 flex items-center justify-center"
        aria-label="Report an issue"
        title="Report an issue"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="6" />
          <circle cx="9" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
          <path d="M8 8.5 Q6 5 4 6" className="ant-l" strokeWidth="1.5" />
          <path d="M16 8.5 Q18 5 20 6" className="ant-r" strokeWidth="1.5" />
          <path d="M6 15 Q3 17 2 16" strokeWidth="1.2" />
          <path d="M18 15 Q21 17 22 16" strokeWidth="1.2" />
          <path d="M6 13 Q3 12 2 11" strokeWidth="1.2" />
          <path d="M18 13 Q21 12 22 11" strokeWidth="1.2" />
          <path d="M6 17 Q4 20 3 19" strokeWidth="1.2" />
          <path d="M18 17 Q20 20 21 19" strokeWidth="1.2" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => { if (!done) setOpen(false); }}>
          <div
            className="bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-auto p-5 shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-success-light flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-semibold text-charcoal">Report sent</p>
                <p className="text-sm text-steel mt-1">Admin will review it shortly.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold text-lg text-charcoal">Report an Issue</h3>
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-muted-bg transition-colors" aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-charcoal mb-1 block">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Can't upload photo"
                      className="w-full rounded-[0.625rem] border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary-ring"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-charcoal mb-1 block">Describe the issue</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What happened? What were you trying to do?"
                      rows={4}
                      className="w-full rounded-[0.625rem] border border-border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
                      maxLength={1000}
                    />
                    <p className="text-[10px] text-muted text-right mt-0.5">{description.length}/1000</p>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!subject.trim() || !description.trim() || sending}
                    className="w-full rounded-[0.625rem] bg-primary text-white font-semibold text-sm px-5 py-2.5 shadow-btn hover:shadow-btn-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
