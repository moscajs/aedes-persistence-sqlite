# aedes-persistence-sqlite

![.github/workflows/ci.yml](https://github.com/moscajs/aedes-persistence-sqlite/workflows/.github/workflows/ci.yml/badge.svg)

[Aedes][aedes] [persistence][persistence], backed by the built-in Node.js SQLite module.

See [aedes-persistence][persistence] for the full API, and [Aedes][aedes] for usage.

## Install

```
npm i aedes aedes-persistence-sqlite --save
```

## API

<a name="constructor"></a>
### aedesPersistenceSqlite(database)

Creates a new instance of aedes-persistence-sqlite.
The parameter is a SQLite database filename, or an existing `DatabaseSync` instance from `node:sqlite`.

Example:

```js
const aedesPersistenceSqlite = require('aedes-persistence-sqlite')

// instantiate a persistence instance
aedesPersistenceSqlite('./mydb.sqlite')
```

## License

MIT

[aedes]: https://github.com/mcollina/aedes
[persistence]: https://github.com/mcollina/aedes-persistence
