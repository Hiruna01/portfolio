import type { Metadata } from "next";
import { Page, PageTitle } from "@/components/lists";
import { ProjectCard } from "@/components/project-card";
import { ProjectsBrowser } from "@/components/projects-browser";
import { getProjects } from "@/lib/store";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <Page>
      <PageTitle title="Projects" lede="Things I've built, newest first. Each preview is a small loop of the project doing its job." />
      <ProjectsBrowser
        cards={projects.map((project) => ({
          id: project.id,
          category: project.category,
          card: <ProjectCard project={project} />,
        }))}
      />
    </Page>
  );
}
