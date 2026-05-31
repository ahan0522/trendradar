import { categories } from "@/data/mock-topics";
import { rssSources } from "@/data/rss-sources";

export default function CategoriesPage() {
  const visibleCategories = categories.filter((category) => category !== "全部");

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            分類管理
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">分類與資料來源</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            這裡用來檢查目前有哪些話題分類，以及每個 RSS 來源會被歸到哪個分類。之後可以把這裡擴充成可新增、停用、調整權重的後台。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visibleCategories.map((category) => {
            const sources = rssSources.filter((source) => source.category === category);
            return (
              <div key={category} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{category}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {sources.length} 來源
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {sources.length > 0 ? (
                    sources.map((source) => (
                      <div key={source.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div className="font-medium">{source.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{source.region}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">尚未設定 RSS 來源</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
