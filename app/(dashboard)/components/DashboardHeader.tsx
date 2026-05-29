

interface DashboardTitleProps {
  title: string;
  description?: string;
}

export default function DashboardTitle({title, description} : DashboardTitleProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );
}
