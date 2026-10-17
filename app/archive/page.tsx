import { ArchiveContent } from "@/components/ArchiveContent";
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
      <ArchiveContent articles={articles} categories={categories} />
    </>
  );
}
