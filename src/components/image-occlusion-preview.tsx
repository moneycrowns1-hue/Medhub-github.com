import type { SrsImageOcclusion, SrsIoBox } from "@/lib/srs";

function boxesOf(io: SrsImageOcclusion): SrsIoBox[] {
  if (Array.isArray(io.boxes) && io.boxes.length) return io.boxes;
  return [io.box];
}

export function ImageOcclusionPreview({
  io,
  reveal,
}: {
  io: SrsImageOcclusion;
  reveal: boolean;
}) {
  const boxes = boxesOf(io);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-black/30">
      <div className="relative aspect-[16/10] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={io.imageUrl}
          alt="Imagen"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />

        {boxes.map((b, i) => (
          <div
            key={i}
            className={
              reveal
                ? "absolute rounded-md ring-2 ring-emerald-400/70"
                : "absolute rounded-md bg-black/75 backdrop-blur-[1px]"
            }
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
