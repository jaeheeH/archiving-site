

interface DashboardTitleProps {
  title: string;
  description?: string;
}

export default function DashboardTitle({title, description} : DashboardTitleProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{title}</h1>
    </div>
  );
}