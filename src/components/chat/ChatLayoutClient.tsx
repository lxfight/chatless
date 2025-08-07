"use client";

import { ChatLayout } from "@/components/layout/ChatLayout";

interface ChatLayoutClientProps {
  children: React.ReactNode;
}

export default function ChatLayoutClient({ children }: ChatLayoutClientProps) {
  return (
    <div className="w-full h-full overflow-hidden">
      <ChatLayout>{children}</ChatLayout>
    </div>
  );
} 