export async function register() {
  // A persistent local Node server polls the same DB queue; Vercel is woken by Supabase Cron.
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL && process.env.NEXT_PHASE !== 'phase-production-build' && process.env.ARCHB_DISABLE_LOCAL_NEWS_WORKER !== '1') {
    const { startLocalNewsWorker } = await import('./lib/news-jobs');
    startLocalNewsWorker();
  }
}
