import { InstanceDto } from '@api/dto/instance.dto';
import { ProxyDto } from '@api/dto/proxy.dto';
import { SettingsDto } from '@api/dto/settings.dto';
import { PrismaRepository, Query } from '@api/repository/repository.service';
import { eventManager } from '@api/server.module';
import { Events, wa } from '@api/types/wa.types';
import { Auth, ConfigService, HttpServer, Proxy } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { NotFoundException } from '@exceptions';
import { Contact, Message, Prisma } from '@prisma/client';
import { createJid } from '@utils/createJid';
import { WASocket } from 'baileys';
import EventEmitter2 from 'eventemitter2';
import { v4 } from 'uuid';

export class ChannelStartupService {
  constructor(
    public readonly configService: ConfigService,
    public readonly eventEmitter: EventEmitter2,
    public readonly prismaRepository: PrismaRepository,
  ) {}

  public readonly logger = new Logger('ChannelStartupService');

  public client: WASocket;
  public readonly instance: wa.Instance = {};
  public readonly localProxy: wa.LocalProxy = {};
  public readonly localSettings: wa.LocalSettings = {};
  public readonly localWebhook: wa.LocalWebHook = {};

  public setInstance(instance: InstanceDto) {
    this.logger.setInstance(instance.instanceName);

    this.instance.name = instance.instanceName;
    this.instance.id = instance.instanceId;
    this.instance.integration = instance.integration;
    this.instance.number = instance.number;
    this.instance.token = instance.token;
    this.instance.businessId = instance.businessId;
  }

  public set instanceName(name: string) {
    this.logger.setInstance(name);

    if (!name) {
      this.instance.name = v4();
      return;
    }
    this.instance.name = name;
  }

  public get instanceName() {
    return this.instance.name;
  }

  public set instanceId(id: string) {
    if (!id) {
      this.instance.id = v4();
      return;
    }
    this.instance.id = id;
  }

  public get instanceId() {
    return this.instance.id;
  }

  public set integration(integration: string) {
    this.instance.integration = integration;
  }

  public get integration() {
    return this.instance.integration;
  }

  public set number(number: string) {
    this.instance.number = number;
  }

  public get number() {
    return this.instance.number;
  }

  public set token(token: string) {
    this.instance.token = token;
  }

  public get token() {
    return this.instance.token;
  }

  public get wuid() {
    return this.instance.wuid;
  }

  public async loadWebhook() {
    const data = await this.prismaRepository.webhook.findUnique({
      where: {
        instanceId: this.instanceId,
      },
    });

    this.localWebhook.enabled = data?.enabled;
    this.localWebhook.webhookBase64 = data?.webhookBase64;
  }

  public async loadSettings() {
    const data = await this.prismaRepository.setting.findUnique({
      where: {
        instanceId: this.instanceId,
      },
    });

    this.localSettings.rejectCall = data?.rejectCall;
    this.localSettings.msgCall = data?.msgCall;
    this.localSettings.groupsIgnore = data?.groupsIgnore;
    this.localSettings.alwaysOnline = data?.alwaysOnline;
    this.localSettings.readMessages = data?.readMessages;
    this.localSettings.readStatus = data?.readStatus;
    this.localSettings.syncFullHistory = data?.syncFullHistory;
    this.localSettings.wavoipToken = data?.wavoipToken;
  }

  public async setSettings(data: SettingsDto) {
    await this.prismaRepository.setting.upsert({
      where: {
        instanceId: this.instanceId,
      },
      update: {
        rejectCall: data.rejectCall,
        msgCall: data.msgCall,
        groupsIgnore: data.groupsIgnore,
        alwaysOnline: data.alwaysOnline,
        readMessages: data.readMessages,
        readStatus: data.readStatus,
        syncFullHistory: data.syncFullHistory,
        wavoipToken: data.wavoipToken,
      },
      create: {
        rejectCall: data.rejectCall,
        msgCall: data.msgCall,
        groupsIgnore: data.groupsIgnore,
        alwaysOnline: data.alwaysOnline,
        readMessages: data.readMessages,
        readStatus: data.readStatus,
        syncFullHistory: data.syncFullHistory,
        wavoipToken: data.wavoipToken,
        instanceId: this.instanceId,
      },
    });

    this.localSettings.rejectCall = data?.rejectCall;
    this.localSettings.msgCall = data?.msgCall;
    this.localSettings.groupsIgnore = data?.groupsIgnore;
    this.localSettings.alwaysOnline = data?.alwaysOnline;
    this.localSettings.readMessages = data?.readMessages;
    this.localSettings.readStatus = data?.readStatus;
    this.localSettings.syncFullHistory = data?.syncFullHistory;
    this.localSettings.wavoipToken = data?.wavoipToken;

    if (this.localSettings.wavoipToken && this.localSettings.wavoipToken.length > 0) {
      this.client.ws.close();
      this.client.ws.connect();
    }
  }

  public async findSettings() {
    const data = await this.prismaRepository.setting.findUnique({
      where: {
        instanceId: this.instanceId,
      },
    });

    if (!data) {
      return null;
    }

    return {
      rejectCall: data.rejectCall,
      msgCall: data.msgCall,
      groupsIgnore: data.groupsIgnore,
      alwaysOnline: data.alwaysOnline,
      readMessages: data.readMessages,
      readStatus: data.readStatus,
      syncFullHistory: data.syncFullHistory,
      wavoipToken: data.wavoipToken,
    };
  }

  public async loadProxy() {
    this.localProxy.enabled = false;

    const proxyConfig = this.configService.get<Proxy>('PROXY');
    if (proxyConfig.HOST) {
      this.localProxy.enabled = true;
      this.localProxy.host = proxyConfig.HOST;
      this.localProxy.port = proxyConfig.PORT || '80';
      this.localProxy.protocol = proxyConfig.PROTOCOL || 'http';
      this.localProxy.username = proxyConfig.USERNAME;
      this.localProxy.password = proxyConfig.PASSWORD;
    }

    const data = await this.prismaRepository.proxy.findUnique({
      where: {
        instanceId: this.instanceId,
      },
    });

    if (data?.enabled) {
      this.localProxy.enabled = true;
      this.localProxy.host = data?.host;
      this.localProxy.port = data?.port;
      this.localProxy.protocol = data?.protocol;
      this.localProxy.username = data?.username;
      this.localProxy.password = data?.password;
    }
  }

  public async setProxy(data: ProxyDto) {
    await this.prismaRepository.proxy.upsert({
      where: {
        instanceId: this.instanceId,
      },
      update: {
        enabled: data?.enabled,
        host: data.host,
        port: data.port,
        protocol: data.protocol,
        username: data.username,
        password: data.password,
      },
      create: {
        enabled: data?.enabled,
        host: data.host,
        port: data.port,
        protocol: data.protocol,
        username: data.username,
        password: data.password,
        instanceId: this.instanceId,
      },
    });

    Object.assign(this.localProxy, data);
  }

  public async findProxy() {
    const data = await this.prismaRepository.proxy.findUnique({
      where: {
        instanceId: this.instanceId,
      },
    });

    if (!data) {
      throw new NotFoundException('Proxy not found');
    }

    return data;
  }

  public async sendDataWebhook<T extends object = any>(event: Events, data: T, local = true, integration?: string[]) {
    const serverUrl = this.configService.get<HttpServer>('SERVER').URL;
    const tzoffset = new Date().getTimezoneOffset() * 60000; //offset in milliseconds
    const localISOTime = new Date(Date.now() - tzoffset).toISOString();
    const now = localISOTime;

    const expose = this.configService.get<Auth>('AUTHENTICATION').EXPOSE_IN_FETCH_INSTANCES;

    const instanceApikey = this.token || 'Apikey not found';

    await eventManager.emit({
      instanceName: this.instance.name,
      origin: ChannelStartupService.name,
      event,
      data,
      serverUrl,
      dateTime: now,
      sender: this.wuid,
      apiKey: expose && instanceApikey ? instanceApikey : null,
      local,
      integration,
    });
  }

  // Check if the number is MX or AR
  public formatMXOrARNumber(jid: string): string {
    const countryCode = jid.substring(0, 2);

    if (Number(countryCode) === 52 || Number(countryCode) === 54) {
      if (jid.length === 13) {
        const number = countryCode + jid.substring(3);
        return number;
      }

      return jid;
    }
    return jid;
  }

  // Check if the number is br
  public formatBRNumber(jid: string) {
    const regexp = new RegExp(/^(\d{2})(\d{2})\d{1}(\d{8})$/);
    if (regexp.test(jid)) {
      const match = regexp.exec(jid);
      if (match && match[1] === '55') {
        const joker = Number.parseInt(match[3][0]);
        const ddd = Number.parseInt(match[2]);
        if (joker < 7 || ddd < 31) {
          return match[0];
        }
        return match[1] + match[2] + match[3];
      }
      return jid;
    } else {
      return jid;
    }
  }

  public async fetchContacts(query: Query<Contact>) {
    const where: any = {
      instanceId: this.instanceId,
    };

    if (query?.where?.remoteJid) {
      const remoteJid = query.where.remoteJid.includes('@') ? query.where.remoteJid : createJid(query.where.remoteJid);
      where['remoteJid'] = remoteJid;
    }

    if (query?.where?.id) {
      where['id'] = query.where.id;
    }

    if (query?.where?.pushName) {
      where['pushName'] = query.where.pushName;
    }

    const contactFindManyArgs: Prisma.ContactFindManyArgs = {
      where,
    };

    if (query.offset) contactFindManyArgs.take = query.offset;
    if (query.page) {
      const validPage = Math.max(query.page as number, 1);
      contactFindManyArgs.skip = query.offset * (validPage - 1);
    }

    const contacts = await this.prismaRepository.contact.findMany(contactFindManyArgs);

    return contacts.map((contact) => {
      const remoteJid = contact.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const isSaved = !!contact.pushName || !!contact.profilePicUrl;
      const type = isGroup ? 'group' : isSaved ? 'contact' : 'group_member';
      return {
        ...contact,
        isGroup,
        isSaved,
        type,
      };
    });
  }

  public cleanMessageData(message: any) {
    if (!message) return message;
    const cleanedMessage = { ...message };

    if (cleanedMessage.message) {
      const { mediaUrl } = cleanedMessage.message;
      delete cleanedMessage.message.base64;

      // Limpa imageMessage
      if (cleanedMessage.message.imageMessage) {
        cleanedMessage.message.imageMessage = {
          caption: cleanedMessage.message.imageMessage.caption,
        };
      }

      // Limpa videoMessage
      if (cleanedMessage.message.videoMessage) {
        cleanedMessage.message.videoMessage = {
          caption: cleanedMessage.message.videoMessage.caption,
        };
      }

      // Limpa audioMessage
      if (cleanedMessage.message.audioMessage) {
        cleanedMessage.message.audioMessage = {
          seconds: cleanedMessage.message.audioMessage.seconds,
        };
      }

      // Limpa stickerMessage
      if (cleanedMessage.message.stickerMessage) {
        cleanedMessage.message.stickerMessage = {};
      }

      // Limpa documentMessage
      if (cleanedMessage.message.documentMessage) {
        cleanedMessage.message.documentMessage = {
          caption: cleanedMessage.message.documentMessage.caption,
          name: cleanedMessage.message.documentMessage.name,
        };
      }

      // Limpa documentWithCaptionMessage
      if (cleanedMessage.message.documentWithCaptionMessage) {
        cleanedMessage.message.documentWithCaptionMessage = {
          caption: cleanedMessage.message.documentWithCaptionMessage.caption,
          name: cleanedMessage.message.documentWithCaptionMessage.name,
        };
      }

      if (mediaUrl) cleanedMessage.message.mediaUrl = mediaUrl;
    }

    return cleanedMessage;
  }

  public async fetchMessages(query: Query<Message>) {
    const keyFilters = query?.where?.key as {
      id?: string;
      fromMe?: boolean;
      remoteJid?: string;
      participants?: string;
    };

    const timestampFilter = {};
    if (query?.where?.messageTimestamp) {
      if (query.where.messageTimestamp['gte'] && query.where.messageTimestamp['lte']) {
        timestampFilter['messageTimestamp'] = {
          gte: Math.floor(new Date(query.where.messageTimestamp['gte']).getTime() / 1000),
          lte: Math.floor(new Date(query.where.messageTimestamp['lte']).getTime() / 1000),
        };
      }
    }

    // Build remoteJid filter - also try LID if phone number format
    let remoteJidFilter: any = {};
    if (keyFilters?.remoteJid) {
      const remoteJidsToQuery = [keyFilters.remoteJid];
      this.logger.info(`fetchMessages: Looking for messages with remoteJid ${keyFilters.remoteJid}`);
      this.logger.info(
        `fetchMessages: client exists: ${!!this.client}, signalRepo exists: ${!!(this.client as any)?.signalRepository}`,
      );

      // If phone number format, also try to query by LID
      if (keyFilters.remoteJid.includes('@s.whatsapp.net')) {
        this.logger.info(`fetchMessages: Phone number format detected, attempting LID lookup...`);
        try {
          const lid = await this.getLidForPhoneNumber(keyFilters.remoteJid);
          if (lid) {
            remoteJidsToQuery.push(lid);
            this.logger.info(`fetchMessages: Also querying by LID ${lid} for ${keyFilters.remoteJid}`);
          } else {
            this.logger.info(`fetchMessages: No LID found for ${keyFilters.remoteJid}`);
          }
        } catch (error) {
          this.logger.warn(`fetchMessages: LID lookup error: ${error?.message}`);
        }
      }

      // If LID format, also try to query by phone number
      if (keyFilters.remoteJid.includes('@lid')) {
        try {
          const phoneNumber = await this.resolveLidToPhoneNumber(keyFilters.remoteJid);
          if (phoneNumber) {
            remoteJidsToQuery.push(`${phoneNumber}@s.whatsapp.net`);
            this.logger.info(`fetchMessages: Also querying by phone ${phoneNumber} for ${keyFilters.remoteJid}`);
          }
        } catch (error) {
          // Continue with just the original remoteJid
        }
      }

      // Build OR filter for multiple remoteJids
      if (remoteJidsToQuery.length > 1) {
        remoteJidFilter = {
          OR: remoteJidsToQuery.map((jid) => ({ key: { path: ['remoteJid'], equals: jid } })),
        };
      } else {
        remoteJidFilter = { key: { path: ['remoteJid'], equals: keyFilters.remoteJid } };
      }
    }

    const count = await this.prismaRepository.message.count({
      where: {
        instanceId: this.instanceId,
        id: query?.where?.id,
        source: query?.where?.source,
        messageType: query?.where?.messageType,
        ...timestampFilter,
        AND: [
          keyFilters?.id ? { key: { path: ['id'], equals: keyFilters?.id } } : {},
          keyFilters?.fromMe ? { key: { path: ['fromMe'], equals: keyFilters?.fromMe } } : {},
          remoteJidFilter,
          keyFilters?.participants ? { key: { path: ['participants'], equals: keyFilters?.participants } } : {},
        ],
      },
    });

    if (!query?.offset) {
      query.offset = 50;
    }

    if (!query?.page) {
      query.page = 1;
    }

    const messages = await this.prismaRepository.message.findMany({
      where: {
        instanceId: this.instanceId,
        id: query?.where?.id,
        source: query?.where?.source,
        messageType: query?.where?.messageType,
        ...timestampFilter,
        AND: [
          keyFilters?.id ? { key: { path: ['id'], equals: keyFilters?.id } } : {},
          keyFilters?.fromMe ? { key: { path: ['fromMe'], equals: keyFilters?.fromMe } } : {},
          remoteJidFilter,
          keyFilters?.participants ? { key: { path: ['participants'], equals: keyFilters?.participants } } : {},
        ],
      },
      orderBy: {
        messageTimestamp: 'desc',
      },
      skip: query.offset * (query?.page === 1 ? 0 : (query?.page as number) - 1),
      take: query.offset,
      select: {
        id: true,
        key: true,
        pushName: true,
        messageType: true,
        message: true,
        messageTimestamp: true,
        instanceId: true,
        source: true,
        contextInfo: true,
        MessageUpdate: {
          select: {
            status: true,
          },
        },
      },
    });

    return {
      messages: {
        total: count,
        pages: Math.ceil(count / query.offset),
        currentPage: query.page,
        records: messages,
      },
    };
  }

  public async fetchStatusMessage(query: any) {
    if (!query?.offset) {
      query.offset = 50;
    }

    if (!query?.page) {
      query.page = 1;
    }

    return await this.prismaRepository.messageUpdate.findMany({
      where: {
        instanceId: this.instanceId,
        remoteJid: query.where?.remoteJid,
        keyId: query.where?.id,
      },
      skip: query.offset * (query?.page === 1 ? 0 : (query?.page as number) - 1),
      take: query.offset,
    });
  }

  public async findChatByRemoteJid(remoteJid: string) {
    if (!remoteJid) return null;
    return await this.prismaRepository.chat.findFirst({
      where: {
        instanceId: this.instanceId,
        remoteJid: remoteJid,
      },
    });
  }

  /**
   * Resolve LID (Linked ID) to phone number using Baileys internal mapping.
   * WhatsApp multi-device uses LID format internally, this converts to phone number.
   */
  public async resolveLidToPhoneNumber(lid: string): Promise<string | null> {
    try {
      if (!lid?.includes('@lid')) {
        return null; // Not a LID format
      }

      // Use Baileys signal repository to get phone number from LID
      const signalRepo = (this.client as any)?.signalRepository;
      const rawPhoneNumber = await signalRepo?.lidMapping?.getPNForLID(lid);
      if (rawPhoneNumber) {
        // Extract just the phone number part (remove @s.whatsapp.net and device)
        // e.g., "5511947879044:0@s.whatsapp.net" -> "5511947879044"
        const cleanNumber = rawPhoneNumber.split('@')[0].split(':')[0];
        return cleanNumber;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to resolve LID ${lid}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Get LID for a phone number using Baileys internal mapping.
   * This can be used to match contacts (with phone numbers) to chats (with LIDs).
   */
  public async getLidForPhoneNumber(phoneNumber: string): Promise<string | null> {
    try {
      // Ensure proper format
      const pnJid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

      // Use Baileys signal repository to get LID for phone number
      const signalRepo = (this.client as any)?.signalRepository;
      const result = await signalRepo?.lidMapping?.getLIDsForPNs([pnJid]);
      if (result && result.length > 0 && result[0]?.lid) {
        return result[0].lid;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to get LID for phone ${phoneNumber}: ${error?.message}`);
      return null;
    }
  }

  public async fetchChats(query: any) {
    const remoteJid = query?.where?.remoteJid
      ? query?.where?.remoteJid.includes('@')
        ? query.where?.remoteJid
        : createJid(query.where?.remoteJid)
      : null;

    // Query actual chats from the chat table - this contains the correct remoteJid format
    // that matches how messages are stored (especially @lid format for multi-device sync)
    const chats = await this.prismaRepository.chat.findMany({
      where: {
        instanceId: this.instanceId,
        ...(remoteJid ? { remoteJid } : {}),
      },
      take: query?.take || 100,
      skip: query?.skip || 0,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Get all contacts for this instance - these have proper names
    const contacts = await this.prismaRepository.contact.findMany({
      where: {
        instanceId: this.instanceId,
      },
    });

    // Build a lookup map for contacts by remoteJid (phone number format)
    const contactMap = new Map<string, (typeof contacts)[0]>();
    for (const contact of contacts) {
      contactMap.set(contact.remoteJid, contact);
      // Also map by just the phone number (without @s.whatsapp.net)
      const phoneNumber = contact.remoteJid.split('@')[0];
      if (phoneNumber) {
        contactMap.set(phoneNumber, contact);
      }
    }

    // Try to resolve LIDs to phone numbers using Baileys signal repository
    // This allows us to match LID chats to contacts with names
    const lidToPhoneMap = new Map<string, string>();
    const phoneToLidMap = new Map<string, string>();

    // First, try forward lookup: LID -> phone number (parallel for performance)
    const lidChats = chats.filter((c) => c.remoteJid.includes('@lid'));
    const resolutions = await Promise.all(
      lidChats.map(async (chat) => {
        try {
          const phoneNumber = await this.resolveLidToPhoneNumber(chat.remoteJid);
          return { lid: chat.remoteJid, phoneNumber };
        } catch {
          return { lid: chat.remoteJid, phoneNumber: null };
        }
      }),
    );

    // Build maps from parallel results
    for (const { lid, phoneNumber } of resolutions) {
      if (phoneNumber) {
        this.logger.info(`LID forward lookup: ${lid} -> ${phoneNumber}`);
        lidToPhoneMap.set(lid, phoneNumber);
        phoneToLidMap.set(phoneNumber, lid);
      }
    }

    // Log LID resolution stats (reverse lookup disabled for performance - it makes slow network requests)
    const lidChatsCount = chats.filter((c) => c.remoteJid.includes('@lid')).length;
    this.logger.info(`LID resolution: ${lidChatsCount} LID chats, ${lidToPhoneMap.size} mappings from forward lookup`);

    // Filter out status@broadcast (WhatsApp status updates, not a real chat)
    // Also filter any remoteJid starting with "status@" to be safe
    const filteredChats = chats.filter(
      (c) => !c.remoteJid.includes('status@broadcast') && !c.remoteJid.startsWith('status@'),
    );

    // Get the last message for each chat (for UI display)
    // For LID chats, also include the resolved phone JID since sent messages use that format
    const chatRemoteJids = filteredChats.map((c) => c.remoteJid);
    const phoneJidsForLidChats = filteredChats
      .filter((c) => c.remoteJid.includes('@lid') && lidToPhoneMap.has(c.remoteJid))
      .map((c) => `${lidToPhoneMap.get(c.remoteJid)}@s.whatsapp.net`);
    const allJidsToQuery = [...chatRemoteJids, ...phoneJidsForLidChats];

    const lastMessages = await this.prismaRepository.$queryRawUnsafe<
      Array<{ remoteJid: string; messageTimestamp: bigint; message: any }>
    >(
      `
      SELECT DISTINCT ON (key->>'remoteJid')
        key->>'remoteJid' as "remoteJid",
        "messageTimestamp",
        message
      FROM "evo_Message"
      WHERE "instanceId" = $1
        AND key->>'remoteJid' = ANY($2::text[])
      ORDER BY key->>'remoteJid', "messageTimestamp" DESC
    `,
      this.instanceId,
      allJidsToQuery,
    );

    // Build a lookup map for last messages
    // For LID chats, also map the phone JID messages to the LID
    const lastMessageMap = new Map<string, (typeof lastMessages)[0]>();
    for (const msg of lastMessages) {
      lastMessageMap.set(msg.remoteJid, msg);
    }
    // Map phone JID messages to their corresponding LID chats
    for (const [lid, phoneNumber] of lidToPhoneMap.entries()) {
      const phoneJid = `${phoneNumber}@s.whatsapp.net`;
      const phoneMsg = lastMessageMap.get(phoneJid);
      const lidMsg = lastMessageMap.get(lid);
      // Use the more recent message between LID and phone JID
      if (phoneMsg && (!lidMsg || BigInt(phoneMsg.messageTimestamp) > BigInt(lidMsg.messageTimestamp))) {
        lastMessageMap.set(lid, phoneMsg);
      }
    }

    // Build result: chats from Chat table with resolved names
    const results: any[] = [];
    const seenJids = new Set<string>();
    const seenPhoneNumbers = new Set<string>();

    // First add chats that have messages (prioritize these)
    for (const chat of filteredChats) {
      const lastMsg = lastMessageMap.get(chat.remoteJid);
      const isGroup = chat.remoteJid.includes('@g.us');

      // Only include chats that have messages or are groups
      if (!lastMsg && !isGroup) continue;

      // Try to find contact by:
      // 1. Direct remoteJid match
      // 2. Resolved phone number from LID
      let contact = contactMap.get(chat.remoteJid);
      let resolvedPhoneNumber: string | null = null;

      if (!contact && chat.remoteJid.includes('@lid')) {
        resolvedPhoneNumber = lidToPhoneMap.get(chat.remoteJid) || null;
        if (resolvedPhoneNumber) {
          // Try to find contact by resolved phone number
          contact = contactMap.get(resolvedPhoneNumber) || contactMap.get(`${resolvedPhoneNumber}@s.whatsapp.net`);
          if (contact) {
            seenPhoneNumbers.add(resolvedPhoneNumber);
          }
        }
      }

      seenJids.add(chat.remoteJid);
      results.push({
        id: chat.id,
        remoteJid: chat.remoteJid,
        pushName: chat.name || contact?.pushName || null,
        name: chat.name || contact?.pushName || null,
        profilePicUrl: contact?.profilePicUrl || null,
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
        unreadCount: chat.unreadMessages || 0,
        lastMessage: lastMsg
          ? {
              messageTimestamp: lastMsg.messageTimestamp?.toString(),
              message: lastMsg.message,
            }
          : null,
        // Store resolved phone number for reference
        resolvedPhoneNumber: resolvedPhoneNumber,
        isSaved: true,
      });
    }

    // Then add contacts with @s.whatsapp.net that have names and weren't already matched
    for (const contact of contacts) {
      if (seenJids.has(contact.remoteJid)) continue;
      if (contact.remoteJid.includes('@g.us')) continue;
      if (!contact.pushName) continue;

      // Skip if this contact was already matched to a LID chat
      const phoneNumber = contact.remoteJid.split('@')[0];
      if (seenPhoneNumbers.has(phoneNumber)) continue;

      // Check if this contact has messages
      const contactLastMsg = await this.prismaRepository.$queryRawUnsafe<
        Array<{ remoteJid: string; messageTimestamp: bigint; message: any }>
      >(
        `
        SELECT key->>'remoteJid' as "remoteJid", "messageTimestamp", message
        FROM "evo_Message"
        WHERE "instanceId" = $1
          AND key->>'remoteJid' = $2
        ORDER BY "messageTimestamp" DESC
        LIMIT 1
      `,
        this.instanceId,
        contact.remoteJid,
      );

      seenJids.add(contact.remoteJid);
      results.push({
        id: contact.id,
        remoteJid: contact.remoteJid,
        pushName: contact.pushName,
        name: contact.pushName,
        profilePicUrl: contact.profilePicUrl || null,
        updatedAt: contact.updatedAt,
        createdAt: contact.createdAt,
        unreadCount: 0,
        lastMessage:
          contactLastMsg.length > 0
            ? {
                messageTimestamp: contactLastMsg[0].messageTimestamp?.toString(),
                message: contactLastMsg[0].message,
              }
            : null,
        isSaved: true,
      });
    }

    // Sort by lastMessage timestamp (most recent first)
    // Chats without messages go to the bottom, sorted by updatedAt as tiebreaker
    results.sort((a, b) => {
      // Use lastMessage timestamp (in seconds), convert to ms
      const aLastMsgTime = a.lastMessage?.messageTimestamp ? Number(a.lastMessage.messageTimestamp) * 1000 : 0;
      const bLastMsgTime = b.lastMessage?.messageTimestamp ? Number(b.lastMessage.messageTimestamp) * 1000 : 0;

      // If both have no messages, sort by updatedAt as tiebreaker (keeps them grouped at bottom)
      if (aLastMsgTime === 0 && bLastMsgTime === 0) {
        const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bUpdated - aUpdated;
      }

      // Chats without messages go to bottom (use 0 instead of falling back to updatedAt)
      return bLastMsgTime - aLastMsgTime;
    });

    return results;
  }

  public hasValidMediaContent(message: any): boolean {
    if (!message?.message) return false;

    const msg = message.message;

    // Se só tem messageContextInfo, não é mídia válida
    if (Object.keys(msg).length === 1 && Object.prototype.hasOwnProperty.call(msg, 'messageContextInfo')) {
      return false;
    }

    // Verifica se tem pelo menos um tipo de mídia válido
    const mediaTypes = [
      'imageMessage',
      'videoMessage',
      'stickerMessage',
      'documentMessage',
      'documentWithCaptionMessage',
      'ptvMessage',
      'audioMessage',
    ];

    return mediaTypes.some((type) => msg[type] && Object.keys(msg[type]).length > 0);
  }
}
