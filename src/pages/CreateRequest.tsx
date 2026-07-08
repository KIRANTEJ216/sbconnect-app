import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createRequest, getBusinessProfile } from '../lib/firestore';
import { REQUEST_CATEGORIES } from '../types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';

export default function CreateRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    setDeadline(d.toISOString().split('T')[0]);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!category) { setError('Please select a category.'); return; }
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const profile = await getBusinessProfile(user.uid);
      const companyName = profile?.companyName || user.displayName || 'Unknown';
      const phone = profile?.phone || '';
      await createRequest(user.uid, companyName, title, description, category, customCategory, budget, deadline, phone);
      navigate('/requests');
    } catch (err) {
      console.error('Failed to create request:', err);
      setError('Failed to create request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Create a Request</h1>
        <p className="text-steel mt-1.5 gradient-text">Submit a business request or opportunity</p>
      </div>

      <Card>
        <CardContent className="p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Request Title"
              placeholder="What are you looking for?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">Category</label>
              <select
                className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select category...</option>
                {REQUEST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {category === 'Other' && (
              <Input
                label="Specify Category"
                placeholder="Enter your category..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-charcoal tracking-tight mb-1.5">
                Description
                <span className="text-muted font-normal"> ({description.length}/1000)</span>
              </label>
              <textarea
                className="w-full rounded-[0.75rem] border border-border bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all resize-none"
                rows={5}
                maxLength={1000}
                placeholder="Describe what you're looking for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Budget"
                type="text"
                placeholder="e.g. ₹ 50,000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <Input
                label="Deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-light px-4 py-2.5 rounded-xl">{error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={() => navigate('/requests')}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Publish Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </AnimatedPage>
  );
}
