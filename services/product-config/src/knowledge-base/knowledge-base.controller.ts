import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeBaseService } from './knowledge-base.service';

@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  @Get()
  findAll(@Query('productLineCode') productLineCode?: string) {
    return this.service.findAll(productLineCode);
  }

  @Get('search')
  search(
    @Query('query') query: string,
    @Query('productLineCode') productLineCode?: string,
  ) {
    if (!query) throw new BadRequestException('query param is required');
    return this.service.search(query, productLineCode);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.service.getDownloadUrl(id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('productLineCode') productLineCode?: string,
    @Body('description') description?: string,
    @Body('tags') tagsJson?: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    let tags: string[] | undefined;
    if (tagsJson) {
      try {
        tags = JSON.parse(tagsJson);
      } catch {
        tags = undefined;
      }
    }
    return this.service.upload(file.originalname, file.buffer, file.mimetype, {
      productLineCode,
      description,
      tags,
    });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: { description?: string; tags?: string[]; productLineCode?: string },
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/reprocess')
  reprocess(@Param('id') id: string) {
    return this.service.reprocess(id);
  }
}
