"use client";

type StarFieldProps = {
  className?: string;
};

/**
 * Cheap full-viewport starfield: 3 layered radial-gradient backgrounds with
 * staggered twinkle animations. Static paint (no per-frame JS), safe for iPad.
 */
export function StarField({ className = "" }: StarFieldProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 animate-[starTwinkleA_7s_ease-in-out_infinite_alternate]"
        style={{
          backgroundImage:
            "radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.9), transparent 60%)," +
            "radial-gradient(1px 1px at 34% 42%, rgba(255,255,255,0.8), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 72% 22%, rgba(255,255,255,0.85), transparent 60%)," +
            "radial-gradient(1px 1px at 88% 60%, rgba(255,255,255,0.7), transparent 60%)," +
            "radial-gradient(1.2px 1.2px at 58% 78%, rgba(255,255,255,0.75), transparent 60%)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="absolute inset-0 animate-[starTwinkleB_9s_ease-in-out_infinite_alternate]"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 22% 66%, rgba(255,255,255,0.65), transparent 60%)," +
            "radial-gradient(1.5px 1.5px at 46% 12%, rgba(255,255,255,0.85), transparent 60%)," +
            "radial-gradient(1px 1px at 80% 88%, rgba(255,255,255,0.7), transparent 60%)," +
            "radial-gradient(1px 1px at 6% 84%, rgba(255,255,255,0.6), transparent 60%)," +
            "radial-gradient(1.2px 1.2px at 64% 48%, rgba(255,255,255,0.8), transparent 60%)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        className="absolute inset-0 animate-[starTwinkleC_11s_ease-in-out_infinite_alternate]"
        style={{
          backgroundImage:
            "radial-gradient(0.8px 0.8px at 18% 34%, rgba(255,255,255,0.6), transparent 60%)," +
            "radial-gradient(0.8px 0.8px at 52% 58%, rgba(255,255,255,0.55), transparent 60%)," +
            "radial-gradient(0.8px 0.8px at 76% 36%, rgba(255,255,255,0.55), transparent 60%)," +
            "radial-gradient(0.8px 0.8px at 30% 82%, rgba(255,255,255,0.5), transparent 60%)," +
            "radial-gradient(0.8px 0.8px at 90% 14%, rgba(255,255,255,0.55), transparent 60%)",
          backgroundRepeat: "no-repeat",
        }}
      />
      <style jsx>{`
        @keyframes starTwinkleA {
          0% { opacity: 0.55; }
          100% { opacity: 1; }
        }
        @keyframes starTwinkleB {
          0% { opacity: 0.8; }
          100% { opacity: 0.4; }
        }
        @keyframes starTwinkleC {
          0% { opacity: 0.35; }
          100% { opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
