import { ArrowUp } from 'lucide-react';

interface ScrollToTopProps {
  visible: boolean;
}

export function ScrollToTop({ visible }: ScrollToTopProps) {
  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-opacity hover:opacity-80"
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  );
}
