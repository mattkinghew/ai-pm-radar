"use client";

import Link from "next/link";

import { useLanguage } from "@/components/LanguageProvider";

type HeaderProps = {
  currentPath?: string;
};

export function Header({ currentPath }: HeaderProps) {
  const { locale, messages, setLocale } = useLanguage();
  const navItems = [
    { href: "/", label: messages.nav.home },
    { href: "/source-inbox", label: messages.nav.sourceInbox },
    { href: "/archive", label: messages.nav.archive },
    { href: "/research", label: messages.nav.research },
    { href: "/about", label: messages.nav.about },
  ];

  return (
    <header className="site-header">
      <div className="container shell">
        <Link href="/" className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <strong>AI PM Radar</strong>
            <p>{messages.brand.description}</p>
          </div>
        </Link>

        <nav aria-label={messages.nav.primary} className="nav">
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

        <button
          type="button"
          className="language-toggle"
          aria-label={messages.language.current}
          aria-pressed={locale === "zh-en"}
          onClick={() => setLocale(locale === "zh-Hant" ? "zh-en" : "zh-Hant")}
        >
          {messages.language.toggle}
        </button>
      </div>
    </header>
  );
}
