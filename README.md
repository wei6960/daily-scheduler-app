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

有設定 Supabase 時，主任、員工、群組代碼、排程、考勤、留言會同步到雲端。未設定時會顯示「本機模式」，資料只存在目前瀏覽器。

目前通知仍是瀏覽器通知與 Email 草稿。真正背景手機推播或自動寄信，需要再接通知服務。
