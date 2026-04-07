import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceContractType, InvoiceDocument } from './schemas/invoice.schema';
import { User, UserDocument, UserRole } from '../user/schemas/user.schema';
import { RentalPayment, RentalPaymentDocument, RentalPaymentStatus } from '../rental/schemas/rental-payment.schema';
import { Rental, RentalDocument } from '../rental/schemas/rental.schema';
import { Property, PropertyDocument } from '../property/schemas/property.schema';
import PDFDocument = require('pdfkit');
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RentalPayment.name) private rentalPaymentModel: Model<RentalPaymentDocument>,
    @InjectModel(Rental.name) private rentalModel: Model<RentalDocument>,
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
  ) { }

  /**
   * Creates a generic invoice and assigns the accountant branch to keep branch-level segregation.
   */
  async createInvoice(invoiceData: any, requesterAccountantId?: string): Promise<InvoiceDocument> {
    if (invoiceData?.rentalPaymentId) {
      return this.createInvoiceForSucceededPaymentId(
        String(invoiceData.rentalPaymentId),
        requesterAccountantId,
        invoiceData?.rentalContractId,
        invoiceData?.paymentMethodNote,
      );
    }

    if (!invoiceData?.clientName || !invoiceData?.clientAddress || !Array.isArray(invoiceData?.items)) {
      throw new BadRequestException(
        'Manual invoice creation requires clientName, clientAddress and items array. For payment-based invoice creation, send rentalPaymentId.',
      );
    }

    const accountant = await this.resolveAccountant(requesterAccountantId ?? invoiceData.accountantId);

    const newInvoice = new this.invoiceModel({
      ...invoiceData,
      accountantId: accountant._id,
      branchId: accountant.branchId,
      signatureUrl: invoiceData.signatureUrl ?? accountant.signature,
    });

    const savedInvoice = await newInvoice.save();
    await this.attachInvoicePdf(savedInvoice, accountant);
    return savedInvoice;
  }

  /**
   * Creates a paid invoice directly from a successful rental payment event.
   * This is used by rental payment flows (Stripe success or offline verification).
   */
  async createInvoiceFromRentalPayment(input: {
    accountantId?: string;
    rentalId: string;
    rentalPaymentId?: string;
    rentalBranchId?: string;
    rentalContractId?: string;
    saleContractId?: string;
    amount: number;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    clientName: string;
    clientAddress: string;
    paymentMethod?: string;
    paymentBreakdown?: {
      rentAmount: number;
      agencyFeeAmount: number;
      depositAmount: number;
      coveredMonths?: number;
    };
    paymentMethodNote?: string;
  }): Promise<InvoiceDocument> {
    const accountant = await this.resolveAccountant(input.accountantId, input.rentalBranchId);
    const invoiceNumber = await this.generateInvoiceNumber();

    const breakdown = {
      rentAmount: Number(input.paymentBreakdown?.rentAmount ?? input.amount),
      agencyFeeAmount: Number(input.paymentBreakdown?.agencyFeeAmount ?? 0),
      depositAmount: Number(input.paymentBreakdown?.depositAmount ?? 0),
      coveredMonths: Number(input.paymentBreakdown?.coveredMonths ?? 1),
    };

    const items = this.buildRentalPaymentItems(
      input.billingPeriodStart,
      input.billingPeriodEnd,
      breakdown,
    );

    const computedTotal = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalAmount = Number(input.amount ?? computedTotal);
    const normalizedTotal = totalAmount > 0 ? totalAmount : computedTotal;

    const noteParts = [input.paymentMethodNote];
    if (input.paymentMethod) {
      noteParts.push(`Payment method: ${input.paymentMethod}`);
    }
    const notes = noteParts.filter(Boolean).join(' | ');

    const invoice = new this.invoiceModel({
      invoiceNumber,
      clientName: input.clientName,
      clientAddress: input.clientAddress,
      date: new Date(),
      dueDate: new Date(),
      items,
      subtotal: normalizedTotal,
      htAmount: normalizedTotal,
      vatAmount: 0,
      vatRate: 0,
      total: normalizedTotal,
      paid: normalizedTotal,
      balanceDue: 0,
      status: 'paid',
      signatureUrl: accountant.signature,
      accountantId: accountant._id,
      contractType: InvoiceContractType.RENTAL,
      rentalContractId: input.rentalContractId ? new Types.ObjectId(input.rentalContractId) : undefined,
      saleContractId: input.saleContractId ? new Types.ObjectId(input.saleContractId) : undefined,
      rentalId: new Types.ObjectId(input.rentalId),
      rentalPaymentId: input.rentalPaymentId ? new Types.ObjectId(input.rentalPaymentId) : undefined,
      paymentMethod: input.paymentMethod,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      paymentBreakdown: breakdown,
      branchId: accountant.branchId ?? input.rentalBranchId,
      notes,
    });

    const savedInvoice = await invoice.save();
    await this.attachInvoicePdf(savedInvoice, accountant);
    return savedInvoice;
  }

  /**
   * Creates (or returns existing) invoice from a succeeded rental payment id.
   * This supports accountant "Create missing invoice" actions.
   */
  async createInvoiceForSucceededPaymentId(
    rentalPaymentId: string,
    accountantId?: string,
    rentalContractId?: string,
    paymentMethodNote?: string,
  ): Promise<InvoiceDocument> {
    const payment = await this.rentalPaymentModel.findById(rentalPaymentId).exec();
    if (!payment) {
      throw new NotFoundException('Rental payment not found');
    }

    if (![RentalPaymentStatus.SUCCEEDED, RentalPaymentStatus.VERIFIED].includes(payment.status)) {
      throw new BadRequestException('Invoice can be created only for succeeded payments');
    }

    if (payment.invoiceId) {
      return this.findOne(payment.invoiceId.toString(), accountantId);
    }

    const rental = await this.rentalModel.findById(payment.rentalId).exec();
    if (!rental) {
      throw new NotFoundException('Rental not found for this payment');
    }

    const tenant = await this.userModel.findById(rental.tenantId).exec();
    const property = await this.propertyModel.findById(rental.propertyId).exec();

    const invoice = await this.createInvoiceFromRentalPayment({
      accountantId,
      rentalId: rental._id.toString(),
      rentalPaymentId: payment._id.toString(),
      rentalBranchId: rental.branchId,
      rentalContractId,
      amount: Number(payment.amount ?? 0),
      billingPeriodStart: payment.billingPeriodStart,
      billingPeriodEnd: payment.billingPeriodEnd,
      clientName: tenant?.fullName ?? 'Rental Tenant',
      clientAddress: property?.address ?? 'N/A',
      paymentMethod: payment.paymentMethod,
      paymentBreakdown: {
        rentAmount: Number(payment.rentAmount ?? payment.amount ?? 0),
        agencyFeeAmount: Number(payment.agencyFeeAmount ?? 0),
        depositAmount: Number(payment.depositAmount ?? 0),
        coveredMonths: Number(payment.coveredMonths ?? 1),
      },
      paymentMethodNote,
    });

    payment.invoiceId = new Types.ObjectId(invoice._id.toString());
    await payment.save();

    await this.propertyModel.findByIdAndUpdate(
      rental.propertyId,
      {
        $push: { invoiceIds: invoice._id },
        $set: { latestInvoiceId: invoice._id },
      },
    ).exec();

    return invoice;
  }

  /**
   * Returns all invoices, optionally scoped to one accountant for strict ownership.
   */
  async findAll(accountantId?: string): Promise<InvoiceDocument[]> {
    if (accountantId) {
      // Filtrer directement par accountantId pour une séparation complète
      return this.invoiceModel.find({ accountantId }).populate('accountantId', 'fullName email').exec();
    }
    return this.invoiceModel.find().populate('accountantId', 'fullName email').exec();
  }

  /**
   * Returns one invoice by id and enforces accountant ownership when provided.
   */
  async findOne(id: string, accountantId?: string): Promise<InvoiceDocument> {
    const invoice = await this.invoiceModel.findById(id).populate('accountantId', 'fullName email').exec();
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Si un accountantId est fourni, vérifier que la facture appartient à ce comptable
    if (accountantId && invoice.accountantId.toString() !== accountantId) {
      throw new NotFoundException('Invoice not found or access denied');
    }

    return invoice;
  }

  /**
   * Updates an invoice after validating it exists and belongs to the requesting accountant.
   */
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

  /**
   * Deletes an invoice after validating accountant-level access.
   */
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

  /**
   * Computes finance dashboard aggregates for revenue, paid amount, and pending balance.
   */
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

  /**
   * Generates a readable invoice number in INV-YYYY-XXXXXX format.
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoiceModel.countDocuments({}).exec();
    return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  /**
   * Resolves a valid accountant from explicit user id, then branch-level fallback, then global fallback.
   */
  private async resolveAccountant(accountantId?: string, branchId?: string): Promise<UserDocument> {
    if (accountantId) {
      const accountant = await this.userModel.findById(accountantId).exec();
      if (!accountant) throw new NotFoundException('Accountant not found');
      if (accountant.role !== UserRole.ACCOUNTANT) {
        throw new BadRequestException('Provided user is not an accountant');
      }
      return accountant;
    }

    if (branchId) {
      const branchAccountant = await this.userModel.findOne({
        role: UserRole.ACCOUNTANT,
        branchId,
      }).exec();

      if (branchAccountant) {
        return branchAccountant;
      }
    }

    const fallback = await this.userModel.findOne({ role: UserRole.ACCOUNTANT }).exec();
    if (!fallback) {
      throw new NotFoundException('No accountant user found to generate invoice');
    }

    return fallback;
  }

  /**
   * Creates readable invoice lines from componentized rental payment breakdown.
   */
  private buildRentalPaymentItems(
    periodStart: Date,
    periodEnd: Date,
    breakdown: {
      rentAmount: number;
      agencyFeeAmount: number;
      depositAmount: number;
      coveredMonths: number;
    },
  ): Array<{ description: string; quantity: number; rate: number; amount: number }> {
    const label = `${periodStart.toISOString()} to ${periodEnd.toISOString()}`;
    const items: Array<{ description: string; quantity: number; rate: number; amount: number }> = [];

    if (breakdown.rentAmount > 0) {
      const months = Math.max(1, Number(breakdown.coveredMonths || 1));
      items.push({
        description: `Rent (${label})`,
        quantity: months,
        rate: breakdown.rentAmount / months,
        amount: breakdown.rentAmount,
      });
    }

    if (breakdown.agencyFeeAmount > 0) {
      items.push({
        description: `Agency fee (${label})`,
        quantity: 1,
        rate: breakdown.agencyFeeAmount,
        amount: breakdown.agencyFeeAmount,
      });
    }

    if (breakdown.depositAmount > 0) {
      items.push({
        description: `Security deposit (${label})`,
        quantity: 1,
        rate: breakdown.depositAmount,
        amount: breakdown.depositAmount,
      });
    }

    if (items.length === 0) {
      items.push({
        description: `Rental payment (${label})`,
        quantity: 1,
        rate: 0,
        amount: 0,
      });
    }

    return items;
  }

  private async attachInvoicePdf(invoice: InvoiceDocument, accountant: UserDocument): Promise<void> {
    const pdfBuffer = await this.generateInvoicePdfBuffer(invoice, accountant);
    try {
      const publicId = `smart-property/invoices/${invoice.invoiceNumber}`;
      const uploaded = await this.uploadPdfToCloudinary(pdfBuffer, publicId);

      invoice.pdfUrl = uploaded.url;
      invoice.pdfPublicId = uploaded.publicId;
    } catch {
      // Fallback keeps invoice usable even if Cloudinary raw upload is unavailable.
      invoice.pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      invoice.pdfPublicId = undefined;
    }

    await invoice.save();
  }

  async getInvoicePdfUrl(id: string, accountantId?: string): Promise<{ pdfUrl: string }> {
    const invoice = await this.findOne(id, accountantId);
    if (!invoice.pdfUrl) {
      throw new NotFoundException('Invoice PDF is not available yet');
    }

    return { pdfUrl: invoice.pdfUrl };
  }

  private async generateInvoicePdfBuffer(invoice: InvoiceDocument, accountant: UserDocument): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).text('SmartProperty - Invoice', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Date: ${new Date(invoice.date).toISOString().slice(0, 10)}`);
    doc.text(`Status: ${invoice.status}`);
    doc.moveDown(0.5);

    doc.text(`Client: ${invoice.clientName}`);
    doc.text(`Address: ${invoice.clientAddress}`);
    doc.moveDown(1);

    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.3);
    for (const item of invoice.items ?? []) {
      doc.fontSize(10).text(
        `${item.description} | Qty: ${item.quantity} | Rate: ${item.rate} EUR | Amount: ${item.amount} EUR`,
      );
    }

    doc.moveDown(1);
    doc.fontSize(12).text(`Subtotal: ${invoice.subtotal} EUR`);
    doc.text(`VAT (${invoice.vatRate ?? 0}%): ${invoice.vatAmount ?? 0} EUR`);
    doc.text(`Total: ${invoice.total} EUR`);
    doc.text(`Paid: ${invoice.paid} EUR`);
    doc.text(`Balance Due: ${invoice.balanceDue} EUR`);

    if (invoice.paymentBreakdown) {
      doc.moveDown(0.8);
      doc.fontSize(12).text('Payment Breakdown', { underline: true });
      doc.fontSize(10).text(`Rent: ${invoice.paymentBreakdown.rentAmount} EUR`);
      doc.text(`Agency Fee: ${invoice.paymentBreakdown.agencyFeeAmount} EUR`);
      doc.text(`Deposit: ${invoice.paymentBreakdown.depositAmount} EUR`);
      doc.text(`Covered Months: ${invoice.paymentBreakdown.coveredMonths}`);
    }

    doc.moveDown(1.2);
    doc.fontSize(11).text('Accountant Signature', { underline: true });

    const signatureUrl = invoice.signatureUrl ?? accountant.signature;
    if (signatureUrl) {
      try {
        const signatureBuffer = await this.fetchImageBuffer(signatureUrl);
        doc.image(signatureBuffer, { fit: [180, 90] });
      } catch {
        doc.fontSize(10).text('Signature image unavailable');
      }
    } else {
      doc.fontSize(10).text('No signature configured');
    }

    doc.moveDown(0.5);
    doc.fontSize(10).text(`Signed by: ${accountant.fullName ?? 'Accountant'}`);
    doc.text(`Email: ${accountant.email ?? 'N/A'}`);

    doc.end();
    return done;
  }

  private async fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(response.data);
  }

  private async uploadPdfToCloudinary(buffer: Buffer, publicId: string): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: publicId,
          format: 'pdf',
          overwrite: true,
        },
        (error, result) => {
          if (error || !result?.secure_url || !result?.public_id) {
            reject(error ?? new Error('Failed to upload invoice PDF to Cloudinary'));
            return;
          }

          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );

      stream.end(buffer);
    });
  }
}
