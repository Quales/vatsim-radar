import type { VatsimEvent } from '~/types/data/vatsim';
import { VatsimEventType } from '~/types/data/vatsim';

export type IvaoEventResponse = {
    id: number;
    startDate: string;
    endDate: string;
    title: string;
    imageUrl?: string | null;
    description?: string | null;
    infoUrl?: string | null;
    divisions?: string[];
    airports?: string[];
    eventType?: string | null;
    hqeAward?: boolean;
    routes?: {
        departureIcao?: string | null;
        arrivalIcao?: string | null;
        route?: string | null;
    }[];
};

function stripMarkdownSummary(value: string) {
    return value
        .replace(/\r/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/(\*\*|__|\*|_|`)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isIcaoCode(value: string | null | undefined) {
    return typeof value === 'string' && /^[A-Z0-9]{4}$/.test(value);
}

function makeEventSummary(description: string | null | undefined, title: string) {
    const text = (description ?? '').trim();
    if (!text) return title;

    const firstParagraph = text.split(/\n\s*\n/).find(Boolean) ?? text;
    const summary = stripMarkdownSummary(firstParagraph);
    return summary.length ? summary : title;
}

function mapIvaoEventType(eventType: string | null | undefined, hqeAward?: boolean) {
    switch (eventType?.toLowerCase()) {
        case 'exam':
            return VatsimEventType.Exam;
        case 'hq_event':
            return VatsimEventType.VASOPS;
        case 'rfe':
            return VatsimEventType.RFE;
        case 'pde':
            return VatsimEventType.PDE;
        default:
            return hqeAward ? VatsimEventType.VASOPS : VatsimEventType.Event;
    }
}

export function normalizeIvaoEvent(event: IvaoEventResponse): VatsimEvent | null {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    const airports = Array.from(new Set([
        ...(event.airports ?? []),
        ...(event.routes ?? []).flatMap(route => [route.departureIcao, route.arrivalIcao]),
    ].filter((airport): airport is string => isIcaoCode(airport))));

    const routes = (event.routes ?? []).map(route => ({
        departure: route.departureIcao ?? '',
        arrival: route.arrivalIcao ?? '',
        route: route.route ?? '',
    })).filter(route => isIcaoCode(route.departure) && isIcaoCode(route.arrival));

    return {
        id: event.id,
        type: mapIvaoEventType(event.eventType, event.hqeAward),
        name: event.title,
        link: event.infoUrl ?? 'https://www.ivao.aero',
        organisers: (event.divisions ?? []).map(division => ({
            region: null,
            division,
            subdivision: null,
            organised_by_vatsim: false,
        })),
        airports: airports.map(icao => ({ icao })),
        routes,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        short_description: makeEventSummary(event.description, event.title),
        description: event.description ?? '',
        banner: event.imageUrl ?? '',
    };
}
