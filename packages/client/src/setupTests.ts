/* eslint-disable import/first */
// We need to import after calling jest.mock in this file...
import { GlobalWithFetchMock } from "jest-fetch-mock";
import resolve from "resolve";

const customGlobal: GlobalWithFetchMock = global as GlobalWithFetchMock;
customGlobal.fetch = require("jest-fetch-mock");
customGlobal.fetchMock = customGlobal.fetch;

import { mocked } from "ts-jest/utils";
jest.mock("shuffle-array");
const commonShuffleLocation = resolve.sync("shuffle-array", {
  basedir: "../common",
});
jest.mock(commonShuffleLocation);
import shuffle from "shuffle-array";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const commonShuffle = require(commonShuffleLocation) as typeof shuffle;
// Our mock shuffle reverses the list being shuffled rather than doing anything random
mocked(shuffle).mockImplementation(arr => arr.reverse());
mocked(commonShuffle).mockImplementation(arr => arr.reverse());
