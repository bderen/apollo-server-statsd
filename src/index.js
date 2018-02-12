const os = require('os');
const onFinished = require('on-finished');
const { format } = require('util');
const timer = require('./timer');
const url = require('url');
const appmetrics = require('appmetrics');
const natsClient = require('./natsClient'); 
const dummyClient = require('./dummyClient');
const dummyMonitor = require('./dummyMonitor');

let sendInterval = null;
process.on('exit', function() {
  clearInterval(sendInterval)
})

class Metrics {
  constructor(options = { dummy: true }) {
    this.options = options;
    if (!options.dummy) {
      appmetrics.configure({'mqtt': 'off'})
    }
    this.client = options.dummy ? new dummyClient() : new natsClient();
    this.monitor = options.dummy ? new dummyMonitor() : appmetrics.monitor();
    this.tags = this.options.tags || [];
    this.schemaTags = this.options.schemaTags || false;
    this.resolverTags = this.options.resolverTags || false;
    this.sendAgregatedDataInterval = this.options.sendAgregatedDataInterval || 5000 //send agregate data every X seconds
    this.data = {}
  }

  startMonitor() {
    if (this.options.monitorCPU) {
      this.monitor.on('cpu', (cpu) => {
        this.agregateData('cpu.process', cpu.process)
        this.agregateData('cpu.system', cpu.system)
      });
    }
  
    if (this.options.monitorMEM) {
      this.monitor.on('memory', (memory) => {
        this.agregateData('memory.process.private', memory.private);
        this.agregateData('memory.process.physical', memory.physical);
        this.agregateData('memory.process.virtual', memory.virtual);
        this.agregateData('memory.system.used', memory.physical_used);
        this.agregateData('memory.system.total', memory.physical_total);
      });
    }
  
    if (this.options.monitorEVENTLOOP) {
      this.monitor.on('eventloop', (eventloop) => {
        this.agregateData('eventloop.latency.min', eventloop.latency.min);
        this.agregateData('eventloop.latency.max', eventloop.latency.max);
        this.agregateData('eventloop.latency.avg', eventloop.latency.avg);
      });
    }
    
    if (this.options.monitorGC) {
      this.monitor.on('gc', (gc) => {
        this.agregateData('gc.size', gc.size);
        this.agregateData('gc.used', gc.used);
        this.agregateData('gc.duration', gc.duration);
      });
    }

    this.sendAgregatedData()
  }

  agregateData(name, data) {
    this.data[name] = data;
  }

  sendAgregatedData() {
    const me = this
    sendInterval = setInterval(function(){
      Object.keys(me.data).map(key => {
        me.send(key, me.data[key])
      })
    }, this.sendAgregatedDataInterval)
  }

  send(name, value = 1, tags = []) {
    const _tags = [...tags, ...this.tags]
    const msg = this.formatPayload(name, value, _tags)
    
    this.client.send(msg);
  }

  formatPayload(name, value, tags) {
    let _tags = []
    if (tags && Array.isArray(tags)) {
      _tags = tags.length ? ',' + tags.join(',') : '';
    }
    return `{ "${name}": ${value} ${_tags}}`
  }

  decorateResolver(resolver, fieldInfo) {
    return (p, a, ctx, resolverInfo) => {
      const resolveTimer = new timer().start();
      const context = ctx.graphqlMetricsContext ?
        ctx.graphqlMetricsContext : undefined;

      // Send the resolve stat
      const statResolve = err => {
        let tags = [];
        if (this.resolverTags) {
          if (err) {
            // In case Apollo Error is used, send the err.data.type
            tags.push(format('"error": "%s"', err.data ? err.data.type : err.name))
          }
  
          if (context && context.operation) {
            tags.push(format('"operation": "%s"', context.operation))
          }
  
          if (context && context.type) {
            tags.push(format('"type": "%s"', context.type))
          }
  
          tags.push(format('"resolver": "%s"', fieldInfo.name ? fieldInfo.name : 'undefined'))
        }

        this.send(
          'resolve_time',
          resolveTimer.stop().ms,
          tags
        );
        if (err) {
          this.send('resolve_error', 1, tags);
        }
      };

      // Heavily inspired by:
      // apollographql/optics-agent-js
      // https://git.io/vDL9p

      let result;
      try {
        result = resolver(p, a, ctx, resolverInfo);
      } catch (e) {
        statResolve(e);
        throw e;
      }

      try {
        if (result && typeof result.then === 'function') {
          result.then(res => {
            statResolve();
            return res;
          }).catch(err => {
            statResolve(err);
            throw err;
          });
          return result;
        } else if (Array.isArray(result)) {
          const promises = [];
          result.forEach(value => {
            if (value && typeof value.then === 'function') {
              promises.push(value);
            }
          });
          if (promises.length > 0) {
            Promise.all(promises).then(() => {
              statResolve();
            }).catch(err => {
              statResolve(err);
              throw err;
            });
            return result;
          }
        }

        statResolve();
        return result;
      } catch (e) {
        statResolve(e);
        return result;
      }

      return result;
    };
  }

  decorateSchema(schema) {
    const { getNamedType } = require('graphql');
    const typeMap = schema.getTypeMap();
    Object.keys(typeMap).forEach(typeName => {
      const type = typeMap[typeName];
      if (!getNamedType(type).name.startsWith('__') && type.getFields) {
        const fields = type.getFields();
        Object.keys(fields).forEach(fieldName => {
          const field = fields[fieldName];
          if (field.resolve) {
            field.resolve = this.decorateResolver(field.resolve, field);
          }
        });
      }
    });

    return schema;
  }

  graphqlStatsdMiddleware() {
    return (req, res, next) => {
      const tags = [];
      const t = new timer().start();
      if (this.schemaTags) {
        let operation;
        if (Array.isArray(req.body)) {
          const names = req.body.filter(q => q.operationName).map(q => q.operationName)
          operation = names && names.length ? names.join(',') : 'unknown'
        } else {
          operation = req.body.operationName ? req.body.operationName : 'unknown'
        }

        const referer = req.get('Referer');
        const refererUrl = referer ? url.parse(referer) : null;
        const type = referer ? 'browser' : 'server';
        const page = refererUrl ? refererUrl.pathname : 'unknown';

        const metricsContext = {
          type,
          page,
          operation,
        };

        if (req.context) {
          req.context.graphqlMetricsContext = metricsContext;
        } else {
          req.context = {
            graphqlMetricsContext: metricsContext
          }
        }

        if (metricsContext.type) tags.push(format('"type": "%s"', metricsContext.type))
        if (metricsContext.page) tags.push(format('"page": "%s"', metricsContext.page))
        if (metricsContext.operation) tags.push(format('"operation": "%s"', metricsContext.operation))
      }
      this.send('requests', 1, tags);

      onFinished(res, () => {
        this.send(
          'response_time',
          t.stop().ms,
          tags
        );
      });
      next();
    };
  }
}

module.exports = Metrics