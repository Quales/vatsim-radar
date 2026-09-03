import { handleH3Error, handleH3Exception } from '~/utils/server/h3';
import type { VatsimEvent } from '~/types/data/vatsim';
import { getVATSIMIdentHeaders } from '~/utils/server';
import { normalizeIvaoEvent, type IvaoEventResponse } from '~/utils/server/vatsim/events';

export default defineEventHandler(async (event): Promise<VatsimEvent | undefined> => {
    const id = getRouterParam(event, 'id');
    if (!id || isNaN(Number(id))) {
        handleH3Error({
            event,
            statusCode: 400,
        });

        return;
    }

    try {
        const ivaoEvent = await $fetch<IvaoEventResponse>(`https://api.ivao.aero/v1/events/${ id }`, {
            headers: getVATSIMIdentHeaders(),
        });
        const eventData = normalizeIvaoEvent(ivaoEvent);
        if (!eventData) {
            handleH3Error({
                event,
                statusCode: 404,
            });
            return;
        }

        return eventData;
    }
    catch (e) {
        handleH3Exception(event, e);
    }
});
