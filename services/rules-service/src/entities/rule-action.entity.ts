import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rule_actions')
export class RuleActionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'rule_id' })
  ruleId!: string;

  @Column({ type: 'varchar', length: 30, name: 'action_type' })
  actionType!: string;

  @Column({ type: 'varchar', length: 255, name: 'target_field' })
  targetField!: string;

  @Column({ type: 'jsonb', nullable: true })
  value!: unknown | null;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder!: number;
}
