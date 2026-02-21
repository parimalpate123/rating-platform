import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('entity_scope_tags')
export class ScopeTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'varchar', length: 30, name: 'scope_type' })
  scopeType: string;

  @Column({ type: 'varchar', length: 100, name: 'scope_value' })
  scopeValue: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
