'use client';

import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, MessageSquare } from 'lucide-react';
import { MessageBubble, InfoCard, TypingIndicator } from '@/components/chat';

export interface PracticeBootBubbleProps {
  framing: string;
  message: string;
  scenarioTitle: string;
  preparingLabel: string;
}

export function PracticeBootBubble({ framing, message, scenarioTitle, preparingLabel }: PracticeBootBubbleProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {framing && (
        <InfoCard title={scenarioTitle} icon={BookOpen}>
          <p className="italic">&quot;{framing}&quot;</p>
        </InfoCard>
      )}

      {message ? (
        <div className="flex justify-start">
          <div className="max-w-[85%] min-w-[200px]">
            <MessageBubble variant="assistant" icon={MessageSquare} accentColor="blue" noAnimate>
              <p>{message}</p>
            </MessageBubble>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <TypingIndicator />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 pl-11">
            {preparingLabel}
          </span>
        </div>
      )}
    </motion.div>
  );
}
