import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schemas/user.schema';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  /**
   * Creates a manual invoice entry.
   */
  @Post('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  create(@Body() invoiceData: any, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.createInvoice(invoiceData, accountantId);
  }

  /**
   * Lists invoices visible to the authenticated accountant.
   */
  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  findAll(@Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.findAll(accountantId);
  }

  /**
   * Lists invoices for a specific accountant. (No auth for testing)
   */
  @Get('invoices/accountant/:accountantId')
  //@UseGuards(JwtAuthGuard, RolesGuard) // Removed for unauthenticated testing
  //@Roles(UserRole.ACCOUNTANT)
  findByAccountantId(@Param('accountantId') accountantId: string) {
    return this.financeService.findByAccountantId(accountantId);
  }

  /**
   * Returns summary stats for the authenticated accountant finance dashboard.
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  getStats(@Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.getStats(accountantId);
  }

  /**
   * Returns one invoice by id with ownership checks.
   */
  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  findOne(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.findOne(id, accountantId);
  }

  /**
   * Returns signed invoice PDF URL for the authenticated accountant.
   */
  @Get('invoices/:id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  getInvoicePdfUrl(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.getInvoicePdfUrl(id, accountantId);
  }

  /**
   * Updates one invoice by id for the authenticated accountant.
   */
  @Put('invoices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  update(@Param('id') id: string, @Body() updateData: any, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.updateInvoice(id, updateData, accountantId);
  }

  /**
   * Deletes one invoice by id for the authenticated accountant.
   */
  @Delete('invoices/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ACCOUNTANT)
  remove(@Param('id') id: string, @Request() req) {
    const accountantId = req.user.userId;
    return this.financeService.deleteInvoice(id, accountantId);
  }
}
