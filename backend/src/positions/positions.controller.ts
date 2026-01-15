import { Controller, Get } from '@nestjs/common';
import { PositionsService } from './positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly svc: PositionsService) {}

  @Get()
  list() {
    return this.svc.findAll();
  }
}
