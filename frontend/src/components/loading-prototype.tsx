import { BasedOneArt } from "@/components/basedone-art";

export function LoadingPrototype() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(36,86,255,0.12),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] px-4 py-6 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-[rgba(120,156,255,0.16)] bg-[rgba(255,255,255,0.72)] shadow-[0_30px_100px_rgba(27,67,255,0.10)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(63,118,255,0.08),transparent_32%)]" />
          <div className="relative aspect-[768/590] w-full">
            <BasedOneArt animated className="h-full w-full" />
          </div>
        </div>
      </section>
    </main>
  );
}
