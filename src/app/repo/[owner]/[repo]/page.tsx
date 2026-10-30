import { SchemaBrowser } from "@/components/repo/SchemaBrowser";

export default function RepoPage({
  params,
}: {
  params: { owner: string; repo: string };
}) {
  return (
    <SchemaBrowser
      owner={decodeURIComponent(params.owner)}
      repo={decodeURIComponent(params.repo)}
    />
  );
}
