import { ArchiveExplorer } from "@/components/ArchiveExplorer";
import { Header } from "@/components/Header";
import { getAllArticles, getCategories } from "@/lib/articles";

export default async function ArchivePage() {
  const [articles, categories] = await Promise.all([
    getAllArticles(),
    getCategories(),
  ]);

  return (
    <>
      <Header currentPath="/archive" />
      <main className="container section stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Archive</p>
            <h1>Daily archive</h1>
          </div>
          <p className="section-note">
            Filter by category and expand each card for business, AI PM, and risk
            context.
          </p>
        </div>

        <ArchiveExplorer articles={articles} categories={categories} />
      </main>
    </>
  );
}
