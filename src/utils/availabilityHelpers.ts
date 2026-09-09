export function buildAvailabilityMap<T extends { routeId?: string; userId: string; role: string; date?: string }>(
  records: T[],
  useDateKey: boolean = false
): Map<string, T> {
  const map = new Map<string, T>();
  
  records.forEach((record) => {
    const prefix = (useDateKey && record.date) ? `${record.date}_` : '';
    // Primary key: user_route_role
    if (record.routeId) {
      map.set(`${prefix}${record.userId}_${record.routeId}_${record.role}`, record);
    }
    // Fallback key: user_role
    map.set(`${prefix}${record.userId}_${record.role}`, record);
  });
  
  return map;
}

export function getStudentAvailabilityStats(
  studentIds: string[],
  routeId: string,
  availabilityMap: Map<string, { isAvailable?: boolean }>,
  datePrefix?: string
) {
  let availableCount = 0;
  let notAvailableCount = 0;
  let noResponseCount = 0;

  const prefix = datePrefix ? `${datePrefix}_` : '';

  studentIds.forEach((studentId) => {
    const record =
      availabilityMap.get(`${prefix}${studentId}_${routeId}_student`) ||
      availabilityMap.get(`${prefix}${studentId}_student`);

    if (record?.isAvailable === true) {
      availableCount++;
    } else if (record?.isAvailable === false) {
      notAvailableCount++;
    } else {
      noResponseCount++;
    }
  });

  return {
    availableCount,
    notAvailableCount,
    noResponseCount,
    respondedCount: availableCount + notAvailableCount,
    totalStudents: studentIds.length,
  };
}
