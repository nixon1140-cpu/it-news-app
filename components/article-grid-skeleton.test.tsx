import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArticleGridSkeleton } from "@/components/article-grid-skeleton";

// Vitest + React Testing Libraryの疎通確認用の最小テスト（本格的なUIテスト群はフェーズD2以降）。
describe("ArticleGridSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<ArticleGridSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });
});
