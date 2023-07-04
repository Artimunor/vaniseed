import os from "os";
import fs from "fs";
import cluster from "cluster";
import randomBytes from "randombytes";
import { HDNode, entropyToMnemonic } from "@ethersproject/hdnode";

const patterns = ["0x88888888"];

const numCPUs = os.cpus().length;
const numProcesses = Math.max(1, numCPUs - 1);

let startTime = new Date().getTime();

if (cluster.isPrimary) {
  console.log("Master process started with pid", process.pid);

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

  while (true) {
    mnemonic = entropyToMnemonic(randomBytes(32));
    hdnode = HDNode.fromMnemonic(mnemonic).derivePath("m/44'/60'/0'/0/0");
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
  }
}
