import ViolationsPageContent from "@/components/dasboard/manage-violations/violations-page-content";
import ViolationsProvider from "@/components/dasboard/manage-violations/violations-provider";

const ViolationsPage = () => {
  return (
    <ViolationsProvider>
      <ViolationsPageContent />
    </ViolationsProvider>
  );
};

export default ViolationsPage;
