import { Screen } from '@/components/ui/screen';
import { SkeletonList } from '@/components/ui/skeleton';

export default function PortfolioScreen() {
  return (
    <Screen scroll>
      <SkeletonList count={4} />
    </Screen>
  );
}
