import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getBusinessProfile, updateBusinessProfile, getProfileByContactEmail, getProfileByPhone, getProfilesForReferral } from '../lib/firestore';
import { isAdmin, isSuperAdmin } from '../lib/admin';
import { getUserProfile } from '../lib/auth';
import { replaceProfilePhoto, uploadCatalogFiles, downloadCatalogFile, compressImage, compressProfilePhoto } from '../lib/storage';
import { formatDate } from '../lib/format';
import type { BusinessProfile, UserProfile } from '../types';
import { INDUSTRIES, COMPANY_SIZES, LOCATIONS } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';
import { MembershipCountdown } from '../components/MembershipCountdown';
import { CameraCapture } from '../components/CameraCapture';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    ownerName: '',
    ownerSurname: '',
    phone: '',
    companyName: '',
    categories: [] as string[],
    companySize: '',
    location: '',
    keywords: [] as string[],
    contactEmail: '',
    website: '',
    description: '',
    referredByPhone: '',
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [referredByName, setReferredByName] = useState('');
  const [referredByStatus, setReferredByStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [referralOptions, setReferralOptions] = useState<{ name: string; phone: string }[]>([]);
  const [locationFiltered, setLocationFiltered] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const handleLocationInput = (value: string) => {
    update('location', value);
    const filtered = value.trim()
      ? LOCATIONS.filter((l) => l.toLowerCase().includes(value.toLowerCase()))
      : [];
    setLocationFiltered(filtered);
    setShowLocationDropdown(filtered.length > 0);
  };

  const [editingMembership, setEditingMembership] = useState(false);
  const [editPaidDate, setEditPaidDate] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [bp, up] = await Promise.all([
        getBusinessProfile(id),
        getUserProfile(id),
      ]);
      if (bp) {
        if (bp.membershipDate > 0) {
          const computedExpiry = bp.membershipDate + 364 * 24 * 60 * 60 * 1000;
          if (bp.membershipExpiry !== computedExpiry) {
            bp.membershipExpiry = computedExpiry;
            updateBusinessProfile(bp.uid, { membershipExpiry: computedExpiry }).catch(console.error);
          }
        }
        if (bp.membershipStatus === 'active' && bp.membershipExpiry > 0 && Date.now() > bp.membershipExpiry) {
          bp.membershipStatus = 'expired';
          updateBusinessProfile(bp.uid, { membershipStatus: 'expired' }).catch(console.error);
        }
        setProfile(bp);
      }
      setUserProfile(up);
      setLoading(false);
    }
    load();
    getProfilesForReferral(5).then((profiles) => {
      setReferralOptions(profiles.map((p) => ({
        name: `${p.ownerName} ${p.ownerSurname}`.trim() || p.companyName,
        phone: p.phone,
      })));
    }).catch(() => {});
  }, [id]);

  const startEditing = () => {
    if (!profile) return;
    setError('');
    if (profile.locked && !isAdminViewer) {
      setError('This profile is locked. Maximum 3 edits reached.');
      return;
    }
    const currentCategories = [...(profile.categories ?? [])];
    const customCats = currentCategories.filter((c) => !INDUSTRIES.includes(c as any));
    const presetCats = currentCategories.filter((c) => INDUSTRIES.includes(c as any));
    if (customCats.length > 0) {
      presetCats.push('Other');
      setCustomCategory(customCats[0]);
    } else {
      setCustomCategory('');
    }
    setForm({
      ownerName: profile.ownerName || '',
      ownerSurname: profile.ownerSurname || '',
      phone: profile.phone || '',
      companyName: profile.companyName,
      categories: presetCats,
      companySize: profile.companySize,
      location: profile.location,
      keywords: [...(profile.keywords ?? [])],
      contactEmail: profile.contactEmail,
      website: profile.website,
      description: profile.description,
      referredByPhone: profile.referredByPhone || '',
    });
    setReferredByName(profile.referredByName || '');
    setReferredByStatus(profile.referredByPhone ? 'found' : 'idle');
    setPhotoPreview(profile.photoURL || '');
    setEditing(true);
  };

  const toggleCategory = (cat: string) => {
    if (cat === 'Other' && form.categories.includes('Other')) {
      setCustomCategory('');
    }
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

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files (JPG, PNG, WebP) are allowed.');
      return;
    }
    try {
      const compressed = await compressProfilePhoto(file, 800, 0.85);
      const compressedFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
      setPhotoFile(compressedFile);
      setError('');
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(compressedFile);
    } catch {
      setError('Failed to compress image. Try a different file.');
    }
  };

  const handleCameraCapture = async (blob: Blob) => {
    try {
      const compressed = await compressProfilePhoto(new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' }), 800, 0.85);
      const file = new File([compressed], 'camera_photo.jpg', { type: 'image/jpeg' });
      setPhotoFile(file);
      setError('');
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } catch {
      setError('Failed to process camera photo.');
    }
    setCameraOpen(false);
  };

  const handleGalleryInstead = () => {
    setCameraOpen(false);
    setTimeout(() => photoRef.current?.click(), 100);
  };

  const handleCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const total = catalogFiles.length + files.length;
    if (total > 5) {
      setError(`Maximum 5 files allowed. You can add ${5 - catalogFiles.length} more.`);
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    for (const f of files) {
      if (f.size > maxSize) { setError(`"${f.name}" exceeds 10MB limit.`); return; }
      if (!allowed.includes(f.type)) { setError(`"${f.name}" must be JPG, PNG, WebP or PDF.`); return; }
    }
    const compressed = await Promise.all(files.map(async (f) => {
      if (f.type === 'application/pdf') return f;
      const blob = await compressImage(f, 1200, 0.8);
      return new File([blob], f.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }));
    setCatalogFiles((prev) => [...prev, ...compressed]);
    setError('');
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
    if (form.location.trim() && !LOCATIONS.includes(form.location.trim() as any)) {
      setError('Please select a valid location from the suggestions.');
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
    const normalizedPhone = normalizePhone(form.phone);
    if (normalizedPhone !== form.phone) setForm((f) => ({ ...f, phone: normalizedPhone }));
    const cleanEmail = form.contactEmail.toLowerCase().trim();

    const [existingEmail, existingPhone] = await Promise.all([
      getProfileByContactEmail(cleanEmail),
      getProfileByPhone(normalizedPhone),
    ]);
    if (existingEmail && existingEmail.uid !== user.uid && existingEmail.uid !== profile?.uid) { setError('This email is already registered to another business.'); setSaving(false); return; }
    if (existingPhone && existingPhone.uid !== user.uid && existingPhone.uid !== profile?.uid) { setError('This phone number is already registered to another business.'); setSaving(false); return; }

    setSaving(true);
    try {
      let photoURL = profile.photoURL || '';
      let catalogURLs = [...(profile.catalogURLs || [])];
      const newEditCount = isAdminViewer ? (profile.editCount || 0) : (profile.editCount || 0) + 1;
      const locked = isAdminViewer ? profile.locked : newEditCount >= 3;

      if (photoFile) {
        photoURL = await replaceProfilePhoto(user.uid, photoFile, profile.photoURL || '');
      }
      if (catalogFiles.length > 0) {
        catalogURLs = await uploadCatalogFiles(user.uid, catalogFiles);
      }

      const finalCategories = form.categories
        .filter((c) => c !== 'Other')
        .concat(customCategory.trim() ? [customCategory.trim()] : []);

      await updateBusinessProfile(user.uid, {
        ownerName: form.ownerName,
        ownerSurname: form.ownerSurname,
        phone: form.phone,
        companyName: form.companyName,
        categories: finalCategories,
        companySize: form.companySize,
        location: form.location,
        keywords: form.keywords,
        contactEmail: form.contactEmail,
        website: form.website && !form.website.startsWith('http://') && !form.website.startsWith('https://')
          ? `https://${form.website}`
          : form.website,
        description: form.description,
        photoURL,
        catalogURLs,
        editCount: newEditCount,
        locked,
        referredByPhone: form.referredByPhone,
        referredByName,
      });

      setProfile({
        ...profile,
        ownerName: form.ownerName,
        ownerSurname: form.ownerSurname,
        phone: form.phone,
        companyName: form.companyName,
        categories: finalCategories,
        companySize: form.companySize,
        location: form.location,
        keywords: form.keywords,
        contactEmail: form.contactEmail,
        website: form.website && !form.website.startsWith('http://') && !form.website.startsWith('https://')
          ? `https://${form.website}`
          : form.website,
        description: form.description,
        photoURL,
        catalogURLs,
        editCount: newEditCount,
        locked,
      });
      queryClient.invalidateQueries({ queryKey: ['businessProfile', user.uid] });
      setEditing(false);
      setPhotoFile(null);
      setCatalogFiles([]);
      setError('');
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMembership = () => {
    setEditPaidDate(profile!.paidDate > 0 ? new Date(profile!.paidDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditingMembership(true);
  };

  const handleSaveMembership = async () => {
    setError('');
    if (!user || !profile) return;
    setSaving(true);
    try {
      const paidTimestamp = new Date(editPaidDate).getTime();
      const expiryTimestamp = paidTimestamp + 364 * 24 * 60 * 60 * 1000;
      const derivedStatus = Date.now() >= expiryTimestamp ? 'expired' : 'active' as const;
      await updateBusinessProfile(user.uid, {
        membershipStatus: derivedStatus,
        paidDate: paidTimestamp,
        membershipDate: paidTimestamp,
        membershipExpiry: expiryTimestamp,
      });
      setProfile({ ...profile, membershipStatus: derivedStatus, paidDate: paidTimestamp, membershipDate: paidTimestamp, membershipExpiry: expiryTimestamp });
      queryClient.invalidateQueries({ queryKey: ['businessProfile', user.uid] });
      setEditingMembership(false);
    } catch (err) {
      console.error('Failed to update membership:', err);
      setError('Failed to save membership. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectReferral = (name: string, phone: string) => {
    update('referredByPhone', phone);
    setReferredByName(name);
    setReferredByStatus('found');
  };

  const normalizePhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    if (form.keywords.includes(trimmed.toLowerCase())) return;
    setForm((f) => ({ ...f, keywords: [...f.keywords, trimmed] }));
  };

  const removeKeyword = (kw: string) => {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((k) => k !== kw) }));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput.replace(/,+$/, '').trim());
      setKeywordInput('');
    }
  };

  const isOwnProfile = user?.uid === id;
  const isAdminViewer = isAdmin(authProfile?.role);
  const isSuperAdminUser = isSuperAdmin(authProfile?.role);
  const canEdit = isOwnProfile || isSuperAdminUser;

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
        <div className="flex items-center justify-center gap-3 mt-6">
          {(isOwnProfile || isAdminViewer) && (
            <Link
              to="/create-profile"
              className="inline-flex items-center px-5 py-2 bg-primary text-white rounded-[0.75rem] hover:bg-primary-hover text-sm font-medium transition-all active:scale-[0.97]"
            >
              Create Profile
            </Link>
          )}
          <Link to="/dashboard" className="text-primary hover:text-primary-hover text-sm transition-colors inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }


  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-3">
      <div className="rounded-card bg-gradient-to-br from-primary/5 via-primary-light/5 to-success/5 border border-primary/10 shadow-card px-4 py-3 text-center">
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">SB Connect</p>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-fluid-h1 font-bold gradient-text tracking-tight">
            {profile.companyName || 'Business Profile'}
          </h1>
          {profile.verified ? (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-success-light text-success border border-success/20">Verified</span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-light text-warning border border-warning/20">Pending</span>
          )}
        </div>
        <p className="text-steel text-sm">{profile.ownerName} {profile.ownerSurname} · {profile.location}</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Member Since</p>
            <p className="text-sm font-bold text-charcoal">{profile.membershipDate ? formatDate(profile.membershipDate) : '—'}</p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Status</p>
            <p className={`text-sm font-bold capitalize ${profile.membershipStatus === 'active' ? 'text-success' : profile.membershipStatus === 'expired' ? 'text-danger' : 'text-muted'}`}>{profile.membershipStatus || '—'}</p>
          </div>
          <div className="w-px h-6 bg-border" />
          <div>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Size</p>
            <p className="text-sm font-bold text-primary">{profile.companySize || '—'}</p>
          </div>
        </div>
        {profile.locked && (
          <p className="text-[10px] text-danger mt-1">Profile locked — max 3 edits reached</p>
        )}
        {isOwnProfile && !profile.locked && (
          <p className="text-[10px] text-muted mt-1">Edits remaining: {Math.max(0, 3 - (profile.editCount || 0))} of 3</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-2">
          {canEdit && !editing && (
            <Button size="xs" variant="outline" onClick={startEditing}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Profile
            </Button>
          )}
          {isOwnProfile && (
            <Link to="/my-issues" className="text-xs text-primary hover:text-primary-hover">My Issues</Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          {editing ? (
            <Card>
              <CardContent className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-charcoal tracking-tight">Edit Profile</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} loading={saving}>Save Changes</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Name"
                    value={form.ownerName}
                    onChange={(e) => update('ownerName', e.target.value)}
                  />
                  <Input
                    label="Surname"
                    value={form.ownerSurname}
                    onChange={(e) => update('ownerSurname', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Phone Number <span className="text-danger">*</span></label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-2.5 rounded-[0.75rem] border border-border bg-muted-bg text-sm text-charcoal font-medium shrink-0">+91</span>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onBlur={(e) => { const n = normalizePhone(e.target.value); if (n !== e.target.value) update('phone', n); }}
                      required
                      className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                    />
                  </div>
                </div>
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
                  {form.categories.includes('Other') && (
                    <div className="mt-3">
                      <Input
                        label="Specify your category"
                        type="text"
                        placeholder="e.g. AI Services, Interior Design"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                      />
                    </div>
                  )}
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

                <div className="relative">
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Location <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad, India"
                    value={form.location}
                    onChange={(e) => handleLocationInput(e.target.value)}
                    onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
                    onFocus={(e) => {
                      const filtered = e.target.value.trim()
                        ? LOCATIONS.filter((l) => l.toLowerCase().includes(e.target.value.toLowerCase()))
                        : [];
                      setLocationFiltered(filtered);
                      if (filtered.length > 0) setShowLocationDropdown(true);
                    }}
                    required
                    className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                  />
                  {showLocationDropdown && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
                      {locationFiltered.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); update('location', loc); setShowLocationDropdown(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-charcoal hover:bg-primary-light transition-colors cursor-pointer"
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">
                    Keywords <span className="text-muted font-normal">(sub-business categories)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                    {form.keywords.map((kw, i) => (
                      <span key={`${kw}-${i}`} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-primary-light text-primary">
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-danger transition-colors cursor-pointer">&times;</button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. steel-supply, it-services, pvc-pipes, solar-panels, packaging"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleKeywordKeyDown}
                      onBlur={() => { if (keywordInput.trim()) { addKeyword(keywordInput); setKeywordInput(''); } }}
                      className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted font-mono">Enter</span>
                  </div>
                  <p className="text-xs text-muted mt-1.5">Type a keyword and press Enter. e.g. steel-supply, it-services, pvc-pipes, packaging, solar-panels</p>
                </div>

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
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          {photoPreview ? 'Change' : 'Gallery'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                          Camera
                        </Button>
                      </div>
                      {photoPreview && (
                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} className="text-xs text-danger ml-3 hover:underline cursor-pointer">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Catalog Images (up to 5 files)</label>
                  <div className="flex items-center gap-3">
                    <input ref={catalogRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={handleCatalog} className="hidden" />
                    <Button type="button" variant="outline" size="sm" onClick={() => catalogRef.current?.click()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      Add Images
                    </Button>
                  </div>
                  {catalogFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {catalogFiles.map((f, i) => (
                        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted-bg">
                          <img
                            src={URL.createObjectURL(f)}
                            alt={`Catalog ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setCatalogFiles((prev) => prev.filter((_, j) => j !== i))}
                              className="w-7 h-7 rounded-full bg-white/90 text-danger flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[9px] font-medium bg-black/50 text-white rounded-md">compressed</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    type="text"
                    value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">
                    Referred By <span className="text-muted font-normal">(member who referred you)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name or phone"
                    value={referredByStatus === 'found' ? referredByName : form.referredByPhone}
                    onChange={(e) => {
                      update('referredByPhone', e.target.value);
                      setReferredByStatus('idle');
                      setReferredByName('');
                    }}
                    onBlur={async (e) => {
                      const val = normalizePhone(e.target.value);
                      if (val !== e.target.value) update('referredByPhone', val);
                      if (!val.trim()) { setReferredByStatus('idle'); setReferredByName(''); return; }
                      const profile = await getProfileByPhone(val);
                      if (profile) {
                        setReferredByName(`${profile.ownerName} ${profile.ownerSurname}`.trim() || profile.companyName);
                        setReferredByStatus('found');
                      } else {
                        setReferredByName('');
                        setReferredByStatus('not_found');
                      }
                    }}
                    list="referred-list"
                    className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                  />
                  <datalist id="referred-list">
                    {referralOptions.map((r) => (
                      <option key={r.phone} value={`${r.name} (${r.phone})`} />
                    ))}
                  </datalist>
                  {referralOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {referralOptions.map((r) => (
                        <button
                          key={r.phone}
                          type="button"
                          onClick={() => selectReferral(r.name, r.phone)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors cursor-pointer ${
                            form.referredByPhone === r.phone
                              ? 'bg-primary-light text-primary border-primary'
                              : 'bg-canvas text-muted border-border hover:border-primary hover:text-primary'
                          }`}
                        >
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {referredByStatus === 'found' && (
                    <p className="text-xs text-success mt-1">Referred by: <span className="font-medium">{referredByName}</span></p>
                  )}
                  {referredByStatus === 'not_found' && (
                    <p className="text-xs text-danger mt-1">No member found with this phone number. Type the phone number of the person who referred you.</p>
                  )}
                </div>
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
              {profile.description && (
              <TiltCard>
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">About</h3>
                  <p className="text-sm text-charcoal">{profile.description}</p>
                </CardContent>
              </Card>
              </TiltCard>
              )}
              <TiltCard>
              <Card>
                <CardContent className="p-3 space-y-2">
                  {(profile.categories ?? []).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Categories</h3>
                      <div className="flex flex-wrap gap-1">
                        {(profile.categories ?? []).map((cat) => (
                          <span key={cat} className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-primary-light text-primary border border-primary/20">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(profile.keywords ?? []).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Keywords</h3>
                      <div className="flex flex-wrap gap-1">
                        {(profile.keywords ?? []).map((kw) => (
                          <span key={kw} className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-canvas text-muted border border-border">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Contact</h3>
                    <div className="space-y-1.5 text-sm">
                      {profile.phone && <p className="text-charcoal">📞 {profile.phone}</p>}
                      {profile.contactEmail && <p className="text-charcoal">✉️ {profile.contactEmail}</p>}
                      {profile.website && (
                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors block">
                          🌐 {profile.website}
                        </a>
                      )}
                    </div>
                  </div>
                  {profile.referredByName && (
                    <p className="text-xs text-muted">Referred by <span className="font-medium text-charcoal">{profile.referredByName}</span></p>
                  )}
                </CardContent>
              </Card>
              </TiltCard>
              {isOwnProfile && (
                <Link to="/my-issues" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors">
                  View My Issues
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </Link>
              )}
              {(profile.catalogURLs ?? []).length > 0 && (
              <TiltCard>
              <Card>
                <CardContent className="p-3">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Catalog</h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(profile.catalogURLs ?? []).map((url, i) => (
                      url.endsWith('.pdf') ? (
                        <button key={i} type="button" onClick={() => downloadCatalogFile(url, i)} className="shrink-0 flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-xl bg-canvas border border-border hover:bg-primary-light transition-colors cursor-pointer">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="text-[9px] text-muted font-mono">PDF</span>
                        </button>
                      ) : (
                        <button key={i} type="button" onClick={() => downloadCatalogFile(url, i)} className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer">
                          <img src={url} alt={`Catalog ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
              </TiltCard>
              )}
            </>
          )}

          {editingMembership ? (
          <TiltCard>
          <Card>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-charcoal tracking-tight">Edit Membership</h3>
                <button onClick={() => setEditingMembership(false)} className="text-sm text-muted hover:text-charcoal transition-colors cursor-pointer">Cancel</button>
              </div>
              <div className="space-y-4">
                {!isSuperAdminUser && (
                  <p className="text-xs text-warning font-medium bg-warning/10 px-3 py-2 rounded-lg">
                    This action cannot be changed once submitted.
                  </p>
                )}
                <Input label="Date Paid" type="date" value={editPaidDate} onChange={(e) => setEditPaidDate(e.target.value)} />
                {editPaidDate && (
                  <p className="text-[11px] text-steel">Expires: {new Date(new Date(editPaidDate).getTime() + 364 * 86400000).toLocaleDateString('en-IN')}</p>
                )}
                <Button onClick={handleSaveMembership} loading={saving} className="w-full">Save</Button>
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          ) : (
          <TiltCard>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-charcoal tracking-tight">Membership</h3>
                {(isSuperAdminUser || (isOwnProfile && !profile.paidDate)) && (
                  <button onClick={handleEditMembership} className="text-sm text-primary hover:text-primary-hover transition-colors font-medium cursor-pointer">
                    Set Membership
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <Badge variant={profile.membershipStatus === 'active' ? 'success' : profile.membershipStatus === 'expired' ? 'danger' : 'neutral'}>
                    {profile.membershipStatus === 'active' ? 'Active Member' : profile.membershipStatus === 'expired' ? 'EXPIRED' : profile.membershipStatus.charAt(0).toUpperCase() + profile.membershipStatus.slice(1)}
                  </Badge>
                </div>
                {(() => {
                  const now = Date.now();
                  const diff = profile.membershipExpiry - now;
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  if (profile.membershipStatus === 'active' && days <= 30) {
                    return <p className="text-sm text-warning font-medium">{days <= 0 ? 'Expiring today' : `${days} days remaining`}</p>;
                  }
                  if (profile.membershipStatus === 'expired') {
                    return <p className="text-sm text-danger font-medium">Expired {Math.abs(days)} days ago</p>;
                  }
                  return null;
                })()}
                <div className="text-sm">
                  {profile.membershipDate > 0 && <><span className="text-muted font-mono tracking-tight">Member since </span>
                  <span className="text-charcoal font-medium">{formatDate(profile.membershipDate)}</span></>}
                </div>
                {profile.membershipExpiry > 0 && <div className="text-sm">
                  <span className="text-muted font-mono tracking-tight">Expires </span>
                  <span className="text-charcoal font-medium">{formatDate(profile.membershipExpiry)}</span>
                </div>}
                {profile.membershipExpiry > 0 && (
                  <div className="mt-2">
                    <MembershipCountdown membershipExpiry={profile.membershipExpiry} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          )}
        </div>

        <div className="space-y-3">
          {profile.photoURL && (
          <TiltCard>
          <Card>
            <CardContent className="p-2.5">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <img src={profile.photoURL} alt={profile.companyName} loading="lazy" className="w-full h-full object-cover aspect-square" />
              </div>
            </CardContent>
          </Card>
          </TiltCard>
          )}
        </div>
      </div>
    </div>
      {cameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} onGallery={handleGalleryInstead} />}
    </AnimatedPage>
  );
}
