import Sidebar from "./components/Sidebar";
import "./css/style.scss";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 dashboard-Contents">
        {children}
      </div>
    </div>
  );
}