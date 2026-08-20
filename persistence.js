'use strict'

const { CallBackPersistence } = require('aedes-persistence/callBackPersistence.js')
const AsyncPersistence = require('./asyncPersistence.js')
const SqliteStore = require('./sqliteStore.js')
const asyncInstanceFactory = (database) => new AsyncPersistence(new SqliteStore(database))
module.exports = (opts) => new CallBackPersistence(asyncInstanceFactory, opts)
