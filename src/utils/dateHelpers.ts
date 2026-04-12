import { format, addDays, subDays } from "date-fns";

// Returns today as 'YYYY-MM-DD' — MUST match mobile app format
export const getTodayString = (): string => format(new Date(), "yyyy-MM-dd");

// Returns tomorrow as 'YYYY-MM-DD' — used for availability reports
export const getTomorrowString = (): string =>
  format(addDays(new Date(), 1), "yyyy-MM-dd");

// Returns yesterday as 'YYYY-MM-DD'
export const getYesterdayString = (): string =>
  format(subDays(new Date(), 1), "yyyy-MM-dd");

// Returns any date offset from today
export const getDateString = (daysOffset: number): string =>
  format(addDays(new Date(), daysOffset), "yyyy-MM-dd");

// Returns current month as 'YYYY-MM' — MUST match mobile app format
export const getCurrentMonthString = (): string =>
  format(new Date(), "yyyy-MM");

// Returns month string for any Date object
export const getMonthString = (date: Date): string => format(date, "yyyy-MM");

// Converts 'YYYY-MM' to 'March 2026'
export const formatMonthDisplay = (monthString: string): string => {
  const [year, month] = monthString.split("-");
  return format(new Date(parseInt(year), parseInt(month) - 1), "MMMM yyyy");
};

// Converts 'YYYY-MM-DD' to 'Mar 9, 2026'
export const formatDateDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split("-");
  return format(
    new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    "MMM d, yyyy",
  );
};

// Converts 'YYYY-MM-DD' to 'Monday, March 9, 2026'
export const formatDateFull = (dateString: string): string => {
  const [year, month, day] = dateString.split("-");
  return format(
    new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    "EEEE, MMMM d, yyyy",
  );
};

// Availability document ID format — MUST match mobile app exactly
// Mobile app uses: currentUser.uid + '_' + tomorrowDateString
export const getAvailabilityDocId = (
  userId: string,
  dateString: string,
): string => `${userId}_${dateString}`;

// Get array of date strings for a range
export const getDateRange = (startDate: Date, endDate: Date): string[] => {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addDays(current, 1);
  }
  return dates;
};
