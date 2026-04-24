export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#585a4f" }}>
      {children}
    </div>
  );
}
