import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { CardLinkModule } from '@common/cardlink/cardlink.module';
import { PlategaModule } from '@common/platega/platega.module';
import { AxiosModule } from '@common/axios/axios.module';
import { WataModule } from '@common/wata/wata.module';

import { SubscriptionPageBackendModule } from '@modules/subscription-page-backend.modules';

@Module({
    imports: [
        AxiosModule,
        WataModule,
        PlategaModule,
        CardLinkModule,
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
