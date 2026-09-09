import type { Route } from "@/types";

export function getRouteAssignedDriverIds(route: Pick<Route, "assignedDriverId" | "assignedDriverIds">): string[] {
  const driverIds = new Set<string>();

  if (route.assignedDriverId && typeof route.assignedDriverId === "string") {
    driverIds.add(route.assignedDriverId);
  }

  if (Array.isArray(route.assignedDriverIds)) {
    route.assignedDriverIds.forEach((id) => {
      if (typeof id === "string" && id.length > 0) {
        driverIds.add(id);
      }
    });
  }

  return Array.from(driverIds);
}

export function getRoutePrimaryDriverId(route: Pick<Route, "assignedDriverId" | "assignedDriverIds">): string {
  return getRouteAssignedDriverIds(route)[0] || "";
}