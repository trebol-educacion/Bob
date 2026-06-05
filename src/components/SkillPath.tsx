'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Check, Gift, Headphones, Lock, Mic, PenLine, Star, Trophy } from 'lucide-react';

type SkillKey = 'speaking' | 'reading' | 'listening' | 'writing';

/**
 * One skill's progress, used to render its winding Duolingo-style activity path.
 * `done` activities show as completed nodes, `total - done` as locked, with
 * reward checkpoints every few activities and a final goal node (`goalLevel`).
 */
export interface SkillPathSkill {
  key: SkillKey;
  label: string;
  level: string;
  goalLevel: string;
  done: number;
  total: number;
}

const PALETTE: Record<SkillKey, { c: string; light: string; dark: string; tint: string }> = {
  speaking: { c: '#3660AB', light: '#7aa0ff', dark: '#26417a', tint: '#e7edf9' },
  reading: { c: '#469E7B', light: '#7fd0ad', dark: '#2f7256', tint: '#e3f1ea' },
  listening: { c: '#F8AC37', light: '#ffce7a', dark: '#c97f12', tint: '#fdefd6' },
  writing: { c: '#9333EA', light: '#c084fc', dark: '#6d28d9', tint: '#f3e8ff' },
};

const ICON: Record<SkillKey, typeof Headphones> = {
  speaking: Mic,
  reading: BookOpen,
  listening: Headphones,
  writing: PenLine,
};

const DECOR = [
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="9"/></svg>',
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="2.6"/><circle cx="17" cy="9" r="2"/><circle cx="9" cy="17" r="2.6"/></svg>',
];

const SPACING = 92;
const SLOPE = 7;
const PAD = 96;
const NODE = 60;
const GOAL = 76;
const CHECKPOINT_EVERY = 8;

const GREY_BG = 'radial-gradient(120% 120% at 50% 24%, #f6f2fd, #e3ddef 72%)';
const GREY_SHADOW = '0 7px 0 #cdc4e2, 0 13px 16px -7px rgba(60,40,110,.4), 0 2px 1px #fff inset';

type Item =
  | { kind: 'activity'; idx: number }
  | { kind: 'checkpoint'; after: number }
  | { kind: 'goal' };

/**
 * Sample `n` evenly-spaced points (by arc length) along a vertical sine curve, so
 * nodes stay equidistant however wide the swing is. The wavelength scales with the
 * amplitude (constant gentle slope), so the curve reads as one smooth harmonic wave
 * at any width — on mobile and desktop alike.
 */
function buildPoints(n: number, width: number): { pts: Array<{ x: number; y: number }>; amp: number } {
  const amp = Math.max(64, Math.min(230, width * 0.21));
  const k = (2 * Math.PI) / (amp * SLOPE);
  const xOf = (y: number) => amp * Math.sin(y * k);

  const pts: Array<{ x: number; y: number }> = [{ x: xOf(0), y: 0 }];
  let target = SPACING;
  let acc = 0;
  let lastX = xOf(0);
  let lastY = 0;
  const limit = (n + 2) * SPACING * 2;

  for (let y = 0; pts.length < n && y < limit; y += 2) {
    const x = xOf(y);
    acc += Math.hypot(x - lastX, y - lastY);
    lastX = x;
    lastY = y;
    if (acc >= target) {
      pts.push({ x, y });
      target += SPACING;
    }
  }
  return { pts, amp };
}

function buildItems(total: number): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < total; i++) {
    items.push({ kind: 'activity', idx: i });
    const done = i + 1;
    if (done % CHECKPOINT_EVERY === 0 && i !== total - 1) {
      items.push({ kind: 'checkpoint', after: done });
    }
  }
  items.push({ kind: 'goal' });
  return items;
}

/**
 * Tabbed, full-width skill path for the student dashboard. Each tab is a skill;
 * the active skill renders as a vertical winding trail of evenly-spaced 3D nodes
 * with reward checkpoints, ambient decorations and Bob cheering beside the current
 * step, ending in a goal node with the target CEFR level.
 */
export function SkillPath({
  skills,
  title,
  startLabel,
}: {
  skills: SkillPathSkill[];
  title: string;
  startLabel: string;
}) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const skill = skills[active];
  const items = useMemo(() => (skill ? buildItems(skill.total) : []), [skill]);
  const { pts, amp } = useMemo(() => buildPoints(items.length, width), [items.length, width]);

  if (!skill || pts.length === 0) return null;

  const p = PALETTE[skill.key];
  const pct = skill.total ? Math.round((skill.done / skill.total) * 100) : 0;
  const lastPt = pts[pts.length - 1];
  const colHeight = lastPt.y + PAD * 2;
  const showDecor = width >= 680;
  const currentIdx = items.findIndex((it) => it.kind === 'activity' && it.idx === skill.done);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className="w-full mt-6 pb-16"
    >
      <style>{`
        @keyframes sp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes sp-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}
      `}</style>

      <div className="max-w-5xl mx-auto px-4 mb-3">
        <h3 className="text-base font-black text-trebol-text tracking-tight">{title}</h3>
      </div>

      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-y border-trebol-border/40">
        <div className="max-w-5xl mx-auto px-3 py-2.5 grid grid-cols-4 gap-2">
          {skills.map((s, i) => {
            const sp = PALETTE[s.key];
            const Ic = ICON[s.key];
            const on = i === active;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(i)}
                className="flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] sm:text-xs font-bold transition-all"
                style={
                  on
                    ? {
                        background: `linear-gradient(150deg, ${sp.light}, ${sp.c})`,
                        color: '#fff',
                        boxShadow: `0 8px 16px -6px ${sp.c}`,
                        transform: 'translateY(-2px)',
                      }
                    : { color: sp.c }
                }
              >
                <Ic size={22} strokeWidth={2.4} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2.5 flex items-center gap-3">
          <span className="text-[11px] font-black whitespace-nowrap" style={{ color: p.c }}>
            {skill.level} ▸ {skill.goalLevel}
          </span>
          <div className="flex-1 h-2 rounded-full bg-trebol-text/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.light}, ${p.c})` }}
            />
          </div>
          <span className="text-[11px] font-black tabular-nums" style={{ color: p.c }}>
            {skill.done}/{skill.total}
          </span>
        </div>
      </div>

      <div ref={trackRef} className="relative mx-auto max-w-5xl px-4 overflow-hidden" style={{ height: colHeight }}>
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-72 pointer-events-none"
          style={{ background: `radial-gradient(60% 70% at 50% 0%, ${p.tint}, transparent 70%)` }}
        />

        {showDecor &&
          pts.map((pt, i) => {
            if (i % 3 !== 2) return null;
            const side = i % 2 === 0 ? 1 : -1;
            const dist = amp + 46 + (i % 3) * 26;
            const motif = DECOR[Math.floor(i / 3) % DECOR.length];
            const size = 18 + ((i * 7) % 16);
            return (
              <div
                key={`d-${i}`}
                aria-hidden
                className="absolute"
                style={{
                  top: pt.y + PAD,
                  left: `calc(50% + (${side * dist}px))`,
                  transform: 'translate(-50%, -50%)',
                  color: p.c,
                  opacity: 0.16,
                }}
              >
                <div
                  style={{ width: size, height: size, animation: `sp-float ${3 + (i % 4) * 0.6}s ease-in-out ${(i % 5) * 0.4}s infinite` }}
                  dangerouslySetInnerHTML={{ __html: motif }}
                />
              </div>
            );
          })}

        {items.map((it, i) => {
          const pt = pts[i];
          if (!pt) return null;
          const left = `calc(50% + (${pt.x}px))`;
          const top = pt.y + PAD;

          if (it.kind === 'goal') {
            const reached = skill.done >= skill.total;
            return (
              <div
                key="goal"
                className="absolute flex flex-col items-center justify-center"
                style={{
                  top,
                  left,
                  width: GOAL,
                  height: GOAL,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  background: reached
                    ? 'radial-gradient(120% 120% at 50% 24%, #ffe79c, #ffc73a 80%)'
                    : GREY_BG,
                  boxShadow: reached
                    ? '0 7px 0 #d99300, 0 16px 22px -7px #ffc73a, 0 2px 1px rgba(255,255,255,.6) inset'
                    : GREY_SHADOW,
                }}
              >
                <Trophy size={23} color={reached ? '#fff' : '#8d85a8'} fill={reached ? '#fff' : 'none'} strokeWidth={2} />
                <span className="text-[15px] font-black leading-none mt-0.5" style={{ color: reached ? '#fff' : '#8d85a8' }}>
                  {skill.goalLevel}
                </span>
              </div>
            );
          }

          if (it.kind === 'checkpoint') {
            const reached = skill.done >= it.after;
            return (
              <div
                key={`c-${it.after}`}
                className="absolute grid place-items-center"
                style={{
                  top,
                  left,
                  width: 66,
                  height: 66,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '20px',
                  background: reached
                    ? `radial-gradient(120% 120% at 50% 24%, ${p.light}, ${p.c} 80%)`
                    : GREY_BG,
                  boxShadow: reached
                    ? `0 7px 0 ${p.dark}, 0 15px 20px -7px ${p.c}, 0 2px 1px rgba(255,255,255,.5) inset`
                    : GREY_SHADOW,
                  zIndex: 4,
                }}
              >
                <Gift size={28} color={reached ? '#fff' : '#8d85a8'} strokeWidth={2.2} />
              </div>
            );
          }

          const state = it.idx < skill.done ? 'done' : it.idx === skill.done ? 'current' : 'locked';
          const isColor = state !== 'locked';
          return (
            <div
              key={`a-${it.idx}`}
              className="absolute grid place-items-center"
              style={{
                top,
                left,
                width: NODE,
                height: NODE,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: isColor
                  ? `radial-gradient(120% 120% at 50% 24%, ${p.light}, ${p.c} 78%)`
                  : GREY_BG,
                boxShadow: isColor
                  ? `0 7px 0 ${p.dark}, 0 14px 18px -7px ${p.c}, 0 2px 1px rgba(255,255,255,.55) inset`
                  : GREY_SHADOW,
                zIndex: state === 'current' ? 6 : 3,
              }}
            >
              {state === 'current' && (
                <>
                  <span className="absolute rounded-full animate-ping" style={{ inset: -9, border: `3px solid ${p.c}`, opacity: 0.5 }} />
                  <span
                    className="absolute -top-7 px-2.5 py-0.5 rounded-full bg-white text-[11px] font-black whitespace-nowrap shadow-md"
                    style={{ color: p.c }}
                  >
                    {startLabel}
                  </span>
                  <Star size={26} color="#fff" fill="#fff" />
                </>
              )}
              {state === 'done' && <Check size={26} strokeWidth={3.4} color="#fff" />}
              {state === 'locked' && <Lock size={23} color="#8d85a8" />}
            </div>
          );
        })}

        {currentIdx >= 0 && pts[currentIdx] && (
          <div
            aria-hidden
            className="absolute"
            style={{
              top: pts[currentIdx].y + PAD + 4,
              left: `calc(50% + (${pts[currentIdx].x + (pts[currentIdx].x >= 0 ? -1 : 1) * (NODE / 2 + 58)}px))`,
              transform: 'translate(-50%, -50%)',
              zIndex: 7,
            }}
          >
            <div
              className="w-16 h-16 rounded-full bg-white shadow-lg ring-4 ring-white overflow-hidden"
              style={{ animation: 'sp-bob 2.4s ease-in-out infinite', transformOrigin: '50% 85%' }}
            >
              <img src="/bob_avatar.png" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
