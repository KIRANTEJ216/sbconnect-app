import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBusinessProfile, updateBusinessProfile, getOrCreateConversation } from '../lib/firestore';
import { getUserProfile } from '../lib/auth';
import { uploadProfilePhoto, uploadProfileCatalog } from '../lib/storage';
import { formatDate } from '../lib/format';
import type { BusinessProfile, UserProfile } from '../types';
import { INDUSTRIES, COMPANY_SIZES } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';

function QrCode({ value, size, fgColor }: { value: string; size: number; fgColor: string }) {
  const [QRCodeSVG, setQRCodeSVG] = useState<React.ComponentType<{ value: string; size: number; fgColor: string }> | null>(null);

  useEffect(() => {
    import('qrcode.react').then((mod) => setQRCodeSVG(() => mod.QRCodeSVG));
  }, []);

  if (!QRCodeSVG) {
    return (
      <div className="w-[180px] h-[180px] bg-muted-bg rounded-2xl flex items-center justify-center">
        <span className="text-xs text-muted">Loading QR...</span>
      </div>
    );
  }

  return <QRCodeSVG value={value} size={size} fgColor={fgColor} />;
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    ownerName: '',
    phone: '',
    companyName: '',
    categories: [] as string[],
    companySize: '',
    location: '',
    contactEmail: '',
    website: '',
    description: '',
  });

  const [editingMembership, setEditingMembership] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<'active' | 'inactive' | 'expired'>('active');
  const [membershipExpiry, setMembershipExpiry] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [bp, up] = await Promise.all([
        getBusinessProfile(id),
        getUserProfile(id),
      ]);
      if (bp) {
        if (bp.membershipStatus === 'active' && Date.now() > bp.membershipExpiry) {
          bp.membershipStatus = 'expired';
          updateBusinessProfile(bp.uid, { membershipStatus: 'expired' }).catch(console.error);
        }
        setProfile(bp);
      }
      setUserProfile(up);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleChat = async () => {
    if (!user || !id) return;
    setChatLoading(true);
    const convId = await getOrCreateConversation(user.uid, id);
    window.location.href = `/chat/${convId}`;
  };

  const startEditing = () => {
    if (!profile) return;
    setError('');
    if (profile.locked) {
      setError('This profile is locked. Maximum 3 edits reached.');
      return;
    }
    setForm({
      ownerName: profile.ownerName || '',
      phone: profile.phone || '',
      companyName: profile.companyName,
      categories: [...(profile.categories ?? [])],
      companySize: profile.companySize,
      location: profile.location,
      contactEmail: profile.contactEmail,
      website: profile.website,
      description: profile.description,
    });
    setPhotoPreview(profile.photoURL || '');
    setCatalogName(profile.catalogPDFURL ? 'catalog.pdf' : '');
    setEditing(true);
  };

  const toggleCategory = (cat: string) => {
    setForm((f) => {
      const cats = f.categories ?? [];
      return {
        ...f,
        categories: cats.includes(cat)
          ? cats.filter((c) => c !== cat)
          : [...cats, cat],
      };
    });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Photo must be under 5MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files (JPG, PNG, WebP) are allowed.');
      return;
    }
    setPhotoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCatalog = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('Catalog PDF must be under 10MB.');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed for catalogs.');
      return;
    }
    setCatalogFile(file);
    setError('');
    setCatalogName(file.name);
  };

  const handleSave = async () => {
    setError('');
    if (!user || !profile) return;
    if (!form.companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone number is required.');
      return;
    }
    if ((form.categories ?? []).length === 0) {
      setError('Please select at least one category.');
      return;
    }
    if (!form.companySize) {
      setError('Please select a company size.');
      return;
    }
    if (!form.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!form.contactEmail.trim()) {
      setError('Contact email is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Company description is required.');
      return;
    }
    setSaving(true);
    try {
      let photoURL = profile.photoURL || '';
      let catalogPDFURL = profile.catalogPDFURL || '';
      const newEditCount = (profile.editCount || 0) + 1;
      const locked = newEditCount >= 3;

      if (photoFile) {
        photoURL = await uploadProfilePhoto(user.uid, photoFile);
      }
      if (catalogFile) {
        catalogPDFURL = await uploadProfileCatalog(user.uid, catalogFile);
      }

      await updateBusinessProfile(user.uid, {
        ownerName: form.ownerName,
        phone: form.phone,
        companyName: form.companyName,
        categories: form.categories,
        companySize: form.companySize,
        location: form.location,
        contactEmail: form.contactEmail,
        website: form.website,
        description: form.description,
        photoURL,
        catalogPDFURL,
        editCount: newEditCount,
        locked,
      });

      setProfile({
        ...profile,
        ownerName: form.ownerName,
        phone: form.phone,
        companyName: form.companyName,
        categories: form.categories,
        companySize: form.companySize,
        location: form.location,
        contactEmail: form.contactEmail,
        website: form.website,
        description: form.description,
        photoURL,
        catalogPDFURL,
        editCount: newEditCount,
        locked,
      });
      setEditing(false);
      setPhotoFile(null);
      setCatalogFile(null);
      setError('');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMembership = () => {
    setMembershipStatus(profile!.membershipStatus);
    setMembershipExpiry(new Date(profile!.membershipExpiry).toISOString().split('T')[0]);
    setEditingMembership(true);
  };

  const handleSaveMembership = async () => {
    setError('');
    if (!user || !profile) return;
    setSaving(true);
    try {
      const expiryTimestamp = new Date(membershipExpiry).getTime();
      await updateBusinessProfile(user.uid, {
        membershipStatus,
        membershipExpiry: expiryTimestamp,
      });
      setProfile({ ...profile, membershipStatus, membershipExpiry: expiryTimestamp });
      setEditingMembership(false);
    } catch (err) {
      console.error('Failed to update membership:', err);
      setError('Failed to save membership. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const isOwnProfile = user?.uid === id;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="skeleton h-48 rounded-[2.5rem]" />
            <div className="skeleton h-32 rounded-[2.5rem]" />
          </div>
          <div className="skeleton h-64 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-charcoal tracking-tight">Profile Not Found</h2>
        <p className="text-steel mt-2">This business profile hasn't been created yet.</p>
        <Link to="/dashboard" className="text-primary hover:text-primary-hover text-sm mt-4 inline-block transition-colors">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/profile/${id}`;

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal tracking-tight">Business Profile</h1>
        <div className="flex gap-2">
          {isOwnProfile && !editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Profile
            </Button>
          )}
          {user?.uid !== id && (
            <Button onClick={handleChat} loading={chatLoading} size="sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Send Message
            </Button>
          )}
        </div>
      </div>

      {profile.locked && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-danger-light text-danger border border-danger/20 text-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Profile locked — maximum 3 edits reached. Contact admin to unlock.
        </div>
      )}
      {isOwnProfile && !profile.locked && (
        <div className="text-xs text-muted font-mono tracking-tight">
          Edits remaining: {Math.max(0, 3 - (profile.editCount || 0))} of 3
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-charcoal tracking-tight">Edit Profile</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} loading={saving}>Save Changes</Button>
                  </div>
                </div>

                <Input
                  label="Owner Name"
                  value={form.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  required
                />
                <Input
                  label="Company Name"
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-2">Categories</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INDUSTRIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-2 text-sm rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                          form.categories.includes(cat)
                            ? 'border-primary bg-primary-light text-primary font-medium'
                            : 'border-border text-steel hover:border-primary'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Company Size</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {COMPANY_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => update('companySize', s)}
                        className={`px-3 py-2.5 text-sm rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                          form.companySize === s
                            ? 'border-primary bg-primary-light text-primary font-medium'
                            : 'border-border text-steel hover:border-primary'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Location"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Company Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border border-border bg-muted-bg flex items-center justify-center overflow-hidden shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                        {photoPreview ? 'Change Photo' : 'Upload Photo'}
                      </Button>
                      {photoPreview && (
                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} className="text-xs text-danger ml-3 hover:underline cursor-pointer">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Catalog / Brochure (PDF)</label>
                  <div className="flex items-center gap-3">
                    <input ref={catalogRef} type="file" accept=".pdf" onChange={handleCatalog} className="hidden" />
                    <Button type="button" variant="outline" size="sm" onClick={() => catalogRef.current?.click()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      {catalogName || 'Upload PDF'}
                    </Button>
                    {catalogName && (
                      <button type="button" onClick={() => { setCatalogFile(null); setCatalogName(''); }} className="text-xs text-danger hover:underline cursor-pointer">
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <Input
                  label="Contact Email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => update('contactEmail', e.target.value)}
                  required
                />
                <Input
                  label="Website"
                  type="url"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">
                    Company Description
                    <span className="text-muted font-normal"> ({form.description.length}/500)</span>
                  </label>
                  <textarea
                    className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all resize-none"
                    rows={4}
                    maxLength={500}
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <TiltCard>
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        {profile.photoURL ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                            <img src={profile.photoURL} alt={profile.companyName} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-bold text-lg">
                            {profile.companyName.charAt(0)}
                          </div>
                        )}
                        <div className={`w-2.5 h-2.5 rounded-full ${userProfile?.onlineStatus === 'online' ? 'bg-success' : 'bg-zinc-300'}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-bold text-charcoal tracking-tight">{profile.companyName}</h2>
                        {profile.verified ? (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-success-light text-success border border-success/20">Verified</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-warning-light text-warning border border-warning/20">Pending Verification</span>
                        )}
                      </div>
                      {profile.ownerName && (
                        <p className="text-sm text-muted mt-0.5">Owned by {profile.ownerName}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {(profile.categories ?? []).map((cat) => (
                          <span key={cat} className="px-3 py-1 text-xs font-medium rounded-xl bg-primary-light text-primary border border-primary/20">{cat}</span>
                        ))}
                        <span className="text-sm text-muted font-mono tracking-tight">{profile.companySize} employees</span>
                      </div>
                      <p className="text-steel mt-1.5">{profile.location}</p>
                    </div>
                    <span className="text-xs text-muted font-mono">
                      {userProfile?.onlineStatus === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              </TiltCard>

              <TiltCard>
              <Card>
                <CardContent className="p-8">
                  <h3 className="font-semibold text-charcoal tracking-tight mb-4">About</h3>
                  <p className="text-steel leading-relaxed">
                    {profile.description || 'No description provided.'}
                  </p>
                </CardContent>
              </Card>
              </TiltCard>

              <TiltCard>
              <Card>
                <CardContent className="p-8">
                  <h3 className="font-semibold text-charcoal tracking-tight mb-4">Contact</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span className="text-steel">{profile.contactEmail}</span>
                    </div>
                    {profile.phone && (
                      <div className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <span className="text-steel">{profile.phone}</span>
                      </div>
                    )}
                    {profile.website && (
                      <div className="flex items-center gap-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
                          {profile.website}
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </TiltCard>

              {profile.catalogPDFURL && (
              <TiltCard>
              <Card>
                <CardContent className="p-8">
                  <h3 className="font-semibold text-charcoal tracking-tight mb-4">Catalog</h3>
                  <a href={profile.catalogPDFURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-primary-light text-primary rounded-xl text-sm font-medium hover:bg-primary-light/80 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    View Catalog PDF
                  </a>
                </CardContent>
              </Card>
              </TiltCard>
              )}
            </>
          )}

          {editingMembership ? (
          <TiltCard>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-charcoal tracking-tight">Edit Membership</h3>
                <button onClick={() => setEditingMembership(false)} className="text-sm text-muted hover:text-charcoal transition-colors cursor-pointer">Cancel</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted font-mono tracking-tight uppercase block mb-1.5">Status</label>
                  <select
                    value={membershipStatus}
                    onChange={(e) => setMembershipStatus(e.target.value as 'active' | 'inactive' | 'expired')}
                    className="w-full px-3 py-2 rounded-input border border-border bg-canvas text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <Input label="Expiry Date" type="date" value={membershipExpiry} onChange={(e) => setMembershipExpiry(e.target.value)} />
                <Button onClick={handleSaveMembership} loading={saving} className="w-full">Save</Button>
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          ) : (
          <TiltCard>
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-charcoal tracking-tight">Membership</h3>
                {isOwnProfile && (
                  <button onClick={handleEditMembership} className="text-sm text-primary hover:text-primary-hover transition-colors font-medium cursor-pointer">
                    Edit
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <Badge variant={profile.membershipStatus === 'active' ? 'success' : profile.membershipStatus === 'expired' ? 'danger' : 'neutral'}>
                    {profile.membershipStatus === 'active' ? 'Active Member' : profile.membershipStatus.charAt(0).toUpperCase() + profile.membershipStatus.slice(1)}
                  </Badge>
                </div>
                {(() => {
                  const now = Date.now();
                  const diff = profile.membershipExpiry - now;
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  if (profile.membershipStatus === 'active' && days <= 30) {
                    return <p className="text-sm text-warning font-medium">{days <= 0 ? 'Expiring today' : `${days} days remaining`}</p>;
                  }
                  if (profile.membershipStatus === 'expired' || days < 0) {
                    return <p className="text-sm text-danger font-medium">Expired {Math.abs(days)} days ago</p>;
                  }
                  return null;
                })()}
                <div className="text-sm">
                  <span className="text-muted font-mono tracking-tight">Active since </span>
                  <span className="text-charcoal font-medium">{formatDate(profile.createdAt)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted font-mono tracking-tight">Expires </span>
                  <span className="text-charcoal font-medium">{formatDate(profile.membershipExpiry)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          )}
        </div>

        <div className="space-y-6">
          {profile.photoURL && (
          <TiltCard>
          <Card>
            <CardContent className="p-6">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <img src={profile.photoURL} alt={profile.companyName} className="w-full h-full object-cover" />
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          )}
          <TiltCard>
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="font-semibold text-charcoal tracking-tight mb-6">QR Code</h3>
              <div className="bg-white p-5 rounded-2xl border border-border inline-block">
                <QrCode value={profileUrl} size={180} fgColor="#18181B" />
              </div>
              <p className="text-xs text-muted mt-4 font-mono tracking-tight">Scan to view profile</p>
            </CardContent>
          </Card>
          </TiltCard>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
