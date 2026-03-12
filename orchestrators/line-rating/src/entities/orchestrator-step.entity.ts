import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orchestrator_steps')
export class OrchestratorStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'orchestrator_id' })
  orchestratorId!: string;

  @Column({ type: 'int', name: 'step_order' })
  stepOrder!: number;

  @Column({ type: 'varchar', length: 50, name: 'step_type' })
  stepType!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true, unique: true, name: 'config_key' })
  configKey!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'default_next_step_id' })
  defaultNextStepId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
