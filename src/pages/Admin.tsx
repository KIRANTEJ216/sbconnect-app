import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers, setUserRole, getUserByEmail, getUnverifiedProfiles, verifyBusinessProfile } from '../lib/firestore';
import { formatDate } from '../lib/format';
import type { UserProfile, BusinessProfile } from '../types';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';

export default function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pending, setPending] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [searchMsg, setSearchMsg] = useState('');
  const [searching, setSearching] = useState(false);

  const isSuper = profile?.role === 'super_admin';

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [all, unverified] = await Promise.all([
      getAllUsers(),
      getUnverifiedProfiles(),
    ]);
    setUsers(all.sort((a, b) => a.email.localeCompare(b.email)));
    setPending(unverified);
    setLoading(false);
  }

  const handleSetRole = async (uid: string, role: 'user' | 'admin' | 'super_admin') => {
    setSaving(uid);
    await setUserRole(uid, role);
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role } : u));
    setSaving(null);
  };

  const handleAddByEmail = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setSearchMsg('');
    try {
      const u = await getUserByEmail(email.trim());
      if (!u) {
        setSearchMsg('No user found with that email.');
        return;
      }
      if (u.role === 'admin' || u.role === 'super_admin') {
        setSearchMsg(`${u.displayName || u.email} is already ${u.role}.`);
        return;
      }
      await handleSetRole(u.uid, 'admin');
      setSearchMsg(`${u.displayName || u.email} promoted to admin.`);
      setEmail('');
    } catch (err) {
      console.error(err);
      setSearchMsg('Failed to find user.');
    } finally {
      setSearching(false);
    }
  };

  const handleApprove = async (uid: string) => {
    setApproving(uid);
    await verifyBusinessProfile(uid);
    setPending((prev) => prev.filter((p) => p.uid !== uid));
    setApproving(null);
  };

  const roleBadge = (role: string) => {
    const variants: Record<string, 'accent' | 'success' | 'neutral'> = {
      super_admin: 'accent',
      admin: 'success',
      user: 'neutral',
    };
    return <Badge variant={variants[role] || 'neutral'}>{role.replace('_', ' ')}</Badge>;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-48 rounded-[2.5rem]" />
        <div className="skeleton h-96 rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal tracking-tight">Admin Panel</h1>
        <p className="text-steel mt-1.5">Manage users, roles, and profile verification</p>
      </div>

      {pending.length > 0 && (
        <TiltCard>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-charcoal tracking-tight flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Verification Requests ({pending.length})
              </h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pending.map((p) => (
                <div key={p.uid} className="flex items-center justify-between p-4 rounded-2xl border border-border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-warning-light rounded-xl flex items-center justify-center text-warning font-bold text-sm">
                      {p.companyName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-charcoal text-sm">{p.companyName}</p>
                      <p className="text-xs text-muted font-mono mt-0.5 tracking-tight">{p.contactEmail} &middot; {p.location}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="neutral">Pending</Badge>
                    <Button size="sm" onClick={() => handleApprove(p.uid)} loading={approving === p.uid}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </TiltCard>
      )}

      {isSuper && (
        <TiltCard>
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-charcoal tracking-tight">Add Admin by Email</h3>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <Button onClick={handleAddByEmail} loading={searching}>Add Admin</Button>
            </div>
            {searchMsg && (
              <p className={`text-sm mt-3 ${searchMsg.includes('already') || searchMsg.includes('No user') || searchMsg.includes('Failed') ? 'text-danger' : 'text-success'}`}>
                {searchMsg}
              </p>
            )}
          </CardContent>
        </Card>
        </TiltCard>
      )}

      <TiltCard>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-charcoal tracking-tight">All Users ({users.length})</h3>
            <Button variant="outline" size="sm" onClick={loadAll}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 font-medium text-muted font-mono tracking-tight">Name</th>
                  <th className="pb-3 font-medium text-muted font-mono tracking-tight">Email</th>
                  <th className="pb-3 font-medium text-muted font-mono tracking-tight">Role</th>
                  <th className="pb-3 font-medium text-muted font-mono tracking-tight">Joined</th>
                  {isSuper && <th className="pb-3 font-medium text-muted font-mono tracking-tight">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-canvas/50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-medium text-charcoal">{u.displayName || '—'}</span>
                    </td>
                    <td className="py-3 pr-4 text-steel">{u.email}</td>
                    <td className="py-3 pr-4">{roleBadge(u.role)}</td>
                    <td className="py-3 pr-4 text-muted font-mono text-xs">{formatDate(u.createdAt)}</td>
                    {isSuper && (
                      <td className="py-3">
                        {u.uid !== profile?.uid && (
                          <div className="flex gap-1">
                            {u.role !== 'admin' && (
                              <Button size="sm" variant="outline" onClick={() => handleSetRole(u.uid, 'admin')} loading={saving === u.uid}>
                                Make Admin
                              </Button>
                            )}
                            {u.role === 'admin' && (
                              <Button size="sm" variant="outline" onClick={() => handleSetRole(u.uid, 'user')} loading={saving === u.uid}>
                                Remove Admin
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </TiltCard>
    </div>
    </AnimatedPage>
  );
}
