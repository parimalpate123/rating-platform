import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rule_conditions')
export class RuleConditionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'rule_id' })
  ruleId: string;

  @Column({ type: 'varchar', length: 255 })
  field: string;

  @Column({ type: 'varchar', length: 30 })
  operator: string;

  @Column({ type: 'jsonb', nullable: true })
  value: unknown | null;

  @Column({ type: 'int', default: 0, name: 'logical_group' })
  logicalGroup: number;
}
