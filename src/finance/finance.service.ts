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
      // Filtrer directement par accountantId pour une séparation complète
      return this.invoiceModel.find({ accountantId }).populate('accountantId', 'fullName email').exec();
    }
    return this.invoiceModel.find().populate('accountantId', 'fullName email').exec();
  }

  async findOne(id: string, accountantId?: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).populate('accountantId', 'fullName email').exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    
    // Si un accountantId est fourni, vérifier que la facture appartient à ce comptable
    if (accountantId && invoice.accountantId.toString() !== accountantId) {
      throw new NotFoundException('Invoice not found or access denied');
    }
    
    return invoice;
  }

  async updateInvoice(id: string, updateData: any, accountantId?: string): Promise<InvoiceDocument> {
    // D'abord vérifier que la facture existe et appartient au comptable
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    
    if (accountantId && invoice.accountantId.toString() !== accountantId) {
      throw new NotFoundException('Invoice not found or access denied');
    }
    
    const updatedInvoice = await this.invoiceModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedInvoice) throw new NotFoundException('Invoice not found');
    return updatedInvoice;
  }

  async deleteInvoice(id: string, accountantId?: string): Promise<void> {
    // D'abord vérifier que la facture existe et appartient au comptable
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    
    if (accountantId && invoice.accountantId.toString() !== accountantId) {
      throw new NotFoundException('Invoice not found or access denied');
    }
    
    const result = await this.invoiceModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Invoice not found');
  }

  async getStats(accountantId?: string) {
    let invoices;
    if (accountantId) {
      // Filtrer directement par accountantId pour une séparation complète
      invoices = await this.invoiceModel.find({ accountantId }).exec();
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
