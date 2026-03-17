import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchController {
    constructor(private readonly branchService: BranchService) { }

    @Post()
    async create(@Body() createBranchDto: CreateBranchDto) {
        return this.branchService.create(createBranchDto);
    }

    @Get()
    async findAll() {
        return this.branchService.findAll();
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.branchService.findById(id);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() updateBranchDto: UpdateBranchDto,
    ) {
        return this.branchService.update(id, updateBranchDto);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.branchService.delete(id);
    }
}
