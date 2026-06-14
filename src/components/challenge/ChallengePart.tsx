'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChallengePart as ChallengePartData } from '@/lib/challenge/cambridge-a2';
import { ChallengeAudio } from './ChallengeAudio';
import { ChallengePicture } from './ChallengePicture';

/** Per-part answer map: itemId → chosen option key, typed word, or free text. */
export type PartAnswers = Record<string, string>;

interface Props {
  part: ChallengePartData;
  answers: PartAnswers;
  onChange: (itemId: string, value: string) => void;
}

function OptionButton({
  selected,
  label,
  text,
  onClick,
}: {
  selected: boolean;
  label: string;
  text?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
        selected
          ? 'border-[#3660AB] bg-[#dde4f2] shadow-sm'
          : 'border-trebol-border bg-white hover:border-[#3660AB]/50'
      }`}
    >
      <span
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${
          selected ? 'bg-[#3660AB] text-white' : 'bg-trebol-bg text-trebol-text/60'
        }`}
      >
        {label}
      </span>
      {text && <span className="text-sm font-bold text-trebol-text">{text}</span>}
    </button>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-xl border-2 border-trebol-border bg-white px-3 py-1.5 text-sm font-bold text-trebol-text focus:border-[#3660AB] focus:outline-none min-w-[110px]"
    />
  );
}

function WordCounter({ text, min }: { text: string; min: number }) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const ok = words >= min;
  return (
    <span className={`text-xs font-black ${ok ? 'text-[#469E7B]' : 'text-trebol-text/50'}`}>
      {words} / {min}+ words
      {ok && <CheckCircle2 size={13} className="inline ml-1 -mt-0.5" strokeWidth={2.5} />}
    </span>
  );
}

/** Renders a single challenge part's interactive UI based on its format. */
export function ChallengePart({ part, answers, onChange }: Props) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-black text-trebol-text tracking-tight">{part.title}</h2>
        <p className="text-sm font-semibold text-trebol-text/65 mt-1 leading-snug">{part.instructions}</p>
      </header>

      {part.format === 'listening_picture_mc' && (
        <>
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4 space-y-3">
              <ChallengeAudio script={q.dialogueScript} playLimit={part.playLimit} />
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {q.question}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {q.options.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => onChange(q.id, o.key)}
                    className={`rounded-2xl border-2 p-2 transition-all ${
                      answers[q.id] === o.key ? 'border-[#3660AB] bg-[#dde4f2]' : 'border-trebol-border hover:border-[#3660AB]/50'
                    }`}
                  >
                    <ChallengePicture caption={o.caption} imageUrl={o.imageUrl} label={o.key} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'listening_note_completion' && (
        <>
          <ChallengeAudio script={part.script} playLimit={part.playLimit} />
          <div className="rounded-2xl border border-trebol-border p-4">
            <h3 className="text-sm font-black text-trebol-text mb-3">{part.noteTitle}</h3>
            <ul className="space-y-3">
              {part.gaps.map((g) => (
                <li key={g.id} className="flex items-center gap-2 flex-wrap text-sm font-bold text-trebol-text">
                  <span>{g.label}</span>
                  <TextInput value={answers[g.id] ?? ''} onChange={(v) => onChange(g.id, v)} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {part.format === 'listening_conversation_mc' && (
        <>
          <ChallengeAudio script={part.script} playLimit={part.playLimit} />
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4 space-y-2">
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <OptionButton
                    key={o.key}
                    selected={answers[q.id] === o.key}
                    label={o.key}
                    text={o.text}
                    onClick={() => onChange(q.id, o.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'listening_monologue_mc' && (
        <>
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#3660AB]">{q.speaker}</p>
              <ChallengeAudio script={q.script} playLimit={part.playLimit} />
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <OptionButton
                    key={o.key}
                    selected={answers[q.id] === o.key}
                    label={o.key}
                    text={o.text}
                    onClick={() => onChange(q.id, o.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'listening_matching' && (
        <>
          <div className="rounded-2xl border border-trebol-border p-4">
            <h3 className="text-sm font-black text-trebol-text mb-2">Options</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {part.options.map((o) => (
                <div key={o.key} className="text-sm font-bold text-trebol-text/80">
                  <span className="font-black text-[#3660AB]">{o.key}.</span> {o.text}
                </div>
              ))}
            </div>
          </div>
          {part.people.map((p) => (
            <div key={p.id} className="rounded-2xl border border-trebol-border p-4 space-y-3">
              <ChallengeAudio script={p.script} playLimit={part.playLimit} />
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-black text-trebol-text">{p.name}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {part.options.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => onChange(p.id, o.key)}
                      className={`w-9 h-9 rounded-xl text-sm font-black transition-all ${
                        answers[p.id] === o.key ? 'bg-[#3660AB] text-white' : 'bg-trebol-bg text-trebol-text/60 hover:bg-[#dde4f2]'
                      }`}
                    >
                      {o.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'reading_notices_mc' && (
        <>
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4 space-y-3">
              {q.noticeImageUrl && (
                <div className="max-w-[260px]">
                  <ChallengePicture caption={q.noticeText} imageUrl={q.noticeImageUrl} />
                </div>
              )}
              <div className="rounded-xl bg-[#fde9c8]/50 border border-[#F8AC37]/40 p-3 text-sm font-bold text-trebol-text">
                {q.noticeText}
              </div>
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <OptionButton
                    key={o.key}
                    selected={answers[q.id] === o.key}
                    label={o.key}
                    text={o.text}
                    onClick={() => onChange(q.id, o.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'reading_multiple_matching' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {part.texts.map((t) => (
              <div key={t.key} className="rounded-2xl border border-trebol-border p-4">
                <h3 className="text-sm font-black text-[#3660AB] mb-1">
                  {t.key}. {t.title}
                </h3>
                <p className="text-[13px] font-semibold text-trebol-text/80 leading-snug">{t.body}</p>
              </div>
            ))}
          </div>
          {part.statements.map((s, i) => (
            <div key={s.id} className="rounded-2xl border border-trebol-border p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {s.text}
              </p>
              <div className="flex gap-1.5">
                {part.texts.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onChange(s.id, t.key)}
                    className={`w-9 h-9 rounded-xl text-sm font-black transition-all ${
                      answers[s.id] === t.key ? 'bg-[#3660AB] text-white' : 'bg-trebol-bg text-trebol-text/60 hover:bg-[#dde4f2]'
                    }`}
                  >
                    {t.key}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'reading_long_text_mc' && (
        <>
          <div className="rounded-2xl border border-trebol-border p-4">
            <h3 className="text-base font-black text-trebol-text mb-2">{part.textTitle}</h3>
            <p className="text-sm font-semibold text-trebol-text/85 leading-relaxed whitespace-pre-line">{part.body}</p>
          </div>
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4 space-y-2">
              <p className="text-sm font-black text-trebol-text">
                {i + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((o) => (
                  <OptionButton
                    key={o.key}
                    selected={answers[q.id] === o.key}
                    label={o.key}
                    text={o.text}
                    onClick={() => onChange(q.id, o.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {part.format === 'reading_mc_cloze' && (
        <div className="rounded-2xl border border-trebol-border p-4 space-y-4">
          <h3 className="text-base font-black text-trebol-text">{part.textTitle}</h3>
          <p className="text-sm font-semibold text-trebol-text/85 leading-relaxed">
            {part.textBefore}
            {part.segments.map((seg, i) => (
              <React.Fragment key={seg.gap.id}>
                <span className="inline-flex items-center gap-1 mx-1 align-middle">
                  <span className="w-6 h-6 rounded-full bg-[#3660AB] text-white text-xs font-black inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  {seg.gap.options.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => onChange(seg.gap.id, o.key)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${
                        answers[seg.gap.id] === o.key
                          ? 'border-[#3660AB] bg-[#dde4f2] text-[#3660AB]'
                          : 'border-trebol-border text-trebol-text/70 hover:border-[#3660AB]/50'
                      }`}
                    >
                      {o.key}. {o.text}
                    </button>
                  ))}
                </span>
                {seg.textAfter}
              </React.Fragment>
            ))}
          </p>
        </div>
      )}

      {part.format === 'reading_open_cloze' && (
        <div className="rounded-2xl border border-trebol-border p-4">
          <h3 className="text-base font-black text-trebol-text mb-2">{part.textTitle}</h3>
          <p className="text-sm font-semibold text-trebol-text/85 leading-loose whitespace-pre-line">
            {part.textBefore}
            {part.segments.map((seg, i) => (
              <React.Fragment key={seg.gap.id}>
                <span className="inline-flex items-center gap-1 mx-1 align-middle">
                  <span className="w-5 h-5 rounded-full bg-[#3660AB] text-white text-[10px] font-black inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <TextInput value={answers[seg.gap.id] ?? ''} onChange={(v) => onChange(seg.gap.id, v)} placeholder="word" />
                </span>
                {seg.textAfter}
              </React.Fragment>
            ))}
          </p>
        </div>
      )}

      {part.format === 'writing_guided_email' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#dde4f2]/50 border border-[#3660AB]/30 p-4">
            <p className="text-sm font-bold text-trebol-text mb-2">{part.prompt}</p>
            <ul className="space-y-1.5">
              {part.checklist.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm font-semibold text-trebol-text/80">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#3660AB] shrink-0" />
                  {c.text}
                </li>
              ))}
            </ul>
          </div>
          <textarea
            value={answers[part.id] ?? ''}
            onChange={(e) => onChange(part.id, e.target.value)}
            rows={7}
            placeholder="Write your email here..."
            className="w-full rounded-2xl border-2 border-trebol-border bg-white p-3 text-sm font-semibold text-trebol-text focus:border-[#3660AB] focus:outline-none resize-y"
          />
          <div className="flex justify-end">
            <WordCounter text={answers[part.id] ?? ''} min={part.minWords} />
          </div>
        </div>
      )}

      {part.format === 'writing_picture_story' && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-trebol-text">{part.prompt}</p>
          <div className="grid grid-cols-3 gap-3">
            {part.pictures.map((p) => (
              <ChallengePicture key={p.key} caption={p.caption} imageUrl={p.imageUrl} label={p.key} />
            ))}
          </div>
          <textarea
            value={answers[part.id] ?? ''}
            onChange={(e) => onChange(part.id, e.target.value)}
            rows={7}
            placeholder="Write your story here..."
            className="w-full rounded-2xl border-2 border-trebol-border bg-white p-3 text-sm font-semibold text-trebol-text focus:border-[#3660AB] focus:outline-none resize-y"
          />
          <div className="flex justify-end">
            <WordCounter text={answers[part.id] ?? ''} min={part.minWords} />
          </div>
        </div>
      )}

      {part.format === 'speaking_interview' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#dcebe3]/60 border border-[#469E7B]/30 p-3 text-sm font-semibold text-trebol-text/80">
            Read each question, then speak your answer aloud. There is no exam score — you will get supportive,
            qualitative feedback.
          </div>
          {part.questions.map((q, i) => (
            <div key={q.id} className="rounded-2xl border border-trebol-border p-4">
              <p className="text-sm font-black text-trebol-text mb-2">
                {i + 1}. {q.text}
              </p>
              <button
                onClick={() => onChange(q.id, answers[q.id] === 'answered' ? '' : 'answered')}
                className={`text-sm font-black px-4 py-2 rounded-2xl transition-all ${
                  answers[q.id] === 'answered'
                    ? 'bg-[#469E7B] text-white'
                    : 'bg-[#dcebe3] text-[#2f7256] hover:bg-[#cfe5d9]'
                }`}
              >
                {answers[q.id] === 'answered' ? 'Answered' : 'I answered this'}
              </button>
            </div>
          ))}
        </div>
      )}

      {part.format === 'speaking_collaborative' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#dcebe3]/60 border border-[#469E7B]/30 p-3 text-sm font-semibold text-trebol-text/80">
            Talk about the picture out loud using the points below. There is no exam score — you will get
            supportive, qualitative feedback.
          </div>
          <p className="text-sm font-bold text-trebol-text">{part.prompt}</p>
          <div className="max-w-xs mx-auto">
            <ChallengePicture caption={part.visual.caption} imageUrl={part.visual.imageUrl} />
          </div>
          <ul className="space-y-1.5">
            {part.discussionPoints.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm font-semibold text-trebol-text/80">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#469E7B] shrink-0" />
                {d}
              </li>
            ))}
          </ul>
          <button
            onClick={() => onChange(part.id, answers[part.id] === 'answered' ? '' : 'answered')}
            className={`text-sm font-black px-4 py-2 rounded-2xl transition-all ${
              answers[part.id] === 'answered' ? 'bg-[#469E7B] text-white' : 'bg-[#dcebe3] text-[#2f7256] hover:bg-[#cfe5d9]'
            }`}
          >
            {answers[part.id] === 'answered' ? 'Discussed' : 'I discussed this'}
          </button>
        </div>
      )}
    </div>
  );
}
