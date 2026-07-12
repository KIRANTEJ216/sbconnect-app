import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRequest, expressInterest, getInterests, awardDeal } from '../lib/firestore';
import { getBusinessProfile } from '../lib/firestore';
import { getUserProfile } from '../lib/auth';
import { formatDate, formatDateStr, formatCurrency } from '../lib/format';
import type { Request, UserProfile, Interest } from '../types';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [requester, setRequester] = useState<UserProfile | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [interestPhones, setInterestPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestMessage, setInterestMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const r = await getRequest(id);
      setRequest(r);
      if (r) {
        const [up, ints] = await Promise.all([
          getUserProfile(r.uid),
          getInterests(id),
        ]);
        setRequester(up);
        setInterests(ints);
        const phones: Record<string, string> = {};
        await Promise.all(ints.map(async (int) => {
          const bp = await getBusinessProfile(int.uid);
          if (bp?.phone) phones[int.uid] = bp.phone;
        }));
        setInterestPhones(phones);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const BLOCKED_WORDS = ['fuck', 'shit', 'ass', 'bastard', 'damn', 'bitch', 'crap', 'dick', 'piss', 'slut', 'whore', 'cock', 'cunt', 'douche'];

  const containsProfanity = (text: string) => {
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
  };

  const handleExpressInterest = async () => {
    if (!user || !id || !request) return;
    if (!interestMessage.trim()) {
      setError('Please include a message.');
      return;
    }
    if (containsProfanity(interestMessage)) {
      setError('Please keep your message professional. Abusive language is not allowed.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const bp = await getBusinessProfile(user.uid);
      const companyName = bp?.companyName || user.displayName || 'Unknown';
      const phone = bp?.phone || '';
      const msg = `${interestMessage}\n\nReach me at: ${phone}`;
      await expressInterest(id, user.uid, companyName, phone, msg);
      setSuccess('Interest submitted! The requester will review it.');
      setInterestMessage('');
      setShowInterestForm(false);
      const updatedInts = await getInterests(id);
      setInterests(updatedInts);
      const phones: Record<string, string> = {};
      await Promise.all(updatedInts.map(async (int) => {
        const bp = await getBusinessProfile(int.uid);
        if (bp?.phone) phones[int.uid] = bp.phone;
      }));
      setInterestPhones(phones);
    } catch (err) {
      console.error('Failed to express interest:', err);
      setError('Failed to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAward = async (interest: Interest) => {
    if (!user || !id || !request) return;
    setClosing(true);
    setError('');
    try {
      await awardDeal(
        id,
        request.title,
        request.uid,
        request.companyName,
        interest.uid,
        interest.companyName,
        request.budget || '0',
      );
      setRequest({ ...request, status: 'closed', awardedTo: interest.uid });
      setSuccess(`🎉 Congratulations! Deal awarded to ${interest.companyName}!`);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Failed to award deal:', err);
      setError('Failed to award deal. Try again.');
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-64 rounded-[2.5rem]" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-charcoal tracking-tight">Request Not Found</h2>
        <Link to="/requests" className="text-primary hover:text-primary-hover text-sm mt-4 inline-block transition-colors">
          Back to Requests
        </Link>
      </div>
    );
  }

  const displayCategory = request.category === 'Other' && request.customCategory
    ? request.customCategory
    : request.category;
  const isOwner = user?.uid === request.uid;
  const hasInterested = !isOwner && interests.some((i) => i.uid === user?.uid);

  return (
    <AnimatedPage>
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/requests" className="text-sm text-primary hover:text-primary-hover inline-block transition-colors">
        &larr; Back to Requests
      </Link>

      {success && (
        <div className="px-4 py-3 rounded-2xl bg-success-light text-success border border-success/20 text-sm">{success}</div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-2xl bg-danger-light text-danger border border-danger/20 text-sm">{error}</div>
      )}

      <TiltCard>
      <Card>
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="accent">{displayCategory}</Badge>
            <Badge variant={request.status === 'open' ? 'success' : 'neutral'}>
              {request.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
            {request.awardedTo && (
              <Badge variant="success">Deal Awarded</Badge>
            )}
          </div>
          <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">{request.title}</h1>
          <p className="text-steel mt-5 leading-relaxed">{request.description}</p>

          {(request.budget || request.deadline) && (
            <div className="mt-6 flex flex-wrap gap-6">
              {request.budget && (
                <div>
                  <span className="text-xs text-muted font-mono tracking-tight uppercase">Budget</span>
                  <p className="text-sm font-medium text-charcoal mt-0.5">{formatCurrency(request.budget)}</p>
                </div>
              )}
              {request.deadline && (
                <div>
                  <span className="text-xs text-muted font-mono tracking-tight uppercase">Deadline</span>
                  <p className="text-sm font-medium text-charcoal mt-0.5">{formatDateStr(request.deadline)}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-steel">
                  Posted by {request.companyName}
                </p>
                <p className="text-xs text-muted font-mono mt-1 tracking-tight">
                  {formatDate(request.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!isOwner && request.status === 'open' && (
                  <>
                    {hasInterested ? (
                      <>
                        {requester?.phone && (
                          <a
                            href={`tel:${requester.phone}`}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-[0.75rem] bg-primary text-white hover:bg-primary-hover transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            Call
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        {requester?.phone && (
                          <a
                            href={`tel:${requester.phone}`}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-[0.75rem] bg-primary text-white hover:bg-primary-hover transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            Call
                          </a>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setShowInterestForm(true)}>
                          Express Interest
                        </Button>
                      </>
                    )}
                  </>
                )}
                {isOwner && request.status === 'open' && interests.length === 0 && (
                  <Button size="sm" variant="outline" disabled>
                    No Interest Yet
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </TiltCard>

      {showInterestForm && (
        <TiltCard>
        <Card>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <h3 className="font-semibold text-charcoal tracking-tight mb-4">Express Interest</h3>
            <textarea
              className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all resize-none"
              rows={3}
              placeholder="Tell the requester why you're interested and how you can help..."
              value={interestMessage}
              onChange={(e) => setInterestMessage(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={handleExpressInterest} loading={submitting}>Submit Interest</Button>
              <Button variant="outline" onClick={() => { setShowInterestForm(false); setError(''); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
        </TiltCard>
      )}

      {isOwner && request.status === 'open' && interests.length > 0 && (
        <TiltCard>
        <Card>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <h3 className="font-semibold text-charcoal tracking-tight mb-4">
              Interested Parties ({interests.length})
            </h3>
            <div className="space-y-3">
              {interests.map((int) => (
                <div key={int.id} className="p-4 rounded-2xl border border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal text-sm">{int.companyName}</p>
                      <p className="text-sm text-steel mt-0.5">{int.message}</p>
                      <p className="text-xs text-muted font-mono mt-1 tracking-tight">{formatDate(int.createdAt)}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAward(int)} loading={closing}>
                      Award Contract
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    {interestPhones[int.uid] && (
                      <a
                        href={`tel:${interestPhones[int.uid]}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-[0.5rem] bg-primary text-white hover:bg-primary-hover transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        {interestPhones[int.uid]}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </TiltCard>
      )}
    </div>
    </AnimatedPage>
  );
}
