import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddPayerAliasDto } from './dto/add-payer-alias.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.usersService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/delete')
  removeWithPassword(
    @Param('id') id: string,
    @Body('password') password: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.removeWithPassword(id, req.user.id, password);
  }

  // ---- Authorized payer aliases (people who pay on a member's behalf) ------

  @Get(':id/payer-aliases')
  listPayerAliases(@Param('id') id: string) {
    return this.usersService.listPayerAliases(id);
  }

  @Post(':id/payer-aliases')
  addPayerAlias(@Param('id') id: string, @Body() dto: AddPayerAliasDto) {
    return this.usersService.addPayerAlias(id, dto.name, dto.note);
  }

  @Delete(':id/payer-aliases/:aliasId')
  removePayerAlias(@Param('id') id: string, @Param('aliasId') aliasId: string) {
    return this.usersService.removePayerAlias(id, aliasId);
  }
}
