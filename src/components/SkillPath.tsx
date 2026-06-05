'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Check, Headphones, Lock, Mic, PenLine, Star, Trophy } from 'lucide-react';

type SkillKey = 'speaking' | 'reading' | 'listening' | 'writing';

/**
 * One skill's progress, used to render its winding Duolingo-style activity path.
 * `done` activities show as completed nodes, `total - done` as locked, and the
 * goal node shows `goalLevel` (gold once the skill is fully completed).
 */
export interface SkillPathSkill {
  key: SkillKey;
  label: string;
  level: string;
  goalLevel: string;
  done: number;
  total: number;
}

const PALETTE: Record<SkillKey, { c: string; light: string; dark: string }> = {
  speaking: { c: '#3660AB', light: '#7aa0ff', dark: '#26417a' },
  reading: { c: '#469E7B', light: '#7fd0ad', dark: '#2f7256' },
  listening: { c: '#F8AC37', light: '#ffce7a', dark: '#c97f12' },
  writing: { c: '#9333EA', light: '#c084fc', dark: '#6d28d9' },
};

const ICON: Record<SkillKey, typeof Headphones> = {
  speaking: Mic,
  reading: BookOpen,
  listening: Headphones,
  writing: PenLine,
};

const GAP = 92;
const AMP = 78;
const FREQ = 0.74;
const PAD = 92;
const NODE = 60;
const GOAL = 76;

const GREY_BG = 'radial-gradient(120% 120% at 50% 24%, #f6f2fd, #e3ddef 72%)';
const GREY_SHADOW = '0 7px 0 #cdc4e2, 0 13px 16px -7px rgba(60,40,110,.4), 0 2px 1px #fff inset';

const offAt = (i: number) => Math.sin(i * FREQ) * AMP;

/**
 * Tabbed, full-width skill path for the student dashboard. Each tab is a skill;
 * the active skill renders as a vertical winding trail of 3D activity nodes that
 * scrolls, ending in a goal node with the target CEFR level.
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
  if (skills.length === 0) return null;

  const skill = skills[active];
  const p = PALETTE[skill.key];
  const pct = skill.total ? Math.round((skill.done / skill.total) * 100) : 0;
  const colHeight = skill.total * GAP + PAD * 2 + GOAL;

  const colorBg = `radial-gradient(120% 120% at 50% 24%, ${p.light}, ${p.c} 78%)`;
  const colorShadow = `0 7px 0 ${p.dark}, 0 14px 18px -7px ${p.c}, 0 2px 1px rgba(255,255,255,.55) inset`;

  const reached = skill.done >= skill.total;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className="w-full mt-6 pb-16"
    >
      <div className="max-w-2xl mx-auto px-4 mb-3">
        <h3 className="text-base font-black text-trebol-text tracking-tight">{title}</h3>
      </div>

      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-y border-trebol-border/40">
        <div className="max-w-2xl mx-auto px-3 py-2.5 grid grid-cols-4 gap-2">
          {skills.map((s, i) => {
            const sp = PALETTE[s.key];
            const Ic = ICON[s.key];
            const on = i === active;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(i)}
                className="flex flex-col items-center gap-1 py-2 rounded-2xl text-[11px] font-bold transition-all"
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
        <div className="max-w-2xl mx-auto px-4 pb-2.5 flex items-center gap-3">
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

      <div className="relative mx-auto max-w-md px-4" style={{ height: colHeight }}>
        {Array.from({ length: skill.total }).map((_, i) => {
          const off = offAt(i);
          const state = i < skill.done ? 'done' : i === skill.done ? 'current' : 'locked';
          const isColor = state !== 'locked';
          return (
            <div
              key={i}
              className="absolute left-1/2 grid place-items-center"
              style={{
                top: i * GAP + PAD,
                width: NODE,
                height: NODE,
                transform: `translate(calc(-50% + ${off}px), -50%)`,
                borderRadius: '50%',
                background: isColor ? colorBg : GREY_BG,
                boxShadow: isColor ? colorShadow : GREY_SHADOW,
                zIndex: state === 'current' ? 6 : 3,
              }}
            >
              {state === 'current' && (
                <>
                  <span
                    className="absolute rounded-full animate-ping"
                    style={{ inset: -9, border: `3px solid ${p.c}`, opacity: 0.5 }}
                  />
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

        <div
          className="absolute left-1/2 flex flex-col items-center justify-center"
          style={{
            top: skill.total * GAP + PAD,
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
          <Trophy
            size={23}
            color={reached ? '#fff' : '#8d85a8'}
            fill={reached ? '#fff' : 'none'}
            strokeWidth={2}
          />
          <span
            className="text-[15px] font-black leading-none mt-0.5"
            style={{ color: reached ? '#fff' : '#8d85a8' }}
          >
            {skill.goalLevel}
          </span>
        </div>
      </div>
    </motion.section>
  );
}
