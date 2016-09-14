# Finciero JS Zipkin

[![NPM](https://nodei.co/npm/finciero-zipkin-js.png)](https://nodei.co/npm/finciero-zipkin-js/)

[![npm version](https://badge.fury.io/js/finciero-zipkin-js.svg)](https://badge.fury.io/js/finciero-zipkin-js)

finciero-zipkin-js is an abstraction of [zipkin-js](https://github.com/openzipkin/zipkin-js)
This library let us start a new `zipkin tracer` or continue a `child trace`.

# Config zipkin and kafka.

To use this library you need setup `KAFKA_SERVICE_URL` in your environment variables.
Also, you can use [this](https://github.com/openzipkin/docker-zipkin) to run kafka and zipkin with docker.

# Usage

The basic usage is as follow:

```js
const { TracerJS } = require('finciero-zipkin-js')

const tracer = new TracerJS()
tracer.config({
  name: 'service-name',
  kind: 'service-kind',
  logger: someLogger(),
})
```

then you can start a new trace with:

```js
tracer.start()
```

Or you can pass and object with an old tracer:

```js
const oldTracerData = {
  traceId: 'some-trace-id',
  parentId: 'some-parent-id',
  spanId: 'some-span-id',
  sampled: true,
}
tracer.start(oldTracerData)
```

And this will continue the trace given in the method parameters.

To finish a trace record, just use:

```js
tracer.finish()
```

This will stop the current trace record. If an error happen in your program, you can pass as argument the error and the `finish` method will trace the error, this push the error data to kafka and zipkin.

```js
const err = new Error('awesome error')
tracer.finish(err)
```
