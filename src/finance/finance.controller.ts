import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schemas/user.schema';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ACCOUNTANT)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  /**
   * Creates a manual invoice entry.
   */
  @Post('invoices')
  create(@Body() invoiceData: any, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.createInvoice(invoiceData, accountantId);
  }

  /**
   * Lists invoices visible to the authenticated accountant.
   */
  @Get('invoices')
  findAll(@Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.findAll(accountantId);
  }

  /**
   * Returns summary stats for the authenticated accountant finance dashboard.
   */
  @Get('stats')
  getStats(@Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.getStats(accountantId);
  }

  /**
   * Returns one invoice by id with ownership checks.
   */
  @Get('invoices/:id')
  findOne(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.findOne(id, accountantId);
  }

  /**
   * Returns signed invoice PDF URL for the authenticated accountant.
   */
  @Get('invoices/:id/pdf')
  getInvoicePdfUrl(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.getInvoicePdfUrl(id, accountantId);
  }

  /**
   * Updates one invoice by id for the authenticated accountant.
   */
  @Put('invoices/:id')
  update(@Param('id') id: string, @Body() updateData: any, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.updateInvoice(id, updateData, accountantId);
  }

  /**
   * Deletes one invoice by id for the authenticated accountant.
   */
  @Delete('invoices/:id')
  remove(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.deleteInvoice(id, accountantId);
  }
}
