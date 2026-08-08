import { PokerBenchTrainer } from './PokerBenchTrainer';

export function SizingTrainer({ onExit }: { onExit: () => void }) {
  return <PokerBenchTrainer onExit={onExit} mode="sizing" />;
}
