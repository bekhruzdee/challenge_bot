import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          new KeyvRedis(
            `redis://${config.get<string>('REDIS_HOST', 'localhost')}:${config.get<number>('REDIS_PORT', 6379)}`,
          ),
        ],
        ttl: 300_000,
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
