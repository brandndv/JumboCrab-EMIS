"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { ScreenOverlayLoadingState } from "@/components/loading/loading-states";
import { DepartmentTable } from "@/features/manage-organization/department-table";
import { DepartmentView } from "@/features/manage-organization/department-view";
import { PositionTable } from "@/features/manage-organization/position-table";
import { PositionView } from "@/features/manage-organization/position-view";
import { StructureTable } from "@/features/manage-organization/structure-table";
import { SupervisorView } from "@/features/manage-organization/supervisor-view";

function OrganizationPageShell({
  title,
  description,
  loaderTitle,
  loaderDescription,
  sectionKeys,
  sections,
}: {
  title: string;
  description: string;
  loaderTitle: string;
  loaderDescription: string;
  sectionKeys: string[];
  sections: (markSectionReady: (sectionKey: string) => void) => ReactNode;
}) {
  const [pendingSections, setPendingSections] = useState<Set<string>>(
    () => new Set(sectionKeys),
  );

  const markSectionReady = useCallback((sectionKey: string) => {
    setPendingSections((current) => {
      if (current.size === 0) {
        return current;
      }
      if (!current.has(sectionKey)) {
        return current;
      }
      const next = new Set(current);
      next.delete(sectionKey);
      return next;
    });
  }, []);

  const content = sections(markSectionReady);
  const isLoading = pendingSections.size > 0;

  return (
    <div className="relative min-h-[60vh] px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-6">{content}</div>
      {isLoading ? (
        <ScreenOverlayLoadingState
          title={loaderTitle}
          description={loaderDescription}
        />
      ) : null}
    </div>
  );
}

export function OrganizationOverviewPageContent() {
  return (
    <OrganizationPageShell
      title="Structure"
      description="Manage departments, positions, and reporting structure."
      loaderTitle="Loading organization"
      loaderDescription="Syncing teams, roles, and reporting lines."
      sectionKeys={[
        "department-table",
        "department-view",
        "position-table",
        "position-view",
        "supervisor-view",
        "structure-table",
      ]}
      sections={(markSectionReady) => (
        <>
          <DepartmentTable
            onInitialLoadComplete={() => markSectionReady("department-table")}
          />
          <DepartmentView
            onInitialLoadComplete={() => markSectionReady("department-view")}
          />
          <PositionTable
            onInitialLoadComplete={() => markSectionReady("position-table")}
          />
          <PositionView
            onInitialLoadComplete={() => markSectionReady("position-view")}
          />
          <SupervisorView
            onInitialLoadComplete={() => markSectionReady("supervisor-view")}
          />
          <StructureTable
            onInitialLoadComplete={() => markSectionReady("structure-table")}
          />
        </>
      )}
    />
  );
}

export function OrganizationDepartmentsPageContent() {
  return (
    <OrganizationPageShell
      title="Departments"
      description="Create and manage departments used across the organization."
      loaderTitle="Loading departments"
      loaderDescription="Syncing teams, roles, and department assignments."
      sectionKeys={["department-table", "department-view"]}
      sections={(markSectionReady) => (
        <>
          <DepartmentTable
            onInitialLoadComplete={() => markSectionReady("department-table")}
          />
          <DepartmentView
            onInitialLoadComplete={() => markSectionReady("department-view")}
          />
        </>
      )}
    />
  );
}

export function OrganizationPositionsPageContent() {
  return (
    <OrganizationPageShell
      title="Positions"
      description="Define roles and link them to departments."
      loaderTitle="Loading positions"
      loaderDescription="Syncing role definitions and assigned employees."
      sectionKeys={["position-table", "position-view"]}
      sections={(markSectionReady) => (
        <>
          <PositionTable
            onInitialLoadComplete={() => markSectionReady("position-table")}
          />
          <PositionView
            onInitialLoadComplete={() => markSectionReady("position-view")}
          />
        </>
      )}
    />
  );
}

export function OrganizationStructurePageContent() {
  return (
    <OrganizationPageShell
      title="Structure"
      description="View reporting lines and supervisor relationships."
      loaderTitle="Loading structure"
      loaderDescription="Syncing reporting lines and supervisor assignments."
      sectionKeys={["supervisor-view", "structure-table"]}
      sections={(markSectionReady) => (
        <>
          <SupervisorView
            onInitialLoadComplete={() => markSectionReady("supervisor-view")}
          />
          <StructureTable
            onInitialLoadComplete={() => markSectionReady("structure-table")}
          />
        </>
      )}
    />
  );
}
