import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { submitReview, uploadReviewMedia } from '@/features/reviews/api/reviewsApi';
import { toast } from 'sonner';
import { showApiError } from '@/shared/lib/showApiError';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/ui/button';

type ReviewLocationState = { orderId?: string };

const MAX_FILES = 6;
const REVIEW_TAG_OPTIONS = [
  { id: 'quality', label: 'Quality' },
  { id: 'punctual', label: 'Punctual' },
  { id: 'communication', label: 'Communication' },
  { id: 'value', label: 'Value' },
  { id: 'professionalism', label: 'Professionalism' },
];

export function ReviewSubmitPage() {
  const params = useParams();
  const location = useLocation();
  const routeOrderId = params.id ?? '';
  const stateOrderId = (location.state as ReviewLocationState | null)?.orderId ?? '';
  const orderId = routeOrderId || stateOrderId;
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);

  function handleFiles(next: FileList | null) {
    const selected = Array.from(next ?? []);
    if (selected.length + files.length > MAX_FILES) return setError('Max 6 images');
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) return setError('Each image must be <= 10MB');
    setFiles((current) => [...current, ...selected]);
  }

  async function submit() {
    if (!orderId) {
      const messageText = 'Open the review from an order to attach the correct order ID.';
      toast.error(messageText);
      setError(messageText);
      return;
    }
    try {
      setSubmitting(true);
      const mediaUpload = files.length ? await uploadReviewMedia(files) : { media: [] };
      const mediaIds = Array.isArray(mediaUpload.media) ? mediaUpload.media.map((item) => item.mediaId) : [];
      await submitReview({ orderId, rating, text: message, tags, mediaIds });
      toast.success('Review submitted');
      setError('');
    } catch (cause) {
      const messageText = showApiError(cause);
      toast.error(messageText);
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTag(tagId: string) {
    setTags((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  }

  return (
    <PageShell width="narrow">
      <div className="grid gap-6">
        <PageHeader title="Submit review" description="Share feedback on a completed order." />
        <Card>
          <CardHeader><CardTitle>Review form</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">One review per completed order. Images are optional, up to 6 files, max 10MB each.</p>
            <Separator />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-2">
              <Label htmlFor="review-order">Order ID</Label>
              <Input id="review-order" value={orderId || 'Open from an order'} readOnly />
            </div>
          <div className="grid gap-2">
            <Label htmlFor="review-rating">Rating</Label>
            <Input id="review-rating" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value) || 5)} />
          </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {REVIEW_TAG_OPTIONS.map((tag) => (
                  <label key={tag.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <input type="checkbox" checked={tags.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
                    <span className="text-sm text-foreground">{tag.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <textarea className="min-h-32 rounded-xl border border-border bg-background p-3" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your review" />
            <input type="file" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {previews.map((preview) => <img key={preview.name} src={preview.url} alt={preview.name} className="h-32 w-full rounded-xl object-cover shadow-soft" />)}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={submitting} onClick={submit}>{submitting ? 'Submitting...' : 'Submit'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
