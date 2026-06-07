'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Check,
  ClipboardList,
  Gift,
  Headphones,
  Lock,
  Mic,
  PenLine,
  RefreshCw,
  Star,
  Trophy,
} from 'lucide-react';

type SkillKey = 'speaking' | 'reading' | 'listening' | 'writing';

/**
 * One skill's full state for the unified path block: tab + detail (score ring,
 * level, last test, actions) + the winding activity path. `done` activities show
 * as completed nodes, the rest locked, with reward checkpoints and a goal node.
 */
export interface SkillPathSkill {
  key: SkillKey;
  label: string;
  level: string;
  goalLevel: string;
  cefrValue: string | null;
  done: number;
  total: number;
  pct: number;
  sessions: number;
  lastTest: string | null;
  pending: boolean;
}

const PALETTE: Record<SkillKey, { c: string; light: string; dark: string; tint: string; soft: string }> = {
  speaking: { c: '#3660AB', light: '#7aa0ff', dark: '#26417a', tint: '#e7edf9', soft: '#dde4f2' },
  reading: { c: '#469E7B', light: '#7fd0ad', dark: '#2f7256', tint: '#e3f1ea', soft: '#dcebe3' },
  listening: { c: '#F8AC37', light: '#ffce7a', dark: '#c97f12', tint: '#fdefd6', soft: '#fde9c8' },
  writing: { c: '#9333EA', light: '#c084fc', dark: '#6d28d9', tint: '#f3e8ff', soft: '#ede0fb' },
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

function ScoreRing({ pct, active, color, soft }: { pct: number; active: boolean; color: string; soft: string }) {
  const r = 27;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative w-[68px] h-[68px] shrink-0">
      <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke={soft} strokeWidth="8" />
        <motion.circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: active ? offset : circ }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-black tabular-nums" style={{ color: active ? color : '#cbd5e1' }}>
          {active ? (pct / 10).toFixed(1) : '—'}
        </span>
        {active && <span className="text-[9px] font-bold tracking-wider text-trebol-text/40">/10</span>}
      </div>
    </div>
  );
}

/**
 * Unified, full-width skill block for the student dashboard: a row of skill tabs
 * (each with its CEFR level), then the active skill's detail (score ring, level,
 * last test, change / take-test actions), then the active skill's winding activity
 * path with reward checkpoints, ambient decorations and Bob cheering beside the
 * current step.
 */
export function SkillPath({
  skills,
  title,
  startLabel,
  pickableLevels,
  onTakeTest,
  onChangeLevel,
}: {
  skills: SkillPathSkill[];
  title: string;
  startLabel: string;
  pickableLevels?: Array<{ value: string; label: string }>;
  onTakeTest?: (skill: SkillKey) => void;
  onChangeLevel?: (skill: SkillKey, level: string) => void | Promise<void>;
}) {
  const [active, setActive] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingLevel, setSavingLevel] = useState(false);
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
  const pctDone = skill.total ? Math.round((skill.done / skill.total) * 100) : 0;
  const lastPt = pts[pts.length - 1];
  const colHeight = lastPt.y + PAD * 2;
  const showDecor = width >= 680;
  const select = (i: number) => {
    setActive(i);
    setPickerOpen(false);
  };

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
                onClick={() => select(i)}
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
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider leading-none"
                  style={on ? { background: 'rgba(255,255,255,.25)', color: '#fff' } : { background: sp.soft, color: sp.c }}
                >
                  {s.cefrValue ? s.cefrValue.replace('_', ' ') : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-4">
          <ScoreRing pct={skill.pct} active={skill.sessions > 0} color={p.c} soft={p.soft} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black whitespace-nowrap" style={{ color: p.c }}>
                {skill.level} ▸ {skill.goalLevel}
              </span>
              <span className="text-[11px] font-black tabular-nums text-trebol-text/55">{skill.done}/{skill.total}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-trebol-text/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pctDone}%`, background: `linear-gradient(90deg, ${p.light}, ${p.c})` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {skill.pending ? (
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider" style={{ color: p.c }}>
                  <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: p.c }} />
                  Evaluating
                </span>
              ) : skill.lastTest ? (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ background: p.soft, color: p.c }}
                >
                  <ClipboardList size={10} />
                  {skill.lastTest}
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider text-trebol-text/35">No test yet</span>
              )}

              <div className="flex items-center gap-3 text-[11px] font-bold ml-auto">
                {onChangeLevel && pickableLevels && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    disabled={savingLevel}
                    className="flex items-center gap-1 text-trebol-text/50 hover:text-trebol-text transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={12} />
                    Change
                  </button>
                )}
                {onTakeTest && (
                  <button
                    type="button"
                    onClick={() => onTakeTest(skill.key)}
                    className="flex items-center gap-1 cursor-pointer"
                    style={{ color: p.c }}
                  >
                    <ClipboardList size={12} />
                    Take test
                  </button>
                )}
              </div>
            </div>

            {pickerOpen && onChangeLevel && pickableLevels && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-wrap items-center gap-1">
                {pickableLevels.map((lvl) => {
                  const isCurrent = skill.cefrValue === lvl.value;
                  return (
                    <button
                      key={lvl.value}
                      type="button"
                      disabled={savingLevel || isCurrent}
                      onClick={async () => {
                        setSavingLevel(true);
                        try {
                          await onChangeLevel(skill.key, lvl.value);
                          setPickerOpen(false);
                        } finally {
                          setSavingLevel(false);
                        }
                      }}
                      className="rounded-md font-black uppercase tracking-tight whitespace-nowrap border transition-all cursor-pointer disabled:cursor-default hover:scale-105 text-[10px] px-2 py-1 leading-none"
                      style={
                        isCurrent
                          ? { background: p.c, color: '#fff', borderColor: p.c }
                          : { background: '#fff', color: p.c, borderColor: `${p.c}33` }
                      }
                    >
                      {lvl.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div ref={trackRef} className="relative mx-auto max-w-5xl px-4 overflow-hidden mt-4" style={{ height: colHeight }}>
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
      </div>
    </motion.section>
  );
}
