import { getNamedType } from 'graphql';
import onFinished from 'on-finished';
import {format} from 'util';
import timer from './timer';
import url from 'url';
import appmetrics from 'appmetrics';
import natsClient from './natsClient'; 
import dummyClient from './dummyClient';
import dummyMonitor from './dummyMonitor';

export default class {
  constructor(options = { dummy: true }) {
    this.options = options;
    this.client = options.dummy ? new dummyClient() : new natsClient();
    this.monitor = options.dummy ? new dummyMonitor() : appmetrics.monitor();
  }

  startMonitor() {
    this.monitor.on('cpu', (cpu) => {
      this.send('cpu.process', cpu.process, this.options.tags);
      this.send('cpu.system', cpu.system, this.options.tags);
    });
  
    this.monitor.on('memory', (memory) => {
      this.send('memory.process.private', memory.private, this.options.tags);
      this.send('memory.process.physical', memory.physical, this.options.tags);
      this.send('memory.process.virtual', memory.virtual, this.options.tags);
      this.send('memory.system.used', memory.physical_used, this.options.tags);
      this.send('memory.system.total', memory.physical_total, this.options.tags);
    });
  
    this.monitor.on('eventloop', (eventloop) => {
      this.send('eventloop.latency.min', eventloop.latency.min, this.options.tags);
      this.send('eventloop.latency.max', eventloop.latency.max, this.options.tags);
      this.send('eventloop.latency.avg', eventloop.latency.avg, this.options.tags);
    });
  
    this.monitor.on('gc', (gc) => {
      this.send('gc.size', gc.size, this.options.tags);
      this.send('gc.used', gc.used, this.options.tags);
      this.send('gc.duration', gc.duration, this.options.tags);
    });
  }

  send(name, value = 1, tags) {
    const msg = this.formatPayload(name, value, tags)
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

      if (!context) {
        console.warn('graphqlStatsd: Context is undefined!');
      }

      // Send the resolve stat
      const statResolve = err => {
        let tags = [];

        if (err) {
          // In case Apollo Error is used, send the err.data.type
          tags.push(format('"error": "%s"', err.data ? err.data.type : err.name))
        }

        if (context && context.operation) {
          tags.push(format('"operation": "%s"', context.operation))
        }

        tags.push(format('"resolver": "%s"', fieldInfo.name ? fieldInfo.name : 'undefined'))

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

      const t = new timer().start();
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

      const tags = [];

      if (metricsContext.type) tags.push(format('"type": "%s"', metricsContext.type))
      if (metricsContext.page) tags.push(format('"page": "%s"', metricsContext.page))
      if (metricsContext.operation) tags.push(format('"operation": "%s"', metricsContext.operation))
      

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