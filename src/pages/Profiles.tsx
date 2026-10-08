import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllProfiles } from '../lib/firestore';
import { filterProfiles } from '../lib/directorySearch';
import type { BusinessProfile } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';

/** Cards mounted at a time. A search almost always narrows below this. */
const PAGE_SIZE = 60;

export default function Profiles() {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    getAllProfiles(999, true)
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  // Delegated to the shared helper so the matching rules (multi-token AND,
  // cross-field haystack) are unit-tested in tests/directory-search.test.mjs
  // instead of only observable through the UI.
  const filtered = useMemo(
    () => filterProfiles(profiles, search),
    [profiles, search],
  );

  // A new query always starts from the first page, otherwise a search that
  // narrows to a handful of results can land the user past the end of them.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleProfiles = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (loading) {
    return (
    <div className="max-w-5xl mx-auto space-y-3">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-card bg-gradient-to-br from-primary/5 via-primary-light/5 to-success/5 border border-primary/10 shadow-card px-4 py-4 text-center">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">SB Connect</p>
        <h1 className="text-fluid-h1 font-bold gradient-text tracking-tight">Business Directory</h1>
        <p className="text-steel text-sm mt-0.5">Discover businesses in the community</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-charcoal">{profiles.length}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Verified</p>
            <p className="text-lg font-bold text-success">{profiles.filter((p) => p.verified).length}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Locations</p>
            <p className="text-lg font-bold text-primary">{new Set(profiles.map((p) => p.location).filter(Boolean)).size}</p>
          </div>
        </div>
        <div className="mt-3 max-w-md mx-auto">
          <Input
            aria-label="Search the business directory"
            placeholder="Search name, owner, category, keyword or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* A live count makes it obvious the query was applied, instead of the
              user having to infer it from the cards changing. */}
          {search.trim() && (
            <p className="mt-2 text-xs text-muted tabular" aria-live="polite">
              {filtered.length === 0
                ? `No matches for "${search.trim()}"`
                : `${filtered.length} ${filtered.length === 1 ? 'business' : 'businesses'} match "${search.trim()}"`}
            </p>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-14 text-center">
            <EmptyState
              noun="business"
              title={search ? 'No businesses match that search' : 'No verified businesses yet'}
              body={
                search
                  ? 'Try a different name, category, keyword or location.'
                  : 'Businesses appear here once an admin verifies their profile.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3"
          // Only the rendered slice goes in the DOM, so a 900-member directory
          // still mounts a manageable number of cards. Paging is used instead of
          // a virtualizer on purpose: windowing kept resolving its row range
          // against a stale scroll offset, which put cards the query had
          // filtered out back on screen.
          role="list"
        >
          {visibleProfiles.map((p) => (
            <div key={p.uid} role="listitem" className="h-full">
            <Link to={`/profile/${p.uid}`} className="block h-full">
              <TiltCard className="h-full">
              <Card className="hover:shadow-card-hover transition-all duration-300 cursor-pointer h-full hover:-translate-y-0.5">
                <CardContent className="p-4 flex flex-col">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-bold">
                        {(p.companyName || '?').charAt(0)}
                      </div>
                      <Badge variant={p.membershipStatus === 'active' ? 'success' : 'neutral'}>
                        {p.membershipStatus === 'active' ? 'Active' : 'Pending'}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-charcoal tracking-tight">{p.companyName}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      {p.verified ? (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-success-light text-success border border-success/20">Verified</span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-warning-light text-warning border border-warning/20">Pending</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto pt-3 space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {(p.categories ?? []).slice(0, 2).map((cat) => (
                        <span key={cat} className="px-2 py-0.5 text-xs font-medium rounded-lg bg-primary-light text-primary border border-primary/20">
                          {cat}
                        </span>
                      ))}
                      {(p.categories ?? []).length > 2 && (
                        <span className="text-xs text-muted font-mono">+{p.categories.length - 2}</span>
                      )}
                    </div>
                    {(p.keywords ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(p.keywords ?? []).slice(0, 2).map((kw) => (
                          <span key={kw} className="px-2 py-0.5 text-xs font-medium rounded-lg bg-canvas text-muted border border-border">
                            {kw}
                          </span>
                        ))}
                        {(p.keywords ?? []).length > 2 && (
                          <span className="text-xs text-muted font-mono">+{p.keywords.length - 2}</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-steel pt-0.5 border-t border-border/40">{p.location}</p>
                  </div>
                </CardContent>
              </Card>
              </TiltCard>
            </Link>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
            <span className="ml-1.5 text-muted tabular">
              ({visibleCount} of {filtered.length})
            </span>
          </Button>
        </div>
      )}
    </div>
    </AnimatedPage>
  );
}
