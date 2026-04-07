import Link from "next/link";

import { cn } from "@/lib/utils";

export type PremiumSquareCardProps = {
  title: string;
  href?: string;
  imageUrl?: string;
  className?: string;
  statusBadge?: string;
};

export function PremiumSquareCard({
  title,
  href,
  imageUrl,
  className,
  statusBadge,
}: PremiumSquareCardProps) {
  const sharedClassName = cn(
    "group relative aspect-square overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
    className,
  );

  const content = (
    <>
      <div className="absolute inset-0">
        {imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-900/40 via-slate-800/20 to-slate-950/60 dark:from-slate-200/5 dark:via-slate-200/5 dark:to-slate-950/40" />
        )}

        <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px]" />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {statusBadge ? (
        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          {statusBadge}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="text-lg font-semibold leading-tight text-white">
          {title}
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}
