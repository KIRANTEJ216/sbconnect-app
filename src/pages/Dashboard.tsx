import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserRequests, recordDeal, getMyNotifications, getUserIssueReports, addIssueReply, getAwardedRequests } from '../lib/firestore';
import { useProfiles, useRequestsQuery, useLeaderboardQuery, useBusinessProfile, useTotalBusinessValue, useRevenueConfig } from '../hooks/useFirebaseQuery';
import type { UserNotification, IssueReport, Request as BusinessRequest } from '../types';
import { formatDate, formatCurrency, getFinancialYear } from '../lib/format';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { isSuperAdmin } from '../lib/admin';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';
import { StrikeWarning } from '../components/StrikeWarning';
import { DashboardUpdates } from '../components/DashboardUpdates';
import { MembershipCountdown } from '../components/MembershipCountdown';




export default function Dashboard() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: myProfile } = useBusinessProfile(user?.uid);
  const { data: allBusinesses = [] } = useProfiles(200);
  const { data: allReqs = [] } = useRequestsQuery();
  const { data: leaderboard = [] } = useLeaderboardQuery();
  const [myRequests, setMyRequests] = useState(0);
  const [newRequestsDot, setNewRequestsDot] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealReceiver, setDealReceiver] = useState('');
  const [dealOtherName, setDealOtherName] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealSaving, setDealSaving] = useState(false);
  const [dealMsg, setDealMsg] = useState('');
  const [myNotifications, setMyNotifications] = useState<UserNotification[]>([]);
  const [awardedRequests, setAwardedRequests] = useState<BusinessRequest[]>([]);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [myIssues, setMyIssues] = useState<IssueReport[]>([]);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const { data: totalBusinessValue = 0 } = useTotalBusinessValue();
  const { data: revenueConfig } = useRevenueConfig();

  useEffect(() => {
    if (!user) return;
    getMyNotifications()
      .then(setMyNotifications)
      .catch(() => {});
    getUserIssueReports(user.uid)
      .then(setMyIssues)
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
    if (!dealReceiver || !dealAmount) {
      setDealMsg('Select a business and enter an amount.');
      return;
    }
    if (dealReceiver === '__other__' && !dealOtherName.trim()) {
      setDealMsg('Enter the name of the business you gave work to.');
      return;
    }
    setDealSaving(true);
    setDealMsg('');
    try {
      if (dealReceiver === '__other__') {
        await recordDeal(
          user.uid,
          myProfile.companyName,
          '__other__',
          dealOtherName.trim(),
          dealAmount,
          dealDesc,
        );
      } else {
        const receiver = allBusinesses.find((b) => b.uid === dealReceiver);
        if (!receiver) {
          setDealMsg('Select a valid business.');
          setDealSaving(false);
          return;
        }
        await recordDeal(
          user.uid,
          myProfile.companyName,
          receiver.uid,
          receiver.companyName,
          dealAmount,
          dealDesc,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['totalBusinessValue'] });
      const receiverName = dealReceiver === '__other__' ? dealOtherName.trim() : allBusinesses.find((b) => b.uid === dealReceiver)?.companyName;
      setDealMsg(`🎉 Congratulations! Deal recorded — ${dealAmount} given to ${receiverName}`);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setDealReceiver('');
      setDealOtherName('');
      setDealAmount('');
      setDealDesc('');
      setShowDealForm(false);
    } catch (err) {
      console.error('Failed to record deal:', err);
      setDealMsg('Failed to record deal. Try again.');
    } finally {
      setDealSaving(false);
    }
  };

  const unreadNotifs = myNotifications.filter((n) => !n.read);
  const latestIssue = unreadNotifs.length > 0 ? unreadNotifs[0].message.replace(/^Your report "(.+?)".*/, '$1') : '';

  const statCards: { label: string; value: string; sub?: string; variant: 'accent' | 'success' | 'neutral' | 'danger'; dot?: boolean; to?: string }[] = [
    {
      label: 'Membership Status',
      value: myProfile?.membershipStatus === 'active'
        ? `Member since ${formatDate(myProfile.createdAt)}`
        : myProfile?.membershipStatus === 'expired' ? 'EXPIRED' : myProfile?.membershipStatus ?? 'Inactive',
      variant: myProfile?.membershipStatus === 'active' ? 'success' : myProfile?.membershipStatus === 'expired' ? 'danger' : 'neutral',
      sub: profile?.onlineStatus === 'online' ? 'Online' : 'Offline',
    },
    {
      label: 'Members Directory',
      value: String(allBusinesses.length),
      variant: 'accent',
      to: '/profiles',
    },
    {
      label: 'Requests',
      value: `${myRequests} mine · ${allReqs.filter((r) => r.status === 'open').length} open`,
      variant: 'accent',
      dot: newRequestsDot,
      to: '/requests',
    },
    {
      label: 'Notifications',
      value: unreadNotifs.length > 0 ? `${unreadNotifs.length} unread` : 'All clear',
      variant: unreadNotifs.length > 0 ? 'danger' : 'neutral' as const,
      dot: unreadNotifs.length > 0,
      sub: latestIssue,
    },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-[2.5rem]" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div className="max-w-6xl mx-auto space-y-3">
      <div>
        <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Dashboard</h1>
        <p className="text-steel text-sm">Welcome, {myProfile ? `${myProfile.ownerName} ${myProfile.ownerSurname}`.trim() : user?.displayName || user?.email}</p>
      </div>

      {(() => {
        const fy = getFinancialYear();
        const hasTarget = revenueConfig && revenueConfig.target > 0;
        const target = hasTarget ? revenueConfig!.target : 0;
        const revPct = hasTarget ? Math.min((totalBusinessValue / target) * 100, 100) : 0;
        const remaining = hasTarget ? Math.max(0, target - totalBusinessValue) : 0;
        const achieved = hasTarget && totalBusinessValue >= target;

        const urgency = fy.timeProgress;
        const countdownBg = urgency > 0.75
          ? 'bg-gradient-to-br from-danger/10 via-danger/5 to-warning/15'
          : urgency > 0.5
            ? 'bg-gradient-to-br from-warning/10 via-accent/5 to-primary/8'
            : 'bg-gradient-to-br from-primary/8 via-accent/5 to-success/10';
        const countdownBorder = urgency > 0.75
          ? 'border-danger/20'
          : urgency > 0.5
            ? 'border-warning/20'
            : 'border-primary/10';
        const barGradient = urgency > 0.75
          ? 'from-danger to-warning'
          : urgency > 0.5
            ? 'from-warning to-accent'
            : 'from-primary to-success';
        const emoji = urgency > 0.75 ? '🚨' : urgency > 0.5 ? '⚠️' : '🔥';
        return (
        <Card className="stat-accent-top overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted tracking-tight uppercase">
                  {hasTarget ? `${fy.fyLabel} · Remaining` : fy.fyLabel}
                </p>
                <p className="text-lg sm:text-xl font-bold gradient-text mt-0.5 tracking-tight">
                  ₹ {(hasTarget ? remaining : 0).toLocaleString('en-IN')}
                </p>
              </div>
              {hasTarget && (
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted font-medium">Target</p>
                  <p className="text-base sm:text-lg font-bold text-charcoal tracking-tight">{achieved ? '✓' : `₹ ${target.toLocaleString('en-IN')}`}</p>
                </div>
              )}
            </div>

            <div className="mb-2">
              <div className="w-full h-2 bg-muted-bg rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full bg-gradient-to-r from-primary via-primary-light to-success transition-all duration-700 ease-out"
                  style={{ width: `${hasTarget ? revPct : 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px]">
                <span className="font-semibold text-charcoal">₹ {totalBusinessValue.toLocaleString('en-IN')} raised</span>
                {hasTarget && <span className="text-steel">{Math.round(revPct)}%</span>}
              </div>
            </div>

            {!achieved && (
              <div className={`rounded-xl ${countdownBg} border ${countdownBorder} p-2.5 transition-all duration-500`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{emoji}</span>
                    <div>
                      <p className="text-[11px] font-semibold text-charcoal tracking-tight leading-tight">
                        {fy.remainingMonths > 0
                          ? `${fy.remainingMonths}m ${fy.remainingDaysInMonth}d left`
                          : `${fy.remainingDays}d left`}
                      </p>
                      <p className="text-[10px] text-steel mt-px">
                        {hasTarget
                          ? `₹ ${Math.round(remaining / Math.max(fy.remainingDays, 1)).toLocaleString('en-IN')}/day needed`
                          : `₹ ${Math.round(totalBusinessValue / Math.max(fy.elapsedDays, 1)).toLocaleString('en-IN')}/day avg`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold gradient-text">{Math.round(fy.timeProgress * 100)}%</p>
                    <p className="text-[9px] text-steel leading-tight -mt-px">elapsed</p>
                  </div>
                </div>
                <div className="w-full h-1 bg-muted-bg/60 rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
                    style={{ width: `${fy.timeProgress * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5 text-[9px] text-muted">
                  <span>{fy.elapsedDays}d elapsed</span>
                  <span>{fy.remainingDays}d to go</span>
                </div>
              </div>
            )}

            {achieved && (
              <div className="rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 p-2.5 text-center">
                <p className="text-xs font-bold text-success">🎉 Target Achieved!</p>
                <p className="text-[10px] text-steel mt-0.5">₹ {totalBusinessValue.toLocaleString('en-IN')} of ₹ {target.toLocaleString('en-IN')} target</p>
              </div>
            )}
          </CardContent>
        </Card>
      )})()}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const inner = (
            <div className={`stat-accent-top rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/10 h-full flex flex-col ${s.to ? 'cursor-pointer' : ''}`}>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted font-semibold tracking-tight flex items-center gap-1.5">
                    {s.label}
                    {s.dot && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
                  </p>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    s.label === 'Membership Status' ? 'bg-primary/8 text-primary' :
                    s.label === 'Members Directory' ? 'bg-success/8 text-success' :
                    s.label === 'Notifications' && unreadNotifs.length > 0 ? 'bg-danger/8 text-danger' :
                    'bg-warning/8 text-warning'
                  }`}>
                    {s.label === 'Membership Status' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
                      </svg>
                    ) : s.label === 'Members Directory' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    ) : s.label === 'Notifications' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="mt-auto">
                  {s.label === 'Requests' ? (
                    <div className="flex flex-wrap gap-2">
                      <div className="px-3 py-1.5 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 shadow-sm">
                        <p className="text-xs text-primary font-semibold tracking-tight">My Requests<span className="font-extrabold ml-0.5">: {myRequests}</span></p>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/40 shadow-sm">
                        <p className="text-xs text-amber-700 font-semibold tracking-tight">Open<span className="font-extrabold ml-0.5">: {allReqs.filter((r) => r.status === 'open').length}</span></p>
                      </div>
                      <div className="px-3 py-1.5 rounded-full bg-gradient-to-br from-success/10 to-success/5 border border-success/15 shadow-sm">
                        <p className="text-xs text-success font-semibold tracking-tight">Deal Closed<span className="font-extrabold ml-0.5">: {allReqs.filter((r) => r.awardedTo).length}</span></p>
                      </div>
                    </div>
                  ) : s.label === 'Members Directory' ? (
                    <div className="inline-flex px-3 py-1.5 rounded-full bg-gradient-to-br from-success/10 to-success/5 border border-success/15 shadow-sm">
                      <p className="text-xs text-success font-semibold tracking-tight">Members<span className="font-extrabold ml-0.5">: {allBusinesses.length}</span></p>
                    </div>
                  ) : (
                    <Badge variant={s.variant}>{s.value}</Badge>
                  )}
                </div>
                {s.sub && (
                  <p className="mt-2 text-xs text-muted font-medium tracking-tight flex items-center gap-1.5">
                    {s.label !== 'Notifications' && <span className={`w-1.5 h-1.5 rounded-full ${profile?.onlineStatus === 'online' ? 'bg-green-500' : 'bg-muted/40'}`} />}
                    {s.label === 'Notifications' && unreadNotifs.length > 0 ? (
                      <span className="truncate max-w-full" title={s.sub}>{s.sub}</span>
                    ) : (
                      s.sub
                    )}
                  </p>
                )}
              </CardContent>
            </div>
          );
          return s.to ? (
            <Link key={s.label} to={s.to} className="block h-full">
              <TiltCard className="h-full">{inner}</TiltCard>
            </Link>
          ) : (
            <TiltCard key={s.label} className="h-full">{inner}</TiltCard>
          );
        })}
      </div>

      {myNotifications.filter((n) => !n.read).length > 0 && (
        <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-charcoal tracking-tight text-xs">Notifications</h3>
          </div>
          <div className="space-y-2">
            {myNotifications.filter((n) => !n.read).map((n) => (
              <div key={n.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                n.type === 'issue_resolved' || n.type === 'deal_won' ? 'bg-success-light/20 border-success/15' :
                n.type === 'issue_reply' ? 'bg-warning-light/20 border-warning/15' :
                'bg-primary-light/20 border-primary/15'
              }`}>
                <div className="shrink-0 mt-0.5">
                  {n.type === 'issue_resolved' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : n.type === 'deal_won' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ) : n.type === 'issue_reply' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><polyline points="17 9 21 5 17 1" /><line x1="21" y1="5" x2="11" y2="5" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white ${
                      n.type === 'issue_resolved' ? 'bg-success' :
                      n.type === 'deal_won' ? 'bg-success' :
                      n.type === 'issue_reply' ? 'bg-warning' :
                      'bg-primary'
                    }`}>
                      {n.type === 'deal_won' ? 'Deal Won' : n.type === 'deal_thanks' ? 'Thank You' : n.type === 'issue_resolved' ? 'Resolved' : n.type === 'issue_reply' ? 'New Reply' : 'New Pitch'}
                    </span>
                    <span className="text-xs font-medium text-charcoal">{n.title}</span>
                  </div>
                  <p className="text-[11px] text-steel mt-1">{n.message}</p>
                  <p className="text-[10px] text-muted mt-0.5">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {awardedRequests.length > 0 && (
          <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <h3 className="font-semibold text-charcoal tracking-tight text-xs">🏆 Your Awarded Requests</h3>
            </div>
            <div className="divide-y divide-border">
              {awardedRequests.map((r, i) => {
                const winnerProfile = allBusinesses.find((b) => b.uid === r.awardedTo);
                const winnerName = winnerProfile?.companyName || 'Unknown';
                return (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-xs font-medium text-charcoal truncate">{r.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] font-semibold text-success truncate max-w-[90px]">{winnerName}</span>
                      <span className="text-[10px] text-muted font-mono whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {user && <StrikeWarning uid={user.uid} compact />}
      </div>

      {myIssues.length > 0 && (
        <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-charcoal tracking-tight text-xs">My Reports ({myIssues.length})</h3>
          </div>
          <div className="space-y-2">
            {myIssues.map((r) => (
              <div key={r.id} className="border border-border rounded-lg px-3 py-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'open' ? 'bg-danger' : 'bg-success'}`} />
                      <p className="text-xs font-semibold text-charcoal">{r.subject}</p>
                    </div>
                    <p className="text-[11px] text-steel mt-0.5">{r.description}</p>
                  </div>
                  <Badge variant={r.status === 'open' ? 'danger' : 'success'}>
                    {r.status}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted">{new Date(r.createdAt).toLocaleString('en-IN')}</p>

                {(r.replies ?? []).length > 0 && (
                  <div className="space-y-1.5 pl-2 border-l-2 border-border">
                    {r.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2">
                        <span className="text-[10px] font-semibold text-steel shrink-0 mt-0.5">{reply.authorName}:</span>
                        <p className="text-[11px] text-charcoal">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type a reply..."
                    className="flex-1 min-w-0 rounded-[0.5rem] border border-border px-2.5 py-1.5 text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-primary-ring"
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
                        setMyIssues((prev) => prev.map((x) => x.id === r.id ? { ...x, replies: [...(x.replies ?? []), reply] } : x));
                        setReplyTexts((prev) => ({ ...prev, [r.id]: '' }));
                      } catch { /* error tracked */ }
                      setReplyingId(null);
                    }}
                  >
                    Send
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!myProfile ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-charcoal tracking-tight mb-1">Create Your Business Profile</h2>
            <p className="text-sm text-steel mb-6 max-w-md mx-auto">Set up your business profile to connect with the community.</p>
            <Link
              to="/create-profile"
              className="inline-flex items-center px-5 py-2 bg-primary text-white rounded-[0.75rem] hover:bg-primary-hover text-sm font-medium transition-all active:scale-[0.97]"
            >
              Get Started
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Quick Actions */}
          <div className="rounded-card bg-surface border border-border shadow-card p-3">
            <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-2">Quick Actions</h3>
            <div className="space-y-1.5">
              <Link to="/requests/create" className="flex items-center gap-2 px-3 py-2 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Create a Request
              </Link>
              <Link to={`/profile/${user?.uid}`} className="flex items-center gap-2 px-3 py-2 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                View My Profile
              </Link>
              <button onClick={() => { setShowDealForm(true); setTimeout(() => document.getElementById('deal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }}
                className="flex items-center gap-2 px-3 py-2 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-xs font-medium text-charcoal w-full text-left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <text x="12" y="18" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" stroke="none">₹</text>
                </svg>
                Record Business Given
              </button>
            </div>
          </div>

          {/* Business Profile */}
          <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card p-3">
            <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-2">Your Business Profile</h3>
            <div className="flex items-start gap-3">
              {myProfile.photoURL ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border">
                  <img src={myProfile.photoURL} alt={myProfile.companyName} className="w-full h-full object-cover aspect-square" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {myProfile.companyName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-charcoal tracking-tight text-sm leading-tight">{myProfile.companyName}</p>
                <p className="text-xs text-steel leading-tight">{`${myProfile.ownerName} ${myProfile.ownerSurname}`.trim() || '—'}</p>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {myProfile.verified ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-success-light text-success border border-success/20">Verified</span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-warning-light text-warning border border-warning/20">Pending</span>
                  )}
                  {myProfile.membershipStatus !== 'expired' && (
                    <Badge variant={myProfile.membershipStatus === 'active' ? 'success' : 'neutral'}>
                      {myProfile.membershipStatus.charAt(0).toUpperCase() + myProfile.membershipStatus.slice(1)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {myProfile.membershipExpiry > 0 && myProfile.membershipStatus === 'expired' ? (
              <div className="mt-2 px-3 py-2 rounded-lg bg-danger-light/50 border border-danger/20">
                <p className="text-xs font-medium text-danger">Expired Membership — {Math.floor((Date.now() - myProfile.membershipExpiry) / 86400000)} days ago</p>
              </div>
            ) : myProfile.membershipExpiry > 0 && (
              <div className="mt-2"><MembershipCountdown membershipExpiry={myProfile.membershipExpiry} /></div>
            )}
          </div>

          {/* Leaderboard + Upcoming Meetings */}
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card p-3">
              <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-2">Leaderboard</h3>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">No deals recorded yet.</p>
              ) : (
                <div>
                <div className="divide-y divide-border">
                  {leaderboard.slice(0, showAllLeaderboard ? leaderboard.length : 3).map((entry, i) => (
                    <div key={entry.uid} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`rank-medal ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'} text-xs`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                        </span>
                        <div className="min-w-0">
                          <Link to={`/profile/${entry.uid}`} className="text-xs font-medium text-charcoal hover:text-primary transition-colors truncate block max-w-[140px] leading-tight">
                            {entry.ownerName || entry.companyName}
                          </Link>
                          <p className="text-[10px] text-muted truncate max-w-[140px] leading-tight">{entry.companyName}</p>
                        </div>
                      </div>
                      <div className="text-center sm:text-right shrink-0 ml-2">
                        <p className="text-xs font-semibold text-charcoal">{formatCurrency(String(entry.totalRevenue))}</p>
                        <p className="text-[10px] text-muted font-mono">{entry.dealCount} deal{entry.dealCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {isSuperAdmin(user?.email, profile?.role) && leaderboard.length > 3 && (
                  <button
                    onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                    className="mt-2 w-full text-[11px] font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer py-1"
                  >
                    {showAllLeaderboard ? 'Show Less ▲' : `View All (${leaderboard.length}) ▼`}
                  </button>
                )}
                </div>
              )}
            </div>
            <DashboardUpdates />
          </div>
        </div>
      )}

      {showDealForm && myProfile && (
        <TiltCard id="deal-form">
        <Card>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-charcoal tracking-tight">Record Business Given</h3>
              <button onClick={() => { setShowDealForm(false); setDealMsg(''); }} className="text-sm text-muted hover:text-charcoal transition-colors cursor-pointer">Cancel</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Business Given To</label>
                <select
                  value={dealReceiver}
                  onChange={(e) => setDealReceiver(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[0.75rem] border border-border bg-surface text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  <option value="">Select a business...</option>
                  {allBusinesses
                    .filter((b) => b.uid !== user?.uid)
                    .sort((a, b) => a.companyName.localeCompare(b.companyName))
                    .map((b) => (
                      <option key={b.uid} value={b.uid}>{b.companyName}</option>
                    ))
                  }
                  <option value="__other__">Other (not in list)</option>
                </select>
                {dealReceiver === '__other__' && (
                  <Input
                    label="Company Name"
                    value={dealOtherName}
                    onChange={(e) => setDealOtherName(e.target.value)}
                    placeholder="Enter company name"
                    className="mt-3"
                  />
                )}
              </div>
              <Input
                label="Amount"
                type="number"
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                placeholder="100000"
              />
              <Input
                label="Description (optional)"
                value={dealDesc}
                onChange={(e) => setDealDesc(e.target.value)}
                placeholder="e.g. Website development project"
              />
              {dealMsg && (
                <p className={`text-sm ${dealMsg.includes('Failed') || dealMsg.includes('Select') ? 'text-danger' : 'text-success'}`}>{dealMsg}</p>
              )}
              <Button onClick={handleRecordDeal} loading={dealSaving} className="w-full">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirm Deal
              </Button>
            </div>
          </CardContent>
        </Card>
        </TiltCard>
      )}
    </div>
    </AnimatedPage>
  );
}
