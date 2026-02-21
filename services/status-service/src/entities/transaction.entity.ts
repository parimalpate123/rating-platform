import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, name: 'correlation_id' })
  correlationId!: string;

  @Column({ type: 'varchar', length: 50, name: 'product_line_code' })
  productLineCode!: string;

  @Column({ type: 'varchar', length: 20, default: 'RECEIVED' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'request_payload' })
  requestPayload!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'response_payload' })
  responsePayload!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: {}, nullable: true })
  scope!: Record<string, unknown> | null;

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'premium_result',
  })
  premiumResult!: number | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage!: string | null;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs!: number | null;

  @Column({ type: 'int', default: 0, name: 'step_count' })
  stepCount!: number;

  @Column({ type: 'int', default: 0, name: 'completed_steps' })
  completedSteps!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
