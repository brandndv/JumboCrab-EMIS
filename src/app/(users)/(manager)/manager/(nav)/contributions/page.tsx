import ContributionsPageContent from "@/features/manage-contributions/contributions-page-content";
import ContributionsProvider from "@/features/manage-contributions/contributions-provider";

export default function ManagerContributionsPage() {
  return (
    <ContributionsProvider>
      <ContributionsPageContent />
    </ContributionsProvider>
  );
}
