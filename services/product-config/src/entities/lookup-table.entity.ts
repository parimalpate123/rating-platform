import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { LookupEntryEntity } from './lookup-entry.entity';

@Entity('lookup_tables')
export class LookupTableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'product_line_code', nullable: true })
  productLineCode: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => LookupEntryEntity, (e) => e.table, { eager: true, cascade: true })
  entries: LookupEntryEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
