import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { User, UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createInvoice(invoiceData: any): Promise<InvoiceDocument> {
    // Récupérer le branchId du comptable
    const accountant = await this.userModel.findById(invoiceData.accountantId);
    if (!accountant) throw new NotFoundException('Accountant not found');
    
    const newInvoice = new this.invoiceModel({
      ...invoiceData,
      branchId: accountant.branchId
    });
    return newInvoice.save();
  }

  async findAll(accountantId?: string): Promise<InvoiceDocument[]> {
    if (accountantId) {
      // Récupérer le branchId du comptable
      const accountant = await this.userModel.findById(accountantId);
      if (!accountant) throw new NotFoundException('Accountant not found');
      
      // Filtrer par branchId du comptable
      return this.invoiceModel.find({ branchId: accountant.branchId }).populate('accountantId', 'fullName email').exec();
    }
    return this.invoiceModel.find().populate('accountantId', 'fullName email').exec();
  }

  async findOne(id: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).populate('accountantId', 'fullName email').exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateInvoice(id: string, updateData: any): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const result = await this.invoiceModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Invoice not found');
  }

  async getStats(accountantId?: string) {
    let invoices;
    if (accountantId) {
      // Récupérer le branchId du comptable
      const accountant = await this.userModel.findById(accountantId);
      if (!accountant) throw new NotFoundException('Accountant not found');
      
      // Filtrer par branchId du comptable
      invoices = await this.invoiceModel.find({ branchId: accountant.branchId }).exec();
    } else {
      invoices = await this.invoiceModel.find().exec();
    }
    
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid, 0);
    const totalPending = totalRevenue - totalPaid;
    
    return {
      totalRevenue,
      totalPaid,
      totalPending,
      invoiceCount: invoices.length,
    };
  }
}
