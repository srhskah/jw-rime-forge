import { ProjectEditor } from "@/components/workspace/ProjectEditor";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectEditor projectId={id} />;
}
