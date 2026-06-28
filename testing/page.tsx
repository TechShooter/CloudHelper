import { Suspense } from 'react';
import ModelSelectorV2 from './components/ModelSelectorV2';

export default function TestingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white p-8">Loading...</div>}>
      <ModelSelectorV2 />
    </Suspense>
  );
}
