import React from 'react';
import { Mic, Volume2 } from 'lucide-react';
import type { ImageScene } from '@/actions/gemini';
import type { StoredMessage } from '@/actions/messages';
import { getScoreColor } from '@/lib/score';
import type { ChatMsg } from './types';

export function renderEvaluationContent(
  score: number,
  feedback: string,
  transcribed_text?: string,
  modelAnswer?: string,
): React.ReactNode {
  const roundedScore = Math.round(score);
  const scoreColor = getScoreColor(roundedScore);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`text-4xl font-black ${scoreColor}`}>{roundedScore}</span>
        <span className="text-trebol-text/60 text-sm font-medium">/ 100</span>
      </div>
      {transcribed_text && (
        <div className="bg-trebol-bg rounded-lg px-3 py-2 text-sm text-trebol-text/80 italic">
          &quot;{transcribed_text}&quot;
        </div>
      )}
      <p className="text-sm text-trebol-text/80">{feedback}</p>
      {modelAnswer && (
        <div className="bg-trebol-primary/10 border border-trebol-primary/30 rounded-lg px-3 py-2 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-trebol-primary">Sample answer</p>
          <p className="text-sm text-trebol-text/80 italic">{modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

export function restoreMessages(stored: StoredMessage[]): ChatMsg[] {
  return stored
    .filter((m) => m.msg_type !== 'phrase_plan' && m.msg_type !== 'yl_tts')
    .map((m) => {
    let content: React.ReactNode;

    if (m.msg_type === 'phrase') {
      const j = m.content_json as { phrase: string; index: number; total: number } | null;
      content = j ? (
        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
            Phrase {j.index + 1} of {j.total}
          </p>
          <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
            <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{j.phrase}</p>
          </div>
          <p className="text-sm text-trebol-text/60">Listen to the phrase, then record yourself saying it.</p>
        </div>
      ) : <span>{m.content_text}</span>;
    } else if (m.msg_type === 'image_scene') {
      const j = m.content_json as { description: string } | null;
      content = (
        <div className="space-y-3">
          <p className="text-sm text-trebol-text/60">
            Describe what you see in this image in English. You have 60 seconds.
          </p>
          {m.content_text ? (
            <img
              src={m.content_text}
              alt="Scene to describe"
              className="w-full rounded-xl border-2 border-trebol-border shadow-md"
            />
          ) : j?.description ? (
            <p className="text-xs text-trebol-text/50 italic">{j.description}</p>
          ) : null}
        </div>
      );
    } else if (m.msg_type === 'evaluation') {
      const j = m.content_json as { score: number; feedback: string; transcribed_text?: string; model_answer?: string } | null;
      content = j
        ? renderEvaluationContent(j.score, j.feedback, j.transcribed_text, j?.model_answer)
        : <span>{m.content_text}</span>;
    } else if (m.msg_type === 'user_audio') {
      const text = m.content_text && m.content_text !== 'Audio recorded' ? m.content_text : null;
      content = text ? (
        <span>{text}</span>
      ) : (
        <span className="flex items-center gap-2 text-sm">
          <Mic size={14} /> Audio recorded
        </span>
      );
    } else {
      content = <span>{m.content_text}</span>;
    }

    return { id: m.id, role: m.role, content };
  });
}

export function renderPhrase(
  phrase: string,
  index: number,
  total: number,
  onListen: (text: string) => void,
): React.ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-widest text-trebol-text/50">
        Phrase {index + 1} of {total}
      </p>
      <div className="bg-trebol-bg border-2 border-trebol-primary/30 rounded-xl p-4">
        <p className="text-xl font-extrabold text-trebol-text leading-relaxed">{phrase}</p>
      </div>
      <p className="text-sm text-trebol-text/60">Listen to the phrase, then record yourself saying it.</p>
      <button
        type="button"
        onClick={() => onListen(phrase)}
        className="flex items-center gap-2 text-sm font-bold text-trebol-primary hover:opacity-75 transition-opacity"
      >
        <Volume2 size={16} /> Listen to pronunciation
      </button>
    </div>
  );
}

export function renderScene(scene: ImageScene & { image_data?: string }): React.ReactNode {
  return (
    <div className="space-y-3">
      <p className="text-sm text-trebol-text/60">
        Describe what you see in this image in English. You have 60 seconds.
      </p>
      {scene.image_data && (
        <img
          src={scene.image_data}
          alt="Scene to describe"
          className="w-full rounded-xl border-2 border-trebol-border shadow-md"
        />
      )}
    </div>
  );
}
