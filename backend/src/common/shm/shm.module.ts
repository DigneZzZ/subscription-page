import { Global, Module } from '@nestjs/common';

import { ShmTariffsService } from './shm-tariffs.service';

@Global()
@Module({
    providers: [ShmTariffsService],
    exports: [ShmTariffsService],
})
export class ShmModule {}
