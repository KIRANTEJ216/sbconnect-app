import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserRequests, recordDeal, getMyNotifications, getAwardedRequests } from '../lib/firestore';
import { useProfiles, useRequestsQuery, useLeaderboardQuery, useBusinessProfile, useTotalBusinessValue, useRevenueConfig } from '../hooks/useFirebaseQuery';
import type { UserNotification, Request as BusinessRequest } from '../types';
import { formatDate, formatCurrency, getFinancialYear } from '../lib/format';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { isSuperAdmin } from '../lib/admin';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { DashboardUpdates } from '../components/DashboardUpdates';




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
  const { data: totalBusinessValue = 0 } = useTotalBusinessValue();
  const { data: revenueConfig } = useRevenueConfig();

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
        : myProfile?.membershipStatus === 'expired' ? 'EXPIRED' : myProfile?.membershipStatus ?? 'Pending',
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
      <AnimatedPage>
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-[2.5rem]" />
          ))}
        </div>
        <div className="skeleton h-72 rounded-[2.5rem]" />
      </div>
      </AnimatedPage>
    );
  }

  const name = myProfile ? `${myProfile.ownerName} ${myProfile.ownerSurname}`.trim() : user?.displayName || user?.email;
  const fy = getFinancialYear();
  const hasTarget = revenueConfig && revenueConfig.target > 0;
  const target = hasTarget ? revenueConfig!.target : 0;
  const revPct = hasTarget ? Math.min((totalBusinessValue / target) * 100, 100) : 0;
  const remaining = hasTarget ? Math.max(0, target - totalBusinessValue) : 0;
  const achieved = hasTarget && totalBusinessValue >= target;
  const emoji = fy.timeProgress > 0.75 ? '🚨' : fy.timeProgress > 0.5 ? '⚠️' : '🔥';

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-2">

      {/* Gradient header — matches Attendance / Profile / MyIssues pattern */}
      <div className="rounded-card bg-gradient-to-br from-primary/5 via-primary-light/5 to-success/5 border border-primary/10 shadow-card px-4 py-3 text-center">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">SB Connect</p>
        <h1 className="text-fluid-h1 font-bold gradient-text tracking-tight">Dashboard</h1>
        <p className="text-steel text-sm">Welcome, {name}</p>
        {myProfile && (
          <div className="flex items-center justify-center gap-2 mt-1">
            {myProfile.verified ? (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-success-light text-success border border-success/20">Verified</span>
            ) : (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-warning-light text-warning border border-warning/20">Pending</span>
            )}
            <Badge variant={myProfile.membershipStatus === 'active' ? 'success' : myProfile.membershipStatus === 'expired' ? 'danger' : 'neutral'}>
              {(myProfile.membershipStatus || '—').charAt(0).toUpperCase() + (myProfile.membershipStatus || '—').slice(1)}
            </Badge>
          </div>
        )}
        {/* Revenue — same gradient block, no overflow */}
        <div className="mt-2 pt-2 border-t border-primary/10">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0.5 items-center text-[11px]">
            <span className="text-muted font-semibold tracking-tight uppercase text-left">{fy.fyLabel} · Raised</span>
            <span className="text-right text-muted font-medium">Target</span>
            <span className="text-right text-muted font-medium">{Math.round(fy.timeProgress * 100)}% elapsed</span>
            <span className="text-sm font-bold gradient-text tracking-tight text-left">₹ {totalBusinessValue.toLocaleString('en-IN')}</span>
            <span className="text-right text-sm font-bold text-charcoal tracking-tight">{achieved ? '✓' : hasTarget ? `₹ ${target.toLocaleString('en-IN')}` : '—'}</span>
            <span className="text-right text-xs text-steel">{emoji} {fy.remainingMonths > 0 ? `${fy.remainingMonths}m ${fy.remainingDaysInMonth}d` : `${fy.remainingDays}d`} left</span>
          </div>
          <div className="mt-1.5">
            <div className="w-full h-1.5 bg-muted-bg rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary via-primary-light to-success transition-all"
                style={{ width: `${hasTarget ? revPct : 0}%` }} />
            </div>
            <div className="flex justify-between mt-0.5 text-[10px]">
              <span className="font-semibold text-charcoal">₹ {totalBusinessValue.toLocaleString('en-IN')} raised</span>
              {hasTarget && <span className="text-steel">{Math.round(revPct)}% · ₹ {Math.round(remaining / Math.max(fy.remainingDays, 1)).toLocaleString('en-IN')}/day needed</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards — correct pattern: stat-accent-top on the card div */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statCards.map((s) => {
          const pillColors: Record<string, string> = {
            accent: 'bg-primary-light text-primary border-primary/20',
            success: 'bg-success-light text-success border-success/20',
            neutral: 'bg-muted-bg text-muted border-border',
            danger: 'bg-danger-light text-danger border-danger/20',
          };
          const inner = (
            <div className={`stat-accent-top rounded-card bg-surface border border-border shadow-card h-full ${s.to ? 'cursor-pointer hover:border-primary/30' : ''}`}>
              <CardContent className="p-2.5">
                <p className="text-[10px] text-muted font-semibold tracking-tight mb-1">{s.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${pillColors[s.variant] || pillColors.neutral}`}>
                    {s.value}
                  </span>
                  {s.dot && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />}
                </div>
                {s.sub && (
                  <p className="mt-0.5 text-[10px] text-muted truncate">{s.sub}</p>
                )}
              </CardContent>
            </div>
          );
          return s.to ? <Link key={s.label} to={s.to} className="block h-full">{inner}</Link> : inner;
        })}
      </div>

      {!myProfile ? (
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-sm font-semibold text-charcoal tracking-tight mb-1">Create Your Business Profile</h2>
            <p className="text-[11px] text-steel mb-3">Set up your business profile to connect with the community.</p>
            <Link to="/create-profile" className="inline-flex items-center px-4 py-1.5 bg-primary text-white rounded-[0.75rem] hover:bg-primary-hover text-xs font-medium transition-all">
              Get Started
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">

          {/* Quick Actions */}
          <Card className="stat-accent-top">
            <CardContent className="p-2.5">
              <h3 className="font-semibold text-charcoal tracking-tight text-[11px] mb-1.5">Quick Actions</h3>
              <div className="flex flex-wrap gap-1">
                <Link to="/requests/create" className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-[11px] font-medium text-charcoal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                  Create Request
                </Link>
                <Link to={`/profile/${user?.uid}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-[11px] font-medium text-charcoal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  My Profile
                </Link>
                <button onClick={() => setShowDealForm(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-canvas rounded-lg hover:bg-primary-light transition-colors text-[11px] font-medium text-charcoal cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><text x="12" y="18" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" stroke="none">₹</text></svg>
                  Record Deal
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Business Profile */}
          <Card className="stat-accent-top">
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
                  <p className="text-[10px] text-steel leading-tight truncate">{`${myProfile.ownerName || ''} ${myProfile.ownerSurname || ''}`.trim() || '—'}</p>
                </div>
                {myProfile.membershipExpiry > 0 && myProfile.membershipStatus === 'expired' ? (
                  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-danger-light text-danger border border-danger/20 shrink-0 ml-auto">Expired</span>
                ) : (myProfile.membershipExpiry || 0) > 0 && (
                  <span className="text-[9px] text-muted font-mono shrink-0 ml-auto">{Math.ceil((myProfile.membershipExpiry - Date.now()) / 86400000)}d left</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="stat-accent-top">
            <CardContent className="p-2.5">
              <h3 className="font-semibold text-charcoal tracking-tight text-[11px] mb-1.5">🏆 Leaderboard</h3>
              {leaderboard.length === 0 ? (
                <p className="text-[11px] text-muted text-center py-2">No deals recorded yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {leaderboard.slice(0, showAllLeaderboard ? leaderboard.length : 3).map((entry, i) => (
                    <div key={entry.uid} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px]">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                        <div className="min-w-0">
                          <Link to={`/profile/${entry.uid}`} className="text-[11px] font-medium text-charcoal hover:text-primary transition-colors truncate block leading-tight">
                            {entry.ownerName || entry.companyName}
                          </Link>
                          <p className="text-[9px] text-muted truncate leading-tight">{entry.companyName}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-[11px] font-semibold text-charcoal">{formatCurrency(String(entry.totalRevenue))}</p>
                        <p className="text-[9px] text-muted font-mono">{entry.dealCount}d</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isSuperAdmin(profile?.role) && leaderboard.length > 3 && (
                <button onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                  className="mt-1 w-full text-[10px] font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer py-0.5">
                  {showAllLeaderboard ? '▲ Less' : `▼ All (${leaderboard.length})`}
                </button>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <DashboardUpdates />

          {/* Notifications */}
          {unreadNotifs.length > 0 && (
            <Card className="stat-accent-top lg:col-span-2">
              <CardContent className="p-2.5">
                <h3 className="font-semibold text-charcoal tracking-tight text-[11px] mb-1.5">Notifications</h3>
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
                          <span className={`px-1 py-0.5 text-[9px] font-semibold rounded-full text-white ${n.type === 'deal_won' ? 'bg-success' : 'bg-primary'}`}>
                            {n.type === 'deal_won' ? 'Won' : n.type === 'deal_thanks' ? 'Thanks' : n.type === 'issue_resolved' ? 'Resolved' : 'Alert'}
                          </span>
                          <span className="text-[11px] font-medium text-charcoal">{n.title}</span>
                        </div>
                        <p className="text-[10px] text-steel">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Awarded Requests */}
          {awardedRequests.length > 0 && (
            <Card className="stat-accent-top lg:col-span-2">
              <CardContent className="p-2.5">
                <h3 className="font-semibold text-charcoal tracking-tight text-[11px] mb-1">🏆 Your Awarded Requests</h3>
                <div className="divide-y divide-border">
                  {awardedRequests.map((r) => {
                    const winnerProfile = allBusinesses.find((b) => b.uid === r.awardedTo);
                    const winnerName = winnerProfile?.companyName || 'Unknown';
                    return (
                      <div key={r.id} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-charcoal truncate">{r.title}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[10px] font-semibold text-success truncate max-w-[120px]">{winnerName}</span>
                          <span className="text-[9px] text-muted font-mono whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowDealForm(false); setDealMsg(''); }}>
          <div className="bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal tracking-tight text-base">Record Business Deal</h3>
              <button onClick={() => { setShowDealForm(false); setDealMsg(''); }} className="text-xs text-muted hover:text-charcoal transition-colors cursor-pointer">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] text-muted bg-muted-bg rounded-lg px-3 py-2">Receiver has to update the deal</p>
              <select value={dealReceiver} onChange={(e) => setDealReceiver(e.target.value)}
                className="w-full px-3 py-2 rounded-[0.75rem] border border-border bg-surface text-charcoal text-xs focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select a business...</option>
                {allBusinesses.filter((b) => b.uid !== user?.uid).sort((a, b) => a.companyName.localeCompare(b.companyName)).map((b) => (
                  <option key={b.uid} value={b.uid}>{b.companyName}</option>
                ))}
                <option value="__other__">Other (not in list)</option>
              </select>
              {dealReceiver === '__other__' && (
                <Input label="Company Name" value={dealOtherName} onChange={(e) => setDealOtherName(e.target.value)} placeholder="Enter company name" />
              )}
              <Input label="Amount (₹)" type="number" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="100000" />
              {dealMsg && <p className={`text-xs ${dealMsg.includes('Failed') || dealMsg.includes('Select') ? 'text-danger' : 'text-success'}`}>{dealMsg}</p>}
              <Button onClick={handleRecordDeal} loading={dealSaving} className="w-full text-xs">Confirm Deal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}
