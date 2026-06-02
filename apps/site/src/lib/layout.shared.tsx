import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="font-semibold tracking-tight">promptbook</span>,
      url: "/",
    },
    githubUrl: "https://github.com/markbrutx/promptbook",
    links: [{ text: "Docs", url: "/docs" }],
  };
}
