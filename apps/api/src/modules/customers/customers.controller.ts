import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';

@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) { return this.svc.create(dto); }

  @Get()
  list(@Query() q: any) { return this.svc.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.svc.update(id, dto); }
}
