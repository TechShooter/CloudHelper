import { Suspense } from 'react';
import ModelSelectorV2 from '../components/ModelSelectorV2';

export default function ModelSelectorV2Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white p-8">Loading Model Selector v2...</div>}>
      <ModelSelectorV2 />
    </Suspense>
  );
}