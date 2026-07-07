import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createBusinessProfile } from '../lib/firestore';
import { uploadProfilePhoto, uploadProfileCatalog } from '../lib/storage';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { INDUSTRIES, COMPANY_SIZES } from '../types';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { ProfileSuggestions } from '../components/profile/ProfileSuggestions';

export default function CreateProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (user?.email) {
      setForm((f) => ({ ...f, contactEmail: user.email! }));
    }
  }, [user]);

  const update = (field: string, value: string | string[]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleCategory = (cat: string) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
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

  const fields = [
    { key: 'ownerName', label: 'Owner Name', weight: 10, filled: form.ownerName.trim().length > 0 },
    { key: 'phone', label: 'Phone', weight: 10, filled: form.phone.trim().length > 0 },
    { key: 'companyName', label: 'Company Name', weight: 15, filled: form.companyName.trim().length > 0 },
    { key: 'categories', label: 'Categories', weight: 15, filled: form.categories.length > 0 },
    { key: 'companySize', label: 'Company Size', weight: 10, filled: form.companySize.length > 0 },
    { key: 'location', label: 'Location', weight: 10, filled: form.location.trim().length > 0 },
    { key: 'photo', label: 'Photo', weight: 10, filled: photoFile !== null },
    { key: 'catalog', label: 'Catalog', weight: 5, filled: catalogFile !== null },
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
    if (!form.contactEmail.trim()) { setError('Contact email is required.'); return; }
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      let photoURL = '';
      let catalogPDFURL = '';

      if (photoFile) {
        photoURL = await uploadProfilePhoto(user.uid, photoFile);
      }
      if (catalogFile) {
        catalogPDFURL = await uploadProfileCatalog(user.uid, catalogFile);
      }

      await createBusinessProfile(user.uid, {
        ownerName: form.ownerName,
        phone: form.phone,
        companyName: form.companyName,
        categories: form.categories,
        companySize: form.companySize,
        location: form.location,
        contactEmail: form.contactEmail,
        website: form.website,
        description: form.description,
      });

      if (photoURL || catalogPDFURL) {
        const { updateBusinessProfile } = await import('../lib/firestore');
        await updateBusinessProfile(user.uid, { photoURL, catalogPDFURL });
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to create profile:', err);
      setError('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-charcoal tracking-tight">Create Your Business Profile</h1>
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
            <CardContent className="p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Owner / Business Owner Name"
                  placeholder="e.g. John Doe"
                  value={form.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="e.g. +254 712 345 678"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  required
                />
                <Input
                  label="Company Name"
                  placeholder="e.g. Acme Solutions Ltd"
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

                <Input
                  label="Location"
                  placeholder="e.g. Nairobi, Kenya"
                  value={form.location}
                  onChange={(e) => update('location', e.target.value)}
                  required
                />

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
                          onChange={handlePhoto}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                          {photoPreview ? 'Change Photo' : 'Upload Photo'}
                        </Button>
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
                    <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Catalog / Brochure (PDF)</label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={catalogRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleCatalog}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => catalogRef.current?.click()}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {catalogName || 'Upload PDF'}
                      </Button>
                      {catalogName && (
                        <button
                          type="button"
                          onClick={() => { setCatalogFile(null); setCatalogName(''); }}
                          className="text-xs text-danger hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1.5">Showcase your products or services. Max 10MB.</p>
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
                    type="url"
                    placeholder="https://yourcompany.com"
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
    </AnimatedPage>
  );
}
