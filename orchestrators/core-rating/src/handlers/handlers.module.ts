import { Module, OnModuleInit } from '@nestjs/common';
import { StepHandlerRegistry } from '../registry/step-handler.registry';
import { FieldMappingHandler } from './field-mapping.handler';
import { ApplyRulesHandler } from './apply-rules.handler';
import { FormatTransformHandler } from './format-transform.handler';
import { CallRatingEngineHandler } from './call-rating-engine.handler';
import { PublishEventHandler } from './publish-event.handler';

@Module({
  providers: [
    FieldMappingHandler,
    ApplyRulesHandler,
    FormatTransformHandler,
    CallRatingEngineHandler,
    PublishEventHandler,
  ],
  exports: [FieldMappingHandler, ApplyRulesHandler, FormatTransformHandler, CallRatingEngineHandler, PublishEventHandler],
})
export class HandlersModule implements OnModuleInit {
  constructor(
    private readonly registry: StepHandlerRegistry,
    private readonly fieldMapping: FieldMappingHandler,
    private readonly applyRules: ApplyRulesHandler,
    private readonly formatTransform: FormatTransformHandler,
    private readonly callRatingEngine: CallRatingEngineHandler,
    private readonly publishEvent: PublishEventHandler,
  ) {}

  onModuleInit() {
    this.registry.register(this.fieldMapping);
    this.registry.register(this.applyRules);
    this.registry.register(this.formatTransform);
    this.registry.register(this.callRatingEngine);
    this.registry.register(this.publishEvent);
  }
}
