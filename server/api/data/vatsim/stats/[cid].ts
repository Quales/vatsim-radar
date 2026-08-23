import type { VatsimMemberStats } from '~/types/data/vatsim';
import { handleH3Error } from '~/utils/server/h3';
import { getVATSIMIdentHeaders } from '~/utils/server';

export default defineEventHandler(async (event): Promise<VatsimMemberStats | undefined> => {
    const cid = getRouterParam(event, 'cid');
    if (!cid) {
        handleH3Error({
            event,
            statusCode: 400,
            data: 'Invalid CID',
        });
        return;
    }

    return await $fetch<VatsimMemberStats>(`https://api.ivao.aero/v2/users/${ cid }?apiKey=${ process.env.IVAO_API_KEY }`, {
        headers: getVATSIMIdentHeaders(),
    }).catch(() => {
        handleH3Error({
            event,
            statusCode: 404,
        });
        return undefined;
    });
});
