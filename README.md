# aedes-persistence-sqlite

[![ci](https://github.com/moscajs/aedes-persistence-sqlite/actions/workflows/ci.yml/badge.svg)](https://github.com/moscajs/aedes-persistence-sqlite/actions/workflows/ci.yml)

[Aedes][aedes] [persistence][persistence], backed by the built-in Node.js SQLite
module.

See [aedes-persistence][persistence] for the full API, and [Aedes][aedes] for
usage.

## Install

```
npm i aedes aedes-persistence-sqlite --save
```

## API

<a name="constructor"></a>

### aedesPersistenceSqlite(database)

Creates a new instance of aedes-persistence-sqlite. The parameter is a SQLite
database filename, or an existing `DatabaseSync` instance from `node:sqlite`. As
standard with `node:sqlite` you can pass `:memory:` as filename to get an
in-memory only database.

Example:

```js
const aedesPersistenceSqlite = require("aedes-persistence-sqlite");

// instantiate a persistence instance
aedesPersistenceSqlite('./mydb.sqlite');
```

## License

MIT

[aedes]: https://github.com/moscajs/aedes
[persistence]: https://github.com/moscajs/aedes-persistence
