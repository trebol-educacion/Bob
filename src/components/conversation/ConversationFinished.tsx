import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/Button';

export interface ConversationFinishedProps {
  heading: string;
  body: string;
  backButtonLabel: string;
  onFinish: () => void;
}

export function ConversationFinished({ heading, body, backButtonLabel, onFinish }: ConversationFinishedProps) {
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-12 bg-white rounded-sm shadow-xl space-y-8">
      <div className="p-6 rounded-full" style={{ background: 'color-mix(in oklab, var(--color-bob-brand) 10%, white)' }}>
        <CheckCircle size={64} className="text-bob-brand" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">{heading}</h2>
        <p className="text-gray-500 font-medium">{body}</p>
      </div>
      <Button variant="primary" onClick={onFinish} className="px-12 py-4 text-xl">
        {backButtonLabel}
      </Button>
    </div>
  );
}
