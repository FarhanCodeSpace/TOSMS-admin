"use client";

type AvailabilitySummaryBarProps = {
  available: number;
  notAvailable: number;
  noResponse: number;
};

export default function AvailabilitySummaryBar({
  available,
  notAvailable,
  noResponse,
}: AvailabilitySummaryBarProps) {
  const total = available + notAvailable + noResponse;

  const availablePct = total > 0 ? (available / total) * 100 : 0;
  const notAvailablePct = total > 0 ? (notAvailable / total) * 100 : 0;
  const noResponsePct = total > 0 ? (noResponse / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="flex h-full w-full">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${availablePct}%` }}
            title={`Available: ${available}`}
          />
          <div
            className="h-full bg-rose-500"
            style={{ width: `${notAvailablePct}%` }}
            title={`Not Available: ${notAvailable}`}
          />
          <div
            className="h-full bg-slate-400"
            style={{ width: `${noResponsePct}%` }}
            title={`No Response: ${noResponse}`}
          />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-600">
        {available} Available • {notAvailable} Not Available • {noResponse} No
        Response
      </p>
    </div>
  );
}
