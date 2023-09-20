import {Body, Controller, Get, Param, Post, Res, StreamableFile, UploadedFile, UseInterceptors} from "@nestjs/common";
import {FileInterceptor} from "@nestjs/platform-express";
import mime from "mime";

import {DocumentOutputModel, KycCaseManagementApi} from "../../services";

@Controller('document')
export class FileUploadController {

    constructor(private readonly service: KycCaseManagementApi) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@Body() input: {name: string, parentId: string}, @UploadedFile() file: Express.Multer.File): Promise<DocumentOutputModel> {

        return this.service
            .addDocumentToCase(input.parentId, input.name, {content: file.buffer})
            .then(doc => ({id: doc.id, name: doc.name, path: `/document/${doc.path}`}));
    }

    @Get(':id/:name')
    async downloadFile(
        @Param('id') id: string,
        @Param('name') name: string,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile> {
        const document = await this.service.getDocument(id);

        (res as any).set({
            'Content-Type': mime.getType(document.name),
            'Content-Disposition': `attachment; filename="${document.name}"`
        })

        return new StreamableFile(document.content, {type: mime.getType(document.name)});
    }
}
