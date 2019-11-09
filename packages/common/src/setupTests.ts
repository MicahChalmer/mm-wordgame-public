/* eslint-disable import/first */
// We need to import after calling jest.mock in this file...

import { mocked } from "ts-jest/utils";

jest.mock("shuffle-array");
import shuffle from "shuffle-array";
// Our mock shuffle reverses the list being shuffled rather than doing anything random
mocked(shuffle).mockImplementation(arr => arr.reverse());
