"use client";

import { Input } from "@/components/ui/input";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { ChevronDown } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ContributionsTable } from "@/features/manage-contributions/contributions-table";
import { useContributions } from "@/hooks/use-contributions";
import { useMemo, useState } from "react";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function ContributionsPageContent() {
  const {
    filteredContributions,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    departmentFilter,
    setDepartmentFilter,
    statusFilter,
    setStatusFilter,
    departments,
    refreshContributions,
  } = useContributions();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const sortedContributions = useMemo(
    () =>
      [...filteredContributions].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName, undefined, {
          sensitivity: "base",
        })
      ),
    [filteredContributions]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedContributions.length / itemsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfFirstItem = (safeCurrentPage - 1) * itemsPerPage;
  const indexOfLastItem = indexOfFirstItem + itemsPerPage;
  const paginatedContributions = sortedContributions.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const showingFrom = sortedContributions.length === 0 ? 0 : indexOfFirstItem + 1;
  const showingTo = Math.min(sortedContributions.length, indexOfLastItem);

  const visiblePageNumbers = useMemo(() => {
    const maxPageButtons = 5;
    let startPage = Math.max(
      1,
      safeCurrentPage - Math.floor(maxPageButtons / 2)
    );
    const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index
    );
  }, [safeCurrentPage, totalPages]);

  if (loading && filteredContributions.length === 0 && !error) {
    return (
      <ModuleLoadingState
        title="Contributions"
        description="Loading employee contributions, departments, and filter options."
      />
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-12 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground text-sm">
            Manage contribution amounts, payroll cadence, and auto-apply schedules
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-center">
          <Input
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full"
          />
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | "set" | "not-set");
              setCurrentPage(1);
            }}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All (Set/Not set)</option>
            <option value="set">Set only</option>
            <option value="not-set">Not set only</option>
          </select>
          <div className="text-sm text-muted-foreground">
            Inactive/ended employees are hidden automatically.
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <ContributionsTable
          rows={paginatedContributions}
          loading={loading}
          onRefresh={refreshContributions}
        />

        {sortedContributions.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-border/70 pt-4">
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {showingFrom}-{showingTo} of {sortedContributions.length} employees
              </p>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <label className="flex items-center gap-3">
                  <span className="whitespace-nowrap">Rows per page</span>
                  <span className="relative">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="h-10 min-w-[72px] appearance-none rounded-md border bg-background px-3 pr-9 text-sm text-foreground"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </span>
                </label>

            {totalPages > 1 && (
              <Pagination className="m-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (safeCurrentPage > 1) {
                          setCurrentPage((page) => page - 1);
                        }
                      }}
                      className={
                        safeCurrentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {visiblePageNumbers[0] > 1 && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(1);
                          }}
                          className="cursor-pointer"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {visiblePageNumbers[0] > 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                    </>
                  )}

                  {visiblePageNumbers.map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setCurrentPage(pageNumber);
                        }}
                        isActive={safeCurrentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  {visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages && (
                    <>
                      {visiblePageNumbers[visiblePageNumbers.length - 1] <
                        totalPages - 1 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(totalPages);
                          }}
                          className="cursor-pointer"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (safeCurrentPage < totalPages) {
                          setCurrentPage((page) => page + 1);
                        }
                      }}
                      className={
                        safeCurrentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
