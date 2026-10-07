vi.mock('server-only', () => ({}));

const user = { id: 'student-1' };
const DATA_URI = 'data:image/png;base64,AAAA';

vi.mock('@/lib/prompts/db-prompts', () => ({
  getPrompt: vi.fn().mockResolvedValue('scene prompt'),
}));

vi.mock('@/actions/gemini/image', () => ({
  generateImageAction: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServer: vi.fn(),
}));

function buildSupabase(overrides: {
  uploadError?: { message: string } | null;
  signError?: { message: string } | null;
  signedUrl?: string | null;
} = {}) {
  const { uploadError = null, signError = null, signedUrl = 'https://signed.example/image.png' } = overrides;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: signError ? null : { signedUrl },
          error: signError,
        }),
      }),
    },
  };
}

describe('generatePracticeImageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the inline image when there is no authenticated user to store it', async () => {
    const { generateImageAction } = await import('@/actions/gemini/image');
    (generateImageAction as ReturnType<typeof vi.fn>).mockResolvedValue(DATA_URI);

    const { generatePracticeImageAction } = await import('@/actions/practice/image');
    const result = await generatePracticeImageAction('a rainy street');

    expect(result.ok).toBe(true);
    expect(result.imageUrl).toBe(DATA_URI);
  });

  it('shows the image even when the storage upload fails', async () => {
    const { generateImageAction } = await import('@/actions/gemini/image');
    (generateImageAction as ReturnType<typeof vi.fn>).mockResolvedValue(DATA_URI);
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildSupabase({ uploadError: { message: 'bucket not found' } })
    );

    const { generatePracticeImageAction } = await import('@/actions/practice/image');
    const result = await generatePracticeImageAction('a busy market');

    expect(result.ok).toBe(true);
    expect(result.imageUrl).toBe(DATA_URI);
  });

  it('uses the signed storage URL when upload and signing succeed', async () => {
    const { generateImageAction } = await import('@/actions/gemini/image');
    (generateImageAction as ReturnType<typeof vi.fn>).mockResolvedValue(DATA_URI);
    const { createSupabaseServer } = await import('@/lib/supabase/server');
    (createSupabaseServer as ReturnType<typeof vi.fn>).mockResolvedValue(buildSupabase());
    const { generatePracticeImageAction } = await import('@/actions/practice/image');
    const result = await generatePracticeImageAction('a quiet library');

    expect(result.ok).toBe(true);
    expect(result.imageUrl).toBe('https://signed.example/image.png');
  });

  it('fails cleanly and never throws when the model returns no image', async () => {
    const { generateImageAction } = await import('@/actions/gemini/image');
    (generateImageAction as ReturnType<typeof vi.fn>).mockResolvedValue('');

    const { generatePracticeImageAction } = await import('@/actions/practice/image');
    const result = await generatePracticeImageAction('a topic');

    expect(result).toEqual({ ok: false, imageUrl: null, prompt: null });
  });
});
