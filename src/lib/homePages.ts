import type { CheckGroup, VaastuCheck } from "./checks.ts";

/** One swipe page. A crowded category becomes "Name 1/2", "Name 2/2". */
export interface HomePage {
  id: string;
  group: CheckGroup["group"];
  part: number;
  parts: number;
  icon: string;
  checks: VaastuCheck[];
  columns: 2 | 3;
}

/** Six tiles stay readable in two columns. Seven to nine use three columns. */
const TWO_COLUMN_MAX = 6;
const ONE_PAGE_MAX = 9;
const SPLIT_SIZE = 6;

export function homePages(groups: readonly CheckGroup[]): HomePage[] {
  const pages: HomePage[] = [];
  for (const group of groups) {
    const chunks = chunkChecks(group.checks);
    chunks.forEach((checks, index) => {
      pages.push({
        id: `${group.group.en}:${index}`,
        group: group.group,
        part: index + 1,
        parts: chunks.length,
        icon: checks[0]?.icon ?? "house",
        checks,
        columns: checks.length > TWO_COLUMN_MAX ? 3 : 2,
      });
    });
  }
  return pages;
}

function chunkChecks(checks: readonly VaastuCheck[]): VaastuCheck[][] {
  if (checks.length <= ONE_PAGE_MAX) return [checks.slice()];
  const chunks: VaastuCheck[][] = [];
  for (let index = 0; index < checks.length; index += SPLIT_SIZE) {
    chunks.push(checks.slice(index, index + SPLIT_SIZE));
  }
  return chunks;
}
