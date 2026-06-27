import Link from "next/link";

type HeaderProps = {
  currentPath?: string;
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive" },
  { href: "/about", label: "About" },
];

export function Header({ currentPath }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container shell">
        <Link href="/" className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <strong>AI PM Radar</strong>
            <p>Daily AI and business signals for practical decision-making</p>
          </div>
        </Link>

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
      </div>
    </header>
  );
}
