import { ProjectEditor } from "@/components/workspace/ProjectEditor";

export default function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  return <ProjectEditor projectId={params.id} />;
}
