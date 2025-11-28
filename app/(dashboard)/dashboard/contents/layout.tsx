

export default function ContentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 dashboard-Contents">
        {children}
      </div>
    </div>
  );
}