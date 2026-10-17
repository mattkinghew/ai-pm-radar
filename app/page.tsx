import { Header } from "@/components/Header";
import { HomeContent } from "@/components/HomeContent";
import { getLatestDate, getTopArticles } from "@/lib/articles";

export default async function HomePage() {
  const [topArticles, latestDate] = await Promise.all([
    getTopArticles(),
    getLatestDate(),
  ]);

  return (
    <>
      <Header currentPath="/" />
      <HomeContent topArticles={topArticles} latestDate={latestDate} />
    </>
  );
}
