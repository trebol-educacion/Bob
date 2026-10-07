export function difficultyKey(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'easy';
    case 2: return 'medium';
    case 3: return 'hard';
    case 4: return 'veryHard';
    default: return '';
  }
}
