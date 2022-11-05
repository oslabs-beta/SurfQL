const parser = require('../parser');
import * as path from 'path';
import * as fs from 'fs';


describe('parser module', () => {
  let parserData;
  beforeAll(() => {
    parserData = parser(fs.readFileSync(path.resolve(__dirname, './testingAsset/starWar.ts')));
  });

  test('parsing data successfully', () => {
    expect(parserData.length.toBe(6));
    expect(typeof parserData).toEqual('array');
  });
});