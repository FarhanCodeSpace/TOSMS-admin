"use client";

import { Star } from "lucide-react";

type StarRatingProps = {
  rating: number;
  max?: number;
  size?: number;
  showValue?: boolean;
};

export default function StarRating({
  rating,
  max = 5,
  size = 16,
  showValue = false,
}: StarRatingProps) {
  const clampedRating = Math.max(0, Math.min(max, rating));
  const fullStars = Math.round(clampedRating);

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-1">
        {Array.from({ length: max }).map((_, index) => {
          const filled = index < fullStars;
          return (
            <Star
              key={index}
              size={size}
              className={
                filled ? "fill-amber-400 text-amber-400" : "text-slate-300"
              }
            />
          );
        })}
      </div>
      {showValue ? (
        <span className="text-xs font-semibold text-slate-600">
          {clampedRating.toFixed(1)} / {max}
        </span>
      ) : null}
    </div>
  );
}
