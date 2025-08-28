"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FoldingLoader from '@/components/ui/FoldingLoader';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      <FoldingLoader size={36} />
    </div>
  );
}
