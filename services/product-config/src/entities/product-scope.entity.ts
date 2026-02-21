import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('product_scopes')
export class ProductScopeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_line_code', length: 50 })
  productLineCode: string;

  @Column({ name: 'scope_type', length: 30 })
  scopeType: string;

  @Column({ name: 'scope_value', length: 100 })
  scopeValue: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
