import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LookupTableEntity } from './lookup-table.entity';

@Entity('lookup_entries')
export class LookupEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lookup_table_id' })
  lookupTableId: string;

  @ManyToOne(() => LookupTableEntity, (t) => t.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lookup_table_id' })
  table: LookupTableEntity;

  @Column()
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
