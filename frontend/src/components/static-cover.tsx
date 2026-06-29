export function StaticCover({ alt }: { alt: string }) {
  return (
    <div className="relative h-full w-full">
      <video
        className="pointer-events-none h-full w-full object-cover select-none"
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/basedone-cover.png"
        aria-label={alt}
      >
        <source src="/basedone.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
