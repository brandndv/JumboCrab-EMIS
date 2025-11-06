import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function EmployeePage({ params }: PageProps) {
  const { id } = params;
  
  if (!id) {
    notFound();
  }
  
  // Redirect to the view page
  redirect(`/admin/employees/${id}/view`);
}
