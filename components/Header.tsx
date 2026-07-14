"use client";

import Link from "next/link";

import { useLanguage } from "./LanguageProvider";

type HeaderProps = {
  currentPath?: string;
};

export function Header({ currentPath }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const navItems = [
    { href: "/", label: t("home") },
    { href: "/archive", label: t("archive") },
    { href: "/marketing-ops-demo", label: t("marketingOpsDemo") },
    { href: "/about", label: t("about") },
  ];

  return (
    <header className="site-header">
      <div className="container shell">
        <Link href="/" className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <strong>AI PM Radar</strong>
            <p>{t("brandTagline")}</p>
          </div>
        </Link>

        <div className="header-actions">
          <nav aria-label="Primary navigation" className="nav">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? currentPath === "/"
                  : currentPath?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive ? "nav-link active" : "nav-link"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="language-toggle" role="group" aria-label={t("languageLabel")}>
            <button
              type="button"
              className={language === "zh-HK" ? "lang-button active" : "lang-button"}
              onClick={() => setLanguage("zh-HK")}
            >
              中文
            </button>
            <button
              type="button"
              className={language === "en" ? "lang-button active" : "lang-button"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
