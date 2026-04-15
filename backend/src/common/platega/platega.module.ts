import { Global, Module } from '@nestjs/common';

import { PlategaService } from './platega.service';

@Global()
@Module({
    providers: [PlategaService],
    exports: [PlategaService],
})
export class PlategaModule {}
