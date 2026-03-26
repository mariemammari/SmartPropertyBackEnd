import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { UserRole } from '../user/schemas/user.schema';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('invoices')
  create(@Body() invoiceData: any, @Request() req) {
    return this.financeService.createInvoice(invoiceData);
  }

  @Get('invoices')
  findAll(@Request() req) {
    const accountantId = req.user?.id || req.user?._id;
    return this.financeService.findAll(accountantId);
  }

  @Get('stats')
  getStats(@Request() req) {
    const accountantId = req.user?.id || req.user?._id;
    return this.financeService.getStats(accountantId);
  }

  @Get('invoices/:id')
  findOne(@Param('id') id: string) {
    return this.financeService.findOne(id);
  }

  @Put('invoices/:id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.financeService.updateInvoice(id, updateData);
  }

  @Delete('invoices/:id')
  remove(@Param('id') id: string) {
    return this.financeService.deleteInvoice(id);
  }
}
