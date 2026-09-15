const test = require('node:test')
const assert = require('node:assert/strict')
const persistence = require('../persistence.js')
const abs = require('aedes-persistence/abstract')
const { randomUUID } = require('node:crypto')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { mkdirSync } = require('node:fs')
const { once } = require('node:events')

function tempDir () {
  const dir = join(tmpdir(), 'aedes-persistence-sqlite-test', randomUUID())
  mkdirSync(dir, { recursive: true })
  return join(dir, 'persistence.sqlite')
}

// setup() scans every subscription, so a query issued before 'ready' races that
// scan; wait it out to keep these tests deterministic
function ready (instance) {
  return instance.ready ? Promise.resolve() : once(instance, 'ready')
}

abs({
  test,
  persistence () {
    return persistence(tempDir())
  }
})

test('restore', t => {
  const db = tempDir()
  const instance = persistence(db)
  const client = {
    id: 'abcde'
  }

  const subs = [{
    topic: 'hello',
    qos: 1
  }, {
    topic: 'hello/#',
    qos: 1
  }, {
    topic: 'matteo',
    qos: 1
  }]

  instance.addSubscriptions(client, subs, err => {
    assert.ok(!err, 'no error')
    const instance2 = persistence(db)
    instance2.subscriptionsByTopic('hello', (err, resubs) => {
      assert.ok(!err, 'no error')
      assert.deepEqual(resubs, [{
        clientId: client.id,
        topic: 'hello/#',
        qos: 1,
        rh: undefined,
        rap: undefined,
        nl: undefined
      }, {
        clientId: client.id,
        topic: 'hello',
        qos: 1,
        rh: undefined,
        rap: undefined,
        nl: undefined
      }])
      instance.destroy()
    })
  })
})

test('outgoing update after enqueuing a possible offline message', t => {
  const db = tempDir()
  const instance = persistence(db)
  const client = {
    clientId: 'abcde'
  }

  const client1 = {
    id: 'abcde'
  }

  const packet = {
    cmd: 'publish',
    brokerId: 'adasdasd',
    brokerCounter: 0,
    topic: 'test',
    payload: 'Return of the Jedi',
    messageId: 7
  }

  const updatePacket = {
    cmd: 'pubrel',
    messageId: 7
  }
  // Enqueue an offline packet
  instance.outgoingEnqueue(client, packet, (err, packet1) => {
    assert.ifError(err)
    // When the client comes back online, aedes calls emptyQueue which calls outgoingUpdate
    instance.outgoingUpdate(client1, packet, (err, client, packet) => {
      assert.ok(!err, 'no error')
      // When pubrel is published, outgoingUpdate is called again without the broker Id
      instance.outgoingUpdate(client, updatePacket, (err, client, packet) => {
        assert.ok(!err, 'no error')
        instance.destroy()
      })
    })
  })
})

test('Dont replace subscriptions with different QoS if client id is different', t => {
  const db = tempDir()
  const instance = persistence(db)
  const client = {
    id: 'test'
  }

  const client1 = {
    id: 'test.1'
  }

  const sub1 = [{
    topic: 'test/+/dev/#',
    qos: 2
  }]

  const sub2 = [{
    topic: 'test/television/dev/about',
    qos: 1
  }]

  instance.addSubscriptions(client, sub1, err => {
    assert.ok(!err, 'no error')
    instance.addSubscriptions(client1, sub2, err => {
      assert.ok(!err, 'no error')
      instance.subscriptionsByTopic('test/television/dev/about', (err, resubs) => {
        assert.ok(!err, 'no error')
        assert.deepEqual(resubs, [{
          topic: 'test/television/dev/about',
          clientId: 'test.1',
          qos: 1,
          rh: undefined,
          rap: undefined,
          nl: undefined
        }, {
          topic: 'test/+/dev/#',
          clientId: 'test',
          qos: 2,
          rh: undefined,
          rap: undefined,
          nl: undefined
        }])
        instance.destroy()
      })
    })
  })
})

test('Replace subscriptions with different QoS if client id is same', t => {
  const db = tempDir()
  const instance = persistence(db)
  const client = {
    id: 'test'
  }

  const sub1 = [{
    topic: 'test/+/dev/#',
    qos: 2
  }]

  const sub2 = [{
    topic: 'test/television/dev/about',
    qos: 1
  }]

  instance.addSubscriptions(client, sub1, err => {
    assert.ok(!err, 'no error')
    instance.addSubscriptions(client, sub2, err => {
      assert.ok(!err, 'no error')
      instance.subscriptionsByTopic('test/television/dev/about', (err, resubs) => {
        assert.ok(!err, 'no error')
        assert.deepEqual(resubs, [{
          topic: 'test/television/dev/about',
          clientId: 'test',
          qos: 1,
          rh: undefined,
          rap: undefined,
          nl: undefined
        }])
        instance.destroy()
      })
    })
  })
})

test('cleanIncoming does not touch a client whose id is a prefix of another', async t => {
  const instance = persistence(tempDir())
  instance.broker = { id: 'test' }

  const client = { id: 'ab' }
  const other = { id: 'abc' }

  const packet = {
    cmd: 'publish',
    topic: 'hello',
    payload: Buffer.from('world'),
    qos: 2,
    dup: false,
    length: 14,
    retain: false,
    messageId: 42
  }

  await instance.incomingStorePacket(client, packet)
  await instance.incomingStorePacket(other, packet)
  await instance.cleanIncoming(client)

  await assert.rejects(
    instance.incomingGetPacket(client, { messageId: packet.messageId }),
    'the cleaned client must have no incoming packets left'
  )
  const retrieved = await instance.incomingGetPacket(other, { messageId: packet.messageId })
  assert.equal(retrieved.messageId, packet.messageId, 'other client must not be touched')

  await instance.destroy()
})

// a '\xff' upper bound would only cover ASCII suffixes, hiding every topic
// from U+0100 up
test('retained messages on non-ASCII topics are streamed back', async t => {
  const instance = persistence(tempDir())
  instance.broker = { id: 'test' }

  const topics = ['ascii/t', '\u00fc/t', '\u0100/t', '\u0410/t', '\u4e2d/t', '\ud83d\ude00/t']
  for (const topic of topics) {
    await instance.storeRetained({
      cmd: 'publish',
      topic,
      payload: Buffer.from('world'),
      qos: 0,
      retain: true
    })
  }

  const streamed = []
  for await (const packet of instance.createRetainedStream('#')) {
    streamed.push(packet.topic)
  }
  assert.deepEqual(streamed.sort(), [...topics].sort(), 'every retained topic must come back')

  await instance.destroy()
})

// Each per-client prefix ends at ':' so a scan cannot spill into a client whose
// id merely extends it. The abstract suite only uses ids that share no prefix
// ('abcde'/'fghij'), so it cannot catch any of this.
test('subscriptionsByClient does not return a client whose id extends it', async t => {
  const instance = persistence(tempDir())
  instance.broker = { id: 'test' }
  await ready(instance)

  await instance.addSubscriptions({ id: 'abc' }, [{ topic: 'secret/abc', qos: 1 }])
  await instance.addSubscriptions({ id: 'abcde' }, [{ topic: 'secret/abcde', qos: 1 }])

  const subs = await instance.subscriptionsByClient({ id: 'abc' })
  assert.deepEqual(subs.map(sub => sub.topic), ['secret/abc'], 'must not see abcde subscriptions')

  await instance.destroy()
})

test('outgoingStream does not return a client whose id extends it', async t => {
  const instance = persistence(tempDir())
  instance.broker = { id: 'test' }
  await ready(instance)

  await instance.outgoingEnqueue({ clientId: 'abcde' }, {
    cmd: 'publish',
    topic: 'secret/abcde',
    payload: Buffer.from('private'),
    qos: 1,
    brokerId: 'brk',
    brokerCounter: 1,
    messageId: 7
  })

  const streamed = []
  for await (const packet of instance.outgoingStream({ id: 'abc' })) {
    streamed.push(packet.topic)
  }
  assert.deepEqual(streamed, [], 'must not see abcde queued packets')

  await instance.destroy()
})

// terminating the prefix puts the raw topic first after it, so a bad upper
// bound would hide every non-ASCII subscription instead of just mis-scoping it
test('subscriptions on non-ASCII topics survive lookup and clean', async t => {
  const instance = persistence(tempDir())
  instance.broker = { id: 'test' }
  await ready(instance)

  const client = { id: 'abc' }
  const topics = ['ascii/a', '\u00e9/x', '\u00ff/x', '\u0100/x', '\u0442\u0435\u043c\u0430', '\u4e3b\u9898', '\ud83d\ude00/x']
  await instance.addSubscriptions(client, topics.map(topic => ({ topic, qos: 1 })))

  const subs = await instance.subscriptionsByClient(client)
  assert.deepEqual(subs.map(sub => sub.topic).sort(), [...topics].sort(), 'every topic must come back')

  await instance.cleanSubscriptions(client)
  assert.deepEqual(await instance.subscriptionsByClient(client), [], 'clean must leave nothing behind')

  await instance.destroy()
})
