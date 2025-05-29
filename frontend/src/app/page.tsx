export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-3xl font-bold mb-2">Welcome to Our App</h1>
        <p className="text-lg text-muted-foreground">
          This is a simple Next.js application.
        </p>
      </div>
    </main>
  );
}
