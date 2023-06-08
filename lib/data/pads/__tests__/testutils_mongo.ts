// @ts-ignore
import {MongoMemoryReplSet} from 'mongodb-memory-server';

//Use MongoMemoryReplSet (vs MongoMemoryServer) for testing transaction
let mongod: MongoMemoryReplSet;

export async function start() {
  // Takes a while for MongoMemoryServer to start
  // jest.setTimeout(10000);
  mongod = await MongoMemoryReplSet.create({
    binary: {
      version: '5.0.5',
    },
  });
  return mongod;
}

export async function stop() {
  await mongod.stop();
}

// @ts-ignore
test('', () => {
  // @ts-ignore
  expect(MongoMemoryReplSet).toBeDefined();
});
