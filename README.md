# apollo-server-statsd

## Installation

```
$ npm install apollo-server-statsd

```

send page views from you web app
```
app.use((req, res, next) => {
  metrics.send('pageview', 1, [`"client": "${_package.name}", "version": "${_package.version}", "page": "${req.path}"`]);
  next()
})

```

initialise metrics and start app monitor
```
const metrics = new _metrics({tags: [`"client": "${_package.name}", "version": "${_package.version}"`]});
metrics.startMonitor()

```

decorate schema
middleware will report resolve time and resolver name + operation name

{ "requests": 1 ,"type": "server","page": "unknown","operation": "Menu"}
{ "response_time": 5.996299 ,"type": "server","page": "unknown","operation": "Menu"}
{ "resolve_time": 0.09399 ,"operation": "App","resolver": "session"}

{ "requests": 1 ,"type": "browser","page": "/sport/","operation": "Articles"}
{ "resolve_time": 0.076701 ,"operation": "Articles","resolver": "getArticles"}

```
const _schema = metrics.decorateSchema(schema);
app.use(
    '/graphql',
    metrics.graphqlStatsdMiddleware(),
    graphqlExpress(request => ({
      schema: _schema,
      context: {},
    }))
  )
```

module uses NATS as a message protocol
it sends data to Telegraf agent which stores data into InfluxDB

than you can use Grafana to build nice dashboards

telegraf.conf
```
[[inputs.nats_consumer]]

    servers = ["nats://127.0.0.1:4222"]

    subjects = ["metrics"]

    queue_group = "metrics"

    name_override = "nats_metrics"

    data_format = "json"

    # tag_keys = [
    #   #host by default
    #   "client", # applicationName
    #   "version", # application version
    #   "instance", # 80, 8080 or 3000, 3001 (port)
    #   "type", # browser or server
    #   "page", # actual website page
    #   "operation", # can be graphql operationName or coma separated list of the operationNames or microservice arbitrary name
    #   "resolver", # resolver function name
    #   "error" # error
    # ]

    tag_keys = [
      "client",
      "version",
      "instance",
      "type",
      "page", 
      "operation",
      "resolver",
      "error" 
    ]
```