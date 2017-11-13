import { getNamedType } from 'graphql';
import timer from './timer'

export default class {
  get sampleRate() {
    return this._sampleRate ? this._sampleRate : 1;
  }

  set sampleRate(value) {
    this._sampleRate = value;
  }

  decorateResolver(resolver, fieldInfo) {
    return (p, a, ctx, resolverInfo) => {
      const t = new timer()
      const resolveTimer = t.start();
      const context = ctx.graphqlStatsdContext ?
        ctx.graphqlStatsdContext : undefined;

      if (!context) {
        console.warn('graphqlStatsd: Context is undefined!');
      }

      // Send the resolve stat
      const statResolve = err => {
        let tags = [];
        if (fieldInfo.statsdTags)
          tags = tags.concat(fieldInfo.statsdTags);

        if (err) {
          // In case Apollo Error is used, send the err.data.type
          tags.push(format('error:%s', err.data ? err.data.type : err.name));
        }

        if (context) {
          tags.push(format('queryHash:%s', context.queryHash));
          tags.push(format('operationName:%s', context.operationName));
        }
        tags.push(format('resolveName:%s', fieldInfo.name ?
          fieldInfo.name : 'undefined'));

        this.statsdClient.timing(
          'resolve_time',
          resolveTimer.stop().ms,
          this.sampleRate,
          tags
        );
        if (err) {
          this.statsdClient.increment('resolve_error', 1, this.sampleRate, tags);
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
}