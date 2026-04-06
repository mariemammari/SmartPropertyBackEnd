import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Request, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RentalContractService } from './rental-contract.service';
import { RentalDocumentService } from './rental-document.service';
import { CreateRentalContractDto, SignRentalContractDto } from './dto/create-rental-contract.dto';
import { CreateRentalDocumentDto, UpdateRentalDocumentDto } from './dto/create-rental-document.dto';

@ApiTags('Rental Documents & Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental-documents')
export class RentalDocumentController {
    constructor(
        private readonly contractService: RentalContractService,
        private readonly documentService: RentalDocumentService,
    ) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTRACTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Upload/create a new contract version
     * POST /rental-documents/contracts
     * Roles: ACCOUNTANT, REAL_ESTATE_AGENT, SUPER_ADMIN
     * User ID and role are extracted from JWT token via @JwtAuthGuard
     */
    @Post('contracts')
    async createContract(@Body() dto: CreateRentalContractDto, @Request() req: any) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (!userId) {
            throw new BadRequestException('User must be authenticated');
        }

        return this.contractService.create(dto, userId, userRole);
    }

    /**
     * Get all contract versions for a rental
     * GET /rental-documents/contracts?rentalId=...
     */
    @Get('contracts')
    async getContractsByRental(@Query('rentalId') rentalId: string) {
        if (!rentalId) {
            throw new BadRequestException('rentalId query param required');
        }

        return this.contractService.findByRentalId(rentalId);
    }

    /**
     * Get latest contract version for rental
     * GET /rental-documents/contracts/rental/:rentalId/latest
     */
    @Get('contracts/rental/:rentalId/latest')
    async getLatestContract(@Param('rentalId') rentalId: string) {
        return this.contractService.findLatestByRentalId(rentalId);
    }

    /**
     * Get specific contract by ID
     * GET /rental-documents/contracts/:contractId
     */
    @Get('contracts/:contractId')
    async getContract(@Param('contractId') contractId: string) {
        return this.contractService.findById(contractId);
    }

    /**
     * Download contract PDF
     * GET /rental-documents/contracts/:contractId/download
     * Frontend will use returned URL with window.location.href
     */
    @Get('contracts/:contractId/download')
    async downloadContract(@Param('contractId') contractId: string) {
        return this.contractService.getDownloadUrl(contractId);
    }

    /**
     * Sign contract as authenticated user
     * PATCH /rental-documents/contracts/:contractId/sign
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Patch('contracts/:contractId/sign')
    async signContract(
        @Param('contractId') contractId: string,
        @Body() dto: SignRentalContractDto,
        @Request() req: any,
    ) {
        const userId = req.user.userId;

        return this.contractService.signContract(contractId, userId, dto);
    }

    /**
     * Archive contract
     * PATCH /rental-documents/contracts/:contractId/archive
     */
    @Patch('contracts/:contractId/archive')
    async archiveContract(@Param('contractId') contractId: string) {
        return this.contractService.archive(contractId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DOCUMENTS (Inventory, Inspection, Invoices, etc.)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Upload a rental document
     * POST /rental-documents
     * Roles: ACCOUNTANT, REAL_ESTATE_AGENT, SUPER_ADMIN (anyone with rental access)
     * Body: CreateRentalDocumentDto
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Post()
    async createDocument(@Body() dto: CreateRentalDocumentDto, @Request() req: any) {
        const userId = req.user.userId;
        return this.documentService.create(dto, userId);
    }

    /**
     * Get all documents for a rental
     * GET /rental-documents?rentalId=...&documentType=contract
     * Query params: rentalId (required), documentType (optional)
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Get()
    async getDocumentsByRental(
        @Query('rentalId') rentalId: string,
        @Query('documentType') documentType?: string,
        @Request() req?: any,
    ) {
        if (!rentalId) {
            throw new BadRequestException('rentalId query param required');
        }

        const userId = req.user.userId;

        return this.documentService.findByRentalId(rentalId, userId, documentType);
    }

    /**
     * Get specific document by ID
     * GET /rental-documents/:documentId
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Get(':documentId')
    async getDocument(@Param('documentId') documentId: string, @Request() req: any) {
        const userId = req.user.userId;

        return this.documentService.findById(documentId, userId);
    }

    /**
     * Download document
     * GET /rental-documents/:documentId/download
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Get(':documentId/download')
    async downloadDocument(@Param('documentId') documentId: string, @Request() req: any) {
        const userId = req.user.userId;

        return this.documentService.getDownloadUrl(documentId, userId);
    }

    /**
     * Update document metadata (title, visibility, etc.)
     * PATCH /rental-documents/:documentId
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Patch(':documentId')
    async updateDocument(
        @Param('documentId') documentId: string,
        @Body() dto: UpdateRentalDocumentDto,
        @Request() req: any,
    ) {
        const userId = req.user.userId;

        return this.documentService.update(documentId, dto, userId);
    }

    /**
     * Delete document (soft delete)
     * DELETE /rental-documents/:documentId
     * User ID is extracted from JWT token via @JwtAuthGuard
     */
    @Delete(':documentId')
    async deleteDocument(@Param('documentId') documentId: string, @Request() req: any) {
        const userId = req.user.userId;

        return this.documentService.delete(documentId, userId);
    }
}
