import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_prompts')
export class AiPromptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text' })
  template: string;

  @Column({ type: 'jsonb', default: '[]' })
  variables: string[];

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'kb_query_template' })
  kbQueryTemplate: string | null;

  @Column({ type: 'int', default: 3, name: 'kb_top_k' })
  kbTopK: number;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
