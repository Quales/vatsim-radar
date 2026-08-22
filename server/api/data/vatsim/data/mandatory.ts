import { radarStorage } from '~/utils/server/storage';
import type { VatsimMandatoryData } from '~/types/data/vatsim';
import { updateVatsimMandatoryDataStorage } from '~/utils/server/vatsim/update';

function createEmptyMandatoryData(): VatsimMandatoryData {
    const now = Date.now();

    return {
        timestamp: new Date(now).toISOString(),
        timestampNum: now,
        serverTime: now,
        pilots: [],
    };
}

export default defineEventHandler(async () => {
    const localMandatoryData = radarStorage.vatsim.mandatoryData;
    const livePilots = radarStorage.vatsim.data?.pilots ?? [];

    if (localMandatoryData && (localMandatoryData.pilots.length > 0 || livePilots.length === 0)) {
        return localMandatoryData;
    }

    if (livePilots.length > 0) {
        updateVatsimMandatoryDataStorage();
        return radarStorage.vatsim.mandatoryData ?? createEmptyMandatoryData();
    }

    return localMandatoryData ?? createEmptyMandatoryData();
});
