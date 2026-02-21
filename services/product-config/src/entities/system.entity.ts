import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('systems')
export class SystemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 20 })
  type: string;

  @Column({ length: 20, default: 'json' })
  format: string;

  @Column({ length: 20, default: 'rest' })
  protocol: string;

  @Column({ name: 'base_url', nullable: true, length: 500 })
  baseUrl: string;

  @Column({ name: 'is_mock', default: false })
  isMock: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
