import { Module } from '@nestjs/common';

import { TelegramNotifierService } from './telegram-notifier.service';
import { HwidDevicesController } from './hwid-devices.controller';
import { HwidDevicesService } from './hwid-devices.service';

@Module({
    controllers: [HwidDevicesController],
    providers: [HwidDevicesService, TelegramNotifierService],
})
export class HwidDevicesModule {}
