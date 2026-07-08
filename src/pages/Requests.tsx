import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAllRequests, getBusinessProfile, updateBusinessProfile, expressInterest, closeRequest } from '../lib/firestore';
import { formatDate, formatDateStr, formatCurrency } from '../lib/format';
import type { Request } from '../types';
import { REQUEST_CATEGORIES } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [closingId, setClosingId] = useState<string | null>(null);
  const [pitching, setPitching] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getAllRequests()
      .then(setRequests)
      .finally(() => setLoading(false));
    if (user) {
      updateBusinessProfile(user.uid, { lastRequestsViewedAt: Date.now() }).catch(console.error);
    }
  }, [user]);

  const filtered = selectedCategory
    ? requests.filter((r) => r.category === selectedCategory)
    : requests;

  const handlePitch = async (req: Request) => {
    if (!user) return;
    if (req.interestedUids?.includes(user.uid)) {
      setError('You have already pitched for this request');
      return;
    }
    setPitching(req.id);
    try {
      const bp = await getBusinessProfile(user.uid);
      const companyName = bp?.companyName || user.displayName || 'Unknown';
      const phone = bp?.phone || '';
      const msg = `Hi, I'm from ${companyName}. Reach me at ${phone} — let's connect!`;
      await expressInterest(req.id, user.uid, companyName, phone, msg);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, interestCount: r.interestCount + 1, interestedUids: [...(r.interestedUids ?? []), user.uid] } : r,
        ),
      );
    } catch (err: any) {
      console.error('Failed to pitch:', err);
      setError(err?.message || 'Failed to pitch');
    } finally {
      setPitching(null);
    }
  };

  const handleClose = async (reqId: string) => {
    setClosingId(reqId);
    try {
      await closeRequest(reqId);
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'closed' } : r)),
      );
    } catch (err) {
      console.error('Failed to close:', err);
    } finally {
      setClosingId(null);
    }
  };

  const myReqs = filtered.filter((r) => r.uid === user?.uid);
  const openReqs = filtered.filter((r) => r.uid !== user?.uid && r.status === 'open');

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-charcoal tracking-tight">Requests</h1>
          <p className="text-steel mt-1.5 gradient-text">Browse business requests and opportunities</p>
        </div>
        <Link to="/requests/create">
          <Button>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Request
          </Button>
        </Link>
      </div>

      {error && (
        <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card bg-surface border border-border shadow-card p-5">
          <p className="text-sm text-muted font-semibold tracking-tight mb-2">My Requests</p>
          <p className="text-3xl font-bold text-charcoal tracking-tight">{myReqs.length}</p>
        </div>
        <div className="rounded-card bg-surface border border-border shadow-card p-5">
          <p className="text-sm text-muted font-semibold tracking-tight mb-2">Open Requests</p>
          <p className="text-3xl font-bold text-charcoal tracking-tight">{openReqs.length}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 text-sm rounded-[0.75rem] border transition-all duration-200 cursor-pointer ${
            !selectedCategory
              ? 'bg-primary text-white border-primary font-medium'
              : 'border-border text-steel hover:border-primary'
          }`}
        >
          All
        </button>
        {REQUEST_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`px-4 py-2 text-sm rounded-[0.75rem] border transition-all duration-200 cursor-pointer ${
              selectedCategory === c
                ? 'bg-primary text-white border-primary font-medium'
                : 'border-border text-steel hover:border-primary'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-[2.5rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-14 text-center">
            <p className="text-muted">No requests found{selectedCategory ? ` in ${selectedCategory}` : ''}.</p>
            <Link to="/requests/create" className="text-primary hover:text-primary-hover text-sm mt-3 inline-block transition-colors">
              Create the first request
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {myReqs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-charcoal tracking-tight mb-3">My Requests</h2>
              <StaggerList className="space-y-2">
                {myReqs.map((req) => {
                  return (
                  <StaggerItem key={req.id}>
                  <div
                    onClick={() => navigate(`/requests/${req.id}`)}
                    className={`block transition-all duration-300 cursor-pointer hover:-translate-y-0.5 ${
                      req.status === 'closed' ? 'opacity-60' : ''
                    }`}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant={req.status === 'open' ? 'success' : 'neutral'}>
                              {req.status === 'open' ? 'Open' : 'Closed'}
                            </Badge>
                            <Badge variant="accent">{req.category}</Badge>
                            {req.interestCount > 0 && (
                              <Badge variant="neutral">{req.interestCount} interest{req.interestCount !== 1 ? 's' : ''}</Badge>
                            )}
                            {req.awardedTo && (
                              <Badge variant="success">Awarded</Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-charcoal tracking-tight text-sm">{req.title}</h3>
                          <p className="text-xs text-steel mt-1 line-clamp-1">{req.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-muted tracking-tight">
                            <span>{req.companyName}</span>
                            <span>&middot;</span>
                            <span>{formatDate(req.createdAt)}</span>
                            {req.budget && (
                              <>
                                <span>&middot;</span>
                                <span>{formatCurrency(req.budget)}</span>
                              </>
                            )}
                            {req.deadline && (
                              <>
                                <span>&middot;</span>
                                <span>Due {formatDateStr(req.deadline)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {req.status === 'open' && (
                          <div className="flex items-center justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => handleClose(req.id)}
                              loading={closingId === req.id}
                            >
                              Close
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  </StaggerItem>
                  );
                })}
              </StaggerList>
            </section>
          )}

          {openReqs.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-charcoal tracking-tight mb-3">Open Requests</h2>
              <StaggerList className="space-y-2">
                {openReqs.map((req) => {
                  return (
                  <StaggerItem key={req.id}>
                  <div
                    onClick={() => navigate(`/requests/${req.id}`)}
                    className="block transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <Badge variant="success">Open</Badge>
                            <Badge variant="accent">{req.category}</Badge>
                            {req.interestCount > 0 && (
                              <Badge variant="neutral">{req.interestCount} interest{req.interestCount !== 1 ? 's' : ''}</Badge>
                            )}
                            {req.awardedTo && (
                              <Badge variant="success">Awarded</Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-charcoal tracking-tight text-sm">{req.title}</h3>
                          <p className="text-xs text-steel mt-1 line-clamp-1">{req.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-muted tracking-tight">
                            <span>{req.companyName}</span>
                            <span>&middot;</span>
                            <span>{formatDate(req.createdAt)}</span>
                            {req.budget && (
                              <>
                                <span>&middot;</span>
                                <span>{formatCurrency(req.budget)}</span>
                              </>
                            )}
                            {req.deadline && (
                              <>
                                <span>&middot;</span>
                                <span>Due {formatDateStr(req.deadline)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          {req.interestedUids?.includes(user?.uid ?? '') ? (
                            <div className="flex items-center gap-1.5">
                              {req.requesterPhone && (
                                <a
                                  href={`tel:${req.requesterPhone}`}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-[0.5rem] bg-primary text-white hover:bg-primary-hover transition-colors"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                  Call
                                </a>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handlePitch(req)}
                              loading={pitching === req.id}
                            >
                              Pitch
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  </StaggerItem>
                  );
                })}
              </StaggerList>
            </section>
          )}
        </>
      )}
    </div>
    </AnimatedPage>
  );
}
