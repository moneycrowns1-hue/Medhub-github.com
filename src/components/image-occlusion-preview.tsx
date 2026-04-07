import type { SrsImageOcclusion } from "@/lib/srs";

export function ImageOcclusionPreview({
  io,
  reveal,
}: {
  io: SrsImageOcclusion;
  reveal: boolean;
}) {
  const { x, y, w, h } = io.box;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-black/30">
      <div className="relative aspect-[16/10] w-full">
        <img
          src={io.imageUrl}
          alt="Imagen"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />

        {!reveal ? (
          <div
            className="absolute rounded-md bg-black/75 backdrop-blur-[1px]"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
          />
        ) : (
          <div
            className="absolute rounded-md ring-2 ring-emerald-400/70"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
          />
        )}
      </div>
    </div>
  );
}
