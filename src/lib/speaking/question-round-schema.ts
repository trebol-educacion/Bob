export interface QuestionRoundSchema<TPlan> {
  safeParse: (x: unknown) => { success: boolean; data?: TPlan; error?: unknown };
}
