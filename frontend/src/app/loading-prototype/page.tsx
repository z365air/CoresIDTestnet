import { StaticCover } from "@/components/static-cover";

export default function LoadingPrototypePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(36,86,255,0.12),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] px-4 py-6 sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-[rgba(120,156,255,0.16)] bg-[rgba(255,255,255,0.72)] shadow-[0_30px_100px_rgba(27,67,255,0.10)] backdrop-blur-xl">
          <div className="relative aspect-[768/590] w-full">
            <StaticCover alt="BasedOne animated artwork" />
          </div>
        </div>
      </section>
    </main>
  );
}
