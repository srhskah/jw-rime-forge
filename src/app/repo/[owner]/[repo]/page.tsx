import { SchemaBrowser } from "@/components/repo/SchemaBrowser";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return (
    <SchemaBrowser
      owner={decodeURIComponent(owner)}
      repo={decodeURIComponent(repo)}
    />
  );
}
