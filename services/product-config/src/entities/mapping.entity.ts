import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('mappings')
export class MappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'product_line_code', length: 50 })
  productLineCode!: string;

  @Column({ length: 20, default: 'request' })
  direction!: string;

  @Column({ length: 20, default: 'draft' })
  status!: string;

  @Column({ name: 'created_by', length: 100, default: 'System' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
