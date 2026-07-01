import { Module } from '@nestjs/common';

import { HwidDevicesModule } from './hwid-devices/hwid-devices.module';
import { RootModule } from './root/root.module';

@Module({
    imports: [RootModule, HwidDevicesModule],
})
export class SubscriptionPageBackendModule {}
