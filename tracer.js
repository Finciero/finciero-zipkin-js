const {
  Annotation,
  BatchRecorder,
  ExplicitContext,
  option: { Some, None },
  Tracer,
  TraceId,
} = require('zipkin')
const lodash = require('lodash')
const { KafkaLogger } = require('zipkin-transport-kafka')
const { NOOPLogger } = require('finciero-logger')
const ctxImpl = new ExplicitContext()

// helpers
const containsRequiredMeta = (meta) => {
  if (meta) {
    return meta.traceId !== undefined && meta.spanId !== undefined
  }
  return false
}

const readVal = (val) => {
  if (val != null) {
    return new Some(val)
  }
  return None
}

let instance = null

class TracerJS {
  constructor () {
    this.tracer = new Tracer({
      recorder: new BatchRecorder({
        logger: new KafkaLogger({
          clientOpts: {
            connectionString: process.env.KAFKA_SERVICE_URL,
          },
        }),
      }),
      ctxImpl,
    })
    this.serviceName = undefined
    this.serviceKind = undefined
    this.logger = undefined
    this.port = 0
    this.currentId = undefined
    this.extra = undefined
    this.nextTrace = {
      traceId: undefined,
      spanId: undefined,
      parentId: undefined,
      sampled: undefined,
    }

    if (!instance) {
      instance = this
    }

    return instance
  }

  config ({ name = 'unknown', kind = 'server', logger = NOOPLogger }) {
    this.serviceName = name
    this.serviceKind = kind
    this.logger = logger
  }

  setExtraData (extra) {
    if (typeof extra === 'undefined') {
      throw new Error('Extra data should be an object.')
    }
    this.extra = extra
  }

  setPort (port) {
    this.port = port
  }

  start (meta, method) {
    this.logger.info('tracer:start')

    if (containsRequiredMeta(meta)) {
      // child process
      const { traceId, parentId, spanId, sampled } = meta
      const oldSpanId = readVal(spanId)
      oldSpanId.ifPresent(sid => {
        const id = new TraceId({
          traceId: readVal(traceId),
          parentId: readVal(parentId),
          spanId: sid,
          sampled: readVal(sampled),
          flags: 0,
        })
        this.tracer.setId(id)
      })
    } else {
      this.tracer.setId(
        this.tracer.createRootId()
      )
    }
    this.currentId = this.tracer.id

    const childId = this.tracer.createChildId()
    const { traceId, spanId, parentId, sampled } = childId
    Object.assign(this.nextTrace, {
      traceId,
      spanId,
      parentId,
      sampled,
    })

    this.tracer.recordServiceName(this.serviceName)
    this.tracer.recordRpc(method)
    if (this.extra) {
      Object.keys(this.extra).forEach((prop) => {
        const baggageKeys = ['user-id', 'request-id', 'task-id']
        const isBaggageKey = k => baggageKeys.includes(lodash.kebabCase(k))
        const normalizeKey = k => (
          isBaggageKey(k) ? lodash.snakeCase(k) : `${this.serviceName}.${k}`
        )

        this.tracer.recordBinary(normalizeKey(prop), this.extra[prop])
      })
    }
    this.tracer.recordBinary('Local Component', this.serviceName)
    this.tracer.recordBinary('span.kind', this.serviceKind)
    this.tracer.recordAnnotation(new Annotation.ServerRecv())
    this.tracer.recordAnnotation(new Annotation.LocalAddr({ port: this.port }))
  }

  finish (err) {
    if (err) {
      this.tracer.scoped(() => {
        this.tracer.setId(this.currentId)
        this.tracer.recordBinary(`${this.serviceName}.status`, 'fail')
        this.tracer.recordBinary('error', err.toString())
        this.tracer.recordAnnotation(new Annotation.ServerSend())
      })
    } else {
      this.tracer.scoped(() => {
        this.tracer.setId(this.currentId)
        this.tracer.recordBinary(`${this.serviceName}.status`, 'ok')
        this.tracer.recordAnnotation(new Annotation.ServerSend())
      })
    }

    this.logger.info('tracer:finish')
  }
}

exports = module.exports = {
  default: TracerJS,
  TracerJS,
}
