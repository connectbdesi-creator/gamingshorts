"use client";

import Giscus from "@giscus/react";
import { useTheme } from "next-themes";

/**
 * Giscus embed (GitHub Discussions-backed), chosen over Disqus/custom per
 * CLAUDE.md's open item — near-zero build time and no third-party ads
 * competing with this site's own native ad cards.
 *
 * Requires the Giscus GitHub App installed on a public repo and the
 * NEXT_PUBLIC_GISCUS_* env vars set (see .env.example + giscus.app to
 * generate them). Until then, renders a placeholder instead of breaking.
 */
export function Comments({ term }: { term: string }) {
  const { resolvedTheme } = useTheme();

  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  if (!repo || !repoId || !category || !categoryId) {
    return (
      <div className="rounded-card border border-dashed border-border p-6 text-center text-sm text-foreground-subtle">
        Comments aren&apos;t configured yet. Install the Giscus GitHub App on
        this site&apos;s repo and set the NEXT_PUBLIC_GISCUS_* env vars (see
        .env.example) to enable them.
      </div>
    );
  }

  return (
    <Giscus
      repo={repo as `${string}/${string}`}
      repoId={repoId}
      category={category}
      categoryId={categoryId}
      mapping="specific"
      term={term}
      reactionsEnabled="1"
      emitMetadata="0"
      inputPosition="top"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      lang="en"
    />
  );
}
