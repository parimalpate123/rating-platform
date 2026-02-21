import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('field_mappings')
export class FieldMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mapping_id', type: 'uuid' })
  mappingId: string;

  @Column({ name: 'source_path', length: 500 })
  sourcePath: string;

  @Column({ name: 'target_path', length: 500 })
  targetPath: string;

  @Column({ name: 'transformation_type', length: 50, default: 'direct' })
  transformationType: string;

  @Column({ name: 'transform_config', type: 'jsonb', default: {} })
  transformConfig: Record<string, unknown>;

  @Column({ name: 'is_required', default: false })
  isRequired: boolean;

  @Column({ name: 'default_value', nullable: true, length: 500 })
  defaultValue: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
