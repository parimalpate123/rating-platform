import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_lines')
export class ProductLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 50 })
  code!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string;

  @Column({ default: 'draft', length: 20 })
  status!: string;

  @Column({ name: 'product_owner', nullable: true, length: 255 })
  productOwner!: string;

  @Column({ name: 'technical_lead', nullable: true, length: 255 })
  technicalLead!: string;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
