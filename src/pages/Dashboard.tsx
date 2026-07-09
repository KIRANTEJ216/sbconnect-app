import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserRequests, recordDeal } from '../lib/firestore';
import { useProfiles, useRequestsQuery, useLeaderboardQuery, useBusinessProfile } from '../hooks/useFirebaseQuery';
import { formatDate, formatCurrency } from '../lib/format';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
      const receiverName = dealReceiver === '__other__' ? dealOtherName.trim() : allBusinesses.find((b) => b.uid === dealReceiver)?.companyName;
      setDealMsg(`🎉 Congratulations! Deal recorded — ₹${dealAmount} given to ${receiverName}`);
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s, idx) => {
          const inner = (
            <div className={`stat-accent-top rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/10 h-full flex flex-col ${s.to ? 'cursor-pointer' : ''}`}>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted font-semibold tracking-tight flex items-center gap-1.5">
                    {s.label}
                    {s.dot && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
                  </p>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    idx === 0 ? 'bg-primary/8 text-primary' :
                    idx === 1 ? 'bg-success/8 text-success' :
                    'bg-warning/8 text-warning'
                  }`}>
                    {idx === 0 ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
                      </svg>
                    ) : idx === 1 ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
                    <span className={`w-1.5 h-1.5 rounded-full ${profile?.onlineStatus === 'online' ? 'bg-green-500' : 'bg-muted/40'}`} />
                    {s.sub}
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

      {user && <StrikeWarning uid={user.uid} />}

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Record Business Given
              </button>
            </div>
          </div>

          {/* Business Profile */}
          <div className="rounded-card bg-surface border border-border shadow-card p-3">
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
                  <Badge variant={myProfile.membershipStatus === 'active' ? 'success' : myProfile.membershipStatus === 'expired' ? 'danger' : 'neutral'}>
                    {myProfile.membershipStatus === 'expired' ? 'EXPIRED' : myProfile.membershipStatus.charAt(0).toUpperCase() + myProfile.membershipStatus.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
            {myProfile.membershipExpiry > 0 && (
              <div className="mt-2"><MembershipCountdown membershipExpiry={myProfile.membershipExpiry} /></div>
            )}
          </div>

          {/* Upcoming Meetings */}
          <DashboardUpdates />

          {/* Leaderboard - spans full width */}
          <div className="lg:col-span-3 rounded-card bg-surface border border-border shadow-card p-3">
            <h3 className="font-semibold text-charcoal tracking-tight text-xs mb-2">Leaderboard</h3>
            {leaderboard.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No deals recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={entry.uid} className="flex items-center gap-2 py-1">
                    <span className={`rank-medal ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'} text-xs`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <Link to={`/profile/${entry.uid}`} className="text-xs font-medium text-charcoal hover:text-primary transition-colors truncate max-w-[120px]">
                      {entry.ownerName || entry.companyName}
                    </Link>
                    <span className="text-xs font-semibold text-charcoal">{formatCurrency(String(entry.totalRevenue))}</span>
                  </div>
                ))}
              </div>
            )}
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
                label="Amount (₹)"
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
