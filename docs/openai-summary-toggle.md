# OpenAI 摘要開關

TrendRadar 目前預設使用免費的 rule-based 摘要。若未設定 OpenAI 相關環境變數，不會呼叫 API，也不會產生費用。

## 啟用方式

在 Vercel Project Settings > Environment Variables 加上：

```text
AI_SUMMARY_PROVIDER=openai
OPENAI_API_KEY=你的 OpenAI API key
OPENAI_SUMMARY_MODEL=gpt-5-nano
```

啟用後，`/api/topics/sync-grouped` 在整理每個主題時會先嘗試 OpenAI 摘要。若 API 失敗、配額不足或回傳格式錯誤，系統會自動 fallback 到 rule-based 摘要，不會中斷同步。

## 成本控制建議

- 先只用手動 Run 測試，不要立刻提高 cron 頻率。
- 每次同步只對去重後的主題呼叫一次 AI，不要逐篇文章各呼叫一次。
- 每個主題最多送 8 篇代表來源。
- 免費試做階段建議一天 1-2 次即可。

## 目前輸出格式

OpenAI 會回傳目前 DB 已支援的欄位：

- `longTitle`
- `summary`
- `bullets`
- `subtopics`
- `tags`

`sourceBriefs`、`openQuestions` 這類更完整的資訊先放在後續 schema 升級，不急著寫入 DB。
