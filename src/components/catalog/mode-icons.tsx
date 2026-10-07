import React from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Mic2,
  Headphones,
  ClipboardList,
  Hand,
  HelpCircle,
  BookOpen,
  User,
  GitCompare,
  MessageCircle,
  BookImage,
  Signpost,
  Link2,
  TextCursorInput,
  PenLine,
  Shapes,
  KeyRound,
  Puzzle,
  CheckCheck,
  Images,
  NotebookPen,
  Users,
  Podcast,
  Smile,
  Heart,
  MessagesSquare,
  Mail,
  FileText,
  Files,
  SquarePen,
  Newspaper,
  AudioLines,
  Repeat,
} from 'lucide-react';
import { ListenAndPointIcon } from '@/components/icons/ModeIcons';
import { LookAndAnswerIcon, TellTheStoryIcon, WhatsThisIcon, PersonalQuestionsIcon } from '@/components/icons/StartersIcons';
import { FindTheDifferencesIcon, InformationExchangeIcon, PictureStoryMoversIcon, PersonalQuestionsMoversIcon, MoreAboutYouIcon } from '@/components/icons/MoversIcons';
import { FlyersFindDifferencesIcon } from '@/components/icons/FlyersIcons';
import { KETListeningIcon, KETReadingIcon, KETWritingIcon, KETSpeakingIcon } from '@/components/icons/KETIcons';
import { PETListeningIcon, PETReadingIcon, PETWritingIcon, PETSpeakingIcon } from '@/components/icons/PETIcons';
import { FCEListeningIcon, FCEReadingIcon, FCEWritingIcon, FCESpeakingIcon } from '@/components/icons/FCEIcons';
import { CAEInterviewIcon, CAELongTurnIcon, CAECollaborativeIcon, CAEDiscussionIcon } from '@/components/icons/CAEIcons';
import { CPEInterviewIcon, CPECollaborativeIcon, CPEMonologueIcon, CPEExtendedDiscussionIcon, CPEFinalDiscussionIcon } from '@/components/icons/CPEIcons';

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  MessageSquare,
  Image: ImageIcon,
  Sparkles,
  Mic2,
  Headphones,
  ClipboardList,
  Hand,
  HelpCircle,
  BookOpen,
  User,
  GitCompare,
  MessageCircle,
  BookImage,
  ImageIcon,
  Signpost,
  Link2,
  TextCursorInput,
  PenLine,
  Shapes,
  KeyRound,
  Puzzle,
  CheckCheck,
  Images,
  NotebookPen,
  Users,
  Podcast,
  Smile,
  Heart,
  MessagesSquare,
  Mail,
  FileText,
  Files,
  SquarePen,
  Newspaper,
  AudioLines,
  Repeat,
  ListenAndPoint: ListenAndPointIcon,
  LookAndAnswer: LookAndAnswerIcon,
  TellTheStory: TellTheStoryIcon,
  WhatsThis: WhatsThisIcon,
  PersonalQuestions: PersonalQuestionsIcon,
  FindTheDifferences: FindTheDifferencesIcon,
  InformationExchange: InformationExchangeIcon,
  PictureStoryMovers: PictureStoryMoversIcon,
  PersonalQuestionsMovers: PersonalQuestionsMoversIcon,
  MoreAboutYou: MoreAboutYouIcon,
  FlyersFindDifferences: FlyersFindDifferencesIcon,
  KETListening: KETListeningIcon,
  KETReading: KETReadingIcon,
  KETWriting: KETWritingIcon,
  KETSpeaking: KETSpeakingIcon,
  PETListening: PETListeningIcon,
  PETReading: PETReadingIcon,
  PETWriting: PETWritingIcon,
  PETSpeaking: PETSpeakingIcon,
  FCEListening: FCEListeningIcon,
  FCEReading: FCEReadingIcon,
  FCEWriting: FCEWritingIcon,
  FCESpeaking: FCESpeakingIcon,
  CAEInterview: CAEInterviewIcon,
  CAELongTurn: CAELongTurnIcon,
  CAECollaborative: CAECollaborativeIcon,
  CAEDiscussion: CAEDiscussionIcon,
  CPEInterview: CPEInterviewIcon,
  CPECollaborative: CPECollaborativeIcon,
  CPEMonologue: CPEMonologueIcon,
  CPEExtendedDiscussion: CPEExtendedDiscussionIcon,
  CPEFinalDiscussion: CPEFinalDiscussionIcon,
};

/**
 * @param name icon key
 * @param size number
 * @param className string
 * @returns icon element, Sparkles when the key is unknown
 */
export function resolveIcon(name: string, size = 28, className?: string): React.ReactNode {
  const Icon = ICON_MAP[name];
  if (Icon) return <Icon size={size} className={className} />;
  return <Sparkles size={size} className={className} />;
}
