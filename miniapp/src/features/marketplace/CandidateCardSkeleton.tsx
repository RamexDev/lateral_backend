// CandidateCardSkeleton — shimmer placeholder matching the live card shape.

import { Card, Skeleton } from '../../components/ui';

export function CandidateCardSkeleton() {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex gap-3 p-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="border-t border-line p-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </Card>
  );
}
