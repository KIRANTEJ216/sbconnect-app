import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { createBusinessProfile, updateBusinessProfile, getProfileByContactEmail, getProfileByPhone } from '../lib/firestore';
import { uploadProfilePhoto, uploadCatalogFiles, compressImage, compressProfilePhoto } from '../lib/storage';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { INDUSTRIES, COMPANY_SIZES, LOCATIONS } from '../types';
import type { BusinessProfile } from '../types';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { ProfileSuggestions } from '../components/profile/ProfileSuggestions';
import { CameraCapture } from '../components/CameraCapture';

export default function CreateProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (user?.email) {
      setForm((f) => ({ ...f, contactEmail: user.email! }));
    }
    if (profile) {
      const firstName = profile.displayName?.split(' ')[0] || '';
      setForm((f) => ({ ...f, ownerName: firstName, ownerSurname: profile.surname || '' }));
    }
    if (profile?.phone) {
      const cleanedPhone = profile.phone.replace(/^\+91[-\s]?/, '').replace(/\D/g, '').slice(0, 10);
      if (cleanedPhone) {
        setForm((f) => ({ ...f, phone: cleanedPhone }));
      }
    }
  }, [user, profile]);

  const normalizePhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  const update = (field: string, value: string | string[]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleCategory = (cat: string) => {
    if (cat === 'Other' && form.categories.includes('Other')) {
      setCustomCategory('');
    }
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Only image files (JPG, PNG, WebP) are allowed.');
      return;
    }
    try {
      const compressed = await compressProfilePhoto(file, 400, 0.75);
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

  const handleCameraCapture = (blob: Blob) => {
    const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
    setPhotoFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
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

  const fields = [
    { key: 'ownerName', label: 'Full Name', weight: 5, filled: form.ownerName.trim().length > 0 },
    { key: 'phone', label: 'Phone', weight: 10, filled: form.phone.trim().length > 0 },
    { key: 'companyName', label: 'Company Name', weight: 15, filled: form.companyName.trim().length > 0 },
    { key: 'categories', label: 'Categories', weight: 15, filled: form.categories.length > 0 },
    { key: 'keywords', label: 'Keywords', weight: 5, filled: form.keywords.length > 0 },
    { key: 'companySize', label: 'Company Size', weight: 10, filled: form.companySize.length > 0 },
    { key: 'location', label: 'Location', weight: 10, filled: form.location.trim().length > 0 },
    { key: 'photo', label: 'Photo', weight: 10, filled: photoFile !== null },
    { key: 'catalog', label: 'Catalog', weight: 5, filled: catalogFiles.length > 0 },
    { key: 'contactEmail', label: 'Contact Email', weight: 15, filled: form.contactEmail.trim().length > 0 },
    { key: 'website', label: 'Website', weight: 5, filled: form.website.trim().length > 0 },
    { key: 'description', label: 'Description', weight: 15, filled: form.description.trim().length > 0 },
  ];

  const completion = Math.min(100, fields.reduce((sum, f) => sum + (f.filled ? f.weight : 0), 0));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    if (!form.phone.trim()) { setError('Phone number is required.'); return; }
    if (form.categories.length === 0) { setError('Please select at least one category.'); return; }
    if (!form.companySize) { setError('Please select company size.'); return; }
    if (!form.location.trim()) { setError('Location is required.'); return; }
    if (form.location.trim() && !LOCATIONS.includes(form.location.trim() as any)) {
      setError('Please select a valid location from the suggestions.');
      return;
    }
    if (!form.contactEmail.trim()) { setError('Contact email is required.'); return; }
    if (!user) return;

    const normalizedPhone = normalizePhone(form.phone);
    setForm((f) => ({ ...f, phone: normalizedPhone }));
    const cleanEmail = form.contactEmail.toLowerCase().trim();

    const [existingEmail, existingPhone] = await Promise.all([
      getProfileByContactEmail(cleanEmail),
      getProfileByPhone(normalizedPhone),
    ]);
    if (existingEmail) { setError('This email is already registered to another business.'); return; }
    if (existingPhone) { setError('This phone number is already registered to another business.'); return; }

    setLoading(true);
    setError('');
    try {
      let photoURL = '';
      let catalogURLs: string[] = [];

      if (photoFile) {
        photoURL = await uploadProfilePhoto(user.uid, photoFile);
      }
      if (catalogFiles.length > 0) {
        catalogURLs = await uploadCatalogFiles(user.uid, catalogFiles);
      }

      const finalCategories = form.categories
        .filter((c) => c !== 'Other')
        .concat(customCategory.trim() ? [customCategory.trim()] : []);

      await createBusinessProfile(user.uid, {
        ownerName: form.ownerName,
        phone: form.phone,
        companyName: form.companyName,
        categories: finalCategories,
        companySize: form.companySize,
        location: form.location,
        contactEmail: form.contactEmail,
        website: form.website && !form.website.startsWith('http://') && !form.website.startsWith('https://')
          ? `https://${form.website}`
          : form.website,
        description: form.description,
        keywords: form.keywords,
      });

      const updates: Record<string, unknown> = {};
      if (photoURL) updates.photoURL = photoURL;
      if (catalogURLs.length > 0) updates.catalogURLs = catalogURLs;
      updates.ownerSurname = form.ownerSurname;
      if (form.referredByPhone) updates.referredByPhone = form.referredByPhone;
      if (referredByName) updates.referredByName = referredByName;
      if (Object.keys(updates).length > 0) {
        await updateBusinessProfile(user.uid, updates as Partial<BusinessProfile>);
      }

      queryClient.invalidateQueries({ queryKey: ['businessProfile', user.uid] });
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to create profile:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('storage') || msg.includes('permission') || msg.includes('unauthorized')) {
        setError('Image upload failed. Check Firebase Storage rules — authenticated uploads must be allowed.');
      } else {
        setError('Failed to create profile. ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Create Your Business Profile</h1>
        <p className="text-steel mt-1.5 gradient-text">Connect with the business community</p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted font-mono tracking-tight uppercase">Profile Completion</span>
          <span className="text-sm font-semibold text-primary">{completion}%</span>
        </div>
        <div className="w-full h-2 bg-muted-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-5 sm:p-8 lg:p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Full Name"
                    placeholder="e.g. Ravi"
                    value={form.ownerName}
                    onChange={(e) => update('ownerName', e.target.value)}
                  />
                  <Input
                    label="Surname"
                    placeholder="e.g. Sharma"
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
                  placeholder="e.g. Sri Sai Enterprises"
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-2">Categories <span className="text-danger">*</span></label>
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
                  <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Company Size <span className="text-danger">*</span></label>
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
                  <p className="text-xs text-muted mt-1.5">Type a keyword and press Enter to add it. e.g. steel-supply, it-services, pvc-pipes, packaging, solar-panels</p>
                </div>

                <div className="border-t border-border pt-6">
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
                        <input
                          ref={photoRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhoto}
                          className="hidden"
                        />
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
                          <button
                            type="button"
                            onClick={() => { setPhotoFile(null); setPhotoPreview(''); }}
                            className="text-xs text-danger ml-3 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                        <p className="text-xs text-muted mt-1.5">JPG, PNG or WebP. Recommended 400x400px.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Catalog / Brochure (up to 5 files)</label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={catalogRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        multiple
                        onChange={handleCatalog}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => catalogRef.current?.click()}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Upload Catalog
                      </Button>
                    </div>
                    {catalogFiles.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {catalogFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-canvas text-xs text-steel">
                            <span className="truncate">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setCatalogFiles((prev) => prev.filter((_, j) => j !== i))}
                              className="text-danger hover:underline shrink-0 ml-2 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted mt-1.5">JPG, PNG, WebP or PDF. Max 10MB each, up to 5 files.</p>
                  </div>
                </div>

                <div className="border-t border-border pt-6 space-y-5">
                  <Input
                    label="Contact Email"
                    type="email"
                    placeholder="contact@yourcompany.com"
                    value={form.contactEmail}
                    onChange={(e) => update('contactEmail', e.target.value)}
                    required
                  />
                  <Input
                    label="Website"
                    type="text"
                    placeholder="https://yourcompany.com"
                    value={form.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">
                      Referred By <span className="text-muted font-normal">(member who referred you)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Search by Phone Number"
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
                      className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                    />
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
                      placeholder="Brief description of what your company does..."
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" type="button" onClick={() => navigate('/dashboard')}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={loading}>
                    Create Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <ProfileSuggestions />
        </div>
      </div>
    </div>
      {cameraOpen && <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} onGallery={handleGalleryInstead} />}
    </AnimatedPage>
  );
}
