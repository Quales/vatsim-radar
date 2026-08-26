import type {
    VatsimATIS,
    VatsimController,
    VatsimData,
    VatsimPilot,
    VatsimPilotFlightPlan,
} from '~/types/data/vatsim';
import { getFacilityByCallsign } from '~/utils/shared/vatsim';

type IVAOConnection = Record<string, unknown>;

type IVAOSummaryPayload = {
    pilotsSummary?: unknown;
    atcSummary?: unknown;
};

const IVAO_DEFAULT_SERVER = {
    ident: 'IVAO',
    hostname_or_ip: 'ivao.aero',
    location: 'Global',
    name: 'IVAO Network',
    client_connections_allowed: true,
    is_sweatbox: false,
} satisfies VatsimData['servers'][0];

const DEFAULT_FACILITIES: VatsimData['facilities'] = [
    { id: 0, short: 'OBS', long: 'Observer' },
    { id: 1, short: 'FSS', long: 'Flight Service Station' },
    { id: 2, short: 'DEL', long: 'Clearance Delivery' },
    { id: 3, short: 'GND', long: 'Ground' },
    { id: 4, short: 'TWR', long: 'Tower' },
    { id: 5, short: 'APP', long: 'Approach' },
    { id: 6, short: 'CTR', long: 'Center' },
];

const DEFAULT_RATINGS: VatsimData['ratings'] = [
    { id: 0, short: 'OBS', long: 'Observer' },
    { id: 1, short: 'AS0', long: 'Student' },
    { id: 2, short: 'AS1', long: 'ATC Applicant' },
    { id: 3, short: 'AS2', long: 'ATC Trainee' },
    { id: 4, short: 'AS3', long: 'Advanced ATC Trainee' },
    { id: 5, short: 'ADC', long: 'Aerodrome Controller' },
    { id: 6, short: 'APC', long: 'Approach Controller' },
    { id: 7, short: 'ACC', long: 'Centre Controller' },
    { id: 8, short: 'SEC', long: 'Senior Controller' },
    { id: 9, short: 'SAI', long: 'Senior ATC Instructor' },
    { id: 10, short: 'CAI', long: 'Chief ATC Instructor' },
    { id: 11, short: 'ADM', long: 'Administrator' },
];

const DEFAULT_PILOT_RATINGS: VatsimData['pilot_ratings'] = [
    { id: 0, short_name: 'P0', long_name: 'No Pilot Rating' },
    { id: 1, short_name: 'FS', long_name: 'No Pilot Rating' },
    { id: 2, short_name: 'FS1', long_name: 'Basic Flight Student' },
    { id: 3, short_name: 'FS2', long_name: 'Flight Student' },
    { id: 4, short_name: 'FS3', long_name: 'Advanced Flight Student' },
    { id: 5, short_name: 'PP', long_name: 'Private Pilot' },
    { id: 6, short_name: 'SPP', long_name: 'Senior Private Pilot' },
    { id: 7, short_name: 'CP', long_name: 'Commercial Private Pilot' },
    { id: 8, short_name: 'ATP', long_name: 'Airline Transport Pilot' },
    { id: 9, short_name: 'SFI', long_name: 'Senior Flight Instructor' },
    { id: 10, short_name: 'CFI', long_name: 'Chief Flight Instructor' },
];

const DEFAULT_MILITARY_RATINGS: VatsimData['military_ratings'] = [
    { id: 0, short_name: 'M0', long_name: 'No Military Rating' },
    { id: 1, short_name: 'M1', long_name: 'Military 1' },
    { id: 2, short_name: 'M2', long_name: 'Military 2' },
    { id: 3, short_name: 'M3', long_name: 'Military 3' },
];

function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function readRecord(value: unknown): IVAOConnection {
    return (value && typeof value === 'object') ? value as IVAOConnection : {};
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function formatFrequency(value: unknown): string {
    const numeric = readNumber(value);
    if (numeric === undefined) return '122.800';
    return numeric.toFixed(3);
}

function formatTransponder(value: unknown): string {
    const numeric = readNumber(value);
    if (numeric === undefined) return '2000';
    return Math.round(numeric).toString().padStart(4, '0').slice(-4);
}

function readTimestamp(...values: unknown[]) {
    for (const value of values) {
        const date = new Date(String(value ?? ''));
        if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    return new Date().toISOString();
}

function inferPilotName(entry: IVAOConnection) {
    const directName = readString(entry.name);
    if (directName) return directName;

    const atcPosition = readRecord(entry.atcPosition);
    const atcCallsign = readString(atcPosition.atcCallsign);
    if (atcCallsign) return atcCallsign;

    const user = readRecord(entry.user);
    const firstName = readString(user.firstName);
    const lastName = readString(user.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (fullName.length) return fullName;

    return readString(entry.callsign) ?? 'Unknown';
}

function mapFlightPlan(flightPlanUnknown: unknown): VatsimPilotFlightPlan | undefined {
    const flightPlan = readRecord(flightPlanUnknown);
    if (!Object.keys(flightPlan).length) return;

    const aircraft = readRecord(flightPlan.aircraft);
    const departure = readRecord(flightPlan.departure);
    const arrival = readRecord(flightPlan.arrival);
    const alternative = readRecord(flightPlan.alternative);

    const aircraftShort = readString(flightPlan.aircraftId) ?? readString(aircraft.icaoCode);
    const aircraftFaa = aircraftShort ? `H/${ aircraftShort }/L` : undefined;

    const rules = readString(flightPlan.flightRules)?.[0];

    return {
        flight_rules: rules as VatsimPilotFlightPlan['flight_rules'],
        aircraft: readString(flightPlan.aircraftName) ?? aircraftShort,
        aircraft_faa: aircraftFaa,
        aircraft_short: aircraftShort,
        departure: readString(flightPlan.departureId) ?? readString(departure.icao),
        arrival: readString(flightPlan.arrivalId) ?? readString(arrival.icao),
        alternate: readString(alternative.icao),
        route: readString(flightPlan.route),
        remarks: readString(flightPlan.remarks),
        altitude: readString(flightPlan.cruiseAltitude),
        cruise_tas: readString(flightPlan.cruiseSpeed),
    };
}

function mapPilot(entry: IVAOConnection): VatsimPilot {
    const track = readRecord(entry.lastTrack);
    const flightPlan = mapFlightPlan(entry.flightPlan);
    const timestamp = readTimestamp(track.timestamp, entry.updatedAt, entry.createdAt);

    return {
        cid: readNumber(entry.userId) ?? readNumber(entry.vid) ?? readNumber(entry.id) ?? 0,
        name: inferPilotName(entry),
        callsign: readString(entry.callsign) ?? '',
        server: readString(entry.serverId) ?? 'IVAO',
        pilot_rating: readNumber(entry.pilotRating) ?? readNumber(entry.rating) ?? 0,
        military_rating: entry.isMilitary === true ? 1 : 0,
        latitude: readNumber(track.latitude) ?? 0,
        longitude: readNumber(track.longitude) ?? 0,
        altitude: readNumber(track.altitude) ?? 0,
        groundspeed: readNumber(track.groundSpeed) ?? 0,
        transponder: formatTransponder(track.transponder),
        heading: readNumber(track.heading) ?? 0,
        qnh_i_hg: readNumber(track.qnhInHg) ?? 29.92,
        qnh_mb: readNumber(track.qnhMb) ?? 1013,
        flight_plan: flightPlan,
        logon_time: readTimestamp(entry.createdAt, timestamp),
        last_updated: timestamp,
        frequencies: [],
        sim: readString(entry.simulator),
        vertical_speed: readNumber(track.altitudeDifference),
    };
}

function readAtisLines(entry: IVAOConnection): string[] {
    const atis = readRecord(entry.atis);
    const lines = readArray(atis.lines);
    if (lines.length) return lines.map(x => String(x)).filter(Boolean);

    return readArray(entry.atis).map(x => String(x)).filter(Boolean);
}

function mapController(entry: IVAOConnection): VatsimController {
    const timestamp = readTimestamp(entry.updatedAt, entry.createdAt);
    const atcSession = readRecord(entry.atcSession);
    const atcPosition = readRecord(entry.atcPosition);

    const callsign = readString(entry.callsign) ??
        readString(atcPosition.composePosition) ??
        '';

    const name = inferPilotName(entry);

    const frequency = formatFrequency(
        atcSession.frequency ??
        entry.frequency ??
        entry.comFrequency,
    );

    return {
        cid: readNumber(entry.userId) ?? readNumber(entry.vid) ?? readNumber(entry.id) ?? 0,
        name,
        callsign,
        frequency,
        facility: readNumber(entry.facility) ?? getFacilityByCallsign(callsign),
        rating: readNumber(entry.rating) ?? 0,
        server: readString(entry.serverId) ?? 'IVAO',
        visual_range: readNumber(entry.visualRange) ?? 200,
        text_atis: readAtisLines(entry),
        last_updated: timestamp,
        logon_time: readTimestamp(entry.createdAt, timestamp),
    };
}

function mapATIS(entry: IVAOConnection): VatsimATIS {
    const atis = mapController(entry);

    return {
        ...atis,
        isATIS: true,
        atis_code: readString(entry.atisCode),
    };
}

function toConnectionArray(value: unknown): IVAOConnection[] {
    return Array.isArray(value) ? value.map(readRecord) : [];
}

function getConnectionLookupValue(entry: IVAOConnection, key: 'id' | 'userId' | 'callsign'): string | undefined {
    if (key === 'callsign') {
        const callsign = readString(entry.callsign);
        return callsign ? callsign.toUpperCase() : undefined;
    }

    const numeric = readNumber(entry[key]);
    return numeric !== undefined ? String(numeric) : undefined;
}

function buildConnectionLookup(entries: IVAOConnection[]) {
    const byId = new Map<string, IVAOConnection>();
    const byUserId = new Map<string, IVAOConnection>();
    const byCallsign = new Map<string, IVAOConnection>();

    for (const entry of entries) {
        const id = getConnectionLookupValue(entry, 'id');
        const userId = getConnectionLookupValue(entry, 'userId');
        const callsign = getConnectionLookupValue(entry, 'callsign');

        if (id) byId.set(id, entry);
        if (userId) byUserId.set(userId, entry);
        if (callsign) byCallsign.set(callsign, entry);
    }

    return { byId, byUserId, byCallsign };
}

function enrichFromWhazzup(entry: IVAOConnection, whazzupLookup: ReturnType<typeof buildConnectionLookup>): IVAOConnection {
    const id = getConnectionLookupValue(entry, 'id');
    const userId = getConnectionLookupValue(entry, 'userId');
    const callsign = getConnectionLookupValue(entry, 'callsign');

    const match = (id && whazzupLookup.byId.get(id)) ||
        (userId && whazzupLookup.byUserId.get(userId)) ||
        (callsign && whazzupLookup.byCallsign.get(callsign));

    if (!match) return entry;

    return {
        ...match,
        ...entry,
    };
}

export function convertIvaoDataToVatsimData(payload: unknown, summaries?: IVAOSummaryPayload): VatsimData {
    const body = readRecord(payload);
    const clients = readRecord(body.clients);

    const whazzupPilots = toConnectionArray(clients.pilots);
    const whazzupAtcs = toConnectionArray(clients.atcs);
    const whazzupObservers = toConnectionArray(clients.observers);

    const summaryPilots = toConnectionArray(summaries?.pilotsSummary);
    const summaryAtcs = toConnectionArray(summaries?.atcSummary);

    const whazzupPilotsLookup = buildConnectionLookup(whazzupPilots);
    const whazzupAtcsLookup = buildConnectionLookup(whazzupAtcs);

    const rawPilots = summaryPilots.length
        ? summaryPilots.map(entry => enrichFromWhazzup(entry, whazzupPilotsLookup))
        : whazzupPilots;
    const rawAtcs = summaryAtcs.length
        ? summaryAtcs.map(entry => enrichFromWhazzup(entry, whazzupAtcsLookup))
        : whazzupAtcs;
    const rawObservers = whazzupObservers;

    const pilots: VatsimData['pilots'] = [];
    const controllers: VatsimData['controllers'] = [];
    const atis: VatsimData['atis'] = [];
    const observers: VatsimData['observers'] = [];

    for (const entry of rawPilots) {
        if (!readString(entry.callsign)) continue;
        pilots.push(mapPilot(entry));
    }

    for (const entry of rawAtcs) {
        const callsign = readString(entry.callsign) ?? '';
        if (!callsign) continue;

        if (callsign.toUpperCase().endsWith('_ATIS')) {
            atis.push(mapATIS(entry));
        }
        else {
            controllers.push(mapController(entry));
        }
    }

    for (const entry of rawObservers) {
        if (!readString(entry.callsign)) continue;
        observers.push(mapController(entry));
    }

    const uniqueUsers = new Set<number>();
    for (const entry of [...rawPilots, ...rawAtcs, ...rawObservers]) {
        const userId = readNumber(entry.userId) ?? readNumber(entry.vid);
        if (userId !== undefined) uniqueUsers.add(userId);
    }

    const connections = readRecord(body.connections);
    const connectedClients = readNumber(connections.total) ??
        pilots.length + controllers.length + atis.length + observers.length;

    const updateTimestamp = readTimestamp(body.updatedAt);

    return {
        general: {
            update_timestamp: updateTimestamp,
            connected_clients: connectedClients,
            unique_users: uniqueUsers.size,
            sups: [],
            adm: [],
            onlineWSUsers: 0,
        },
        pilots,
        controllers,
        observers,
        atis,
        servers: [IVAO_DEFAULT_SERVER],
        prefiles: [],
        facilities: DEFAULT_FACILITIES,
        ratings: DEFAULT_RATINGS,
        pilot_ratings: DEFAULT_PILOT_RATINGS,
        military_ratings: DEFAULT_MILITARY_RATINGS,
    };
}
