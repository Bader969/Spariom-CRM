import { Toaster } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

type ViewTransitionDocument = Omit<Document, "startViewTransition"> & {
  startViewTransition?: (callback: () => Promise<void> | void) => {
    ready?: Promise<void>;
  };
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("spariom-theme") || localStorage.getItem("theme")) as
      "light" | "dark" | null;
    const isDark = stored ? stored === "dark" : document.documentElement.classList.contains("dark");
    const initial = isDark ? "dark" : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  return <>{children}</>;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDark =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggle = (event?: React.MouseEvent) => {
    const isCurrentlyDark =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";
    const next = isCurrentlyDark ? "light" : "dark";
    setTheme(next);

    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("spariom-theme", next);
        localStorage.setItem("theme", next);
      } catch (err) {
        void err;
      }
    };

    const doc = typeof document !== "undefined" ? (document as ViewTransitionDocument) : undefined;

    if (
      !doc ||
      !doc.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      applyTheme();
      return;
    }

    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? 0;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    try {
      const transition = doc.startViewTransition(() => {
        applyTheme();
      });

      transition.ready?.then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
          },
          {
            duration: 400,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });
    } catch {
      applyTheme();
    }
  };

  return { theme, toggle };
}

export function AppToaster() {
  return <Toaster richColors position="top-right" />;
}
