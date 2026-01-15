import { Module } from '@nestjs/common';
import { IvaoService } from './ivao.service';

@Module({
  providers: [IvaoService],
  exports: [IvaoService],
})
export class IvaoModule {}
