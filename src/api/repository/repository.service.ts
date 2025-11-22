import { ConfigService } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { PrismaClient } from '@prisma/client';

export class Query<T> {
  where?: T;
  sort?: 'asc' | 'desc';
  page?: number;
  offset?: number;
}

export class PrismaRepository extends PrismaClient {
  configService: ConfigService;
  logger: Logger;

  constructor(configService: ConfigService) {
    super();
    this.configService = configService;
    this.logger = new Logger('PrismaRepository');
  }

  public async onModuleInit() {
    await this.$connect();
    const database = this.configService.get('DATABASE');
    this.logger.info(`Repository:Prisma - ON (Provider: ${database.PROVIDER})`);
  }

  public async onModuleDestroy() {
    await this.$disconnect();
    this.logger.warn('Repository:Prisma - OFF');
  }
}
