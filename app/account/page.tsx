import { createSupabaseServerClient, getCurrentUser, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { signOut } from "@/app/account/actions";
import { SignInForm, SignUpForm } from "@/components/AuthForms";
import { SubscribeButton } from "@/components/SubscribeButton";

export const dynamic = "force-dynamic";

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

async function loadSubscription(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();
  return data;
}

export default async function AccountPage() {
  if (!isSupabaseAuthConfigured()) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-md px-5 py-16 text-center">
          <h1 className="text-xl font-bold">帳號系統尚未設定</h1>
          <p className="mt-3 text-sm text-slate-500">此功能即將推出，敬請期待。</p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-sm px-5 py-16">
          <h1 className="text-2xl font-bold tracking-tight">帳號</h1>
          <div className="mt-8 space-y-8">
            <SignInForm />
            <div className="border-t border-slate-200 pt-8">
              <SignUpForm />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const subscription = await loadSubscription(user.id);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-sm px-5 py-16">
        <h1 className="text-2xl font-bold tracking-tight">帳號</h1>
        <p className="mt-2 text-sm text-slate-500">{user.email}</p>

        <div className="mt-8 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">訂閱狀態</p>
          {subscription ? (
            <>
              <p className="mt-2 text-sm text-slate-700">{subscription.status}</p>
              {subscription.current_period_end ? (
                <p className="mt-1 text-xs text-slate-400">
                  {subscription.cancel_at_period_end ? "將於" : "下次續訂"} {new Date(subscription.current_period_end).toLocaleDateString("zh-TW")}
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-3">
              <p className="mb-3 text-sm text-slate-500">尚未訂閱。</p>
              <SubscribeButton userId={user.id} email={user.email ?? ""} />
            </div>
          )}
        </div>

        <form action={signOut} className="mt-8">
          <button className="text-sm font-semibold text-slate-500 hover:text-slate-800">登出</button>
        </form>
      </div>
    </main>
  );
}
