import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata = { title: "隱私權政策 | TrendRadar" };

export default function PrivacyPage() {
  return (
    <LegalPageShell title="隱私權政策" updatedAt="2026-07-14">
      <p>
        本隱私權政策說明 TrendRadar（以下稱「本平台」）如何蒐集、使用及保護您的個人資料。
      </p>
      <h2>我們蒐集的資料</h2>
      <ul>
        <li>帳號資料：若您註冊會員，我們會蒐集您的電子郵件與登入憑證（由 Supabase Auth 代管，本平台不會以明文儲存密碼）。</li>
        <li>訂閱與付款狀態：若您訂閱付費方案，我們會保存訂閱狀態、方案與到期時間；實際付款卡號等敏感資料由第三方支付服務商（如 Stripe）處理與儲存，本平台不會直接接觸或儲存完整卡號。</li>
        <li>使用紀錄：基本的網站使用行為（如瀏覽頁面），用於維運與改善服務品質。</li>
      </ul>
      <h2>我們如何使用資料</h2>
      <ul>
        <li>提供、維護與改善本平台服務。</li>
        <li>處理訂閱、帳務與客服需求。</li>
        <li>依法令要求或為保護本平台及使用者權益之必要範圍。</li>
      </ul>
      <h2>第三方服務</h2>
      <p>
        本平台使用 Supabase（資料庫與會員系統）與 Stripe（金流處理，若啟用付費訂閱）等第三方服務商，
        這些服務商可能依其自身隱私權政策處理您的資料。
      </p>
      <h2>資料保存與刪除</h2>
      <p>
        您可隨時聯繫我們要求查詢、更正或刪除您的個人資料，惟依法令或正當商業需求（如帳務紀錄保存義務）
        須保留之資料不在此限。
      </p>
      <h2>聯絡我們</h2>
      <p>
        若您對本隱私權政策有任何疑問，歡迎透過本平台公告之聯絡方式與我們聯繫。
      </p>
    </LegalPageShell>
  );
}
