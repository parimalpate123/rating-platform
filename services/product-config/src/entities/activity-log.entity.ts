import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('activity_log')
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_line_code', length: 50 })
  productLineCode!: string;

  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string;

  @Column({ length: 50, nullable: true })
  action!: string;

  @Column({ length: 255, nullable: true })
  actor!: string;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
