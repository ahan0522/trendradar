import { LegalPageShell } from "@/components/LegalPageShell";

export const metadata = { title: "服務條款 | TrendRadar" };

export default function TermsPage() {
  return (
    <LegalPageShell title="服務條款" updatedAt="2026-07-14">
      <p>
        歡迎使用 TrendRadar（以下稱「本平台」）。使用本平台即表示您同意以下條款；若您不同意，請勿使用本平台。
      </p>
      <h2>服務內容</h2>
      <p>
        本平台提供市場研究整理、指數與族群觀察、法人資金流統計等內容，部分內容目前公開提供，未來可能區分
        免費與付費（訂閱）層級。詳見{" "}
        <a href="/legal/disclaimer" className="underline">免責聲明</a>。
      </p>
      <h2>帳號</h2>
      <ul>
        <li>若本平台提供會員註冊，您應提供正確、完整之資訊，並自行妥善保管登入憑證。</li>
        <li>因帳號憑證外洩所生之損失，除可歸責於本平台之情形外，由使用者自行負責。</li>
      </ul>
      <h2>付費訂閱</h2>
      <ul>
        <li>付費方案之價格、內容範圍、扣款週期將於訂閱頁面公告，並可能隨時間調整；調整前既有訂閱期間之權益不受影響。</li>
        <li>金流處理由第三方支付服務商（如 Stripe）處理，本平台不會直接儲存您的完整卡號等付款資訊。</li>
        <li>退款政策將於訂閱頁面另行公告。</li>
      </ul>
      <h2>使用限制</h2>
      <p>
        您同意不得以自動化方式大量擷取、重製、轉售本平台內容，亦不得將本平台內容用於誤導他人之投資決策
        或任何違法用途。
      </p>
      <h2>服務變更與中止</h2>
      <p>
        本平台得因營運、技術或法規因素調整、暫停或終止部分或全部服務，並將合理方式通知使用者。
      </p>
      <h2>準據法</h2>
      <p>本條款以中華民國法律為準據法。</p>
    </LegalPageShell>
  );
}
