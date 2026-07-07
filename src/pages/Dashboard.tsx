import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBusinessProfile, getAllProfiles, getAllRequests, getUserRequests, getLeaderboard, recordDeal } from '../lib/firestore';
import { formatDate, formatCurrency } from '../lib/format';
import type { BusinessProfile, LeaderboardEntry } from '../types';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';


function CollapsibleSection({ title, icon, defaultOpen, children }: { title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <TiltCard>
      <Card>
        <div className="stat-accent-top">
          <CardHeader>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                {icon && <span className="text-lg shrink-0">{icon}</span>}
                <h3 className="font-semibold text-charcoal tracking-tight">{title}</h3>
              </div>
              <div className={`w-6 h-6 rounded-lg bg-muted-bg flex items-center justify-center transition-colors duration-200 group-hover:bg-primary-light ${open ? 'bg-primary-light' : ''}`}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-muted transition-transform duration-200 ${open ? 'rotate-180 text-primary' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>
          </CardHeader>
        </div>
        <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <CardContent>
            {children}
          </CardContent>
        </div>
      </Card>
    </TiltCard>
  );
}


export default function Dashboard() {
  const { user, profile } = useAuth();
  const [myProfile, setMyProfile] = useState<BusinessProfile | null>(null);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [myRequests, setMyRequests] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [allBusinesses, setAllBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealReceiver, setDealReceiver] = useState('');
  const [dealOtherName, setDealOtherName] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealSaving, setDealSaving] = useState(false);
  const [dealMsg, setDealMsg] = useState('');

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const [bp, all, allReqs, myReqs, lb] = await Promise.all([
          getBusinessProfile(user.uid),
          getAllProfiles(),
          getAllRequests(),
          getUserRequests(user.uid),
          getLeaderboard(),
        ]);
        setMyProfile(bp);
        setTotalProfiles(all.length);
        setOpenRequests(allReqs.filter((r) => r.status === 'open').length);
        setMyRequests(myReqs.length);
        setLeaderboard(lb);
        setAllBusinesses(all);
      } catch (err) {
        console.error('Dashboard load error:', err);
        setMyProfile(null);
        setTotalProfiles(0);
        setOpenRequests(0);
        setMyRequests(0);
      }
      setLoading(false);
    }
    load();
  }, [user]);

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
      const lb = await getLeaderboard();
      setLeaderboard(lb);
      setDealMsg(`✅ Deal recorded! ₹${dealAmount} given to ${dealReceiver === '__other__' ? dealOtherName.trim() : allBusinesses.find((b) => b.uid === dealReceiver)?.companyName}`);
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

  const statCards: { label: string; value: string; sub?: string; variant: 'accent' | 'success' | 'neutral' }[] = [
    {
      label: 'Membership Status',
      value: myProfile?.membershipStatus === 'active'
        ? `Member since ${formatDate(myProfile.createdAt)}`
        : myProfile?.membershipStatus ?? 'Inactive',
      variant: myProfile?.membershipStatus === 'active' ? 'success' : 'neutral',
      sub: profile?.onlineStatus === 'online' ? 'Online' : 'Offline',
    },
    {
      label: 'Members Directory',
      value: String(totalProfiles),
      variant: 'accent',
    },
    {
      label: 'Requests',
      value: `${myRequests} mine · ${openRequests} open`,
      variant: 'accent',
    },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-charcoal tracking-tight">Dashboard</h1>
        <p className="text-steel mt-1.5">Welcome, {myProfile?.ownerName || user?.displayName || user?.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s, idx) => (
          <TiltCard key={s.label} className="h-full">
          <div className="stat-accent-top rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/10 h-full flex flex-col">
            <CardContent className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted font-semibold tracking-tight">{s.label}</p>
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
                <Badge variant={s.variant}>{s.value}</Badge>
              </div>
              {s.sub && (
                <p className="mt-2 text-xs text-muted font-medium tracking-tight flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${profile?.onlineStatus === 'online' ? 'bg-green-500' : 'bg-muted/40'}`} />
                  {s.sub}
                </p>
              )}
            </CardContent>
          </div>
          </TiltCard>
        ))}
      </div>

      {!myProfile ? (
        <Card>
          <CardContent className="p-14 text-center">
            <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-charcoal tracking-tight mb-2">Create Your Business Profile</h2>
            <p className="text-sm text-steel mb-8 max-w-md mx-auto">
              Set up your business profile to connect with other businesses in the community.
            </p>
            <Link
              to="/create-profile"
              className="inline-flex items-center px-6 py-2.5 bg-primary text-white rounded-[0.75rem] hover:bg-primary-hover text-sm font-medium transition-all duration-200 active:scale-[0.97]"
            >
              Get Started
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CollapsibleSection
              title="Quick Actions"
              icon="⚡"
            >
              <div className="space-y-3">
                <Link
                  to="/requests/create"
                  className="flex items-center gap-3 px-4 py-3 bg-canvas rounded-xl hover:bg-primary-light transition-colors text-sm font-medium text-charcoal"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  Create a Request
                </Link>
                <Link
                  to={`/profile/${user?.uid}`}
                  className="flex items-center gap-3 px-4 py-3 bg-canvas rounded-xl hover:bg-primary-light transition-colors text-sm font-medium text-charcoal"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  View My Profile
                </Link>
                <button
                  onClick={() => setShowDealForm(true)}
                  className="flex items-center gap-3 px-4 py-3 bg-canvas rounded-xl hover:bg-primary-light transition-colors text-sm font-medium text-charcoal w-full text-left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Record Business Given
                </button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Your Business"
              icon="🏠"
            >
              <div className="space-y-2">
                <p className="font-medium text-charcoal">{myProfile.companyName}</p>
                <p className="text-sm text-steel font-mono tracking-tight">{(myProfile.categories ?? []).join(', ')} &middot; {myProfile.location}</p>
                <div>
                  {myProfile.verified ? (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-success-light text-success border border-success/20">Verified Business</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-warning-light text-warning border border-warning/20">Pending Verification</span>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          </div>

          <CollapsibleSection
            title="Leaderboard"
            icon="🏆"
          >
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No deals recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {leaderboard.slice(0, 7).map((entry, i) => (
                  <div key={entry.uid} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`rank-medal ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      <div className="min-w-0">
                        <Link to={`/profile/${entry.uid}`} className="text-sm font-medium text-charcoal hover:text-primary transition-colors truncate block max-w-[180px]">
                          {entry.ownerName || entry.companyName}
                        </Link>
                        <p className="text-[10px] text-muted truncate max-w-[180px]">{entry.companyName}</p>
                        <p className="text-[10px] text-muted font-mono tracking-tight">{entry.dealCount} deal{entry.dealCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-charcoal shrink-0 ml-2">{formatCurrency(String(entry.totalRevenue))}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {showDealForm && myProfile && (
        <TiltCard>
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
