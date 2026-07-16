import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllProfiles } from '../lib/firestore';
import type { BusinessProfile } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';

export default function Profiles() {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProfiles()
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  const filtered = profiles.filter(
    (p) =>
      p.companyName.toLowerCase().includes(search.toLowerCase()) ||
      p.categories.some((c) => c.toLowerCase().includes(search.toLowerCase())) ||
      (p.keywords ?? []).some((k) => k.toLowerCase().includes(search.toLowerCase())) ||
      p.location.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-12 w-full rounded-[0.75rem]" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-40 rounded-[2.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Business Directory</h1>
        <p className="text-steel mt-1.5 gradient-text">Discover businesses in the community</p>
      </div>

      <Input
        placeholder="Search by name, category, keyword, or location..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-14 text-center">
            <p className="text-muted">No profiles found{search ? ' matching your search' : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <StaggerList className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filtered.map((p) => (
            <StaggerItem key={p.uid} className="h-full">
            <Link to={`/profile/${p.uid}`} className="block h-full">
              <TiltCard className="h-full">
              <Card className="hover:shadow-card-hover transition-all duration-300 cursor-pointer h-full hover:-translate-y-0.5">
                <CardContent className="p-6 flex flex-col">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-bold">
                        {p.companyName.charAt(0)}
                      </div>
                      <Badge variant={p.membershipStatus === 'active' ? 'success' : 'neutral'}>
                        {p.membershipStatus === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-charcoal tracking-tight">{p.companyName}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      {p.verified ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-success-light text-success border border-success/20">Verified</span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-light text-warning border border-warning/20">Pending</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto pt-3 space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {(p.categories ?? []).slice(0, 2).map((cat) => (
                        <span key={cat} className="px-2 py-0.5 text-[10px] font-medium rounded-lg bg-primary-light text-primary border border-primary/20">
                          {cat}
                        </span>
                      ))}
                      {(p.categories ?? []).length > 2 && (
                        <span className="text-[10px] text-muted font-mono">+{p.categories.length - 2}</span>
                      )}
                    </div>
                    {(p.keywords ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(p.keywords ?? []).slice(0, 2).map((kw) => (
                          <span key={kw} className="px-2 py-0.5 text-[10px] font-medium rounded-lg bg-canvas text-muted border border-border">
                            {kw}
                          </span>
                        ))}
                        {(p.keywords ?? []).length > 2 && (
                          <span className="text-[10px] text-muted font-mono">+{p.keywords.length - 2}</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-steel pt-0.5 border-t border-border/40">{p.location}</p>
                  </div>
                </CardContent>
              </Card>
              </TiltCard>
            </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
    </AnimatedPage>
  );
}
