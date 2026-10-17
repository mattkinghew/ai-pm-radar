"use client";

import { useLanguage } from "@/components/LanguageProvider";

export function Footer() {
  const { messages } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h2>{messages.footer.disclaimer}</h2>
          <p>{messages.footer.disclaimerBody}</p>
        </div>
        <div>
          <h2>{messages.footer.security}</h2>
          <p>{messages.footer.securityBody}</p>
        </div>
      </div>
    </footer>
  );
}
