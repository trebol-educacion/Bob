'use client';

import { Mic, Square, Send, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChangeEvent, KeyboardEvent } from 'react';

type MicProps = {
  variant: 'mic';
  placeholder: string;
  recording: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
};

type TextProps = {
  variant: 'text';
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onSend: () => void;
  onAttach?: () => void;
};

type Props = MicProps | TextProps;

export function ChatInputBar(props: Props) {
  if (props.variant === 'mic') {
    return <MicBar {...props} />;
  }
  return <TextBar {...props} />;
}

function MicBar({ placeholder, recording, disabled, onStart, onStop }: MicProps) {
  const handleClick = () => {
    if (disabled) return;
    if (recording) onStop();
    else onStart();
  };

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-sm text-gray-500 font-medium pl-2 truncate">
        {placeholder}
      </p>
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        whileTap={{ scale: 0.94 }}
        animate={recording ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={recording ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
        className="w-12 h-12 rounded-full text-white shadow-md flex items-center justify-center transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: recording ? '#dc2626' : 'var(--color-bob-brand)' }}
        aria-label={placeholder}
      >
        {recording ? <Square size={20} fill="currentColor" /> : <Mic size={22} strokeWidth={2.2} />}
      </motion.button>
    </div>
  );
}

function TextBar({ value, placeholder, disabled, onChange, onSend, onAttach }: TextProps) {
  const canSend = value.trim().length > 0 && !disabled;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            disabled={disabled}
            className="shrink-0 w-10 h-10 rounded-full text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors disabled:opacity-40"
            aria-label="Attach"
          >
            <Paperclip size={18} strokeWidth={2.2} />
          </button>
        )}
        <textarea
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none py-2 px-2 max-h-32"
        />
        <motion.button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          whileTap={canSend ? { scale: 0.94 } : undefined}
          className="shrink-0 w-10 h-10 rounded-full text-white shadow-md flex items-center justify-center transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-bob-brand)' }}
          aria-label="Send"
        >
          <Send size={18} strokeWidth={2.2} />
        </motion.button>
      </div>
    </div>
  );
}
