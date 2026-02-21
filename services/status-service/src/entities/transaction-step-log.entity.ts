import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transaction_step_logs')
export class TransactionStepLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'uuid', nullable: true, name: 'step_id' })
  stepId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'step_type' })
  stepType: string;

  @Column({ type: 'varchar', length: 255, name: 'step_name' })
  stepName: string;

  @Column({ type: 'int', name: 'step_order' })
  stepOrder: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'jsonb', nullable: true, name: 'input_snapshot' })
  inputSnapshot: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'output_snapshot' })
  outputSnapshot: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs: number | null;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;
}
