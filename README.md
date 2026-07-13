# 每日排程考勤 APP

一個主任/員工分權的每日排程、考勤、通知與留言板原型。

## 功能

- 主任與員工登入、註冊
- 主任註冊時建立群組代碼
- 員工註冊時輸入群組代碼加入群組
- 主任建立固定每日排程或臨時指定排程
- 員工回覆排程「收到」與「完成」
- 完成按鈕需到排程時間後才能按
- 主任查看每位員工收到/完成狀態
- 主任群發消息
- 群組留言板
- 上班/下班打卡，下班需主任核准
- 主任刪除員工資料
- 主任設定員工每週排班，一天可多段班別
- 瀏覽器通知：排程前 10 分鐘、上班前 10 分鐘

## 預設主任

- 帳號：`GMPJ`
- 密碼：`6090`
- 群組代碼：`GMPJ`

## 開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

## Supabase 雲端同步

1. 到 Supabase 建立專案。
2. 開啟 SQL Editor，執行 `supabase/schema.sql`。
3. 複製 `.env.example` 成 `.env`，填入：

```bash
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

4. 重新建置與部署：

```bash
npm run build
npm run deploy
```

GitHub Pages 也支援自動部署：到 GitHub repo 的 `Settings` → `Secrets and variables` → `Actions` 新增：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

之後推送到 `master` 時會自動部署雲端同步版。

有設定 Supabase 時，主任、員工、群組代碼、排程、考勤、留言會同步到雲端。未設定時會顯示「本機模式」，資料只存在目前瀏覽器。

目前通知仍是瀏覽器通知與 Email 草稿。真正背景手機推播或自動寄信，需要再接通知服務。

## Email 自動寄送

瀏覽器前端不能安全地直接自動寄 Email，因為 Email API 金鑰不能放在公開網站裡。

若要排程或群發消息自動寄到員工信箱，建議下一步接：

- Supabase Edge Function
- Resend 或 SendGrid
- 一組後端專用 API key

目前 APP 會保留 Email 草稿功能；自動寄信需要加後端寄信函式。

## Web Push 背景通知

此專案已加入 Supabase Edge Function + Web Push 架構。

需要先更新 Supabase SQL：

```sql
-- 在 Supabase SQL Editor 重新執行 supabase/schema.sql
```

需要部署 Edge Functions：

```bash
npx supabase login
npx supabase link --project-ref ztsdlnrcjfqzqoypeuju
npx supabase secrets set VAPID_PUBLIC_KEY=你的_VAPID_PUBLIC_KEY
npx supabase secrets set VAPID_PRIVATE_KEY=你的_VAPID_PRIVATE_KEY
npx supabase secrets set VAPID_SUBJECT=mailto:你的信箱
npx supabase functions deploy send-push
npx supabase functions deploy send-due-pushes
```

前端需要 GitHub Secret：

```bash
VITE_VAPID_PUBLIC_KEY=你的_VAPID_PUBLIC_KEY
```

`send-push` 會在主任建立排程或群發消息時立即推送。

`send-due-pushes` 需要定時呼叫，建議每分鐘一次。可用 Supabase Scheduled Functions、cron-job.org，或其他排程服務呼叫：

```text
https://ztsdlnrcjfqzqoypeuju.supabase.co/functions/v1/send-due-pushes
```

手機限制：

- Android Chrome / Edge 通常支援 Web Push。
- iPhone 需要使用 Safari 將網站加入主畫面後，才比較可能收到 Web Push。
- 若使用的手機瀏覽器不支援 Web Push，APP 內通知中心仍會顯示提醒。
