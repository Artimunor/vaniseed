import os from "os";
import fs from "fs";
import cluster from "cluster";
import randomBytes from "randombytes";
import { HDNode, entropyToMnemonic } from "@ethersproject/hdnode";
import { stdout as lg } from "single-line-log";

let iterations = 0;
let intervalM = 0;
let intervalHD = 0;
let intervalMatch = 0;
let startT;
let mnemonicT = 0;
let hdT = 0;
let matchT = 0;

const patterns = [
  "0x00000000",
  "0x11111111",
  "0x22222222",
  "0x33333333",
  "0x44444444",
  "0x55555555",
  "0x66666666",
  "0x77777777",
  "0x88888888",
  "0x99999999",
];

// const patterns = ["0x00000000"];

const numCPUs = os.cpus().length;
const numProcesses = Math.max(1, numCPUs - 1);

let startTime = new Date().getTime();

if (cluster.isPrimary) {
  console.log("Primary process started with pid", process.pid);

  for (let i = 0; i < numProcesses; i++) {
    const mineWorker = cluster.fork({ alias: "Miner " + i });

    mineWorker.on("message", (message) => {
      const { address, privatekey, mnemonic } = message;
      console.log(
        `Found address ${address} in ${Math.floor(
          (new Date().getTime() - startTime) / 1000
        )} seconds`
      );
      startTime = new Date().getTime();
      try {
        fs.writeFileSync(
          "wallets.txt",
          address + "\n" + privatekey + "\n" + mnemonic + "\n\n",
          { flag: "a+" }
        );
      } catch (err) {
        console.error(err);
      }
    });
  }
} else {
  console.log(
    `${process.env.alias} started looking for patterns: [${patterns}]`
  );

  let mnemonic = "";
  let privateKey = "";
  let hdnode: HDNode;
  const starttT = new Date().getTime();

  while (true) {
    startT = new Date().getTime();

    mnemonic = entropyToMnemonic(randomBytes(32));

    intervalM = new Date().getTime();
    mnemonicT += intervalM - startT;

    hdnode = HDNode.fromMnemonic(mnemonic).derivePath("m/44'/60'/0'/0/0");

    intervalHD = new Date().getTime();
    hdT += intervalHD - intervalM;

    privateKey = hdnode.privateKey;

    patterns.forEach((search) => {
      if (hdnode.address.indexOf(search) === 0) {
        if (process) {
          (<any>process).send({
            address: hdnode.address,
            privatekey: privateKey,
            mnemonic: mnemonic,
          });
        }
      }
    });
    matchT += new Date().getTime() - intervalHD;
    iterations += 1;

    if (process.env.alias === "Miner 1") {
      lg(
        `Count: ${iterations}, Total: ${
          new Date().getTime() - starttT
        }, Mnemonic: ${mnemonicT}, hd: ${hdT}, match: ${matchT}`
      );
    }
  }
}
