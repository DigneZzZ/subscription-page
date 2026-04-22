import { Global, Module } from '@nestjs/common';

import { CardLinkService } from './cardlink.service';

@Global()
@Module({
    providers: [CardLinkService],
    exports: [CardLinkService],
})
export class CardLinkModule {}
