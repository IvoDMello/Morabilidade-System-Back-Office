export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#585a4f" }}>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
