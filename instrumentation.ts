export async function register() {
  // A persistent local Node server polls the same DB queue; Vercel is woken by Supabase Cron.
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startLocalNewsWorker } = await import('./lib/news-jobs');
    startLocalNewsWorker();
  }
}
