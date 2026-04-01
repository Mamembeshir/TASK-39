import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import type { ServiceReview } from '@/features/catalog/api/catalogApi';

export function ReviewsSection({ reviews }: { reviews: ServiceReview[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Verified Reviews</CardTitle></CardHeader>
      <CardContent>
        {reviews.length ? reviews.map((review) => <div key={review.id}><strong>{review.rating}/5</strong><p>{review.text ?? 'No review text'}</p></div>) : <p>No verified reviews yet.</p>}
      </CardContent>
    </Card>
  );
}
