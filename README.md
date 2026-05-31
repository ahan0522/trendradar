# TrendRadar Next.js DB Live Home + Topic Detail

新增功能：
- `/topics/[id]` 話題詳情頁
- `/api/db/topics/[id]` 話題詳情 API
- 首頁與熱門話題頁可跳轉到完整詳情
- 詳情頁顯示相關文章、來源分布、熱度時間線、最後同步時間

## 開發

```bash
npm install
npm run dev
```

## 主要頁面

- `/` 首頁
- `/topics` 熱門話題頁
- `/topics/<topic-id>` 話題詳情頁
- `/api/db/topics/<topic-id>` 話題詳情 API


## Vercel Cron

This project includes a cron endpoint at `/api/cron/sync` and a `vercel.json` schedule.

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=replace-with-a-random-secret
```

For manual testing, call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/cron/sync
```
