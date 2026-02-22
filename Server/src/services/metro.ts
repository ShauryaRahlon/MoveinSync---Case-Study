import prisma from '../db';

// ─── STOP OPERATIONS ────────────────────────────────────────────

export const createStop = async (name: string) => {
    return prisma.stop.create({
        data: { name },
    });
};

export const getAllStops = async () => {
    return prisma.stop.findMany({
        include: {
            routes: {
                include: { route: { select: { id: true, name: true, color: true } } },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
        orderBy: { name: 'asc' },
    });
};

export const getStopById = async (id: string) => {
    return prisma.stop.findUnique({
        where: { id },
        include: {
            routes: {
                include: { route: { select: { id: true, name: true, color: true } } },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });
};

export const updateStop = async (id: string, name: string) => {
    return prisma.stop.update({
        where: { id },
        data: { name },
    });
};

export const deleteStop = async (id: string) => {
    return prisma.stop.delete({
        where: { id },
    });
};

// ─── ROUTE OPERATIONS ───────────────────────────────────────────

export const createRoute = async (
    name: string,
    color: string,
    stopIds: string[]
) => {
    // Create the route
    const route = await prisma.route.create({
        data: { name, color },
    });

    // Create ordered RouteStop entries
    if (stopIds.length > 0) {
        await prisma.routeStop.createMany({
            data: stopIds.map((stopId, index) => ({
                routeId: route.id,
                stopId,
                sequenceOrder: index + 1,
            })),
        });
    }

    // Return the full route with stops
    return prisma.route.findUnique({
        where: { id: route.id },
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });
};

export const getAllRoutes = async () => {
    return prisma.route.findMany({
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
        orderBy: { name: 'asc' },
    });
};

export const getRouteById = async (id: string) => {
    return prisma.route.findUnique({
        where: { id },
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });
};

export const updateRoute = async (
    id: string,
    name?: string,
    color?: string,
    stopIds?: string[]
) => {
    // Update route name/color if provided
    const updateData: { name?: string; color?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    if (Object.keys(updateData).length > 0) {
        await prisma.route.update({
            where: { id },
            data: updateData,
        });
    }

    // Replace stop ordering if stopIds provided
    if (stopIds !== undefined) {
        // Delete existing RouteStop entries for this route
        await prisma.routeStop.deleteMany({ where: { routeId: id } });

        // Create new ordered entries
        if (stopIds.length > 0) {
            await prisma.routeStop.createMany({
                data: stopIds.map((stopId, index) => ({
                    routeId: id,
                    stopId,
                    sequenceOrder: index + 1,
                })),
            });
        }
    }

    // Return updated route
    return prisma.route.findUnique({
        where: { id },
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });
};

export const deleteRoute = async (id: string) => {
    return prisma.route.delete({
        where: { id },
    });
};

// ─── BULK IMPORT ────────────────────────────────────────────────

interface BulkImportRoute {
    name: string;
    color: string;
    stops: string[]; // stop names
}

interface BulkImportPayload {
    stops: string[];
    routes: BulkImportRoute[];
}

export const bulkImport = async (payload: BulkImportPayload) => {
    // 1. Collect all unique stop names from both arrays
    const allStopNames = new Set<string>(payload.stops);
    for (const route of payload.routes) {
        for (const stopName of route.stops) {
            allStopNames.add(stopName);
        }
    }

    // 2. Upsert all stops by name (sequential, no interactive transaction)
    const stopMap = new Map<string, string>(); // name → id

    for (const name of allStopNames) {
        const stop = await prisma.stop.upsert({
            where: { name },
            create: { name },
            update: {},
        });
        stopMap.set(name, stop.id);
    }

    // 3. Create routes with ordered stops
    const createdRoutes = [];
    for (const routeData of payload.routes) {
        // Check if route already exists
        const existing = await prisma.route.findUnique({
            where: { name: routeData.name },
        });

        let route;
        if (existing) {
            // Update existing route color
            route = await prisma.route.update({
                where: { name: routeData.name },
                data: { color: routeData.color },
            });
            // Clear old stop mappings
            await prisma.routeStop.deleteMany({ where: { routeId: route.id } });
        } else {
            route = await prisma.route.create({
                data: { name: routeData.name, color: routeData.color },
            });
        }

        // Create ordered RouteStop entries
        const routeStopData = routeData.stops.map((stopName, index) => {
            const stopId = stopMap.get(stopName);
            if (!stopId) {
                throw new Error(`Stop "${stopName}" not found during import`);
            }
            return {
                routeId: route.id,
                stopId,
                sequenceOrder: index + 1,
            };
        });

        if (routeStopData.length > 0) {
            await prisma.routeStop.createMany({ data: routeStopData });
        }

        createdRoutes.push(route);
    }

    return {
        stopsCreated: stopMap.size,
        routesCreated: createdRoutes.length,
        stops: Array.from(stopMap.entries()).map(([name, id]) => ({ id, name })),
        routes: createdRoutes,
    };
};
