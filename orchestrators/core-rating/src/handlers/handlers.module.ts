import { Module, OnModuleInit } from '@nestjs/common';
import { StepHandlerRegistry } from '../registry/step-handler.registry';
import { RegistryModule } from '../registry/registry.module';
import { FieldMappingHandler } from './field-mapping.handler';
import { ApplyRulesHandler } from './apply-rules.handler';
import { FormatTransformHandler } from './format-transform.handler';
import { CallRatingEngineHandler } from './call-rating-engine.handler';
import { PublishEventHandler } from './publish-event.handler';
import { ValidateRequestHandler } from './validate-request.handler';
import { CallExternalApiHandler } from './call-external-api.handler';
import { EnrichHandler } from './enrich.handler';
import { GenerateValueHandler } from './generate-value.handler';
import { RunCustomFlowHandler } from './run-custom-flow.handler';
import { RunScriptHandler } from './run-script.handler';

@Module({
  imports: [RegistryModule],
  providers: [
    FieldMappingHandler,
    ApplyRulesHandler,
    FormatTransformHandler,
    CallRatingEngineHandler,
    PublishEventHandler,
    ValidateRequestHandler,
    CallExternalApiHandler,
    EnrichHandler,
    GenerateValueHandler,
    RunCustomFlowHandler,
    RunScriptHandler,
  ],
  exports: [
    FieldMappingHandler,
    ApplyRulesHandler,
    FormatTransformHandler,
    CallRatingEngineHandler,
    PublishEventHandler,
    ValidateRequestHandler,
    CallExternalApiHandler,
    EnrichHandler,
    GenerateValueHandler,
    RunCustomFlowHandler,
    RunScriptHandler,
  ],
})
export class HandlersModule implements OnModuleInit {
  constructor(
    private readonly registry: StepHandlerRegistry,
    private readonly fieldMapping: FieldMappingHandler,
    private readonly applyRules: ApplyRulesHandler,
    private readonly formatTransform: FormatTransformHandler,
    private readonly callRatingEngine: CallRatingEngineHandler,
    private readonly publishEvent: PublishEventHandler,
    private readonly validateRequest: ValidateRequestHandler,
    private readonly callExternalApi: CallExternalApiHandler,
    private readonly enrich: EnrichHandler,
    private readonly generateValue: GenerateValueHandler,
    private readonly runCustomFlow: RunCustomFlowHandler,
    private readonly runScript: RunScriptHandler,
  ) {}

  onModuleInit() {
    this.registry.register(this.fieldMapping);
    this.registry.register(this.applyRules);
    this.registry.register(this.formatTransform);
    this.registry.register(this.callRatingEngine);
    this.registry.register(this.publishEvent);
    this.registry.register(this.validateRequest);
    this.registry.register(this.callExternalApi);
    this.registry.register(this.enrich);
    this.registry.register(this.generateValue);
    this.registry.register(this.runCustomFlow);
    this.registry.register(this.runScript);
  }
}
