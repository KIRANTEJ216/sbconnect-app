import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserRequests, recordDeal, getMyNotifications, getAwardedRequests, submitReferralRevenue, countsTowardDealsTotal } from '../lib/firestore';
import { useProfiles, useRequestsQuery, useBusinessProfile, useTotalBusinessValue, useRevenueConfig, useAllDealsQuery, useTotalReferralRevenue, useMyRevenueEntries, usePendingRevenueTotalsQuery, useDealsWonCount } from '../hooks/useFirebaseQuery';
import type { UserNotification, Request as BusinessRequest } from '../types';
import { formatDate, formatCompactINR, formatINR, toCompactINR, getFinancialYear } from '../lib/format';
import { buildBusinessLeaderboard, toLeaderboardDeal } from '../lib/leaderboard';
import { Card, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { DashboardUpdates } from '../components/DashboardUpdates';


/** How many members the Business Leaderboard ranks. */
const LEADERBOARD_TOP_N = 3;

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: myProfile } = useBusinessProfile(user?.uid);
  const { data: allBusinesses = [] } = useProfiles(200);
  const { data: allReqs = [] } = useRequestsQuery();
  const { data: allDeals = [] } = useAllDealsQuery();
  const { data: myRevenueEntries = [] } = useMyRevenueEntries(user?.uid);
  const [myRequests, setMyRequests] = useState(0);
  const [newRequestsDot, setNewRequestsDot] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealGiver, setDealGiver] = useState('');
  const [dealOtherName, setDealOtherName] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealSaving, setDealSaving] = useState(false);
  const [dealMsg, setDealMsg] = useState('');
  const [dealMode, setDealMode] = useState<'business' | 'referral'>('business');
  const [refClient, setRefClient] = useState('');
  const [refExternalName, setRefExternalName] = useState('');
  const [refAmount, setRefAmount] = useState('');
  const [refNote, setRefNote] = useState('');
  const [refSaving, setRefSaving] = useState(false);
  const [refMsg, setRefMsg] = useState('');
  const [myNotifications, setMyNotifications] = useState<UserNotification[]>([]);
  const [awardedRequests, setAwardedRequests] = useState<BusinessRequest[]>([]);
  const { data: totalBusinessValue = 0 } = useTotalBusinessValue();
  const { data: revenueConfig } = useRevenueConfig();
  const { data: referralTotals = { totalValue: 0, pendingValue: 0 } } = useTotalReferralRevenue();
  const { data: dealsWonCount = 0 } = useDealsWonCount();
  const { data: pendingRevenue = { total: 0, totalCount: 0, pendingDeals: 0, pendingDealsCount: 0, pendingReferrals: 0, pendingReferralsCount: 0 } } = usePendingRevenueTotalsQuery();

  useEffect(() => {
    if (!user) return;
    getMyNotifications()
      .then(setMyNotifications)
      .catch(() => {});
    getAwardedRequests(user.uid)
      .then(setAwardedRequests)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getUserRequests(user.uid).then((reqs) => {
      setMyRequests(reqs.length);
    }).catch(() => setMyRequests(0));
    if (allReqs.length > 0 && myProfile) {
      const latestRequestTime = allReqs
        .filter((r) => r.uid !== user.uid)
        .reduce((max, r) => Math.max(max, r.createdAt), 0);
      setNewRequestsDot(latestRequestTime > (myProfile?.lastRequestsViewedAt ?? 0));
    }
  }, [user, allReqs, myProfile]);

  const loading = !myProfile && !allBusinesses.length;

  const handleRecordDeal = async () => {
    if (!myProfile || !user) return;
    if (!dealGiver || !dealAmount) {
      setDealMsg('Select a business and enter an amount.');
      return;
    }
    if (dealGiver === '__other__' && !dealOtherName.trim()) {
      setDealMsg('Enter the name of the business that gave you work.');
      return;
    }
    setDealSaving(true);
    setDealMsg('');
    try {
      let giverUid: string;
      let giverCompanyName: string;
      
      if (dealGiver === '__other__') {
        giverCompanyName = dealOtherName.trim();
        // Generate a unique uid for "other" givers based on company name
        giverUid = `other_${btoa(giverCompanyName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
        await recordDeal(
          giverUid,
          giverCompanyName,
          user.uid,
          myProfile.companyName,
          dealAmount,
          dealDesc,
        );
      } else {
        const giver = allBusinesses.find((b) => b.uid === dealGiver);
        if (!giver) {
          setDealMsg('Select a valid business.');
          setDealSaving(false);
          return;
        }
        giverUid = giver.uid;
        giverCompanyName = giver.companyName;
        await recordDeal(
          giverUid,
          giverCompanyName,
          user.uid,
          myProfile.companyName,
          dealAmount,
          dealDesc,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['revenueSummary'] });
      queryClient.invalidateQueries({ queryKey: ['receivedDeals', user.uid] });
      queryClient.invalidateQueries({ queryKey: ['pendingRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['revenueSummary'] });
      setDealMsg(`Submitted ${dealAmount} from ${giverCompanyName}. An admin will verify it before it counts toward the total.`);
      setDealGiver('');
      setDealOtherName('');
      setDealAmount('');
      setDealDesc('');
      setShowDealForm(false);
    } catch (err) {
      console.error('Failed to record deal:', err);
      setDealMsg(`Failed to record deal: ${err instanceof Error ? err.message : 'Try again.'}`);
    } finally {
      setDealSaving(false);
    }
  };

  const unreadNotifs = myNotifications.filter((n) => !n.read);
  const latestIssue = unreadNotifs.length > 0 ? unreadNotifs[0].message.replace(/^Your report "(.+?)".*/, '$1') : '';

  const hasReferrer = !!myProfile?.referredByPhone;
  const resolvedRefClient = refClient === '__other__'
    ? refExternalName.trim()
    : refClient
      ? (allBusinesses.find((b) => b.uid === refClient)?.companyName || '')
      : '';

  const handleSubmitReferralRevenue = async () => {
    if (!resolvedRefClient) {
      setRefMsg('Select or enter the client / business.');
      return;
    }
    if (!refAmount.trim()) {
      setRefMsg('Enter the revenue amount.');
      return;
    }
    setRefSaving(true);
    setRefMsg('');
    try {
      await submitReferralRevenue({
        amount: refAmount,
        clientUid: refClient === '__other__' ? undefined : refClient,
        clientName: resolvedRefClient,
        clientIsExternal: refClient === '__other__',
        note: refNote,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pendingRevenue'] }),
        queryClient.invalidateQueries({ queryKey: ['revenueSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['myRevenueEntries'] }),
        queryClient.invalidateQueries({ queryKey: ['revenueSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['referralLeaderboard'] }),
      ]);
      setRefAmount('');
      setRefClient('');
      setRefExternalName('');
      setRefNote('');
      setRefMsg('Submitted. An admin will verify it before it is counted toward the total.');
    } catch (err) {
      setRefMsg(err instanceof Error ? err.message : 'Could not submit. Try again.');
    }
    setRefSaving(false);
  };

  // Verified plain deals only. Unverified submissions must not be able to move a
  // public leaderboard, and referral claims are not giver→receiver transfers so
  // they don't belong here at all.
  //
  // This memo depends on `allDeals`, not on a derived array. The previous
  // version memoized on `allDeals.filter(...)`, whose identity changes on every
  // render, so the memo could never short-circuit — the aggregation re-ran on
  // every keystroke in the 13-state deal/referral modal below.
  const leaderboardRows = useMemo(
    () =>
      buildBusinessLeaderboard(
        allDeals.filter(countsTowardDealsTotal).map(toLeaderboardDeal),
      ),
    [allDeals],
  );

  // The referral picker lists every other member's company, sorted A-Z. This ran
  // inline in the JSX on both sides of the modal — two filter+sort passes over
  // the full profile list per render.
  const referralPickerCompanies = useMemo(
    () =>
      allBusinesses
        .filter((b) => b.uid !== user?.uid)
        .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [allBusinesses, user?.uid],
  );

  const openRequestCount = useMemo(
    () => allReqs.filter((r) => r.status === 'open').length,
    [allReqs],
  );

  // The board is a podium, not a full table: only the top three members are
  // ranked, since the value is in the leaders rather than in scrolling a long
  // list. Rows are already sorted by value then recency, so slicing here is
  // exactly "top 3" with no re-sorting.
  const visibleLeaderboardRows = useMemo(
    () => leaderboardRows.slice(0, LEADERBOARD_TOP_N),
    [leaderboardRows],
  );
  const rankedOutCount = leaderboardRows.length - visibleLeaderboardRows.length;

  // Plain deals still awaiting verification. They stay off the board until an
  // admin approves them, but the count is surfaced so the omission is explicit.
  const hiddenFromLeaderboard = allDeals.length - leaderboardRows.reduce(
    (n, r) => n + r.dealCount,
    0,
  );

  // Claims this member submitted, and revenue credited to them for their own referrals.
  const myReferralClaims = myRevenueEntries.filter((e) => e.referredMemberUid === user?.uid);
  const creditedToMe = myRevenueEntries.filter((e) => e.referrerUid === user?.uid && e.referredMemberUid !== user?.uid);

  // Values are deliberately short — a capsule holds a token, not a sentence.
  // Detail belongs in `sub`, which truncates rather than overflowing the card.
  const statCards: {
    label: string;
    value: string;
    sub?: string;
    variant: 'accent' | 'success' | 'neutral' | 'danger';
    dot?: boolean;
    to?: string;
  }[] = [
    {
      label: 'Membership',
      value: (myProfile?.membershipStatus || 'pending').charAt(0).toUpperCase()
        + (myProfile?.membershipStatus || 'pending').slice(1),
      variant: myProfile?.membershipStatus === 'active'
        ? 'success'
        : myProfile?.membershipStatus === 'expired' ? 'danger' : 'neutral',
      sub: myProfile ? `Since ${formatDate(myProfile.createdAt)}` : undefined,
    },
    {
      label: 'Directory',
      value: String(allBusinesses.length),
      variant: 'accent',
      sub: 'Members',
      to: '/profiles',
    },
    {
      label: 'Requests',
      value: String(openRequestCount),
      variant: 'accent',
      dot: newRequestsDot,
      sub: myRequests > 0 ? `${myRequests} raised by you` : 'Open now',
      to: '/requests',
    },
    {
      label: 'Alerts',
      value: unreadNotifs.length > 0 ? String(unreadNotifs.length) : '0',
      variant: unreadNotifs.length > 0 ? 'danger' : 'neutral',
      dot: unreadNotifs.length > 0,
      sub: unreadNotifs.length > 0 ? (latestIssue || 'Unread') : 'All clear',
    },
  ];

  if (loading) {
    return (
      <AnimatedPage>
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-2xl" />
      </div>
      </AnimatedPage>
    );
  }

  const name = myProfile ? `${myProfile.ownerName} ${myProfile.ownerSurname}`.trim() : user?.displayName || user?.email;
  const fy = getFinancialYear();
  const hasTarget = revenueConfig && revenueConfig.target > 0;
  const target = hasTarget ? revenueConfig!.target : 0;
  // Headline progress covers verified deal revenue, verified referral revenue, and
  // member-submitted revenue that is still awaiting verification — members see
  // their entry reflected the moment they submit it, flagged as unverified below.
  // On approval the value leaves `pending` and lands in the verified cache, so it
  // is never counted twice; on rejection it drops out of both.
  const totalRaised = totalBusinessValue + referralTotals.totalValue + pendingRevenue.total;
  const revPct = hasTarget ? Math.min((totalRaised / target) * 100, 100) : 0;
  const remaining = hasTarget ? Math.max(0, target - totalRaised) : 0;
  const achieved = hasTarget && totalRaised >= target;
  const emoji = fy.timeProgress > 0.75 ? '🚨' : fy.timeProgress > 0.5 ? '⚠️' : '🔥';

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-4">

      {/* ── Revenue hero ────────────────────────────────────────────────────
          The revenue figure is the reason members open this app, so it gets the
          visual weight. One dominant number, one meter, one honest breakdown of
          what is verified versus submitted. */}
      <div className="premium-surface rounded-card px-5 py-6 sm:px-7 sm:py-7">
        <div className="relative z-10 text-center sm:text-left">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              {/* Title carries the hierarchy; the FY context is a caption beneath
                  the figure, not a header competing with it. */}
              <h2 className="text-h1 text-charcoal">Total Revenue</h2>
              <p className="mt-1.5 flex flex-wrap items-baseline justify-center gap-2 sm:justify-start">
                <span className="text-hero gradient-text tabular">₹{totalRaised.toLocaleString('en-IN')}</span>
                {achieved && (
                  <span className="text-micro font-semibold text-success-strong bg-success-light border border-success/20 rounded-full px-2 py-0.5">
                    Target hit
                  </span>
                )}
              </p>
              <p className="mt-2 text-micro font-semibold text-muted uppercase tracking-[0.08em]">
                {fy.fyLabel} · Revenue Raised
              </p>
            </div>

            <div className="text-center shrink-0 sm:text-right">
              <p className="text-micro font-semibold text-muted uppercase tracking-[0.08em]">Target</p>
              <p className="text-h3 font-semibold text-charcoal tabular mt-1">
                {hasTarget ? `₹${target.toLocaleString('en-IN')}` : '—'}
              </p>
{hasTarget && (
                <p className="text-xs text-muted mt-1">
                  {revPct > 0 && revPct < 1 ? 'Under 1% of goal' : `${Math.round(revPct)}% of goal`}
                </p>
              )}
            </div>
          </div>

          {/* Meter — thicker track, rounded cap, smooth fill. */}
          <div className="mt-5">
            <div className="meter-track">
              <div className="meter-fill" style={{ width: `${hasTarget ? revPct : 0}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-steel">
                {hasTarget && (
                  <>
                    <span className="font-semibold text-charcoal tabular">
                      ₹{remaining.toLocaleString('en-IN')}
                    </span>{' '}
                    to go
                  </>
                )}
              </span>
              <span className="text-micro text-muted flex items-center gap-1.5">
                <span aria-hidden="true">{emoji}</span>
                {fy.remainingMonths > 0
                  ? `${fy.remainingMonths}m ${fy.remainingDaysInMonth}d left · ${Math.round(fy.timeProgress * 100)}% of FY elapsed`
                  : `${fy.remainingDays}d left`}
              </span>
            </div>
          </div>

          {/* Provenance — where the figure comes from, and what isn't verified. */}
          <div className="mt-5 pt-4 border-t border-border">
            <dl className="grid grid-cols-3 gap-3">
              {[
                { k: 'Deals', v: formatCompactINR(totalBusinessValue), sub: undefined },
                {
                  k: 'Referrals',
                  v: formatCompactINR(referralTotals.totalValue),
                  sub: `${dealsWonCount} won`,
                },
                {
                  k: 'Unverified',
                  v: formatCompactINR(pendingRevenue.total),
                  sub: pendingRevenue.totalCount > 0 ? `${pendingRevenue.totalCount} pending` : undefined,
                },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-micro font-semibold text-muted uppercase tracking-[0.06em]">
                    {s.k}
                  </dt>
                  <dd
                    className={`text-sm font-semibold tabular mt-0.5 ${
                      s.k === 'Unverified' && pendingRevenue.total > 0 ? 'text-warning' : 'text-charcoal'
                    }`}
                  >
                    {s.v}
                    {s.sub && (
                      <span className="block text-micro font-normal text-faint">{s.sub}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {pendingRevenue.total > 0 && (
              <p className="mt-2.5 text-micro text-muted">
                Unverified submissions are included above and count toward the target until an admin reviews them.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Member greeting + status */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-1">
        <div className="min-w-0">
          <h1 className="text-h2 font-semibold text-charcoal tracking-tight truncate">
            Welcome, {name}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {myProfile?.companyName || 'SB Connect'} · member since{' '}
            {myProfile ? formatDate(myProfile.createdAt) : '—'}
          </p>
        </div>
        {myProfile && (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={myProfile.verified ? 'success' : 'warning'}>
              {myProfile.verified ? 'Verified' : 'Pending'}
            </Badge>
            <Badge
              variant={
                myProfile.membershipStatus === 'active'
                  ? 'success'
                  : myProfile.membershipStatus === 'expired'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {myProfile.membershipStatus || '—'}
            </Badge>
          </div>
        )}
      </div>

      {/* Stat cards — min-w-0 throughout so long text truncates instead of
          widening the grid column and overflowing the card. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {statCards.map((s) => {
          const valueTone: Record<string, string> = {
            accent: 'text-primary',
            success: 'text-success',
            neutral: 'text-charcoal',
            danger: 'text-danger',
          };
          const dotTone: Record<string, string> = {
            accent: 'bg-primary',
            success: 'bg-success',
            neutral: 'bg-muted',
            danger: 'bg-danger',
          };
          const card = (
            <div className={`stat-accent-top rounded-card bg-surface border border-border shadow-card h-full min-w-0 ${s.to ? 'card-interactive' : ''}`}>
              <div className="px-3 py-3 sm:px-3.5 sm:py-4 flex flex-col gap-1 min-w-0">
                <p className="text-micro font-semibold text-muted uppercase tracking-[0.06em] truncate" title={s.label}>
                  {s.label}
                </p>
                <p className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-xl sm:text-2xl font-semibold tracking-tight tabular truncate ${valueTone[s.variant]}`}
                  >
                    {s.value}
                  </span>
                  {s.dot && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 pulse-dot ${dotTone[s.variant]}`}
                      aria-label="Needs attention"
                    />
                  )}
                </p>
                {s.sub && (
                  <p className="text-micro text-muted truncate" title={s.sub}>
                    {s.sub}
                  </p>
                )}
              </div>
            </div>
          );
          return s.to ? (
            <Link key={s.label} to={s.to} className="block h-full min-w-0">{card}</Link>
          ) : (
            <div key={s.label} className="min-w-0">{card}</div>
          );
        })}
      </div>

      {!myProfile ? (
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-sm font-semibold text-charcoal tracking-tight mb-1">Create Your Business Profile</h2>
            <p className="text-xs text-steel mb-3">Set up your business profile to connect with the community.</p>
            <Link to="/create-profile" className="inline-flex items-center px-4 py-1.5 bg-primary text-white rounded-md hover:bg-primary-hover text-xs font-medium transition-all">
              Get Started
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">

          {/* Quick Actions */}
          <Card>
            <CardContent className="p-2.5">
              <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-1.5">Quick Actions</h3>
              <div className="flex flex-wrap gap-1">
                <Link to="/requests/create" className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                  Create Request
                </Link>
                <Link to={`/profile/${user?.uid}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  My Profile
                </Link>
                <button onClick={() => setShowDealForm(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><text x="12" y="18" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" stroke="none">₹</text></svg>
                  Record Business Received
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Business Profile */}
          <Card>
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2.5">
                {myProfile.photoURL ? (
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border">
                    <img src={myProfile.photoURL} alt={myProfile.companyName || ''} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {(myProfile.companyName || '?').charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-charcoal leading-tight truncate">{myProfile.companyName || '—'}</p>
                  <p className="text-xs text-steel leading-tight truncate">{`${myProfile.ownerName || ''} ${myProfile.ownerSurname || ''}`.trim() || '—'}</p>
                </div>
                {myProfile.membershipExpiry > 0 && myProfile.membershipStatus === 'expired' ? (
                  <span className="px-1.5 py-0.5 text-micro font-medium rounded bg-danger-light text-danger border border-danger/20 shrink-0 ml-auto">Expired</span>
                ) : (myProfile.membershipExpiry || 0) > 0 && (
                  <span className="text-micro text-muted font-mono shrink-0 ml-auto">{Math.ceil((myProfile.membershipExpiry - Date.now()) / 86400000)}d left</span>
                )}
              </div>
            </CardContent>
          </Card>

{/* Business Leaderboard */}
          <Card className="lg:col-span-2">
            <CardContent className="p-2.5">
              <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-1.5">🏆 Business Leaderboard</h3>
              {leaderboardRows.length === 0 ? (
                <EmptyState
                  noun="trophy"
                  title={
                    allDeals.length === 0
                      ? 'No deals recorded yet'
                      : 'No verified deals yet'
                  }
                  body={
                    allDeals.length === 0
                      ? 'The leaderboard opens once the first business result is recorded.'
                      : 'Deals appear here after an admin verifies them.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs w-8">Rank</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">Received By</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs text-center">Deals Won</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">Given By</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs text-right">Deal Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* One row per receiving company: wins summed, value summed,
                          clients collapsed into a single cell. */}
                      {visibleLeaderboardRows.map((row, rankIndex) => {
                        const latestGiver = row.givers[0];
                        const secondGiver = row.givers[1];
                        const extraGivers = row.givers.length - 2;
                        return (
                          <tr key={row.key} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-3 py-2 w-8">
                              <span
                                className={`rank-medal ${
                                  rankIndex === 0 ? 'gold'
                                    : rankIndex === 1 ? 'silver'
                                      : rankIndex === 2 ? 'bronze'
                                        : 'default'
                                }`}
                              >
                                {rankIndex + 1}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-charcoal truncate max-w-[140px]" title={row.receiverCompany}>
                              {row.receiverCompany}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-charcoal text-center tabular">
                              {row.dealCount}
                            </td>
                            <td className="px-3 py-2 text-xs max-w-[160px]">
                              <span className="block font-medium text-charcoal truncate" title={latestGiver}>
                                {latestGiver || '—'}
                              </span>
                              {secondGiver && (
                                <span className="block text-micro font-normal text-faint truncate" title={secondGiver}>
                                  {secondGiver}
                                  {extraGivers > 0 && ` +${extraGivers} more`}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-success text-right tabular" title={formatINR(row.totalValue)}>
                              {formatCompactINR(row.totalValue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Say what is excluded rather than letting rows silently vanish —
                  otherwise a pending submission reads as lost data. */}
              {hiddenFromLeaderboard > 0 && (
                <p className="text-micro text-muted mt-2 px-3">
                  {hiddenFromLeaderboard} {hiddenFromLeaderboard === 1 ? 'entry' : 'entries'} awaiting
                  verification {hiddenFromLeaderboard === 1 ? 'is' : 'are'} not ranked yet.
                </p>
              )}
              {rankedOutCount > 0 && (
                <p className="text-micro text-muted mt-1 px-3">
                  Showing the top {LEADERBOARD_TOP_N}. {rankedOutCount} more{' '}
                  {rankedOutCount === 1 ? 'member is' : 'members are'} ranked below.
                </p>
              )}
            </CardContent>
          </Card>

          {/* My Revenue Submissions — claims the member filed, plus revenue credited to them */}
          {(myReferralClaims.length > 0 || creditedToMe.length > 0) && (
            <Card className="lg:col-span-2">
              <CardContent className="p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-semibold text-charcoal tracking-tight text-xs">My Revenue Submissions</h3>
                  {hasReferrer && (
                    <button
                      onClick={() => { setDealMode('referral'); setDealMsg(''); setShowDealForm(true); }}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      + Report referral revenue
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">Date</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">Client</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">{creditedToMe.length > 0 ? 'Referred' : 'Reported By'}</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs">Status</th>
                        <th className="px-3 py-2 font-medium text-muted font-mono tracking-tight text-xs text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {myReferralClaims.map((entry) => {
                        const status = entry.status || 'approved';
                        return (
                          <tr key={entry.id} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-3 py-2 text-xs text-muted font-mono whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                            <td className="px-3 py-2 text-xs font-medium text-charcoal max-w-[130px] truncate" title={entry.requestTitle}>
                              {entry.requestTitle}
                            </td>
                            <td className="px-3 py-2 text-xs text-steel truncate max-w-[120px]">{entry.referrerName || '—'}</td>
                            <td className="px-3 py-2">
                              <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'neutral'}>
                                {status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-charcoal text-right">{toCompactINR(entry.amount)}</td>
                          </tr>
                        );
                      })}
                      {creditedToMe.map((entry) => {
                        const status = entry.status || 'approved';
                        return (
                          <tr key={entry.id} className="hover:bg-canvas/50 transition-colors">
                            <td className="px-3 py-2 text-xs text-muted font-mono whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                            <td className="px-3 py-2 text-xs font-medium text-charcoal max-w-[130px] truncate" title={entry.requestTitle}>
                              {entry.requestTitle}
                            </td>
                            <td className="px-3 py-2 text-xs text-steel truncate max-w-[120px]">{entry.referredMemberName || '—'}</td>
                            <td className="px-3 py-2">
                              <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'neutral'}>
                                {status === 'approved' ? 'credited' : status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-success text-right">{toCompactINR(entry.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Meetings */}
          <DashboardUpdates />

          {/* Notifications */}
          {unreadNotifs.length > 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="p-2.5">
                <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-1.5">Notifications</h3>
                <div className="divide-y divide-border">
                  {unreadNotifs.map((n) => (
                    <div key={n.id} className={`flex items-start gap-2 py-1.5 first:pt-0 last:pb-0 ${n.type === 'deal_won' ? 'bg-success-light/10 -mx-1.5 px-1.5 rounded' : ''}`}>
                      <div className="shrink-0 mt-0.5">
                        {n.type === 'deal_won' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1 py-0.5 text-micro font-semibold rounded-full text-white ${n.type === 'deal_won' ? 'bg-success' : 'bg-primary'}`}>
                            {n.type === 'deal_won' ? 'Won' : n.type === 'deal_thanks' ? 'Thanks' : n.type === 'issue_resolved' ? 'Resolved' : 'Alert'}
                          </span>
                          <span className="text-xs font-medium text-charcoal">{n.title}</span>
                        </div>
                        <p className="text-xs text-steel">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Awarded Requests */}
          {awardedRequests.length > 0 && (
            <Card className="lg:col-span-2">
              <CardContent className="p-2.5">
                <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-1">🏆 Your Awarded Requests</h3>
                <div className="divide-y divide-border">
                  {awardedRequests.map((r) => {
                    const winnerProfile = allBusinesses.find((b) => b.uid === r.awardedTo);
                    const winnerName = winnerProfile?.companyName || 'Unknown';
                    return (
                      <div key={r.id} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <p className="text-xs font-medium text-charcoal truncate">{r.title}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-semibold text-success truncate max-w-[120px]">{winnerName}</span>
                          <span className="text-micro text-muted font-mono whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Deal form modal */}
      {showDealForm && myProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto" onClick={() => { setShowDealForm(false); setDealMsg(''); setRefMsg(''); }}>
          <div className="bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 my-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal tracking-tight text-base">Record Business Received</h3>
              <button onClick={() => { setShowDealForm(false); setDealMsg(''); setRefMsg(''); }} className="text-xs text-muted hover:text-charcoal transition-colors cursor-pointer">✕</button>
            </div>

            <div className="flex gap-1 p-1 bg-muted-bg rounded-xl mb-4">
              <button
                onClick={() => { setDealMode('business'); setRefMsg(''); }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${dealMode === 'business' ? 'bg-surface text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}
              >
                Business Received
              </button>
              <button
                onClick={() => { setDealMode('referral'); setDealMsg(''); }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${dealMode === 'referral' ? 'bg-surface text-charcoal shadow-sm' : 'text-muted hover:text-charcoal'}`}
              >
                Referral Revenue
              </button>
            </div>

            {dealMode === 'business' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted bg-muted-bg rounded-lg px-3 py-2">Select who gave you this business</p>
                <select value={dealGiver} onChange={(e) => setDealGiver(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-surface text-charcoal text-xs focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select a business...</option>
                  {referralPickerCompanies.map((b) => (
                    <option key={b.uid} value={b.uid}>{b.companyName}</option>
                  ))}
                  <option value="__other__">Other (not in list)</option>
                </select>
                {dealGiver === '__other__' && (
                  <Input label="Company Name" value={dealOtherName} onChange={(e) => setDealOtherName(e.target.value)} placeholder="Enter company name" />
                )}
                <Input label="Amount (₹)" type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="100000" />
                {dealMsg && <p className={`text-xs ${dealMsg.includes('Failed') || dealMsg.includes('Select') ? 'text-danger' : 'text-success'}`}>{dealMsg}</p>}
                <Button onClick={handleRecordDeal} loading={dealSaving} className="w-full text-xs">Confirm Deal</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {!hasReferrer ? (
                  <div className="text-center py-4">
                    <p className="text-xs font-medium text-charcoal">No referrer on your profile</p>
                    <p className="text-xs text-muted mt-1">
                      Referral revenue is credited to whoever referred you, so it can only be reported once a
                      referrer is on your profile. Ask an admin to add it.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-md bg-muted-bg px-3 py-2">
                      <span className="text-xs font-medium text-muted uppercase tracking-wider shrink-0">Referred by</span>
                      <span className="text-xs font-medium text-charcoal truncate">
                        {myProfile.referredByName || myProfile.referredByPhone}
                      </span>
                    </div>
                    <p className="text-xs text-muted">Who did you get this business from? Credit goes to your referrer once verified.</p>
                    <select value={refClient} onChange={(e) => setRefClient(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-surface text-charcoal text-xs focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Select a client...</option>
                      {referralPickerCompanies.map((b) => (
                        <option key={b.uid} value={b.uid}>{b.companyName}</option>
                      ))}
                      <option value="__other__">External business (not a member)</option>
                    </select>
                    {refClient === '__other__' && (
                      <Input label="Business Name" value={refExternalName} onChange={(e) => setRefExternalName(e.target.value)} placeholder="Enter company name" />
                    )}
                    <Input label="Amount (₹)" type="number" value={refAmount} onChange={(e) => setRefAmount(e.target.value)} placeholder="100000 or 5L" />
                    <Input label="Note (optional)" value={refNote} onChange={(e) => setRefNote(e.target.value)} placeholder="Retainer, 3 months" />
                    {refMsg && <p className={`text-xs ${refMsg.startsWith('Submitted') ? 'text-success' : 'text-danger'}`}>{refMsg}</p>}
                    <Button onClick={handleSubmitReferralRevenue} loading={refSaving} className="w-full text-xs">Submit for Verification</Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}
