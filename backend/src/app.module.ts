import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { validateEnvConfig } from '@common/utils/validate-env-config';
import { CardLinkModule } from '@common/cardlink/cardlink.module';
import { PlategaModule } from '@common/platega/platega.module';
import { configSchema, Env } from '@common/config/app-config';
import { AxiosModule } from '@common/axios/axios.module';
import { WataModule } from '@common/wata/wata.module';
import { ShmModule } from '@common/shm';

import { SubscriptionPageBackendModule } from '@modules/subscription-page-backend.modules';

@Module({
    imports: [
        AxiosModule,
        WataModule,
        PlategaModule,
        CardLinkModule,
        ShmModule,
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: '.env',
            validate: (config) => validateEnvConfig<Env>(configSchema, config),
        }),

        SubscriptionPageBackendModule,
    ],
})
export class AppModule {}
