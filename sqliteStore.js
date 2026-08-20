'use strict'

const { DatabaseSync } = require('node:sqlite')

class SqliteStore {
  #db
  #get
  #put
  #del
  #range
  #insert
  #delete

  constructor (database) {
    this.#db = typeof database === 'string' ? new DatabaseSync(database) : database
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS key_value (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL
      ) STRICT
    `)
    this.#get = this.#db.prepare('SELECT value FROM key_value WHERE key = ?')
    this.#put = this.#db.prepare('INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)')
    this.#del = this.#db.prepare('DELETE FROM key_value WHERE key = ?')
    this.#range = this.#db.prepare('SELECT value FROM key_value WHERE key > ? AND key < ? ORDER BY key')
    this.#insert = this.#db.prepare('INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)')
    this.#delete = this.#db.prepare('DELETE FROM key_value WHERE key = ?')
  }

  async get (key) {
    const value = this.#get.get(key)?.value
    return value === undefined ? undefined : Buffer.from(value)
  }

  async put (key, value) {
    this.#put.run(key, value)
  }

  async del (key) {
    this.#del.run(key)
  }

  batch (operations) {
    if (operations) {
      this.#db.exec('BEGIN')
      try {
        for (const operation of operations) {
          if (operation.type === 'put') {
            this.#insert.run(operation.key, operation.value)
          } else {
            this.#delete.run(operation.key)
          }
        }
        this.#db.exec('COMMIT')
      } catch (err) {
        this.#db.exec('ROLLBACK')
        throw err
      }
      return Promise.resolve()
    }

    const pending = []
    return {
      del: (key) => pending.push({ type: 'del', key }),
      put: (key, value) => pending.push({ type: 'put', key, value }),
      write: () => this.batch(pending)
    }
  }

  async * values (options) {
    for (const row of this.#range.iterate(options.gt, options.lt)) {
      yield Buffer.from(row.value)
    }
  }

  async close () {
    this.#db.close()
  }
}

module.exports = SqliteStore
