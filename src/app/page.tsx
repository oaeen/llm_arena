import { DashboardPage } from "@/components/dashboard-page";
import { DEFAULT_LIMIT } from "@/lib/config";
import { formatDateTime } from "@/lib/formatters";
import { readLatestSnapshot } from "@/lib/snapshot/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await readLatestSnapshot();

  if (!snapshot) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
        <section className="w-full rounded-[32px] border border-black/8 bg-white p-10 shadow-[0_18px_56px_rgba(15,23,42,0.06)]">
          <div className="text-xs font-medium uppercase tracking-[0.28em] text-black/45">
            LLM Arena 综合性能看板
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-black">
            还没有可展示的快照。
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-black/58">
            页面默认只读本地快照。请先运行
            <code className="mx-1 rounded bg-black/[0.04] px-2 py-1 text-sm">
              npm run refresh:data
            </code>
            或通过受保护的
            <code className="mx-1 rounded bg-black/[0.04] px-2 py-1 text-sm">
              POST /api/refresh
            </code>
            生成第一份数据。
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <DashboardPage initialLimit={DEFAULT_LIMIT} snapshot={snapshot} />
      <footer className="mx-auto mb-10 max-w-[1400px] px-4 text-sm text-black/45 md:px-8">
        数据来源更新时间：Arena{" "}
        {formatDateTime(snapshot.meta.sourceFreshness.arenaFetchedAt)}
        {" · "}
        OpenRouter catalog{" "}
        {formatDateTime(
          snapshot.meta.sourceFreshness.openRouterCatalogFetchedAt,
        )}
      </footer>
    </>
  );
}
