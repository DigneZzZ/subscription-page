import { Global, Module } from '@nestjs/common';

import { WataService } from './wata.service';

@Global()
@Module({
    providers: [WataService],
    exports: [WataService],
})
export class WataModule {}
