import type { Metadata } from 'next';
import Tutorial from '@/components/Tutorial';

export const metadata: Metadata = {
  title: 'Learn Web Dev — FlipJump IDE',
  description:
    'A beginner-friendly tutorial teaching HTML, CSS, React, state, effects, API routes, and WebSockets — illustrated with real source code from this IDE.',
};

export default function LearnPage() {
  return <Tutorial />;
}
