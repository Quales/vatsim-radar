import { prisma } from '~/utils/server/prisma';
import { handleH3Exception } from '~/utils/server/h3';
import { createDBUser, getDBUserToken } from '~/utils/db/user';
import {vatsimAuthOrRefresh, vatsimGetUser, VatsimUser} from '~/utils/server/vatsim';
import { findUserByCookie } from '~/utils/server/user';
import { discordClient } from '~~/server/plugins/discord';
import { GuildMember, PermissionFlagsBits} from 'discord.js';
import { getDiscordName } from '~/utils/server/discord';
import { getRedirectURL } from '~/utils/server';

export default defineEventHandler(async event => {


    async function giveUserRoles(config: any, user: GuildMember, vatsimUser: VatsimUser) {
        const ratings: Record<string, string | undefined> = {
            AS1: config.DISCORD_ROLE_ATC_AS1,
            AS2: config.DISCORD_ROLE_ATC_AS2,
            AS3: config.DISCORD_ROLE_ATC_AS3,
            ADC: config.DISCORD_ROLE_ATC_ADC,
            APC: config.DISCORD_ROLE_ATC_APC,
            ACC: config.DISCORD_ROLE_ATC_ACC,
            SEC: config.DISCORD_ROLE_ATC_SEC,
            SAI: config.DISCORD_ROLE_ATC_SAI,
            CAI: config.DISCORD_ROLE_ATC_CAI,

            FS1: config.DISCORD_ROLE_PILOT_FS1,
            FS2: config.DISCORD_ROLE_PILOT_FS2,
            FS3: config.DISCORD_ROLE_PILOT_FS3,
            PP: config.DISCORD_ROLE_PILOT_PP,
            SPP: config.DISCORD_ROLE_PILOT_SPP,
            CP: config.DISCORD_ROLE_PILOT_CP,
            ATP: config.DISCORD_ROLE_PILOT_ATP,
            SFI: config.DISCORD_ROLE_PILOT_SFI,
            CFI: config.DISCORD_ROLE_PILOT_CFI,
        };

        if (vatsimUser.rating.isAtc) {
            console.log("atc rating", vatsimUser.rating.atcRating.shortName, ratings[vatsimUser.rating.atcRating.shortName])
            const roleId = ratings[vatsimUser.rating.atcRating.shortName];
            if (roleId) {
                await user.roles.add(roleId);
            } else {
            }
        }

        if (vatsimUser.rating.isPilot) {
            const roleId2 = ratings[vatsimUser.rating.pilotRating.shortName];
            if (roleId2) {
                await user.roles.add(roleId2);
            } else {
            }
        }
    }

    try {
        const config = useRuntimeConfig();
        const query = getQuery(event) as Record<string, string>;

        let redirectUrl = getRedirectURL(event);

        if (typeof query.state === 'string' && query.state.endsWith('-app') && !query.webview) {
            return sendRedirect(event, `ivao-radar:///auth/vatsim?state=${ query.state }&code=${ query.code }`);
        }

        const { id: verifierId, discordId, discordStrategy } = await prisma.auth.findFirstOrThrow({
            select: {
                id: true,
                discordId: true,
                discordStrategy: true,
            },
            where: {
                state: query.state ?? '',
            },
        });

        await prisma.auth.delete({ where: { id: verifierId } });

        const auth = await vatsimAuthOrRefresh(query.code as string, 'auth');

        const vatsimUser = await vatsimGetUser(auth.access_token);

        const expires = new Date(Date.now() + (auth.expires_in * 1000));

        const vatsimUserClient = await prisma.vatsimUser.findFirst({
            select: {
                user: {
                    select: {
                        id: true,
                        discordId: true,
                    },
                },
            },
            where: {
                id: vatsimUser.cid,
            },
        });

        let user = await findUserByCookie(event);

        if (discordId) {
            await prisma.user.updateMany({
                where: {
                    discordId,
                },
                data: {
                    discordId: null,
                    discordStrategy: null,
                },
            });

            const user = await (await discordClient.guilds.fetch(config.DISCORD_INTERNAL_SERVER_ID || config.DISCORD_SERVER_ID)).members.fetch(discordId);
            if (user && discordStrategy) {
                await user.roles.add(config.DISCORD_ROLE_ID);
                await giveUserRoles(config, user, vatsimUser);
                if (!user.permissions.has(PermissionFlagsBits.Administrator)) {
                    await user.setNickname(getDiscordName(discordStrategy, vatsimUser.cid, vatsimUser.personal.name_full), 'Verification process');

                }
                else {
                    console.log(getDiscordName(discordStrategy, vatsimUser.cid, vatsimUser.personal.name_full));
                }
            }
        }

        if (discordId) {
            const url = new URL(redirectUrl);
            url.searchParams.set('discord', '1');
            redirectUrl = url.toString();
        }

        if (vatsimUserClient) {
            await prisma.vatsimUser.update({
                where: {
                    userId: vatsimUserClient.user.id,
                },
                data: {
                    accessToken: auth.access_token,
                    accessTokenExpire: expires,
                    refreshToken: auth.refresh_token,
                    fullName: vatsimUser.personal.name_full,
                },
            });

            if (discordId) {
                await prisma.user.update({
                    where: {
                        id: vatsimUserClient.user.id,
                    },
                    data: {
                        discordId,
                    },
                });
            }

            if (!user) {
                await getDBUserToken(event, vatsimUserClient.user);
            }
            return sendRedirect(event, redirectUrl);
        }

        if (!user) {
            user = await createDBUser({ discordId });
            await getDBUserToken(event, user);
        }

        await prisma.vatsimUser.create({
            data: {
                id: vatsimUser.cid,
                userId: user.id,
                accessToken: auth.access_token,
                accessTokenExpire: expires,
                refreshToken: auth.refresh_token,
                fullName: vatsimUser.personal.name_full,
            },
        });

        return sendRedirect(event, redirectUrl);
    }
    catch (e) {
        return handleH3Exception(event, e);
    }
});
