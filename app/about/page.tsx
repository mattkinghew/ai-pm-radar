import { AboutContent } from "@/components/AboutContent";
import { Header } from "@/components/Header";

export default function AboutPage() {
  return (
    <>
      <Header currentPath="/about" />
      <AboutContent />
    </>
  );
}
