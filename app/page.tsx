import { Header } from "@/components/Header";
import { HomeDashboard } from "@/components/HomeDashboard";
import { getLatestDate, getTopArticles } from "@/lib/articles";

export default async function HomePage() {
  const [topArticles, latestDate] = await Promise.all([
    getTopArticles(),
    getLatestDate(),
  ]);

  return (
    <>
      <Header currentPath="/" />
      <HomeDashboard topArticles={topArticles} latestDate={latestDate} />
    </>
  );
}
